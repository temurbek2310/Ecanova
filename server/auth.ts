import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { normalizeBookmarkedCourseIds } from '../src/lib/course-bookmarks.ts';
import { sanitizeRedirectTo } from '../src/lib/auth-routing.ts';
import { db, isDatabaseConfigured, runInTransaction } from './db.ts';
import type { LocaleCode, UserRole, UserSummary } from '../src/shared/types.ts';
import { STAFF_ROLES } from '../src/shared/econova-rules.ts';

let cachedFallbackSecret: string | null = null;
let warnedMissingSecret = false;

export function isSessionSecretConfigured(): boolean {
  const secret = (process.env.SESSION_SECRET || '').trim();
  return Boolean(secret && secret !== 'CHANGE_ME_FOR_PRODUCTION' && secret.length >= 16);
}

/**
 * Throws when the server would sign sessions without a real secret in production.
 * Called once at startup so a misconfigured deploy fails fast instead of issuing
 * tokens signed with a throwaway key.
 */
export function assertSessionSecretForProduction(): void {
  if (process.env.NODE_ENV === 'production' && !isSessionSecretConfigured()) {
    throw new Error(
      '[ECONOVA] SESSION_SECRET must be set (16+ random characters) when NODE_ENV=production.'
    );
  }
}

function getSessionSecret(): string {
  if (isSessionSecretConfigured()) {
    return process.env.SESSION_SECRET!.trim();
  }
  if (!cachedFallbackSecret) {
    // Random per-process key: never derivable from source or configuration.
    // Sessions do not survive a restart and are not shared across instances.
    cachedFallbackSecret = crypto.randomBytes(32).toString('hex');
    if (!warnedMissingSecret && process.env.NODE_ENV !== 'test') {
      warnedMissingSecret = true;
      console.warn(
        '[ECONOVA] SESSION_SECRET is unset; using a random per-process secret. Sessions reset on restart.'
      );
    }
  }
  return cachedFallbackSecret;
}

export const COOKIE_NAME = 'econova_session';
export const CLIENT_COOKIE_NAME = 'econova_client_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSION_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 6; // Refresh whenever < 6 days remain

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (candidate.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(candidate, storedBuf);
}

