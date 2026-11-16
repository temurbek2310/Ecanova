import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, isDatabaseConfigured } from './db.ts';
import type { UserRole, UserSummary } from '../src/shared/types.ts';

let ephemeralDevSecret: string | null = null;
let warnedMissingSecret = false;

export function isSessionSecretConfigured(): boolean {
  const secret = (process.env.SESSION_SECRET || '').trim();
  return Boolean(secret && secret !== 'CHANGE_ME_FOR_PRODUCTION' && secret.length >= 16);
}

function getSessionSecret(): string {
  if (isSessionSecretConfigured()) {
    return process.env.SESSION_SECRET!.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is not configured for production. Configure a 32+ byte random secret in AI Studio Secrets or Cloud Run.'
    );
  }
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString('hex');
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        '[ECONOVA] SESSION_SECRET is unset; using an in-memory ephemeral dev secret (sessions reset on server restart).'
      );
    }
  }
  return ephemeralDevSecret;
}

const COOKIE_NAME = 'econova_session';

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

function signToken(payload: { userId: string; exp: number }): string {
  const secret = getSessionSecret();
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): { userId: string; exp: number } | null {
  if (!isSessionSecretConfigured() && process.env.NODE_ENV === 'production') {
    return null;
  }
  const secret = getSessionSecret();
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
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
    };
    if (!parsed.userId || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

export function setSessionCookie(res: Response, userId: string): void {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const token = signToken({ userId, exp });
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
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
  }>(
    `SELECT u.id, u.email, u.role, p.display_name, p.preferred_locale, p.timezone,
            p.age_band, p.leaderboard_opt_in, p.leaderboard_pseudonym, p.consent_accepted_at
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
  };
}

export interface AuthenticatedRequest extends Request {
  authUser?: UserSummary;
}

export async function attachOptionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!isDatabaseConfigured()) {
    next();
    return;
  }
  try {
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[COOKIE_NAME];
    if (raw) {
      const verified = verifyToken(raw);
      if (verified) {
        const user = await loadUserSummaryById(verified.userId);
        if (user) {
          req.authUser = user;
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

export function requireStaffRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const allowed: UserRole[] = ['editor', 'reviewer', 'publisher', 'admin'];
  if (!allowed.includes(req.authUser.role)) {
    res.status(403).json({ error: 'Staff editorial permission required.' });
    return;
  }
  next();
}
