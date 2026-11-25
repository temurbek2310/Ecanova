import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import QRCode from 'qrcode';
import {
  OAUTH_NONCE_COOKIE_NAME,
  assertSessionSecretForProduction,
  attachOptionalAuth,
  buildGoogleOAuthAuthorizeUrl,
  clearAuthFailuresForEmail,
  clearOAuthNonceCookie,
  clearSessionCookie,
  createOAuthNonce,
  getAuthThrottleRetryAfter,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleOAuthRedirectUri,
  hashPassword,
  isGoogleOAuthConfigured,
  isSessionSecretConfigured,
  loadUserSummaryById,
  parseCookies,
  recordAuthFailure,
  requireAuth,
  requireAdmin,
  setOAuthNonceCookie,
  setSessionCookie,
  upsertGoogleOAuthUser,
  verifyGoogleOAuthState,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  evaluateMiddlewareRouteGuard,
  resolveGuardRedirectTarget,
  sanitizeRedirectTo,
  withAccessNotice,
} from './src/lib/auth-routing.ts';
import {
  isAiConfigured,
  runAiChat,
  runAiImageGeneration,
  type AiChatMessage,
} from './server/ai.ts';
import {
  applyMigrations,
  db,
  isDatabaseConfigured,
  runInTransaction,
  type SqlExecutor,
} from './server/db.ts';
import { seedIfEmpty } from './server/seed.ts';
import {
  completionRejectedResponse,
  computeMinDwellSeconds,
  decideLessonCompletion,
  invalidEvidenceResponse,
  LESSON_STARTED_MARKER,
  parseLessonEvidence,
  type ProgressRowFacts,
} from './server/lesson-progress-policy.ts';
import {
  calculateAssessmentScore,
  calculateEligibleXp,
  authorizeEditorialTransition,
  authorizeRoleChange,
  canTransitionEditorialState,
  evaluateCertificateVerification,
  evaluateCourseCompletion,
  evaluateStreakUpdate,
  formatLocalDateKey,
  normalizeSimulationType,
  normalizeUserRole,
  XP_RULE_VERSION,
} from './src/shared/econova-rules.ts';
import { parseDailyGoalMinutes } from './src/lib/study-goal.ts';
import { buildOwnerCertificateVerification } from './src/lib/certificate-verification.ts';
import {
  normalizeBookmarkedCourseIds,
  toggleBookmarkedCourseId,
} from './src/lib/course-bookmarks.ts';
import {
  getCurrentWeekWindow,
  rankWeeklyQuizAttempts,
  type RawQuizAttemptRow,
} from './src/lib/quiz-leaderboard.ts';
import type {
  AssessmentPublic,
  CourseCatalogItem,
  CourseEditionSummary,
  EditorialSignoffType,
  EditorialStatus,
  KeyTerm,
  LessonBlock,
  LessonPublic,
  LocaleCode,
  ProvenanceSummary,
  QuestionPublic,
  QuestionWithKey,
} from './src/shared/types.ts';

let initPromise: Promise<boolean> | null = null;
let dbUnavailable = false;

async function ensureDbReady(): Promise<boolean> {
  if (!isDatabaseConfigured() || dbUnavailable) return false;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        if (process.env.AUTO_MIGRATE !== 'false') {
          await applyMigrations();
        }
        await seedIfEmpty();
        return true;
      } catch (err) {
        dbUnavailable = true;
        console.warn('Database initialization failed; falling back to stubbed mode:', err instanceof Error ? err.message : err);
        return false;
      }
    })();
  }
  return initPromise;
}