export function signSessionToken(payload: {
  userId: string;
  exp: number;
  role?: UserRole;
}): string {
  const secret = getSessionSecret();
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string
): { userId: string; exp: number; role?: UserRole } | null {
  const secret = getSessionSecret();
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      userId: string;
      exp: number;
      role?: UserRole;
    };
    if (!parsed.userId || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function isSecureRequest(req?: Request): boolean {
  if (req) {
    if (req.secure) return true;
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (typeof forwardedProto === 'string' && forwardedProto.includes('https')) {
      return true;
    }
    const origin = req.headers.origin || req.headers.referer || '';
    if (typeof origin === 'string' && origin.startsWith('https://')) {
      return true;
    }
  }
  if ((process.env.APP_URL || '').startsWith('https://')) {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

export function setSessionCookie(
  res: Response,
  userId: string,
  req?: Request,
  role?: UserRole
): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const token = signSessionToken({ userId, exp, role });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
  return token;
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const secure = isSecureRequest(req);
  res.clearCookie(COOKIE_NAME, { path: '/', sameSite: 'lax', secure });
  // Legacy JS-readable cookie from earlier builds; cleared so stale tokens disappear.
  res.clearCookie(CLIENT_COOKIE_NAME, { path: '/', sameSite: 'lax', secure });
  res.clearCookie(CLIENT_COOKIE_NAME, { path: '/', sameSite: 'none', secure: true });
}

export function extractSessionTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

export async function loadUserSummaryById(userId: string): Promise<UserSummary | null> {
  const row = await db.queryOne<{
    id: string;
    email: string;
    role: UserRole;
    display_name: string;
    preferred_locale: 'en' | 'uz';
    timezone: string;
    age_band: 'school' | 'university' | 'independent';
    leaderboard_opt_in: boolean;
    leaderboard_pseudonym: string;
    consent_accepted_at: string | Date | null;
    daily_study_goal_minutes: number | null;
    study_goal_notifications_enabled: boolean | null;
    weekly_digest_email_enabled: boolean | null;
    lesson_notes_json: unknown;
    bookmarked_course_ids: unknown;
  }>(
    `SELECT u.id, u.email, u.role, p.display_name, p.preferred_locale, p.timezone,
            p.age_band, p.leaderboard_opt_in, p.leaderboard_pseudonym, p.consent_accepted_at,
            p.daily_study_goal_minutes, p.study_goal_notifications_enabled,
            p.weekly_digest_email_enabled, p.lesson_notes_json,
            p.bookmarked_course_ids
     FROM users u
     JOIN learner_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (!row) return null;
  const consentStr =
    row.consent_accepted_at instanceof Date
      ? row.consent_accepted_at.toISOString()
      : row.consent_accepted_at;

  let lessonNotes: Record<string, string> = {};
  if (
    row.lesson_notes_json &&
    typeof row.lesson_notes_json === 'object' &&
    !Array.isArray(row.lesson_notes_json)
  ) {
    for (const [k, v] of Object.entries(row.lesson_notes_json as Record<string, unknown>)) {
      if (typeof v === 'string' && k.trim()) {
        lessonNotes[k.trim()] = v;
      }
    }
  } else if (typeof row.lesson_notes_json === 'string') {
    try {
      const parsed = JSON.parse(row.lesson_notes_json) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === 'string' && k.trim()) {
            lessonNotes[k.trim()] = v;
          }
        }
      }
    } catch {
      lessonNotes = {};
    }
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    preferredLocale: row.preferred_locale,
    timezone: row.timezone,
    ageBand: row.age_band,
    leaderboardOptIn: Boolean(row.leaderboard_opt_in),
    leaderboardPseudonym: row.leaderboard_pseudonym,
    consentAcceptedAt: consentStr ?? null,
    dailyStudyGoalMinutes: Number(row.daily_study_goal_minutes ?? 30),
    studyGoalNotificationsEnabled: Boolean(row.study_goal_notifications_enabled),
    weeklyDigestEmailEnabled: Boolean(row.weekly_digest_email_enabled),
    lessonNotes,
    bookmarkedCourseIds: normalizeBookmarkedCourseIds(row.bookmarked_course_ids),
  };
}

// --- Login / registration throttling ---

const AUTH_RATE_WINDOW_MS = 1000 * 60 * 15;
/** Failures allowed per window for one email (targets password guessing on one account). */
const AUTH_MAX_FAILURES_PER_EMAIL = 10;
/** Failures allowed per window from one IP (high enough for a shared school/campus NAT). */
const AUTH_MAX_FAILURES_PER_IP = 100;
const authFailureBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function throttleKeys(req: Request, scope: string, email?: string) {
  const keys: Array<{ key: string; max: number }> = [
    { key: `${scope}:ip:${clientIp(req)}`, max: AUTH_MAX_FAILURES_PER_IP },
  ];
  if (email) keys.push({ key: `${scope}:email:${email}`, max: AUTH_MAX_FAILURES_PER_EMAIL });
  return keys;
}

/**
 * Returns seconds to wait when this IP or email has too many recent failures,
 * otherwise null. In-memory and per-process: use a shared store (e.g. Redis)
 * before running more than one instance.
 */
export function getAuthThrottleRetryAfter(
  req: Request,
  scope: string,
  email?: string
): number | null {
  const now = Date.now();
  let retryAfter: number | null = null;
  for (const { key, max } of throttleKeys(req, scope, email)) {
    const bucket = authFailureBuckets.get(key);
    if (bucket && bucket.resetAt > now && bucket.count >= max) {
      retryAfter = Math.max(retryAfter ?? 0, Math.ceil((bucket.resetAt - now) / 1000));
    }
  }
  return retryAfter;
}

export function recordAuthFailure(req: Request, scope: string, email?: string): void {
  const now = Date.now();
  if (authFailureBuckets.size > 10_000) {
    for (const [key, bucket] of authFailureBuckets) {
      if (bucket.resetAt <= now) authFailureBuckets.delete(key);
    }
  }
  for (const { key } of throttleKeys(req, scope, email)) {
    const bucket = authFailureBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      authFailureBuckets.set(key, { count: 1, resetAt: now + AUTH_RATE_WINDOW_MS });
    } else {
      bucket.count += 1;
    }
  }
}

/** Clears the per-email counter after a successful sign-in (the IP counter is kept). */
export function clearAuthFailuresForEmail(scope: string, email: string): void {
  authFailureBuckets.delete(`${scope}:email:${email}`);
}

export function __resetAuthThrottleForTests(): void {
  authFailureBuckets.clear();
}

export interface AuthenticatedRequest extends Request {
  authUser?: UserSummary;
  sessionToken?: string;
}

export async function attachOptionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isDatabaseConfigured()) {
    next();
    return;
  }
  try {
    const raw = extractSessionTokenFromRequest(req);
    if (raw) {
      const verified = verifySessionToken(raw);
      if (verified) {
        const user = await loadUserSummaryById(verified.userId);
        if (user) {
          req.authUser = user;
          const timeRemaining = verified.exp - Date.now();
          if (timeRemaining < SESSION_REFRESH_THRESHOLD_MS) {
            req.sessionToken = setSessionCookie(res, user.id, req, user.role);
          } else {
            req.sessionToken = raw;
          }
        }
      }
    }
  } catch {
    // Do not crash request pipeline if DB probe fails
  }
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}

/**
 * Returns middleware that allows the request only when the verified session
 * user holds one of `allowedRoles`: 401 when unauthenticated, 403 otherwise.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  if (allowedRoles.length === 0) {
    throw new Error('requireRole needs at least one allowed role.');
  }
  const allowed = new Set<UserRole>(allowedRoles);
  return function requireRoleMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowed.has(req.authUser.role)) {
      res.status(403).json({
        error: `This action requires one of these roles: ${allowedRoles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}

/** General staff guard: editor, reviewer, publisher or admin. */
export function requireStaffRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!STAFF_ROLES.includes(req.authUser.role)) {
    res.status(403).json({ error: 'Staff editorial permission required.' });
    return;
  }
  next();
}

/** Admin-only guard for system actions (role management, imports, etc.). */
export const requireAdmin = requireRole('admin');

// --- Google OAuth 2.0 Utilities ---

export function getGoogleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || '').trim();
}