function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function loadPublishedLessonForProgress(lessonId: string) {
  return db.queryOne<{
    id: string;
    title: string;
    edition_id: string;
    course_id: string;
    locale: LocaleCode;
    version: number;
    estimated_minutes: number;
  }>(
    `SELECT l.id, l.title, l.edition_id, l.estimated_minutes, ce.course_id, ce.locale, ce.version
     FROM lessons l
     JOIN course_editions ce ON ce.id = l.edition_id
     WHERE l.id = $1 AND ce.status = 'published'`,
    [lessonId]
  );
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

function parseJsonCol<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

function toIso(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

async function getProvenance(id: string | null, exec: SqlExecutor = db): Promise<ProvenanceSummary | null> {
  if (!id) return null;
  const row = await exec.queryOne<{
    id: string;
    source_title: string;
    author_creator: string;
    original_url: string;
    publisher_platform: string;
    license_basis: string;
    attribution_text: string;
    commercial_allowed: boolean;
    adaptation_allowed: boolean;
    translation_allowed: boolean;
    ai_assisted: boolean;
    ai_model: string | null;
    prompt_version: string | null;
    reviewed_by: string | null;
    reviewed_at: string | Date | null;
    notes: string;
  }>('SELECT * FROM provenance_records WHERE id = $1', [id]);
  if (!row) return null;
  return {
    id: row.id,
    sourceTitle: row.source_title,
    authorCreator: row.author_creator,
    originalUrl: row.original_url,
    publisherPlatform: row.publisher_platform,
    licenseBasis: row.license_basis,
    attributionText: row.attribution_text,
    commercialAllowed: Boolean(row.commercial_allowed),
    adaptationAllowed: Boolean(row.adaptation_allowed),
    translationAllowed: Boolean(row.translation_allowed),
    aiAssisted: Boolean(row.ai_assisted),
    aiModel: row.ai_model,
    promptVersion: row.prompt_version,
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    notes: row.notes,
  };
}

async function mapEditionSummary(
  row: Record<string, unknown>,
  exec: SqlExecutor = db
): Promise<CourseEditionSummary> {
  const [lessonStats, lessonTitleRows] = await Promise.all([
    exec.queryOne<{ cnt: number; mins: number }>(
      `SELECT COUNT(*)::int as cnt, COALESCE(SUM(estimated_minutes), 0)::int as mins
       FROM lessons WHERE edition_id = $1`,
      [String(row.id)]
    ),
    exec.query<{ title: string }>(
      `SELECT title FROM lessons WHERE edition_id = $1 ORDER BY sequence_num ASC`,
      [String(row.id)]
    ),
  ]);

  return {
    id: String(row.id),
    courseId: String(row.course_id),
    locale: row.locale as LocaleCode,
    version: Number(row.version),
    title: String(row.title),
    subtitle: String(row.subtitle),
    description: String(row.description),
    outcomes: parseJsonCol<string[]>(row.outcomes_json, []),
    prerequisites: parseJsonCol<string[]>(row.prerequisites_json, []),
    completionRules: String(row.completion_rules),
    passingScorePercent: Number(row.passing_score_percent),
    status: row.status as EditorialStatus,
    subjectReviewerId: row.subject_reviewer_id ? String(row.subject_reviewer_id) : null,
    languageReviewerId: row.language_reviewer_id ? String(row.language_reviewer_id) : null,
    rightsReviewerId: row.rights_reviewer_id ? String(row.rights_reviewer_id) : null,
    publishedAt: toIso(row.published_at),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    lessonCount: Number(lessonStats?.cnt ?? 0),
    lessonTitles: lessonTitleRows.map((l) => String(l.title)),
    estimatedMinutes: Number(lessonStats?.mins ?? 0),
    provenance: await getProvenance(row.provenance_id ? String(row.provenance_id) : null, exec),
  };
}

async function getXpEarnedToday(
  userId: string,
  timeZone: string,
  exec: SqlExecutor = db
): Promise<number> {
  const todayLocal = formatLocalDateKey(new Date(), timeZone);
  const rows = await exec.query<{ amount: number; created_at: string | Date }>(
    "SELECT amount, created_at FROM xp_ledger WHERE user_id = $1 AND status = 'valid' AND amount > 0",
    [userId]
  );
  return rows
    .filter((r) => formatLocalDateKey(new Date(r.created_at), timeZone) === todayLocal)
    .reduce((acc, r) => acc + Number(r.amount), 0);
}

async function awardXpIdempotent(
  params: {
    userId: string;
    eventType: 'lesson_completed' | 'assessment_passed' | 'course_completed' | 'referral_reward';
    referenceId: string;
    idempotencyKey: string;
    description: string;
    timeZone: string;
  },
  exec: SqlExecutor = db
): Promise<{ awarded: number; reason: string }> {
  const existing = await exec.queryOne<{ id: string }>(
    'SELECT id FROM xp_ledger WHERE idempotency_key = $1',
    [params.idempotencyKey]
  );
  const xpEarnedToday = await getXpEarnedToday(params.userId, params.timeZone, exec);
  const decision = calculateEligibleXp({
    eventType: params.eventType,
    alreadyAwardedForIdempotencyKey: Boolean(existing),
    xpEarnedToday,
  });
  if (decision.eligibleAmount <= 0) {
    return { awarded: 0, reason: decision.reason };
  }
  await exec.execute(
    `INSERT INTO xp_ledger (
      id, user_id, event_type, reference_id, amount, status, idempotency_key,
      rule_version, description, created_at
    ) VALUES ($1, $2, $3, $4, $5, 'valid', $6, $7, $8, $9)
    ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      uid('xp'),
      params.userId,
      params.eventType,
      params.referenceId,
      decision.eligibleAmount,
      params.idempotencyKey,
      XP_RULE_VERSION,
      params.description,
      new Date().toISOString(),
    ]
  );
  return { awarded: decision.eligibleAmount, reason: decision.reason };
}

async function awardBadgeIdempotent(
  userId: string,
  badgeKey: string,
  title: string,
  criteria: string,
  exec: SqlExecutor = db
): Promise<void> {
  const key = `badge:${userId}:${badgeKey}`;
  await exec.execute(
    `INSERT INTO badge_awards (id, user_id, badge_key, title, criteria, awarded_at, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [uid('bdg'), userId, badgeKey, title, criteria, new Date().toISOString(), key]
  );
}

async function recordMeaningfulActivityStreak(
  userId: string,
  timeZone: string,
  exec: SqlExecutor = db
): Promise<void> {
  const todayLocal = formatLocalDateKey(new Date(), timeZone);
  const row = await exec.queryOne<{
    current_streak: number;
    best_streak: number;
    last_activity_local_date: string | null;
  }>('SELECT * FROM streak_records WHERE user_id = $1', [userId]);

  const updated = evaluateStreakUpdate({
    lastActivityLocalDate: row?.last_activity_local_date ?? null,
    currentStreak: row?.current_streak ?? 0,
    bestStreak: row?.best_streak ?? 0,
    todayLocalDate: todayLocal,
  });

  if (row) {
    await exec.execute(
      `UPDATE streak_records
       SET current_streak = $1, best_streak = $2, last_activity_local_date = $3, timezone = $4
       WHERE user_id = $5`,
      [updated.currentStreak, updated.bestStreak, updated.lastActivityLocalDate, timeZone, userId]
    );
  } else {
    await exec.execute(
      `INSERT INTO streak_records (user_id, current_streak, best_streak, last_activity_local_date, timezone)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, updated.currentStreak, updated.bestStreak, updated.lastActivityLocalDate, timeZone]
    );
  }

  if (updated.currentStreak >= 3) {
    await awardBadgeIdempotent(
      userId,
      'streak_3',
      'Consistent Scholar (3-Day Streak)',
      'Complete verified learning actions across 3 consecutive days.',
      exec
    );
  }
}

async function reconcileCourseCompletionAndCertificate(
  params: {
    userId: string;
    courseId: string;
    locale: LocaleCode;
    timeZone: string;
  },
  exec: SqlExecutor = db
): Promise<{
  journeyStatus: string;
  certificateIssuedNow: boolean;
  certificateToken: string | null;
}> {
  const course = await exec.queryOne<{ id: string; subject: string; level: string }>(
    'SELECT id, subject, level FROM courses WHERE id = $1',
    [params.courseId]
  );
  const edition = await exec.queryOne<{
    id: string;
    version: number;
    title: string;
    passing_score_percent: number;
  }>(
    `SELECT id, version, title, passing_score_percent
     FROM course_editions
     WHERE course_id = $1 AND locale = $2 AND status = 'published'
     ORDER BY version DESC LIMIT 1`,
    [params.courseId, params.locale]
  );

  if (!course || !edition) {
    return { journeyStatus: 'not_started', certificateIssuedNow: false, certificateToken: null };
  }

  const requiredLessons = await exec.query<{ id: string }>(
    'SELECT id FROM lessons WHERE edition_id = $1 AND is_required = TRUE',
    [edition.id]
  );
  const requiredLessonIds = requiredLessons.map((l) => l.id);

  const completedRows = await exec.query<{ lesson_id: string }>(
    `SELECT lp.lesson_id FROM lesson_progress lp
     JOIN lessons l ON l.id = lp.lesson_id
     WHERE lp.user_id = $1 AND l.edition_id = $2 AND lp.state = 'completed'`,
    [params.userId, edition.id]
  );
  const completedLessonIds = completedRows.map((r) => r.lesson_id);

  const assessment = await exec.queryOne<{ id: string }>(
    'SELECT id FROM assessments WHERE edition_id = $1 ORDER BY version DESC LIMIT 1',
    [edition.id]
  );

  let bestScorePercent: number | null = null;
  if (assessment) {
    const bestRow = await exec.queryOne<{ best: number | null }>(
      'SELECT MAX(score_percent)::int as best FROM assessment_attempts WHERE user_id = $1 AND assessment_id = $2',
      [params.userId, assessment.id]
    );
    bestScorePercent = bestRow?.best ?? null;
  }

  const enrollment = await exec.queryOne<{
    id: string;
    paused_at: string | Date | null;
    completed_at: string | Date | null;
  }>('SELECT id, paused_at, completed_at FROM enrollments WHERE user_id = $1 AND course_id = $2', [
    params.userId,
    params.courseId,
  ]);

  const decision = evaluateCourseCompletion({
    requiredLessonIds,
    completedLessonIds,
    passingScorePercent: edition.passing_score_percent,
    bestScorePercent,
    hasAssessment: Boolean(assessment),
    isPaused: Boolean(enrollment?.paused_at),
  });

  const now = new Date().toISOString();
  if (enrollment) {
    await exec.execute(
      `UPDATE enrollments
       SET journey_status = $1, completed_at = COALESCE(completed_at, $2)
       WHERE id = $3`,
      [decision.journeyStatus, decision.isCompleted ? now : null, enrollment.id]
    );
  } else {
    await exec.execute(
      `INSERT INTO enrollments (id, user_id, course_id, locale, journey_status, enrolled_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uid('enr'),
        params.userId,
        params.courseId,
        params.locale,
        decision.journeyStatus,
        now,
        decision.isCompleted ? now : null,
      ]
    );
  }

  let certificateIssuedNow = false;
  let certificateToken: string | null = null;

  if (decision.isCompleted) {
    const existingCert = await exec.queryOne<{ public_token: string }>(
      'SELECT public_token FROM certificates WHERE user_id = $1 AND course_id = $2 AND edition_version = $3',
      [params.userId, params.courseId, edition.version]
    );

    if (existingCert) {
      certificateToken = existingCert.public_token;
    } else {
      const profile = await exec.queryOne<{ display_name: string }>(
        'SELECT display_name FROM learner_profiles WHERE user_id = $1',
        [params.userId]
      );
      certificateToken = `ECONOVA-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      await exec.execute(
        `INSERT INTO certificates (
          id, user_id, course_id, edition_id, edition_version, locale,
          recipient_display_name, course_title, subject, level, public_token,
          status, share_enabled, issued_at, template_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'valid', FALSE, $12, 'cert-template-v1')`,
        [
          uid('cert'),
          params.userId,
          params.courseId,
          edition.id,
          edition.version,
          params.locale,
          profile?.display_name || 'Learner',
          edition.title,
          course.subject,
          course.level,
          certificateToken,
          now,
        ]
      );
      certificateIssuedNow = true;

      await awardXpIdempotent(
        {
          userId: params.userId,
          eventType: 'course_completed',
          referenceId: `${params.courseId}:${params.locale}:v${edition.version}`,
          idempotencyKey: `course:${params.userId}:${params.courseId}:v${edition.version}`,
          description: `Completed course: ${edition.title}`,
          timeZone: params.timeZone,
        },
        exec
      );

      await awardBadgeIdempotent(
        params.userId,
        `course_complete_${course.subject.toLowerCase()}`,
        `${course.subject} Finisher`,
        `Complete all required lessons and pass the assessment in a ${course.subject} course.`,
        exec
      );
    }
  }

  return {
    journeyStatus: decision.journeyStatus,
    certificateIssuedNow,
    certificateToken,
  };
}

const DATABASE_UNAVAILABLE_ERROR =
  'The learning database is temporarily unavailable. Please try again shortly.';

/** Real 503 instead of serving stub/sample data when the DB can't be reached. */
function respondDatabaseUnavailable(res: Response): void {
  res.status(503).json({ error: DATABASE_UNAVAILABLE_ERROR, code: 'database_unavailable' });
}

function requireDatabase(req: Request, res: Response, next: NextFunction): void {
  if (!isDatabaseConfigured()) {
    res.status(503).json({
      error:
        'Supabase PostgreSQL is not configured yet. Set SUPABASE_DB_URL (or DATABASE_URL) in AI Studio Settings > Secrets and apply supabase/migrations/*.sql.',
    });
    return;
  }
  ensureDbReady()
    .then((ready) => (ready ? next() : respondDatabaseUnavailable(res)))
    .catch((err) => {
      console.error('Database initialization error:', err);
      res.status(503).json({
        error: 'Unable to initialize Supabase PostgreSQL connection. Verify credentials and migrations.',
      });
    });
}

// True inside a Vercel Serverless Function. There the platform owns the HTTP
// listener and the CDN serves dist/, so this module only exports `app`.
const isServerless = Boolean(process.env.VERCEL);

/**
 * Builds the Express app with every API/auth route registered. It is
 * synchronous so `app` can be exported at module load for serverless use;
 * listening, static files and the Vite dev middleware live in startLocalServer().
 */
export function buildApp(): express.Express {
  assertSessionSecretForProduction();
  const app = express();
  // One proxy hop (Vercel edge / Cloud Run load balancer) so req.ip, req.secure,
  // x-forwarded-proto (secure cookies) and OAuth redirect URLs reflect the real client.
  app.set('trust proxy', 1);
  if (isServerless) {
    // Cold starts finish DB init (migrations + seed check) before any handler or
    // session lookup runs. ensureDbReady() memoizes a single initPromise per
    // instance, so warm invocations reuse it instead of re-running migrations.
    app.use((_req: Request, _res: Response, next: NextFunction) => {
      ensureDbReady().then(() => next(), next);
    });
  }
  app.use(express.json({ limit: '1mb' }));
  app.use(asyncHandler(attachOptionalAuth));

  // Healthcheck (exposes only safe boolean configuration flags, never secrets)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ok: true,
      service: 'econova',
      database: 'supabase_postgresql',
      databaseConfigured: isDatabaseConfigured(),
      sessionConfigured: isSessionSecretConfigured(),
      googleOAuthConfigured: isGoogleOAuthConfigured(),
      aiConfigured: isAiConfigured(),
    });
  });

  // --- AUTH ---
  app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.authUser) {
      res.json({
        id: req.authUser.id,
        name: req.authUser.displayName,
        role: req.authUser.role,
        hasPassword: req.authUser.hasPassword ?? false,
        user: req.authUser,
      });
      return;
    }
    res.json({ user: null });
  });

  const sendThrottled = (res: Response, retryAfter: number) => {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Too many attempts. Please wait a few minutes and try again.',
      retryAfterSeconds: retryAfter,
    });
  };

  app.post(
    '/api/auth/register',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const { email, password, displayName, preferredLocale, ageBand, timezone } = req.body as {
        email?: string;
        password?: string;
        displayName?: string;
        preferredLocale?: LocaleCode;
        ageBand?: 'school' | 'university' | 'independent';
        timezone?: string;
      };
      const cleanEmail = (email ?? '').trim().toLowerCase();
      const cleanName = (displayName ?? '').trim();
      const registerRetry = getAuthThrottleRetryAfter(req, 'register');
      if (registerRetry !== null) {
        sendThrottled(res, registerRetry);
        return;
      }
      // Every registration attempt counts toward the per-IP budget; this caps both
      // bulk sign-ups and probing which emails already have accounts.
      recordAuthFailure(req, 'register');
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (!password || password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      if (cleanName.length < 2) {
        res.status(400).json({ error: 'Display name must be at least 2 characters.' });
        return;
      }

      const existingUser = await db.queryOne<{ id: string; password_hash: string | null }>(
        'SELECT id, password_hash FROM users WHERE email = $1',
        [cleanEmail]
      );
      if (existingUser) {
        if (!existingUser.password_hash || !existingUser.password_hash.trim()) {
          res.status(409).json({
            error: 'This account uses Google Sign-In. Please sign in with Google.',
            code: 'GOOGLE_ONLY_ACCOUNT',
          });
          return;
        }
        res.status(409).json({
          error: 'An account with this email already exists.',
          code: 'EMAIL_ALREADY_EXISTS',
        });
        return;
      }

      const userId = uid('usr');
      const now = new Date().toISOString();
      const safeLocale: LocaleCode = preferredLocale === 'uz' ? 'uz' : 'en';
      const safeAge = ageBand === 'school' || ageBand === 'university' ? ageBand : 'independent';
      const pseudonym = `Scholar-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      await runInTransaction(async (tx) => {
        await tx.execute(
          'INSERT INTO users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)',
          [userId, cleanEmail, hashPassword(password), 'learner', now]
        );
        await tx.execute(
          `INSERT INTO learner_profiles (
            user_id, display_name, preferred_locale, timezone, age_band,
            leaderboard_opt_in, leaderboard_pseudonym, consent_accepted_at, consent_version
          ) VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, 'v1')`,
          [userId, cleanName, safeLocale, timezone || 'Asia/Tashkent', safeAge, pseudonym, now]
        );
      });

      const user = await loadUserSummaryById(userId);
      setSessionCookie(res, userId, req, user?.role);
      res.status(201).json({ user });
    })
  );

  app.post(
    '/api/auth/login',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as { email?: string; password?: string };
      const cleanEmail = (email ?? '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }
      const loginRetry = getAuthThrottleRetryAfter(req, 'login', cleanEmail);
      if (loginRetry !== null) {
        sendThrottled(res, loginRetry);
        return;
      }
      const row = await db.queryOne<{ id: string; password_hash: string | null }>(
        'SELECT id, password_hash FROM users WHERE email = $1',
        [cleanEmail]
      );
      if (row && (!row.password_hash || !row.password_hash.trim())) {
        recordAuthFailure(req, 'login', cleanEmail);
        res.status(409).json({
          error: 'This account uses Google Sign-In. Please sign in with Google.',
          code: 'GOOGLE_ONLY_ACCOUNT',
        });
        return;
      }
      if (!row || !row.password_hash || !verifyPassword(password, row.password_hash)) {
        recordAuthFailure(req, 'login', cleanEmail);
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      clearAuthFailuresForEmail('login', cleanEmail);
      const user = await loadUserSummaryById(row.id);
      setSessionCookie(res, row.id, req, user?.role);
      res.json({ user });
    })
  );

  app.post(
    '/api/auth/password',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.authUser) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const origin = req.headers.origin;
      if (origin) {
        try {
          const originHost = new URL(origin).host;
          const reqHost = req.headers.host;
          if (reqHost && originHost !== reqHost) {
            res.status(403).json({ error: 'Cross-origin request forbidden.' });
            return;
          }
        } catch {
          res.status(403).json({ error: 'Invalid origin header.' });
          return;
        }
      }
      const throttleRetry = getAuthThrottleRetryAfter(req, 'password', req.authUser.email);
      if (throttleRetry !== null) {
        sendThrottled(res, throttleRetry);
        return;
      }

      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }

      const userRow = await db.queryOne<{ id: string; password_hash: string | null }>(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [req.authUser.id]
      );

      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const hasExistingPassword = Boolean(
        userRow.password_hash && userRow.password_hash.trim().length > 0
      );

      if (hasExistingPassword) {
        if (!currentPassword || typeof currentPassword !== 'string') {
          res.status(400).json({ error: 'Current password is required.' });
          return;
        }
        if (!verifyPassword(currentPassword, userRow.password_hash!)) {
          recordAuthFailure(req, 'password', req.authUser.email);
          res.status(403).json({ error: 'Current password does not match.' });
          return;
        }
      }

      const newHash = hashPassword(newPassword);
      await db.execute('UPDATE users SET password_hash = $1 WHERE id = $2', [
        newHash,
        req.authUser.id,
      ]);

      clearAuthFailuresForEmail('password', req.authUser.email);

      try {
        await db.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uid('aud'),
            req.authUser.id,
            hasExistingPassword ? 'auth.password_changed' : 'auth.password_set',
            'user',
            req.authUser.id,
            hasExistingPassword
              ? 'Password changed by authenticated user'
              : 'Initial password set from Google-only account',
            new Date().toISOString(),
          ]
        );
      } catch (auditErr) {
        console.warn('Failed to record password audit event:', auditErr);
      }

      res.json({ ok: true, hasPassword: true });
    })
  );

  // Google OAuth 2.0 URL Builder (opens Google's authorization endpoint directly in popup)
  app.get(['/api/auth/google/url', '/api/auth/url'], (req, res) => {
    const redirectTo = sanitizeRedirectTo(
      typeof req.query.redirectTo === 'string' ? req.query.redirectTo : '/overview',
      '/overview'
    );
    const locale: LocaleCode = req.query.locale === 'uz' ? 'uz' : 'en';
    const clientOrigin = typeof req.query.origin === 'string' ? req.query.origin : undefined;
    const redirectUri = getGoogleOAuthRedirectUri(req, clientOrigin);
    const clientId = getGoogleClientId();
    const configured = isGoogleOAuthConfigured();

    if (!configured || !clientId) {
      res.json({
        configured: false,
        redirectUri,
        url: null,
      });
      return;
    }

    const nonce = createOAuthNonce();
    setOAuthNonceCookie(res, nonce, req);
    const url = buildGoogleOAuthAuthorizeUrl({
      clientId,
      redirectUri,
      redirectTo,
      locale,
      nonce,
    });
    res.json({
      configured: true,
      redirectUri,
      url,
    });
  });

  // Google OAuth 2.0 Callback Handler. Signs the user in only after a verified
  // code exchange, then notifies the same-origin opener window (popup flow) or
  // redirects (full-page flow). The session token never reaches page scripts.
  const renderOAuthResultPage = (
    res: Response,
    locale: LocaleCode,
    message: string,
    payload: Record<string, unknown>,
    fallbackHref: string
  ) => {
    // Escape '<' so user-controlled strings (e.g. a Google display name) cannot close the script tag.
    const serializedPayload = JSON.stringify(payload).replace(/</g, '\\u003c');
    const serializedHref = JSON.stringify(fallbackHref).replace(/</g, '\\u003c');
    const safeMessage = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`<!DOCTYPE html>
<html lang="${locale === 'uz' ? 'uz' : 'en'}">
  <head>
    <meta charset="utf-8" />
    <title>ECONOVA — Google sign-in</title>
  </head>
  <body style="background:#080B14;color:#F3F6FC;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
    <div style="border:2px solid #222B3D;background:#101522;padding:24px 32px;border-radius:12px;">
      <p style="margin:0;font-weight:700;">${safeMessage}</p>
    </div>
    <script>
      (function() {
        var payload = ${serializedPayload};
        var fallbackHref = ${serializedHref};
        try { window.localStorage.removeItem('econova_session_token'); } catch (e) {}

        // 1. BroadcastChannel across all same-origin tabs/windows (works even when opener is severed)
        try {
          if (typeof window.BroadcastChannel === 'function') {
            var channel = new BroadcastChannel('econova_oauth');
            channel.postMessage(payload);
            channel.close();
          }
        } catch (e) {}

        // 2. Storage event fallback for cross-window notification
        try {
          window.localStorage.setItem('econova_oauth_result', JSON.stringify({
            payload: payload,
            timestamp: Date.now()
          }));
        } catch (e) {}

        // 3. postMessage to opener (if accessible)
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, window.location.origin);
          }
        } catch (e) {}

        // 4. If opened as a popup window, close cleanly
        var isPopup = false;
        try {
          isPopup = Boolean(window.opener || window.name === 'econova_google_oauth');
        } catch (e) {}

        if (isPopup) {
          try {
            window.close();
          } catch (e) {}
        }

        // 5. If not in a popup, or if window.close was prevented by the browser, replace location
        window.setTimeout(function() {
          if (!window.closed) {
            window.location.replace(fallbackHref);
          }
        }, 120);
      })();
    </script>
  </body>
</html>`);
  };

  const googleCallbackHandler = asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
    const nonce = parseCookies(req.headers.cookie)[OAUTH_NONCE_COOKIE_NAME];
    const state = verifyGoogleOAuthState(stateParam, nonce);
    clearOAuthNonceCookie(res, req);

    const locale: LocaleCode = state?.locale ?? 'en';
    const fail = (reason: string) => {
      res.status(400);
      renderOAuthResultPage(
        res,
        locale,
        'Google sign-in failed. Please return to ECONOVA and try again.',
        { type: 'OAUTH_AUTH_ERROR', reason },
        `/login?redirectTo=${encodeURIComponent(state?.redirectTo ?? '/overview')}&oauthError=${encodeURIComponent(reason)}`
      );
    };

    if (!isGoogleOAuthConfigured()) return fail('not_configured');
    if (!state) return fail('invalid_state');
    if (!code) return fail(typeof req.query.error === 'string' ? 'access_denied' : 'missing_code');
    if (!(await ensureDbReady())) return fail('database_unavailable');

    type GoogleUserInfo = { email?: string; email_verified?: boolean; name?: string };
    let profile = null as GoogleUserInfo | null;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: getGoogleClientId(),
          client_secret: getGoogleClientSecret(),
          redirect_uri: getGoogleOAuthRedirectUri(req),
          grant_type: 'authorization_code',
        }).toString(),
      });
      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        if (tokenData.access_token) {
          const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (profileRes.ok) {
            profile = (await profileRes.json()) as GoogleUserInfo;
          }
        }
      }
    } catch (err) {
      console.warn('Google OAuth token exchange failed:', err);
    }

    if (!profile?.email || profile.email_verified !== true) {
      return fail('unverified_identity');
    }

    const user = await upsertGoogleOAuthUser({
      email: profile.email,
      displayName: profile.name || profile.email.split('@')[0] || 'Google Scholar',
      preferredLocale: locale,
    });
    setSessionCookie(res, user.id, req, user.role);
    renderOAuthResultPage(
      res,
      locale,
      'Authentication successful. Returning to ECONOVA...',
      { type: 'OAUTH_AUTH_SUCCESS', user, redirectTo: state.redirectTo },
      state.redirectTo
    );
  });

  app.get(['/auth/callback', '/auth/callback/', '/api/auth/callback/google'], googleCallbackHandler);

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res, req);
    res.json({ ok: true });
  });

  // --- PUBLIC CATALOG & COURSES ---
  app.get(
    '/api/catalog',
    asyncHandler(async (_req, res) => {
      if (!(await ensureDbReady())) {
        respondDatabaseUnavailable(res);
        return;
      }
      try {
        const courses = await db.query<{
          id: string;
          slug: string;
          subject: CourseCatalogItem['subject'];
          level: CourseCatalogItem['level'];
          estimated_minutes: number;
        }>('SELECT * FROM courses ORDER BY created_at ASC');

        const items: CourseCatalogItem[] = [];
        for (const c of courses) {
          const enRow = await db.queryOne<Record<string, unknown>>(
            "SELECT * FROM course_editions WHERE course_id = $1 AND locale = 'en' AND status = 'published' ORDER BY version DESC LIMIT 1",
            [c.id]
          );
          const uzRow = await db.queryOne<Record<string, unknown>>(
            "SELECT * FROM course_editions WHERE course_id = $1 AND locale = 'uz' AND status = 'published' ORDER BY version DESC LIMIT 1",
            [c.id]
          );

          if (!enRow && !uzRow) continue;

          items.push({
            id: c.id,
            slug: c.slug,
            subject: c.subject,
            level: c.level,
            estimatedMinutes: Number(c.estimated_minutes),
            editions: {
              en: enRow ? await mapEditionSummary(enRow) : null,
              uz: uzRow ? await mapEditionSummary(uzRow) : null,
            },
          });
        }

        res.json({ courses: items });
      } catch (err) {
        console.error('Catalog query failed:', err);
        res.status(500).json({ error: 'Unable to load the course catalog.' });
      }
    })
  );

  // Contextual Glossary API Endpoint for Interactive Terminology Overlays
  app.get(
    '/api/glossary',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
      const rawLocale = typeof req.query.locale === 'string' ? req.query.locale.trim() : 'en';
      const locale: LocaleCode = rawLocale === 'uz' ? 'uz' : 'en';

      const rows = await db.query<{
        course_id: string;
        subject: CourseCatalogItem['subject'];
        lesson_id: string;
        lesson_title: string;
        key_terms_json: unknown;
      }>(
        courseId
          ? `SELECT ce.course_id, c.subject, l.id as lesson_id, l.title as lesson_title, l.key_terms_json
             FROM lessons l
             JOIN course_editions ce ON ce.id = l.edition_id
             JOIN courses c ON c.id = ce.course_id
             WHERE ce.course_id = $1 AND ce.locale = $2 AND ce.status = 'published'
             ORDER BY ce.version DESC, l.sequence_num ASC`
          : `SELECT ce.course_id, c.subject, l.id as lesson_id, l.title as lesson_title, l.key_terms_json
             FROM lessons l
             JOIN course_editions ce ON ce.id = l.edition_id
             JOIN courses c ON c.id = ce.course_id
             WHERE ce.locale = $1 AND ce.status = 'published'
             ORDER BY c.created_at ASC, l.sequence_num ASC`,
        courseId ? [courseId, locale] : [locale]
      );

      const seen = new Set<string>();
      const terms: Array<{
        term: string;
        definition: string;
        courseId?: string;
        lessonId?: string;
        lessonTitle?: string;
        subject?: CourseCatalogItem['subject'];
      }> = [];

      for (const r of rows) {
        const parsedTerms = parseJsonCol<KeyTerm[]>(r.key_terms_json, []);
        for (const kt of parsedTerms) {
          if (!kt?.term || !kt?.definition) continue;
          const normKey = kt.term.trim().toLowerCase();
          if (seen.has(normKey)) continue;
          seen.add(normKey);
          terms.push({
            term: kt.term.trim(),
            definition: kt.definition.trim(),
            courseId: r.course_id,
            lessonId: r.lesson_id,
            lessonTitle: r.lesson_title,
            subject: r.subject,
          });
        }
      }

      // Supplemental core terms so common economic, mathematical, and business phrases in lesson body text are interactive
      const supplemental: Array<{
        term: string;
        definition: string;
        subject: CourseCatalogItem['subject'];
      }> =
        locale === 'uz'
          ? [
              {
                term: 'Bozor muvozanati',
                definition:
                  'Talab hajmi va taklif hajmi tenglashadigan, narxni o‘zgartirishga ichki bosim bo‘lmagan holat.',
                subject: 'Economics',
              },
              {
                term: 'Talab qonuni',
                definition:
                  'Boshqa shartlar o‘zgarmaganda (ceteris paribus), narx oshishi bilan talab hajmining kamayishi.',
                subject: 'Economics',
              },
              {
                term: 'Taklif',
                definition:
                  'Ishlab chiqaruvchilarning ma’lum narxlarda bozorga chiqarishga tayyor bo‘lgan mahsulot miqdori.',
                subject: 'Economics',
              },
              {
                term: 'Hosila',
                definition:
                  'Funksiyaning o‘zgarish tezligini ifodalovchi matematik tushuncha; urinma chiziqning burchak koeffitsiyenti.',
                subject: 'Mathematics',
              },
              {
                term: 'Marjinal',
                definition:
                  'Qo‘shimcha bir birlik mahsulot ishlab chiqarish yoki iste’mol qilish natijasida yuzaga keladigan o‘zgarish.',
                subject: 'Economics',
              },
              {
                term: 'Marja',
                definition:
                  'Sotuv tushumidan o‘zgaruvchan xarajatlar chegirilgandan keyin qoladigan ulush (Contribution Margin).',
                subject: 'Business',
              },
            ]
          : [
              {
                term: 'Market Equilibrium',
                definition:
                  'The state where quantity demanded equals quantity supplied ($Q_d(P^*) = Q_s(P^*)$) with no shortage or surplus.',
                subject: 'Economics',
              },
              {
                term: 'Equilibrium',
                definition:
                  'A balanced market condition where opposing supply and demand forces clear at price $P^*$.',
                subject: 'Economics',
              },
              {
                term: 'Quantity Demanded',
                definition:
                  'The exact number of units buyers are willing and able to purchase at a specific unit price.',
                subject: 'Economics',
              },
              {
                term: 'Quantity Supplied',
                definition:
                  'The total units producers are willing and able to bring to market at a given price.',
                subject: 'Economics',
              },
              {
                term: 'Price Elasticity',
                definition:
                  'A dimensionless measure of how responsive quantity demanded or supplied is to a change in price.',
                subject: 'Economics',
              },
              {
                term: 'Elasticity',
                definition:
                  'The percentage change in one economic variable in response to a one-percent change in another.',
                subject: 'Economics',
              },
              {
                term: 'Derivative',
                definition:
                  'The instantaneous rate of change $f\'(x)$ of a function, equal to the slope of the tangent line.',
                subject: 'Mathematics',
              },
              {
                term: 'Marginal Cost',
                definition:
                  'The derivative of total cost with respect to output ($MC = C\'(q)$), measuring the cost of one additional unit.',
                subject: 'Mathematics',
              },
              {
                term: 'Marginal Revenue',
                definition:
                  'The derivative of total revenue with respect to output ($MR = R\'(q)$), measuring revenue from one extra unit.',
                subject: 'Mathematics',
              },
              {
                term: 'Contribution Margin',
                definition:
                  'Unit revenue minus unit variable cost ($P - VC$), representing the cash each unit contributes toward fixed costs.',
                subject: 'Business',
              },
              {
                term: 'Break-Even',
                definition:
                  'The output volume where total contribution margin exactly offsets fixed operating expenses ($FC / CM$).',
                subject: 'Business',
              },
              {
                term: 'Payback Period',
                definition:
                  'The number of months required for cumulative gross margin from a customer to recover Customer Acquisition Cost ($CAC$).',
                subject: 'Business',
              },
            ];

      for (const item of supplemental) {
        const normKey = item.term.trim().toLowerCase();
        if (!seen.has(normKey)) {
          seen.add(normKey);
          terms.push({
            term: item.term,
            definition: item.definition,
            courseId: courseId || undefined,
            subject: item.subject,
          });
        }
      }

      res.json({ courseId: courseId || null, locale, terms });
    })
  );

  app.get(
    '/api/courses/:courseId/editions/:locale',
    asyncHandler(async (req, res) => {
      const courseId = String(req.params.courseId);
      const locale = String(req.params.locale);
      if (locale !== 'en' && locale !== 'uz') {
        res.status(400).json({ error: 'Unsupported edition locale. Expected en or uz.' });
        return;
      }
      if (!(await ensureDbReady())) {
        respondDatabaseUnavailable(res);
        return;
      }
      const courseRow = await db.queryOne<{
        id: string;
        slug: string;
        subject: CourseCatalogItem['subject'];
        level: CourseCatalogItem['level'];
        estimated_minutes: number;
      }>('SELECT * FROM courses WHERE id = $1', [courseId]);

      if (!courseRow) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }

      const edRow = await db.queryOne<Record<string, unknown>>(
        "SELECT * FROM course_editions WHERE course_id = $1 AND locale = $2 AND status = 'published' ORDER BY version DESC LIMIT 1",
        [courseId, locale]
      );
      if (!edRow) {
        res.status(404).json({
          error: `No published ${locale === 'uz' ? 'Uzbek' : 'English'} edition exists yet for this course. ECONOVA does not substitute machine translations.`,
        });
        return;
      }

      const edition = await mapEditionSummary(edRow);
      const lessonRows = await db.query<Record<string, unknown>>(
        'SELECT * FROM lessons WHERE edition_id = $1 ORDER BY sequence_num ASC',
        [edition.id]
      );

      const lessons: LessonPublic[] = await Promise.all(
        lessonRows.map(async (l) => ({
          id: String(l.id),
          editionId: String(l.edition_id),
          sequenceNum: Number(l.sequence_num),
          title: String(l.title),
          summary: String(l.summary),
          objectives: parseJsonCol<string[]>(l.objectives_json, []),
          bodyBlocks: parseJsonCol<LessonBlock[]>(l.body_blocks_json, []),
          keyTerms: parseJsonCol<KeyTerm[]>(l.key_terms_json, []),
          simulationType: normalizeSimulationType(l.simulation_type),
          videoUrl: l.video_url ? String(l.video_url) : null,
          captionsVtt: l.captions_vtt ? String(l.captions_vtt) : null,
          transcript: String(l.transcript),
          estimatedMinutes: Number(l.estimated_minutes),
          isRequired: Boolean(l.is_required),
          provenance: await getProvenance(l.provenance_id ? String(l.provenance_id) : null),
        }))
      );

      const assessRow = await db.queryOne<Record<string, unknown>>(
        'SELECT * FROM assessments WHERE edition_id = $1 ORDER BY version DESC LIMIT 1',
        [edition.id]
      );

      let assessment: AssessmentPublic | null = null;
      if (assessRow) {
        const qRows = await db.query<Record<string, unknown>>(
          'SELECT id, sequence_num, objective_ref, prompt, options_json FROM questions WHERE assessment_id = $1 ORDER BY sequence_num ASC',
          [String(assessRow.id)]
        );
        const questions: QuestionPublic[] = qRows.map((q) => ({
          id: String(q.id),
          sequenceNum: Number(q.sequence_num),
          objectiveRef: String(q.objective_ref),
          prompt: String(q.prompt),
          options: parseJsonCol<string[]>(q.options_json, []),
        }));
        assessment = {
          id: String(assessRow.id),
          editionId: String(assessRow.edition_id),
          title: String(assessRow.title),
          passingScorePercent: Number(assessRow.passing_score_percent),
          maxAttemptsPerDay: Number(assessRow.max_attempts_per_day),
          retryPolicyText: String(assessRow.retry_policy_text),
          version: Number(assessRow.version),
          questions,
        };
      }

      res.json({
        course: {
          id: courseRow.id,
          slug: courseRow.slug,
          subject: courseRow.subject,
          level: courseRow.level,
          estimatedMinutes: Number(courseRow.estimated_minutes),
          editions: {
            en: locale === 'en' ? edition : null,
            uz: locale === 'uz' ? edition : null,
          },
        },
        edition,
        lessons,
        assessment,
      });
    })
  );

  // --- LEARNER PROTECTED ROUTES ---
  app.get(
    '/api/me/overview',
    asyncHandler(async (req, res) => {
      if (!req.authUser || !isDatabaseConfigured()) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      if (!(await ensureDbReady())) {
        respondDatabaseUnavailable(res);
        return;
      }
      const userId = req.authUser.id;
      const enrollments = await db.query<{
        id: string;
        course_id: string;
        locale: LocaleCode;
        journey_status: string;
        enrolled_at: string | Date;
        completed_at: string | Date | null;
        paused_at: string | Date | null;
      }>('SELECT * FROM enrollments WHERE user_id = $1 ORDER BY enrolled_at DESC', [userId]);

      const enrichedEnrollments = await Promise.all(
        enrollments.map(async (e) => {
          const ed = await db.queryOne<{ id: string; passing_score_percent: number }>(
            "SELECT id, passing_score_percent FROM course_editions WHERE course_id = $1 AND locale = $2 AND status = 'published' ORDER BY version DESC LIMIT 1",
            [e.course_id, e.locale]
          );

          const reqLessons = ed
            ? (
                await db.query<{ id: string }>(
                  'SELECT id FROM lessons WHERE edition_id = $1 AND is_required = TRUE',
                  [ed.id]
                )
              ).map((r) => r.id)
            : [];

          const compLessons = ed
            ? (
                await db.query<{ lesson_id: string }>(
                  `SELECT lp.lesson_id FROM lesson_progress lp
                   JOIN lessons l ON l.id = lp.lesson_id
                   WHERE lp.user_id = $1 AND l.edition_id = $2 AND lp.state = 'completed'`,
                  [userId, ed.id]
                )
              ).map((r) => r.lesson_id)
            : [];

          const assessment = ed
            ? await db.queryOne<{ id: string }>(
                'SELECT id FROM assessments WHERE edition_id = $1 ORDER BY version DESC LIMIT 1',
                [ed.id]
              )
            : null;

          const bestScore = assessment
            ? ((
                await db.queryOne<{ best: number | null }>(
                  'SELECT MAX(score_percent)::int as best FROM assessment_attempts WHERE user_id = $1 AND assessment_id = $2',
                  [userId, assessment.id]
                )
              )?.best ?? null)
            : null;

          return {
            id: e.id,
            courseId: e.course_id,
            locale: e.locale,
            journeyStatus: e.journey_status,
            completedLessonIds: compLessons,
            requiredLessonIds: reqLessons,
            bestScorePercent: bestScore,
            passedAssessment: bestScore !== null && ed ? bestScore >= ed.passing_score_percent : false,
            enrolledAt: toIso(e.enrolled_at),
            completedAt: toIso(e.completed_at),
            pausedAt: toIso(e.paused_at),
          };
        })
      );

      const xpEntries = await db.query<Record<string, unknown>>(
        'SELECT * FROM xp_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [userId]
      );
      const totalXpRow = await db.queryOne<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0)::int as total FROM xp_ledger WHERE user_id = $1 AND status = 'valid'",
        [userId]
      );

      const streakRow = await db.queryOne<{
        current_streak: number;
        best_streak: number;
        last_activity_local_date: string | null;
        timezone: string;
      }>('SELECT * FROM streak_records WHERE user_id = $1', [userId]);

      const badges = await db.query<Record<string, unknown>>(
        'SELECT id, badge_key, title, criteria, awarded_at FROM badge_awards WHERE user_id = $1 ORDER BY awarded_at DESC',
        [userId]
      );

      const completedTodayRows = await db.query<{
        estimated_minutes: number;
        updated_at: string | Date;
      }>(
        `SELECT l.estimated_minutes, lp.updated_at
         FROM lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         WHERE lp.user_id = $1 AND lp.state = 'completed'`,
        [userId]
      );
      const todayLocal = formatLocalDateKey(new Date(), req.authUser!.timezone);
      const studyMinutesToday = completedTodayRows.reduce((sum, row) => {
        const localDate = formatLocalDateKey(new Date(row.updated_at), req.authUser!.timezone);
        return localDate === todayLocal ? sum + Number(row.estimated_minutes || 0) : sum;
      }, 0);

      res.json({
        enrollments: enrichedEnrollments,
        totalXp: Number(totalXpRow?.total ?? 0),
        xpToday: await getXpEarnedToday(userId, req.authUser!.timezone),
        studyMinutesToday,
        dailyStudyGoalMinutes: req.authUser!.dailyStudyGoalMinutes,
        xpLedger: xpEntries.map((r) => ({
          id: String(r.id),
          eventType: String(r.event_type),
          referenceId: String(r.reference_id),
          amount: Number(r.amount),
          status: String(r.status),
          ruleVersion: String(r.rule_version),
          description: String(r.description),
          createdAt: toIso(r.created_at) || '',
        })),
        streak: {
          currentStreak: Number(streakRow?.current_streak ?? 0),
          bestStreak: Number(streakRow?.best_streak ?? 0),
          lastActivityLocalDate: streakRow?.last_activity_local_date ?? null,
          timezone: streakRow?.timezone ?? req.authUser!.timezone,
        },
        badges: badges.map((b) => ({
          id: String(b.id),
          badgeKey: String(b.badge_key),
          title: String(b.title),
          criteria: String(b.criteria),
          awardedAt: toIso(b.awarded_at) || '',
        })),
      });
    })
  );

  app.post(
    '/api/enrollments',
    asyncHandler(async (req, res) => {
      const { courseId, locale } = req.body as { courseId?: string; locale?: LocaleCode };
      if (!courseId || (locale !== 'en' && locale !== 'uz')) {
        res.status(400).json({ error: 'Valid courseId and edition locale (en/uz) are required.' });
        return;
      }
      if (!req.authUser) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      if (!(await ensureDbReady())) {
        respondDatabaseUnavailable(res);
        return;
      }
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.authUser.id, courseId]
      );

      const now = new Date().toISOString();
      if (existing) {
        await db.execute(
          'UPDATE enrollments SET locale = $1, paused_at = NULL WHERE id = $2',
          [locale, existing.id]
        );
      } else {
        await db.execute(
          `INSERT INTO enrollments (id, user_id, course_id, locale, journey_status, enrolled_at)
           VALUES ($1, $2, $3, $4, 'not_started', $5)`,
          [uid('enr'), req.authUser!.id, courseId, locale, now]
        );
      }
      const status = await reconcileCourseCompletionAndCertificate({
        userId: req.authUser!.id,
        courseId,
        locale,
        timeZone: req.authUser!.timezone,
      });
      res.json({ ok: true, ...status });
    })
  );

  app.patch(
    '/api/enrollments/:courseId/pause',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const courseId = String(req.params.courseId);
      const { paused } = req.body as { paused?: boolean };
      const existing = await db.queryOne<{ id: string; locale: LocaleCode }>(
        'SELECT id, locale FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.authUser!.id, courseId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Enrollment not found.' });
        return;
      }
      await db.execute('UPDATE enrollments SET paused_at = $1 WHERE id = $2', [
        paused ? new Date().toISOString() : null,
        existing.id,
      ]);
      const result = await reconcileCourseCompletionAndCertificate({
        userId: req.authUser!.id,
        courseId,
        locale: existing.locale,
        timeZone: req.authUser!.timezone,
      });
      res.json({ ok: true, ...result });
    })
  );

  // Records that a learner opened a lesson. The first start time is kept
  // (re-opening does not reset it); completed lessons are never downgraded.
  app.post(
    '/api/me/progress/:lessonId/start',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const lesson = await loadPublishedLessonForProgress(String(req.params.lessonId));
      if (!lesson) {
        res.status(404).json({ error: 'Published lesson not found.' });
        return;
      }

      await db.execute(
        `INSERT INTO lesson_progress (id, user_id, lesson_id, edition_version, state, completion_evidence, updated_at)
         VALUES ($1, $2, $3, $4, 'in_progress', $5, NOW())
         ON CONFLICT (user_id, lesson_id) DO NOTHING`,
        [uid('lp'), req.authUser!.id, lesson.id, lesson.version, LESSON_STARTED_MARKER]
      );
      const row = await db.queryOne<{ state: string; updated_at: string | Date }>(
        'SELECT state, updated_at FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
        [req.authUser!.id, lesson.id]
      );

      res.json({
        ok: true,
        state: row?.state ?? 'in_progress',
        startedAt: row?.state === 'in_progress' ? new Date(row.updated_at).toISOString() : null,
        minDwellSeconds: computeMinDwellSeconds(lesson.estimated_minutes),
      });
    })
  );

  app.put(
    '/api/me/progress/:lessonId',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const parsed = parseLessonEvidence((req.body as { evidence?: unknown } | undefined)?.evidence);
      if (!parsed.ok) {
        const rejection = invalidEvidenceResponse(parsed);
        res.status(rejection.status).json(rejection.body);
        return;
      }

      const lesson = await loadPublishedLessonForProgress(String(req.params.lessonId));
      if (!lesson) {
        res.status(404).json({ error: 'Published lesson not found.' });
        return;
      }

      const userId = req.authUser!.id;
      const [progressRow, enrollmentRow, passedAttemptRow] = await Promise.all([
        db.queryOne<{ state: ProgressRowFacts['state']; updated_at: string | Date }>(
          'SELECT state, updated_at FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
          [userId, lesson.id]
        ),
        db.queryOne<{ id: string }>(
          'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
          [userId, lesson.course_id]
        ),
        parsed.evidence === 'assessment_passed'
          ? db.queryOne<{ id: string }>(
              `SELECT aa.id FROM assessment_attempts aa
               JOIN assessments a ON a.id = aa.assessment_id
               WHERE aa.user_id = $1 AND a.edition_id = $2 AND aa.passed = TRUE
               LIMIT 1`,
              [userId, lesson.edition_id]
            )
          : Promise.resolve(null),
      ]);

      const decision = decideLessonCompletion({
        evidence: parsed.evidence,
        lessonEstimatedMinutes: lesson.estimated_minutes,
        existing: progressRow
          ? { state: progressRow.state, updatedAt: new Date(progressRow.updated_at) }
          : null,
        isEnrolled: Boolean(enrollmentRow),
        hasPassedEditionAssessment: Boolean(passedAttemptRow),
        now: new Date(),
      });

      if (!decision.ok) {
        const rejection = completionRejectedResponse(decision);
        res.status(rejection.status).json(rejection.body);
        return;
      }

      const out = await runInTransaction(async (tx) => {
        const now = new Date().toISOString();
        if (!decision.alreadyCompleted) {
          await tx.execute(
            `INSERT INTO lesson_progress (id, user_id, lesson_id, edition_version, state, completion_evidence, updated_at)
             VALUES ($1, $2, $3, $4, 'completed', $5, $6)
             ON CONFLICT (user_id, lesson_id) DO UPDATE
               SET state = 'completed',
                   completion_evidence = EXCLUDED.completion_evidence,
                   edition_version = EXCLUDED.edition_version,
                   updated_at = EXCLUDED.updated_at
               WHERE lesson_progress.state <> 'completed'`,
            [uid('lp'), userId, lesson.id, lesson.version, decision.evidence, now]
          );
        }

        const xpRes = await awardXpIdempotent(
          {
            userId: req.authUser!.id,
            eventType: 'lesson_completed',
            referenceId: lesson.id,
            idempotencyKey: `lesson:${req.authUser!.id}:${lesson.id}:v${lesson.version}`,
            description: `Completed lesson: ${lesson.title}`,
            timeZone: req.authUser!.timezone,
          },
          tx
        );

        await recordMeaningfulActivityStreak(req.authUser!.id, req.authUser!.timezone, tx);
        await awardBadgeIdempotent(
          req.authUser!.id,
          'first_lesson',
          'First Step Completed',
          'Complete your first reviewed lesson in any ECONOVA course.',
          tx
        );

        const completion = await reconcileCourseCompletionAndCertificate(
          {
            userId: req.authUser!.id,
            courseId: lesson.course_id,
            locale: lesson.locale,
            timeZone: req.authUser!.timezone,
          },
          tx
        );

        return { xpAwarded: xpRes.awarded, xpNote: xpRes.reason, ...completion };
      });

      res.json({ ok: true, ...out });
    })
  );

  app.post(
    '/api/assessments/:assessmentId/attempts',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const assessmentId = String(req.params.assessmentId);
      const { answers } = req.body as { answers?: Record<string, number> };

      const assessment = await db.queryOne<{
        id: string;
        title: string;
        passing_score_percent: number;
        max_attempts_per_day: number;
        version: number;
        course_id: string;
        locale: LocaleCode;
        edition_version: number;
      }>(
        `SELECT a.*, ce.course_id, ce.locale, ce.version as edition_version
         FROM assessments a
         JOIN course_editions ce ON ce.id = a.edition_id
         WHERE a.id = $1 AND ce.status = 'published'`,
        [assessmentId]
      );

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found.' });
        return;
      }

      const todayLocal = formatLocalDateKey(new Date(), req.authUser!.timezone);
      const priorAttempts = await db.query<{ created_at: string | Date }>(
        'SELECT created_at FROM assessment_attempts WHERE user_id = $1 AND assessment_id = $2',
        [req.authUser!.id, assessment.id]
      );
      const attemptsToday = priorAttempts.filter(
        (a) => formatLocalDateKey(new Date(a.created_at), req.authUser!.timezone) === todayLocal
      ).length;

      if (attemptsToday >= assessment.max_attempts_per_day) {
        res.status(429).json({
          error: `Daily retry limit reached (${assessment.max_attempts_per_day} attempts per day). Review lesson explanations and try again tomorrow.`,
        });
        return;
      }

      const qRows = await db.query<Record<string, unknown>>(
        'SELECT * FROM questions WHERE assessment_id = $1 ORDER BY sequence_num ASC',
        [assessment.id]
      );

      const questionsWithKeys: QuestionWithKey[] = qRows.map((q) => ({
        id: String(q.id),
        sequenceNum: Number(q.sequence_num),
        objectiveRef: String(q.objective_ref),
        prompt: String(q.prompt),
        options: parseJsonCol<string[]>(q.options_json, []),
        correctOptionIndex: Number(q.correct_option_index),
        explanation: String(q.explanation),
      }));

      if (!answers || typeof answers !== 'object') {
        res.status(400).json({ error: 'Answers payload is required.' });
        return;
      }

      const evalResult = calculateAssessmentScore(
        questionsWithKeys,
        answers,
        assessment.passing_score_percent
      );

      const out = await runInTransaction(async (tx) => {
        const now = new Date().toISOString();
        await tx.execute(
          `INSERT INTO assessment_attempts (
            id, user_id, assessment_id, edition_version, responses_json, score_percent, passed, created_at
          ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
          [
            uid('att'),
            req.authUser!.id,
            assessment.id,
            assessment.edition_version,
            JSON.stringify(answers),
            evalResult.scorePercent,
            evalResult.passed,
            now,
          ]
        );

        let xpAwarded = 0;
        let xpNote = 'Pass the assessment to earn milestone XP.';
        if (evalResult.passed) {
          const xpRes = await awardXpIdempotent(
            {
              userId: req.authUser!.id,
              eventType: 'assessment_passed',
              referenceId: assessment.id,
              idempotencyKey: `assessment:${req.authUser!.id}:${assessment.id}:v${assessment.version}`,
              description: `Passed assessment: ${assessment.title}`,
              timeZone: req.authUser!.timezone,
            },
            tx
          );
          xpAwarded = xpRes.awarded;
          xpNote = xpRes.reason;
          await awardBadgeIdempotent(
            req.authUser!.id,
            'assessment_passed',
            'Verified Assessment Pass',
            'Pass a reviewed course assessment at or above the published passing threshold.',
            tx
          );
        }

        await recordMeaningfulActivityStreak(req.authUser!.id, req.authUser!.timezone, tx);

        const completion = await reconcileCourseCompletionAndCertificate(
          {
            userId: req.authUser!.id,
            courseId: assessment.course_id,
            locale: assessment.locale,
            timeZone: req.authUser!.timezone,
          },
          tx
        );

        return {
          ...evalResult,
          xpAwarded,
          xpNote,
          ...completion,
        };
      });

      res.json(out);
    })
  );

  // --- CERTIFICATES & PUBLIC VERIFICATION ---
  app.get(
    '/api/me/certificates',
    asyncHandler(async (req, res) => {
      if (!req.authUser || !isDatabaseConfigured()) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      if (!(await ensureDbReady())) {
        respondDatabaseUnavailable(res);
        return;
      }
      const rows = await db.query<Record<string, unknown>>(
        'SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC',
        [req.authUser.id]
      );

      const origin =
        process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
          ? process.env.APP_URL.replace(/\/$/, '')
          : `${req.protocol}://${req.get('host')}`;

      const certs = await Promise.all(
        rows.map(async (r) => {
          const token = String(r.public_token);
          const verifyUrl = `${origin}/?verify=${encodeURIComponent(token)}`;
          const qrSvg = await QRCode.toString(verifyUrl, {
            type: 'svg',
            margin: 1,
            width: 112,
            color: { dark: '#080B14', light: '#F3F6FF' },
          });
          return {
            id: String(r.id),
            courseId: String(r.course_id),
            editionId: String(r.edition_id),
            editionVersion: Number(r.edition_version),
            locale: r.locale as LocaleCode,
            recipientDisplayName: String(r.recipient_display_name),
            courseTitle: String(r.course_title),
            subject: String(r.subject),
            level: String(r.level),
            publicToken: token,
            status: r.status as 'valid' | 'revoked',
            shareEnabled: Boolean(r.share_enabled),
            issuedAt: toIso(r.issued_at) || '',
            revokedAt: toIso(r.revoked_at),
            revokeReason: r.revoke_reason ? String(r.revoke_reason) : null,
            templateVersion: String(r.template_version),
            qrSvg,
          };
        })
      );

      res.json({ certificates: certs });
    })
  );

  app.post(
    '/api/me/certificates/:certificateId/share',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const certificateId = String(req.params.certificateId);
      const cert = await db.queryOne<{ id: string }>(
        'SELECT id FROM certificates WHERE id = $1 AND user_id = $2',
        [certificateId, req.authUser!.id]
      );
      if (!cert) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }
      await db.execute('UPDATE certificates SET share_enabled = TRUE WHERE id = $1', [certificateId]);
      res.json({ ok: true, shareEnabled: true });
    })
  );

  app.delete(
    '/api/me/certificates/:certificateId/share',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const certificateId = String(req.params.certificateId);
      const cert = await db.queryOne<{ id: string }>(
        'SELECT id FROM certificates WHERE id = $1 AND user_id = $2',
        [certificateId, req.authUser!.id]
      );
      if (!cert) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }
      await db.execute('UPDATE certificates SET share_enabled = FALSE WHERE id = $1', [certificateId]);
      res.json({ ok: true, shareEnabled: false });
    })
  );

  app.get(
    '/api/me/certificates/:certificateId/verify',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const certificateId = String(req.params.certificateId);
      const row = await db.queryOne<{
        id: string;
        public_token: string;
        status: 'valid' | 'revoked';
        share_enabled: boolean;
        recipient_display_name: string;
        course_title: string;
        subject: 'Economics' | 'Mathematics' | 'Business';
        level: 'Beginner' | 'Intermediate' | 'Advanced';
        locale: 'en' | 'uz';
        edition_version: number;
        issued_at: string | Date;
        revoked_at: string | Date | null;
        revoke_reason: string | null;
      }>('SELECT * FROM certificates WHERE id = $1 AND user_id = $2', [
        certificateId,
        req.authUser!.id,
      ]);

      if (!row) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }

      const verifiedAt = new Date().toISOString();
      res.json(
        buildOwnerCertificateVerification(
          {
            id: String(row.id),
            publicToken: String(row.public_token),
            status: row.status,
            shareEnabled: Boolean(row.share_enabled),
            recipientDisplayName: String(row.recipient_display_name),
            courseTitle: String(row.course_title),
            subject: row.subject,
            level: row.level,
            locale: row.locale,
            editionVersion: Number(row.edition_version),
            issuedAt: toIso(row.issued_at) || '',
            revokedAt: toIso(row.revoked_at),
            revokeReason: row.revoke_reason ? String(row.revoke_reason) : null,
          },
          verifiedAt
        )
      );
    })
  );

  app.get(
    '/api/verify/:token',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const token = String(req.params.token).trim();
      const verifiedAt = new Date().toISOString();
      const row = await db.queryOne<{
        status: 'valid' | 'revoked';
        share_enabled: boolean;
        recipient_display_name: string;
        course_title: string;
        subject: 'Economics' | 'Mathematics' | 'Business';
        level: 'Beginner' | 'Intermediate' | 'Advanced';
        locale: 'en' | 'uz';
        edition_version: number;
        issued_at: string | Date;
        revoked_at: string | Date | null;
        revoke_reason: string | null;
      }>('SELECT * FROM certificates WHERE public_token = $1', [token]);

      if (!row) {
        res.json({ ...evaluateCertificateVerification(null), verifiedAt });
        return;
      }

      if (row.status === 'valid' && !row.share_enabled) {
        res.json({ verificationStatus: 'not_found', verifiedAt });
        return;
      }

      res.json({
        ...evaluateCertificateVerification({
          status: row.status,
          shareEnabled: Boolean(row.share_enabled),
          recipientDisplayName: row.recipient_display_name,
          courseTitle: row.course_title,
          subject: row.subject,
          level: row.level,
          locale: row.locale,
          editionVersion: Number(row.edition_version),
          issuedAt: toIso(row.issued_at) || '',
          revokedAt: toIso(row.revoked_at),
          revokeReason: row.revoke_reason,
        }),
        verifiedAt,
      });
    })
  );

  // --- PROFILE, PRIVACY, LEADERBOARD, REFERRALS, REPORTS ---
  app.patch(
    '/api/me/profile',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const {
        displayName,
        preferredLocale,
        timezone,
        leaderboardOptIn,
        leaderboardPseudonym,
        dailyStudyGoalMinutes,
        studyGoalNotificationsEnabled,
        weeklyDigestEmailEnabled,
        lessonNotes,
        bookmarkedCourseIds,
      } = req.body as {
        displayName?: string;
        preferredLocale?: LocaleCode;
        timezone?: string;
        leaderboardOptIn?: boolean;
        leaderboardPseudonym?: string;
        dailyStudyGoalMinutes?: number;
        studyGoalNotificationsEnabled?: boolean;
        weeklyDigestEmailEnabled?: boolean;
        lessonNotes?: unknown;
        bookmarkedCourseIds?: unknown;
      };

      const current = req.authUser!;
      const nextName =
        displayName && displayName.trim().length >= 2 ? displayName.trim() : current.displayName;
      const nextLocale: LocaleCode =
        preferredLocale === 'uz' || preferredLocale === 'en'
          ? preferredLocale
          : current.preferredLocale;
      const nextTz = timezone && timezone.trim() ? timezone.trim() : current.timezone;
      const nextOptIn =
        typeof leaderboardOptIn === 'boolean' ? leaderboardOptIn : current.leaderboardOptIn;
      const nextPseudo =
        leaderboardPseudonym && leaderboardPseudonym.trim().length >= 2
          ? leaderboardPseudonym.trim().slice(0, 32)
          : current.leaderboardPseudonym;

      let nextGoal = current.dailyStudyGoalMinutes;
      if (dailyStudyGoalMinutes !== undefined) {
        const parsedGoal = parseDailyGoalMinutes(dailyStudyGoalMinutes);
        if (!parsedGoal.valid) {
          res.status(400).json({ error: parsedGoal.error });
          return;
        }
        nextGoal = parsedGoal.value;
      }

      const nextNotificationsEnabled =
        typeof studyGoalNotificationsEnabled === 'boolean'
          ? studyGoalNotificationsEnabled
          : current.studyGoalNotificationsEnabled;

      const nextWeeklyDigestEnabled =
        typeof weeklyDigestEmailEnabled === 'boolean'
          ? weeklyDigestEmailEnabled
          : Boolean(current.weeklyDigestEmailEnabled);

      let nextLessonNotes: Record<string, string> = { ...(current.lessonNotes ?? {}) };
      if (lessonNotes !== undefined) {
        if (!lessonNotes || typeof lessonNotes !== 'object' || Array.isArray(lessonNotes)) {
          res.status(400).json({ error: 'lessonNotes must be a key-value object.' });
          return;
        }
        const cleanedNotes: Record<string, string> = {};
        for (const [k, v] of Object.entries(lessonNotes as Record<string, unknown>)) {
          const cleanKey = k.trim().slice(0, 120);
          if (cleanKey && typeof v === 'string') {
            cleanedNotes[cleanKey] = v.slice(0, 12000);
          }
        }
        nextLessonNotes = cleanedNotes;
      }

      let nextBookmarks = current.bookmarkedCourseIds;
      if (bookmarkedCourseIds !== undefined) {
        if (!Array.isArray(bookmarkedCourseIds)) {
          res.status(400).json({ error: 'bookmarkedCourseIds must be an array of course IDs.' });
          return;
        }
        const normalized = normalizeBookmarkedCourseIds(bookmarkedCourseIds);
        if (normalized.length > 0) {
          const validRows = await db.query<{ id: string }>(
            'SELECT id FROM courses WHERE id = ANY($1::text[])',
            [normalized]
          );
          const validSet = new Set(validRows.map((r) => r.id));
          nextBookmarks = normalized.filter((id) => validSet.has(id));
        } else {
          nextBookmarks = [];
        }
      }

      await db.execute(
        `UPDATE learner_profiles
         SET display_name = $1, preferred_locale = $2, timezone = $3,
             leaderboard_opt_in = $4, leaderboard_pseudonym = $5,
             daily_study_goal_minutes = $6,
             study_goal_notifications_enabled = $7,
             weekly_digest_email_enabled = $8,
             lesson_notes_json = $9::jsonb,
             bookmarked_course_ids = $10::jsonb
         WHERE user_id = $11`,
        [
          nextName,
          nextLocale,
          nextTz,
          nextOptIn,
          nextPseudo,
          nextGoal,
          nextNotificationsEnabled,
          nextWeeklyDigestEnabled,
          JSON.stringify(nextLessonNotes),
          JSON.stringify(nextBookmarks),
          current.id,
        ]
      );

      res.json({ user: await loadUserSummaryById(current.id) });
    })
  );

  app.put(
    '/api/me/bookmarks/:courseId',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const courseId = String(req.params.courseId).trim();
      const body = (req.body || {}) as { bookmarked?: unknown };
      const forceBookmarked =
        typeof body.bookmarked === 'boolean' ? body.bookmarked : true;

      const course = await db.queryOne<{ id: string }>(
        'SELECT id FROM courses WHERE id = $1',
        [courseId]
      );
      if (!course) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }

      const result = await runInTransaction(async (tx) => {
        const profileRow = await tx.queryOne<{ bookmarked_course_ids: unknown }>(
          'SELECT bookmarked_course_ids FROM learner_profiles WHERE user_id = $1 FOR UPDATE',
          [req.authUser!.id]
        );
        const currentIds = normalizeBookmarkedCourseIds(profileRow?.bookmarked_course_ids);
        const toggled = toggleBookmarkedCourseId(currentIds, course.id, forceBookmarked);
        await tx.execute(
          `UPDATE learner_profiles
           SET bookmarked_course_ids = $1::jsonb
           WHERE user_id = $2`,
          [JSON.stringify(toggled.nextIds), req.authUser!.id]
        );
        return toggled;
      });

      const updatedUser = await loadUserSummaryById(req.authUser!.id);
      res.json({
        ok: true,
        bookmarked: result.bookmarked,
        bookmarkedCourseIds: result.nextIds,
        user: updatedUser,
      });
    })
  );

  app.delete(
    '/api/me/bookmarks/:courseId',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const courseId = String(req.params.courseId).trim();
      const result = await runInTransaction(async (tx) => {
        const profileRow = await tx.queryOne<{ bookmarked_course_ids: unknown }>(
          'SELECT bookmarked_course_ids FROM learner_profiles WHERE user_id = $1 FOR UPDATE',
          [req.authUser!.id]
        );
        const currentIds = normalizeBookmarkedCourseIds(profileRow?.bookmarked_course_ids);
        const toggled = toggleBookmarkedCourseId(currentIds, courseId, false);
        await tx.execute(
          `UPDATE learner_profiles
           SET bookmarked_course_ids = $1::jsonb
           WHERE user_id = $2`,
          [JSON.stringify(toggled.nextIds), req.authUser!.id]
        );
        return toggled;
      });

      const updatedUser = await loadUserSummaryById(req.authUser!.id);
      res.json({
        ok: true,
        bookmarked: false,
        bookmarkedCourseIds: result.nextIds,
        user: updatedUser,
      });
    })
  );

  app.put(
    '/api/me/study-goal',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const { targetMinutes } = req.body as { targetMinutes?: unknown };
      const parsed = parseDailyGoalMinutes(targetMinutes);
      if (!parsed.valid) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      await db.execute(
        `UPDATE learner_profiles
         SET daily_study_goal_minutes = $1
         WHERE user_id = $2`,
        [parsed.value, req.authUser!.id]
      );

      const updatedUser = await loadUserSummaryById(req.authUser!.id);
      res.json({
        ok: true,
        dailyStudyGoalMinutes: parsed.value,
        user: updatedUser,
      });
    })
  );

  app.get(
    '/api/me/export',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.authUser!.id;
      const [enrollments, lessonProgress, assessmentAttempts, xpLedger, certificates] =
        await Promise.all([
          db.query('SELECT * FROM enrollments WHERE user_id = $1', [userId]),
          db.query('SELECT * FROM lesson_progress WHERE user_id = $1', [userId]),
          db.query('SELECT * FROM assessment_attempts WHERE user_id = $1', [userId]),
          db.query('SELECT * FROM xp_ledger WHERE user_id = $1', [userId]),
          db.query('SELECT * FROM certificates WHERE user_id = $1', [userId]),
        ]);

      res.json({
        exportedAt: new Date().toISOString(),
        profile: req.authUser,
        enrollments,
        lessonProgress,
        assessmentAttempts,
        xpLedger,
        certificates,
      });
    })
  );

  app.delete(
    '/api/me/account',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.authUser!.id;
      await db.execute('DELETE FROM users WHERE id = $1', [userId]);
      clearSessionCookie(res);
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/leaderboards',
    asyncHandler(async (req, res) => {
      const courseIdFilter =
        typeof req.query.courseId === 'string' ? req.query.courseId.trim() : 'all';
      if (!(await ensureDbReady())) {
        respondDatabaseUnavailable(res);
        return;
      }
      try {
        const weekWindow = getCurrentWeekWindow(new Date());

      const [rows, attemptRows] = await Promise.all([
        db.query<{
          user_id: string;
          leaderboard_pseudonym: string;
          cohort_xp: number;
          lessons_done: number;
        }>(
          `SELECT lp.user_id, lp.leaderboard_pseudonym,
                  COALESCE(SUM(CASE WHEN xl.status = 'valid' THEN xl.amount ELSE 0 END), 0)::int as cohort_xp,
                  (SELECT COUNT(*)::int FROM lesson_progress prog WHERE prog.user_id = lp.user_id AND prog.state = 'completed') as lessons_done
           FROM learner_profiles lp
           LEFT JOIN xp_ledger xl ON xl.user_id = lp.user_id
           WHERE lp.leaderboard_opt_in = TRUE
           GROUP BY lp.user_id, lp.leaderboard_pseudonym
           ORDER BY cohort_xp DESC, lessons_done DESC
           LIMIT 25`
        ),
        db.query<{
          user_id: string;
          leaderboard_pseudonym: string;
          leaderboard_opt_in: boolean;
          course_id: string;
          course_title: string;
          subject: CourseCatalogItem['subject'];
          assessment_id: string;
          assessment_title: string;
          score_percent: number;
          passed: boolean;
          created_at: string | Date;
        }>(
          `SELECT aa.user_id,
                  lp.leaderboard_pseudonym,
                  lp.leaderboard_opt_in,
                  ce.course_id,
                  ce.title as course_title,
                  c.subject,
                  a.id as assessment_id,
                  a.title as assessment_title,
                  aa.score_percent,
                  aa.passed,
                  aa.created_at
           FROM assessment_attempts aa
           JOIN learner_profiles lp ON lp.user_id = aa.user_id
           JOIN assessments a ON a.id = aa.assessment_id
           JOIN course_editions ce ON ce.id = a.edition_id
           JOIN courses c ON c.id = ce.course_id
           WHERE lp.leaderboard_opt_in = TRUE
             AND aa.created_at >= $1::timestamptz
           ORDER BY aa.created_at DESC`,
          [weekWindow.weekStartIso]
        ),
      ]);

      const rawQuizAttempts: RawQuizAttemptRow[] = attemptRows.map((r) => ({
        userId: String(r.user_id),
        pseudonym: String(r.leaderboard_pseudonym || ''),
        leaderboardOptIn: Boolean(r.leaderboard_opt_in),
        courseId: String(r.course_id),
        courseTitle: String(r.course_title),
        subject: r.subject,
        assessmentId: String(r.assessment_id),
        assessmentTitle: String(r.assessment_title),
        scorePercent: Number(r.score_percent),
        passed: Boolean(r.passed),
        createdAt: toIso(r.created_at) || new Date().toISOString(),
      }));

      const quizLeaderboard = rankWeeklyQuizAttempts(rawQuizAttempts, {
        currentUserId: req.authUser?.id ?? null,
        courseId: courseIdFilter,
        weekStartIso: weekWindow.weekStartIso,
        weekEndIso: weekWindow.weekEndIso,
        limit: 25,
      });

      res.json({
        cohortName: 'Active Weekly Study Cohort (Opt-In Pseudonyms)',
        entries: rows.map((r, i) => ({
          rank: i + 1,
          pseudonym: r.leaderboard_pseudonym,
          cohortXp: Number(r.cohort_xp),
          lessonsCompleted: Number(r.lessons_done),
          isCurrentUser: req.authUser?.id === r.user_id,
        })),
        weekWindow,
        quizLeaderboard,
      });
    } catch (err) {
      console.error('Leaderboard query failed:', err);
      res.status(500).json({ error: 'Unable to load leaderboards.' });
    }
  })
);

  app.get(
    '/api/me/referrals',
    asyncHandler(async (req, res) => {
      if (!req.authUser || !isDatabaseConfigured()) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      if (!(await ensureDbReady())) {
        respondDatabaseUnavailable(res);
        return;
      }
      const userId = req.authUser.id;
      let codeRow = await db.queryOne<{ code: string }>(
        'SELECT code FROM referral_codes WHERE owner_user_id = $1',
        [userId]
      );
      if (!codeRow) {
        const code = `ECO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await db.execute(
          `INSERT INTO referral_codes (code, owner_user_id, created_at)
           VALUES ($1, $2, $3) ON CONFLICT (owner_user_id) DO NOTHING`,
          [code, userId, new Date().toISOString()]
        );
        codeRow =
          (await db.queryOne<{ code: string }>(
            'SELECT code FROM referral_codes WHERE owner_user_id = $1',
            [userId]
          )) ?? { code };
      }

      const referralsMade = await db.queryOne<{ cnt: number }>(
        'SELECT COUNT(*)::int as cnt FROM referral_claims WHERE referrer_user_id = $1',
        [userId]
      );
      const claimedByMe = await db.queryOne<{ code: string; created_at: string | Date }>(
        'SELECT code, created_at FROM referral_claims WHERE claimant_user_id = $1',
        [userId]
      );

      res.json({
        myCode: codeRow.code,
        referralsCount: Number(referralsMade?.cnt ?? 0),
        claimedByMe: claimedByMe
          ? { code: claimedByMe.code, createdAt: toIso(claimedByMe.created_at) }
          : null,
      });
    })
  );

  app.post(
    '/api/referrals/claim',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const { code } = req.body as { code?: string };
      const cleanCode = (code ?? '').trim().toUpperCase();
      if (!cleanCode) {
        res.status(400).json({ error: 'Referral code is required.' });
        return;
      }

      const codeRow = await db.queryOne<{ code: string; owner_user_id: string }>(
        'SELECT code, owner_user_id FROM referral_codes WHERE code = $1',
        [cleanCode]
      );

      if (!codeRow) {
        res.status(404).json({ error: 'Referral code not found.' });
        return;
      }
      if (codeRow.owner_user_id === req.authUser!.id) {
        res.status(400).json({ error: 'Self-referrals are blocked by anti-abuse policy.' });
        return;
      }

      const alreadyClaimed = await db.queryOne<{ id: string }>(
        'SELECT id FROM referral_claims WHERE claimant_user_id = $1',
        [req.authUser!.id]
      );
      if (alreadyClaimed) {
        res.status(409).json({ error: 'A referral code has already been applied to your account.' });
        return;
      }

      const xpAwarded = await runInTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO referral_claims (id, code, claimant_user_id, referrer_user_id, status, created_at)
           VALUES ($1, $2, $3, $4, 'credited', $5)`,
          [uid('ref'), cleanCode, req.authUser!.id, codeRow.owner_user_id, new Date().toISOString()]
        );

        const claimantXp = await awardXpIdempotent(
          {
            userId: req.authUser!.id,
            eventType: 'referral_reward',
            referenceId: cleanCode,
            idempotencyKey: `referral:claimant:${req.authUser!.id}`,
            description: `Applied peer referral code ${cleanCode} (non-cash XP)`,
            timeZone: req.authUser!.timezone,
          },
          tx
        );

        await awardXpIdempotent(
          {
            userId: codeRow.owner_user_id,
            eventType: 'referral_reward',
            referenceId: `${cleanCode}:${req.authUser!.id}`,
            idempotencyKey: `referral:referrer:${codeRow.owner_user_id}:${req.authUser!.id}`,
            description: 'Peer study referral credited (non-cash XP)',
            timeZone: 'Asia/Tashkent',
          },
          tx
        );

        return claimantXp.awarded;
      });

      res.json({ ok: true, xpAwarded });
    })
  );

  app.post(
    '/api/reports',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const { courseId, lessonId, segmentHeading, category, description } = req.body as {
        courseId?: string;
        lessonId?: string;
        segmentHeading?: string;
        category?: string;
        description?: string;
      };
      const validCategories = new Set([
        'accuracy',
        'translation',
        'accessibility',
        'rights',
        'safety',
        'segment_review',
      ]);
      if (!category || !validCategories.has(category)) {
        res.status(400).json({ error: 'Select a valid report category.' });
        return;
      }
      if (!description || description.trim().length < 5) {
        res.status(400).json({ error: 'Please describe the issue or question in at least 5 characters.' });
        return;
      }
      const id = uid('rep');
      await db.execute(
        `INSERT INTO issue_reports (id, user_id, course_id, lesson_id, segment_heading, category, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)`,
        [
          id,
          req.authUser?.id ?? null,
          courseId ?? null,
          lessonId ?? null,
          segmentHeading?.trim() || null,
          category,
          description.trim(),
          new Date().toISOString(),
        ]
      );

      res.status(201).json({ ok: true, reportId: id });
    })
  );

  // Asynchronous Student Lesson Segment Review Request -> Admin Console moderation queue
  app.post(
    '/api/reviews/request',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const { courseId, lessonId, lessonTitle, segmentHeading, comment } = req.body as {
        courseId?: string;
        lessonId?: string;
        lessonTitle?: string;
        segmentHeading?: string;
        comment?: string;
      };
      if (!courseId || !lessonId) {
        res.status(400).json({ error: 'courseId and lessonId are required.' });
        return;
      }
      const cleanComment = (comment || '').trim();
      if (cleanComment.length < 5) {
        res.status(400).json({ error: 'Please enter a comment or question of at least 5 characters.' });
        return;
      }
      const cleanSegment = (segmentHeading || 'General Lesson Segment').trim();
      const cleanLessonTitle = (lessonTitle || 'Lesson').trim();
      const studentName = req.authUser?.displayName || 'Learner';
      const now = new Date().toISOString();
      const reviewId = uid('rev');
      const reportId = uid('rep');

      await runInTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO lesson_review_requests (
            id, user_id, student_display_name, course_id, lesson_id, lesson_title,
            segment_heading, comment, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9)`,
          [
            reviewId,
            req.authUser?.id ?? null,
            studentName,
            courseId,
            lessonId,
            cleanLessonTitle,
            cleanSegment,
            cleanComment,
            now,
          ]
        );

        await tx.execute(
          `INSERT INTO issue_reports (
            id, user_id, course_id, lesson_id, segment_heading, category, description, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, 'segment_review', $6, 'open', $7)`,
          [
            reportId,
            req.authUser?.id ?? null,
            courseId,
            lessonId,
            cleanSegment,
            `[${cleanLessonTitle} — ${cleanSegment}] (${studentName}): ${cleanComment}`,
            now,
          ]
        );
      });

      res.status(201).json({
        ok: true,
        reviewRequestId: reviewId,
        reportId,
        status: 'open',
        notifiedAt: now,
      });
    })
  );

  // --- ADMIN CONSOLE ROUTES (/api/admin/*) ---
  // Every admin endpoint sits behind this gate (401 without a session, 403 for
  // non-admins) in addition to the per-route `requireAdmin`, so a route added
  // below without a guard still cannot be reached by a learner.
  app.use('/api/admin', requireAdmin);

  const MODERATION_STATUSES = ['open', 'investigating', 'resolved'] as const;
  type ModerationStatus = (typeof MODERATION_STATUSES)[number];
  const isModerationStatus = (value: unknown): value is ModerationStatus =>
    typeof value === 'string' && (MODERATION_STATUSES as readonly string[]).includes(value);
  const readQueryString = (value: unknown, max = 120): string =>
    typeof value === 'string' ? value.trim().slice(0, max) : '';
  const readLimit = (value: unknown, fallback: number, max: number): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
  };
  const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const mapReportRow = (r: Record<string, unknown>) => ({
    id: String(r.id),
    courseId: r.course_id ? String(r.course_id) : null,
    lessonId: r.lesson_id ? String(r.lesson_id) : null,
    segmentHeading: r.segment_heading ? String(r.segment_heading) : null,
    category: String(r.category),
    description: String(r.description),
    status: String(r.status) as ModerationStatus,
    resolutionNote: r.resolution_note ? String(r.resolution_note) : null,
    createdAt: toIso(r.created_at) || '',
  });

  const mapReviewRequestRow = (rv: Record<string, unknown>) => ({
    id: String(rv.id),
    userId: rv.user_id ? String(rv.user_id) : null,
    studentDisplayName: String(rv.student_display_name || 'Learner'),
    courseId: String(rv.course_id),
    lessonId: String(rv.lesson_id),
    lessonTitle: String(rv.lesson_title || ''),
    segmentHeading: String(rv.segment_heading || 'General Lesson Segment'),
    comment: String(rv.comment),
    status: String(rv.status) as ModerationStatus,
    reviewerNote: rv.reviewer_note ? String(rv.reviewer_note) : null,
    createdAt: toIso(rv.created_at) || '',
  });

  const mapCertificateRow = (c: Record<string, unknown>) => ({
    id: String(c.id),
    userId: c.user_id ? String(c.user_id) : null,
    recipientDisplayName: String(c.recipient_display_name),
    courseTitle: String(c.course_title),
    locale: String(c.locale),
    publicToken: String(c.public_token),
    status: String(c.status) as 'valid' | 'revoked',
    issuedAt: toIso(c.issued_at) || '',
    revokedAt: toIso(c.revoked_at),
    revokeReason: c.revoke_reason ? String(c.revoke_reason) : null,
  });

  const mapAuditRow = (a: Record<string, unknown>) => ({
    id: String(a.id),
    actorUserId: a.actor_user_id ? String(a.actor_user_id) : null,
    actorDisplayName: a.actor_display_name ? String(a.actor_display_name) : null,
    action: String(a.action),
    targetType: String(a.target_type),
    targetId: String(a.target_id),
    reason: String(a.reason),
    createdAt: toIso(a.created_at) || '',
  });

  const AUDIT_SELECT = `SELECT a.*, p.display_name AS actor_display_name
     FROM audit_events a
     LEFT JOIN learner_profiles p ON p.user_id = a.actor_user_id`;

  // Moderation: a review request's status/note is updated and audit-logged.
  app.patch(
    '/api/admin/reviews/:reviewId',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const reviewId = String(req.params.reviewId);
      const { status, reviewerNote } = req.body as { status?: unknown; reviewerNote?: unknown };
      const nextStatus: ModerationStatus = status === undefined ? 'resolved' : (status as ModerationStatus);
      if (!isModerationStatus(nextStatus)) {
        res.status(400).json({ error: 'Status must be open, investigating or resolved.' });
        return;
      }
      const note =
        (typeof reviewerNote === 'string' ? reviewerNote.trim().slice(0, 2000) : '') ||
        'Reviewed and answered by an ECONOVA administrator.';
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM lesson_review_requests WHERE id = $1',
        [reviewId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Review request not found.' });
        return;
      }
      const now = new Date().toISOString();
      await runInTransaction(async (tx) => {
        await tx.execute(
          'UPDATE lesson_review_requests SET status = $1, reviewer_note = $2 WHERE id = $3',
          [nextStatus, note, reviewId]
        );
        await tx.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, $3, 'lesson_review_request', $4, $5, $6)`,
          [uid('aud'), req.authUser!.id, `moderation_review_${nextStatus}`, reviewId, note, now]
        );
      });
      res.json({ ok: true, status: nextStatus });
    })
  );

  app.get(
    '/api/admin/overview',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const [editionCounts, reportRow, reviewRow, userRow, certRow, xpTotalRow, recentAudit] =
        await Promise.all([
          db.query<{ status: string; count: number }>(
            'SELECT status, COUNT(*)::int AS count FROM course_editions GROUP BY status'
          ),
          db.queryOne<{ open: number; investigating: number }>(
            `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open,
                    COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating
             FROM issue_reports`
          ),
          db.queryOne<{ open: number; investigating: number }>(
            `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open,
                    COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating
             FROM lesson_review_requests`
          ),
          db.queryOne<{ total: number; admins: number }>(
            "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE role = 'admin')::int AS admins FROM users"
          ),
          db.queryOne<{ valid: number; revoked: number }>(
            `SELECT COUNT(*) FILTER (WHERE status = 'valid')::int AS valid,
                    COUNT(*) FILTER (WHERE status = 'revoked')::int AS revoked
             FROM certificates`
          ),
          db.queryOne<{ total: number; count: number }>(
            "SELECT COALESCE(SUM(amount), 0)::int as total, COUNT(*)::int as count FROM xp_ledger WHERE status = 'valid'"
          ),
          db.query<Record<string, unknown>>(`${AUDIT_SELECT} ORDER BY a.created_at DESC LIMIT 6`),
        ]);

      const byStatus = (status: string) =>
        Number(editionCounts.find((row) => row.status === status)?.count ?? 0);
      const totalUsers = Number(userRow?.total ?? 0);
      const admins = Number(userRow?.admins ?? 0);

      res.json({
        kpis: {
          editions: {
            draft: byStatus('draft'),
            inReview:
              byStatus('subject_review') + byStatus('language_review') + byStatus('rights_accessibility_review'),
            approved: byStatus('approved'),
            published: byStatus('published'),
            retired: byStatus('retired'),
            total: editionCounts.reduce((sum, row) => sum + Number(row.count), 0),
          },
          moderation: {
            openReports: Number(reportRow?.open ?? 0),
            investigatingReports: Number(reportRow?.investigating ?? 0),
            openReviewRequests: Number(reviewRow?.open ?? 0),
            investigatingReviewRequests: Number(reviewRow?.investigating ?? 0),
          },
          users: { total: totalUsers, admins, learners: Math.max(totalUsers - admins, 0) },
          certificates: {
            valid: Number(certRow?.valid ?? 0),
            revoked: Number(certRow?.revoked ?? 0),
          },
          xp: {
            totalNonCashXpIssued: Number(xpTotalRow?.total ?? 0),
            validEntriesCount: Number(xpTotalRow?.count ?? 0),
          },
        },
        recentAuditEvents: recentAudit.map(mapAuditRow),
      });
    })
  );

  app.get(
    '/api/admin/editions',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const editions = await db.query<Record<string, unknown>>(
        `SELECT ce.*, c.subject, c.level
         FROM course_editions ce
         JOIN courses c ON c.id = ce.course_id
         ORDER BY ce.updated_at DESC`
      );
      const mapped = await Promise.all(
        editions.map(async (e) => ({
          ...(await mapEditionSummary(e)),
          subject: String(e.subject),
          level: String(e.level),
        }))
      );
      res.json({ editions: mapped });
    })
  );

  app.post(
    '/api/admin/editions/draft',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const {
        courseId,
        locale,
        title,
        subtitle,
        description,
        sourceTitle,
        authorCreator,
        originalUrl,
        licenseBasis,
        aiAssisted,
        aiModel,
        lessonTitle,
        lessonBody,
      } = req.body as {
        courseId?: string;
        locale?: LocaleCode;
        title?: string;
        subtitle?: string;
        description?: string;
        sourceTitle?: string;
        authorCreator?: string;
        originalUrl?: string;
        licenseBasis?: string;
        aiAssisted?: boolean;
        aiModel?: string;
        lessonTitle?: string;
        lessonBody?: string;
      };

      if (!courseId || (locale !== 'en' && locale !== 'uz') || !title || title.trim().length < 3) {
        res.status(400).json({ error: 'Course, edition locale, and title are required.' });
        return;
      }

      const courseExists = await db.queryOne<{ id: string }>(
        'SELECT id FROM courses WHERE id = $1',
        [courseId]
      );
      if (!courseExists) {
        res.status(404).json({ error: 'Target course not found.' });
        return;
      }

      const now = new Date().toISOString();
      const provId = uid('prov');
      const editionId = uid('ed');

      const latestVersionRow = await db.queryOne<{ maxv: number }>(
        'SELECT COALESCE(MAX(version), 0)::int as maxv FROM course_editions WHERE course_id = $1 AND locale = $2',
        [courseId, locale]
      );
      const nextVersion = Number(latestVersionRow?.maxv ?? 0) + 1;

      await runInTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO provenance_records (
            id, source_title, author_creator, original_url, publisher_platform,
            license_basis, attribution_text, commercial_allowed, adaptation_allowed,
            translation_allowed, ai_assisted, ai_model, prompt_version, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, TRUE, $8, $9, $10, $11)`,
          [
            provId,
            sourceTitle?.trim() || 'ECONOVA Editorial Draft Source',
            authorCreator?.trim() || req.authUser!.displayName,
            originalUrl?.trim() || 'https://econova.edu/editorial',
            'ECONOVA Admin Console',
            licenseBasis?.trim() || 'Original Draft — Pending Rights Sign-off',
            'Draft awaiting rights and subject review.',
            Boolean(aiAssisted),
            aiAssisted ? aiModel || 'gemini-4-hydrogen' : null,
            aiAssisted ? 'editorial-draft-v1' : null,
            'Created via the Admin Console; cannot publish without recorded review sign-offs.',
          ]
        );

        await tx.execute(
          `INSERT INTO course_editions (
            id, course_id, locale, version, title, subtitle, description,
            outcomes_json, prerequisites_json, completion_rules, passing_score_percent,
            status, provenance_id, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, 70, 'draft', $11, $12)`,
          [
            editionId,
            courseId,
            locale,
            nextVersion,
            title.trim(),
            subtitle?.trim() || 'Draft edition awaiting editorial review.',
            description?.trim() || 'Draft curriculum module created in the Admin Console.',
            JSON.stringify(['Demonstrate core understanding after completing lessons and assessment.']),
            JSON.stringify(['None required for draft review.']),
            'Complete all required lessons and score 70% or higher on the course assessment.',
            provId,
            now,
          ]
        );

        if (lessonTitle?.trim()) {
          await tx.execute(
            `INSERT INTO lessons (
              id, edition_id, sequence_num, title, summary, objectives_json,
              body_blocks_json, key_terms_json, simulation_type, transcript,
              estimated_minutes, is_required, provenance_id
            ) VALUES ($1, $2, 1, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, 'none', $8, 15, TRUE, $9)`,
            [
              uid('les'),
              editionId,
              lessonTitle.trim(),
              'Draft lesson created for human review.',
              JSON.stringify(['Understand key concepts in this draft lesson.']),
              JSON.stringify([
                {
                  kind: 'concept',
                  heading: lessonTitle.trim(),
                  body: lessonBody?.trim() || 'Draft lesson content awaiting subject and language review.',
                },
              ]),
              JSON.stringify([]),
              lessonBody?.trim() || 'Draft transcript awaiting accessibility check.',
              provId,
            ]
          );
        }

        await tx.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, 'create_draft_edition', 'course_edition', $3, $4, $5)`,
          [uid('aud'), req.authUser!.id, editionId, `Created draft v${nextVersion} (${locale})`, now]
        );
      });

      res.status(201).json({ ok: true, editionId, version: nextVersion, status: 'draft' });
    })
  );

  // Draft editing: title / subtitle / description of an edition still in Draft.
  // Editions in review or later must be sent back to Draft first, so reviewed
  // text can never change silently.
  app.patch(
    '/api/admin/editions/:editionId/draft',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const editionId = String(req.params.editionId);
      const body = req.body as { title?: unknown; subtitle?: unknown; description?: unknown };
      const updates: Record<'title' | 'subtitle' | 'description', string | undefined> = {
        title: undefined,
        subtitle: undefined,
        description: undefined,
      };
      const limits = { title: 200, subtitle: 300, description: 4000 } as const;
      for (const field of ['title', 'subtitle', 'description'] as const) {
        const value = body[field];
        if (value === undefined) continue;
        if (typeof value !== 'string') {
          res.status(400).json({ error: `${field} must be text.` });
          return;
        }
        const trimmed = value.trim();
        if (trimmed.length > limits[field]) {
          res.status(400).json({ error: `${field} must be at most ${limits[field]} characters.` });
          return;
        }
        updates[field] = trimmed;
      }
      if (updates.title !== undefined && updates.title.length < 3) {
        res.status(400).json({ error: 'Title must be at least 3 characters.' });
        return;
      }
      const changedFields = (Object.keys(updates) as Array<keyof typeof updates>).filter(
        (field) => updates[field] !== undefined
      );
      if (changedFields.length === 0) {
        res.status(400).json({ error: 'Provide a title, subtitle or description to update.' });
        return;
      }

      const row = await db.queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM course_editions WHERE id = $1',
        [editionId]
      );
      if (!row) {
        res.status(404).json({ error: 'Edition not found.' });
        return;
      }
      if (row.status !== 'draft') {
        res.status(409).json({ error: 'Only Draft editions can be edited. Send the edition back to Draft first.' });
        return;
      }

      const now = new Date().toISOString();
      await runInTransaction(async (tx) => {
        await tx.execute(
          `UPDATE course_editions
           SET title = COALESCE($1, title),
               subtitle = COALESCE($2, subtitle),
               description = COALESCE($3, description),
               updated_at = $4
           WHERE id = $5 AND status = 'draft'`,
          [updates.title ?? null, updates.subtitle ?? null, updates.description ?? null, now, editionId]
        );
        await tx.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, 'edit_draft_edition', 'course_edition', $3, $4, $5)`,
          [uid('aud'), req.authUser!.id, editionId, `Edited draft fields: ${changedFields.join(', ')}`, now]
        );
      });
      res.json({ ok: true, editionId, updatedFields: changedFields });
    })
  );

  app.post(
    '/api/admin/editions/:editionId/transition',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const editionId = String(req.params.editionId);
      const { nextStatus, signoffType, signoffs, reason } = req.body as {
        nextStatus?: EditorialStatus;
        signoffType?: EditorialSignoffType | null;
        signoffs?: unknown;
        reason?: string;
      };

      const row = await db.queryOne<Record<string, unknown>>(
        'SELECT * FROM course_editions WHERE id = $1',
        [editionId]
      );
      if (!row) {
        res.status(404).json({ error: 'Edition not found.' });
        return;
      }
      if (signoffs !== undefined && signoffs !== null && !Array.isArray(signoffs)) {
        res.status(400).json({ error: 'signoffs must be a list of subject, language or rights.' });
        return;
      }

      const targetStatus = (nextStatus ?? row.status) as EditorialStatus;
      const roleCheck = authorizeEditorialTransition({
        actorId: req.authUser!.id,
        actorRole: req.authUser!.role,
        currentStatus: row.status as EditorialStatus,
        targetStatus,
        signoffType: signoffType ?? null,
        signoffTypes: Array.isArray(signoffs) ? (signoffs as EditorialSignoffType[]) : null,
      });
      if (!roleCheck.allowed) {
        res.status(roleCheck.reason.startsWith('Unknown') ? 400 : 403).json({ error: roleCheck.reason });
        return;
      }

      // Sign-offs keep provenance: each slot records the acting admin's ID.
      const now = new Date().toISOString();
      let subjectRev = row.subject_reviewer_id ? String(row.subject_reviewer_id) : null;
      let langRev = row.language_reviewer_id ? String(row.language_reviewer_id) : null;
      let rightsRev = row.rights_reviewer_id ? String(row.rights_reviewer_id) : null;
      if (roleCheck.signoffs.includes('subject')) subjectRev = req.authUser!.id;
      if (roleCheck.signoffs.includes('language')) langRev = req.authUser!.id;
      if (roleCheck.signoffs.includes('rights')) rightsRev = req.authUser!.id;

      const check = canTransitionEditorialState(row.status as EditorialStatus, targetStatus, {
        hasProvenance: Boolean(row.provenance_id),
        hasSubjectReview: Boolean(subjectRev),
        hasLanguageReview: Boolean(langRev),
        hasRightsAccessibilityReview: Boolean(rightsRev),
      });

      if (!check.allowed) {
        res.status(400).json({ error: check.reason || 'Transition blocked by human review gate.' });
        return;
      }

      const signoffLabel = roleCheck.signoffs.length > 0 ? roleCheck.signoffs.join('+') : 'none';
      await runInTransaction(async (tx) => {
        await tx.execute(
          `UPDATE course_editions
           SET status = $1, subject_reviewer_id = $2, language_reviewer_id = $3, rights_reviewer_id = $4,
               published_at = CASE WHEN $5 = 'published' THEN COALESCE(published_at, $6::timestamptz) ELSE published_at END,
               updated_at = $7
           WHERE id = $8`,
          [targetStatus, subjectRev, langRev, rightsRev, targetStatus, now, now, editionId]
        );

        await tx.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, $3, 'course_edition', $4, $5, $6)`,
          [
            uid('aud'),
            req.authUser!.id,
            `editorial_${targetStatus}`,
            editionId,
            reason?.trim() || `${String(row.status)} -> ${targetStatus} (sign-offs: ${signoffLabel})`,
            now,
          ]
        );
      });

      res.json({ ok: true, status: targetStatus, signoffs: roleCheck.signoffs });
    })
  );

  app.get(
    '/api/admin/moderation',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const status = readQueryString(req.query.status, 20);
      const filter = isModerationStatus(status) ? status : null;
      const where = filter ? 'WHERE status = $1' : '';
      const params = filter ? [filter] : [];
      const [reports, reviewRequests] = await Promise.all([
        db.query<Record<string, unknown>>(
          `SELECT * FROM issue_reports ${where} ORDER BY created_at DESC LIMIT 200`,
          params
        ),
        db.query<Record<string, unknown>>(
          `SELECT * FROM lesson_review_requests ${where} ORDER BY created_at DESC LIMIT 200`,
          params
        ),
      ]);
      res.json({
        status: filter ?? 'all',
        reports: reports.map(mapReportRow),
        reviewRequests: reviewRequests.map(mapReviewRequestRow),
      });
    })
  );

  app.patch(
    '/api/admin/reports/:reportId',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const reportId = String(req.params.reportId);
      const { status, resolutionNote } = req.body as { status?: unknown; resolutionNote?: unknown };
      const nextStatus: ModerationStatus = status === undefined ? 'resolved' : (status as ModerationStatus);
      if (!isModerationStatus(nextStatus)) {
        res.status(400).json({ error: 'Status must be open, investigating or resolved.' });
        return;
      }
      const note =
        (typeof resolutionNote === 'string' ? resolutionNote.trim().slice(0, 2000) : '') ||
        'Reviewed by an ECONOVA administrator.';
      const existing = await db.queryOne<{ id: string }>('SELECT id FROM issue_reports WHERE id = $1', [
        reportId,
      ]);
      if (!existing) {
        res.status(404).json({ error: 'Issue report not found.' });
        return;
      }
      const now = new Date().toISOString();
      await runInTransaction(async (tx) => {
        await tx.execute('UPDATE issue_reports SET status = $1, resolution_note = $2 WHERE id = $3', [
          nextStatus,
          note,
          reportId,
        ]);
        await tx.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, $3, 'issue_report', $4, $5, $6)`,
          [uid('aud'), req.authUser!.id, `moderation_report_${nextStatus}`, reportId, note, now]
        );
      });
      res.json({ ok: true, status: nextStatus });
    })
  );

  app.get(
    '/api/admin/certificates',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const q = readQueryString(req.query.q);
      const status = readQueryString(req.query.status, 20);
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (status === 'valid' || status === 'revoked') {
        params.push(status);
        clauses.push(`status = $${params.length}`);
      }
      if (q) {
        params.push(likePattern(q));
        const i = params.length;
        clauses.push(
          `(recipient_display_name ILIKE $${i} OR course_title ILIKE $${i} OR public_token ILIKE $${i})`
        );
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = await db.query<Record<string, unknown>>(
        `SELECT * FROM certificates ${where} ORDER BY issued_at DESC LIMIT 200`,
        params
      );
      res.json({ certificates: rows.map(mapCertificateRow) });
    })
  );

  app.post(
    '/api/admin/certificates/:certificateId/revoke',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const certificateId = String(req.params.certificateId);
      const { reason } = req.body as { reason?: string };
      if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        res.status(400).json({ error: 'A clear audit reason is required to revoke a certificate.' });
        return;
      }
      const cert = await db.queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM certificates WHERE id = $1',
        [certificateId]
      );
      if (!cert) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }
      if (cert.status === 'revoked') {
        res.status(409).json({ error: 'This certificate is already revoked.' });
        return;
      }
      const now = new Date().toISOString();
      await runInTransaction(async (tx) => {
        await tx.execute(
          "UPDATE certificates SET status = 'revoked', revoked_at = $1, revoke_reason = $2 WHERE id = $3",
          [now, reason.trim(), certificateId]
        );
        await tx.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, 'revoke_certificate', 'certificate', $3, $4, $5)`,
          [uid('aud'), req.authUser!.id, certificateId, reason.trim(), now]
        );
      });
      res.json({ ok: true });
    })
  );

  // User management: list accounts. Legacy staff roles read as 'learner'.
  app.get(
    '/api/admin/users',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const q = readQueryString(req.query.q);
      const params: unknown[] = [];
      let where = '';
      if (q) {
        params.push(likePattern(q));
        where = 'WHERE u.email ILIKE $1 OR p.display_name ILIKE $1';
      }
      const rows = await db.query<{
        id: string;
        email: string;
        role: string;
        display_name: string | null;
        created_at: unknown;
      }>(
        `SELECT u.id, u.email, u.role, p.display_name, u.created_at
         FROM users u
         LEFT JOIN learner_profiles p ON p.user_id = u.id
         ${where}
         ORDER BY u.created_at DESC
         LIMIT 200`,
        params
      );
      res.json({
        users: rows.map((u) => ({
          id: String(u.id),
          email: String(u.email),
          displayName: u.display_name ? String(u.display_name) : String(u.email).split('@')[0],
          role: normalizeUserRole(u.role),
          createdAt: toIso(u.created_at) || '',
        })),
      });
    })
  );

  // User management: set a user's role to 'learner' or 'admin'. An admin can
  // never demote themselves; every change is audit-logged.
  app.patch(
    '/api/admin/users/:userId/role',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = String(req.params.userId);
      const { role } = req.body as { role?: unknown };
      const target = await db.queryOne<{ id: string; role: string }>(
        'SELECT id, role FROM users WHERE id = $1',
        [userId]
      );
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const decision = authorizeRoleChange({
        actorId: req.authUser!.id,
        actorRole: req.authUser!.role,
        targetUserId: userId,
        requestedRole: role,
        currentRole: target.role,
      });
      if (!decision.allowed) {
        res.status(decision.status).json({ error: decision.reason });
        return;
      }
      // Rewrite legacy values (e.g. 'editor') even when the effective role is unchanged.
      if (!decision.changed && target.role === decision.nextRole) {
        res.json({ ok: true, userId, role: decision.nextRole, changed: false });
        return;
      }
      const now = new Date().toISOString();
      await runInTransaction(async (tx) => {
        await tx.execute('UPDATE users SET role = $1 WHERE id = $2', [decision.nextRole, userId]);
        await tx.execute(
          `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, reason, created_at)
           VALUES ($1, $2, 'change_user_role', 'user', $3, $4, $5)`,
          [
            uid('aud'),
            req.authUser!.id,
            userId,
            `Role changed from ${target.role} to ${decision.nextRole}`,
            now,
          ]
        );
      });
      res.json({ ok: true, userId, role: decision.nextRole, changed: true });
    })
  );

  app.get(
    '/api/admin/audit',
    requireDatabase,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const action = readQueryString(req.query.action, 80);
      const targetType = readQueryString(req.query.targetType, 80);
      const q = readQueryString(req.query.q);
      const limit = readLimit(req.query.limit, 100, 500);
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (action) {
        params.push(action);
        clauses.push(`a.action = $${params.length}`);
      }
      if (targetType) {
        params.push(targetType);
        clauses.push(`a.target_type = $${params.length}`);
      }
      if (q) {
        params.push(likePattern(q));
        const i = params.length;
        clauses.push(
          `(a.reason ILIKE $${i} OR a.target_id ILIKE $${i} OR a.actor_user_id ILIKE $${i} OR p.display_name ILIKE $${i})`
        );
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      params.push(limit);
      const [events, actions, targetTypes] = await Promise.all([
        db.query<Record<string, unknown>>(
          `${AUDIT_SELECT} ${where} ORDER BY a.created_at DESC LIMIT $${params.length}`,
          params
        ),
        db.query<{ action: string }>('SELECT DISTINCT action FROM audit_events ORDER BY action LIMIT 200'),
        db.query<{ target_type: string }>(
          'SELECT DISTINCT target_type FROM audit_events ORDER BY target_type LIMIT 100'
        ),
      ]);
      res.json({
        events: events.map(mapAuditRow),
        actions: actions.map((row) => String(row.action)),
        targetTypes: targetTypes.map((row) => String(row.target_type)),
      });
    })
  );

  // --- SERVER-SIDE GEMINI AI ROUTES (Disabled until GEMINI_API_KEY is configured in Secrets) ---
  app.post('/api/ai/chat', async (req: AuthenticatedRequest, res) => {
    if (!isAiConfigured()) {
      res.status(503).json({
        error:
          'AI features are disabled until GEMINI_API_KEY is configured in AI Studio Settings > Secrets.',
      });
      return;
    }
    try {
      const { model, mode, locale, history, message } = req.body as {
        model?: string;
        mode?: 'study_tutor' | 'editorial_draft';
        locale?: LocaleCode;
        history?: AiChatMessage[];
        message?: string;
      };
      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const systemInstruction =
        mode === 'editorial_draft'
          ? `You are an ECONOVA Curriculum Draft Assistant helping human editors outline ${locale === 'uz' ? 'Uzbek Latin' : 'English'} lessons in Economics, Mathematics, and Business. All output is strictly an unverified DRAFT requiring human subject, language, and provenance review. Label hypothetical numbers explicitly and never fabricate citations.`
          : `You are an ECONOVA Socratic Study Companion for Economics, Mathematics, and Business (${locale === 'uz' ? 'respond in Uzbek Latin' : 'respond in English'}). Guide learners with clear explanations, worked examples, and intuition. Never give away exact assessment answer keys; encourage step-by-step reasoning.`;

      const result = await runAiChat({
        model: model || 'gemini-4-hydrogen',
        systemInstruction,
        history: Array.isArray(history) ? history.slice(-12) : [],
        message: message.trim(),
      });

      res.json({
        reply: result.reply,
        model: result.model,
        draftNotice:
          mode === 'editorial_draft'
            ? 'AI output is a Draft and cannot auto-publish without human review.'
            : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/generate-image', requireAdmin, async (req, res) => {
    if (!isAiConfigured()) {
      res.status(503).json({
        error:
          'AI features are disabled until GEMINI_API_KEY is configured in AI Studio Settings > Secrets.',
      });
      return;
    }
    try {
      const { prompt, imageSize, aspectRatio } = req.body as {
        prompt?: string;
        imageSize?: '1K' | '2K' | '4K';
        aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4';
      };
      if (!prompt || prompt.trim().length < 5) {
        res.status(400).json({ error: 'Please provide a descriptive diagram prompt.' });
        return;
      }
      const result = await runAiImageGeneration({
        prompt: prompt.trim(),
        imageSize: imageSize || '1K',
        aspectRatio: aspectRatio || '16:9',
      });
      res.json({
        ...result,
        provenanceNote:
          'Generated visual is an AI draft. Rights and accessibility text alternatives must be reviewed before publishing.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed.';
      res.status(500).json({ error: message });
    }
  });

  // Global sanitized JSON error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An internal server error occurred.' });
    }
  });

  // Route Guard & Session Headers Middleware before SPA HTML serving
  app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      next();
      return;
    }
    const accept = req.headers.accept || '';
    if (!accept.includes('text/html')) {
      next();
      return;
    }
    // Uses the session verified by attachOptionalAuth (signature + DB lookup),
    // never an unverified token decode.
    const decision = evaluateMiddlewareRouteGuard({
      pathname: req.path,
      search: req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '',
      isAuthenticated: Boolean(req.authUser),
      userRole: req.authUser?.role ?? null,
    });
    res.setHeader('x-econova-auth-status', req.authUser ? 'authenticated' : 'anonymous');
    res.setHeader('x-econova-route-policy', decision.policyId);
    if (decision.mode !== 'public') {
      // Session-dependent pages must never be served from a shared cache.
      res.setHeader('Cache-Control', 'no-store');
      res.vary('Cookie');
    }
    if (decision.action === 'redirect' && decision.destination) {
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(
        302,
        withAccessNotice(resolveGuardRedirectTarget(decision.destination), decision.reason)
      );
      return;
    }
    next();
  });

  return app;
}

export const app = buildApp();
export default app;

async function startLocalServer(): Promise<void> {
  const httpServer = http.createServer(app);

  // Vite middleware in development, static dist/ in production
  const isProd =
    process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));
  if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    // Loaded lazily through a variable specifier so the production/serverless
    // bundle never pulls Vite (and its native binaries) into the function.
    const viteModuleId = 'vite';
    const { createServer: createViteServer } = (await import(viteModuleId)) as typeof import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`ECONOVA server listening on http://localhost:${port}`);
  });
}

const isMainModule = typeof process.argv[1] === 'string' && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (!isServerless && isMainModule && process.env.NODE_ENV !== 'test') {
  startLocalServer().catch((err) => {
    console.error('Failed to start ECONOVA server:', err);
    process.exit(1);
  });
}