export function getGoogleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || '').trim();
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function getGoogleOAuthRedirectUri(req: Request, clientOrigin?: string): string {
  const envAppUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envAppUrl) {
    return `${envAppUrl}/auth/callback`;
  }
  if (clientOrigin && /^https?:\/\//i.test(clientOrigin)) {
    return `${clientOrigin.replace(/\/+$/, '')}/auth/callback`;
  }
  const proto = isSecureRequest(req) ? 'https' : 'http';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}/auth/callback`;
}

export const OAUTH_NONCE_COOKIE_NAME = 'econova_oauth_nonce';
const OAUTH_STATE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export function createOAuthNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/** Short-lived HttpOnly cookie that binds the OAuth `state` to the browser that started sign-in. */
export function setOAuthNonceCookie(res: Response, nonce: string, req?: Request): void {
  res.cookie(OAUTH_NONCE_COOKIE_NAME, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/',
    maxAge: OAUTH_STATE_TTL_MS,
  });
}

export function clearOAuthNonceCookie(res: Response, req?: Request): void {
  res.clearCookie(OAUTH_NONCE_COOKIE_NAME, {
    path: '/',
    sameSite: 'lax',
    secure: isSecureRequest(req),
  });
}

export function buildGoogleOAuthState(payload: {
  redirectTo: string;
  locale: LocaleCode;
  nonce: string;
}): string {
  const secret = getSessionSecret();
  const data = {
    redirectTo: sanitizeRedirectTo(payload.redirectTo, '/overview'),
    locale: payload.locale === 'uz' ? 'uz' : 'en',
    nonce: payload.nonce,
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verifies the signed OAuth `state` and that its nonce matches the browser's
 * nonce cookie. Returns null when anything is missing, forged, expired or
 * started in a different browser.
 */
export function verifyGoogleOAuthState(
  stateToken: string | undefined,
  expectedNonce: string | undefined
): { redirectTo: string; locale: LocaleCode } | null {
  if (!stateToken || typeof stateToken !== 'string') return null;
  if (!expectedNonce || typeof expectedNonce !== 'string') return null;
  const parts = stateToken.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const secret = getSessionSecret();
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  const sigBuf = Buffer.from(parts[1]);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
      redirectTo?: string;
      locale?: LocaleCode;
      nonce?: string;
      exp?: number;
    };
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
    if (typeof parsed.nonce !== 'string') return null;
    const nonceBuf = Buffer.from(parsed.nonce);
    const expectedNonceBuf = Buffer.from(expectedNonce);
    if (
      nonceBuf.length !== expectedNonceBuf.length ||
      !crypto.timingSafeEqual(nonceBuf, expectedNonceBuf)
    ) {
      return null;
    }
    return {
      redirectTo: sanitizeRedirectTo(parsed.redirectTo, '/overview'),
      locale: parsed.locale === 'uz' ? 'uz' : 'en',
    };
  } catch {
    return null;
  }
}

export function buildGoogleOAuthAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  redirectTo: string;
  locale: LocaleCode;
  nonce: string;
}): string {
  const state = buildGoogleOAuthState({
    redirectTo: params.redirectTo,
    locale: params.locale,
    nonce: params.nonce,
  });
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

export async function upsertGoogleOAuthUser(profile: {
  email: string;
  displayName: string;
  preferredLocale?: LocaleCode;
  timezone?: string;
}): Promise<UserSummary> {
  const cleanEmail = profile.email.trim().toLowerCase();
  const cleanName = (profile.displayName || cleanEmail.split('@')[0] || 'Google Scholar').trim();
  const safeLocale: LocaleCode = profile.preferredLocale === 'uz' ? 'uz' : 'en';
  const safeTimezone = profile.timezone || 'Asia/Tashkent';

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [cleanEmail]
  );

  if (existing) {
    const loaded = await loadUserSummaryById(existing.id);
    if (loaded) return loaded;
  }

  const userId = `usr-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const pseudonym = `Scholar-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const randomOAuthPasswordHash = hashPassword(crypto.randomBytes(24).toString('hex'));

  await runInTransaction(async (tx) => {
    await tx.execute(
      'INSERT INTO users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
      [userId, cleanEmail, randomOAuthPasswordHash, 'learner', now]
    );
    const createdRow = await tx.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    );
    const finalUserId = createdRow?.id || userId;
    await tx.execute(
      `INSERT INTO learner_profiles (
        user_id, display_name, preferred_locale, timezone, age_band,
        leaderboard_opt_in, leaderboard_pseudonym, consent_accepted_at, consent_version
      ) VALUES ($1, $2, $3, $4, 'university', FALSE, $5, $6, 'v1')
      ON CONFLICT (user_id) DO NOTHING`,
      [finalUserId, cleanName, safeLocale, safeTimezone, pseudonym, now]
    );
  });

  const finalRow = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [cleanEmail]
  );
  const summary = finalRow ? await loadUserSummaryById(finalRow.id) : null;
  if (!summary) {
    throw new Error('Unable to provision Google OAuth learner profile.');
  }
  return summary;
}
