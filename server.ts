import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import {
  attachOptionalAuth,
  clearSessionCookie,
  hashPassword,
  isSessionSecretConfigured,
  loadUserSummaryById,
  requireAuth,
  requireStaffRole,
  setSessionCookie,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
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
  calculateAssessmentScore,
  calculateEligibleXp,
  canTransitionEditorialState,
  evaluateCertificateVerification,
  evaluateCourseCompletion,
  evaluateStreakUpdate,
  formatLocalDateKey,
  XP_RULE_VERSION,
} from './src/shared/econova-rules.ts';
import type {
  AssessmentPublic,
  CourseCatalogItem,
  CourseEditionSummary,
  EditorialStatus,
  KeyTerm,
  LessonBlock,
  LessonPublic,
  LocaleCode,
  ProvenanceSummary,
  QuestionPublic,
  QuestionWithKey,
} from './src/shared/types.ts';

let initPromise: Promise<void> | null = null;

async function ensureDbReady(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!initPromise) {
    initPromise = (async () => {
      if (process.env.AUTO_MIGRATE !== 'false') {
        await applyMigrations();
      }
      await seedIfEmpty();
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
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
  const lessonStats = await exec.queryOne<{ cnt: number; mins: number }>(
    `SELECT COUNT(*)::int as cnt, COALESCE(SUM(estimated_minutes), 0)::int as mins
     FROM lessons WHERE edition_id = $1`,
    [String(row.id)]
  );

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

function requireDatabase(req: Request, res: Response, next: NextFunction): void {
  if (!isDatabaseConfigured()) {
    res.status(503).json({
      error:
        'Supabase PostgreSQL is not configured yet. Set SUPABASE_DB_URL (or DATABASE_URL) in AI Studio Settings > Secrets and apply supabase/migrations/*.sql.',
    });
    return;
  }
  ensureDbReady()
    .then(() => next())
    .catch((err) => {
      console.error('Database initialization error:', err);
      res.status(503).json({
        error: 'Unable to initialize Supabase PostgreSQL connection. Verify credentials and migrations.',
      });
    });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(asyncHandler(attachOptionalAuth));

  // Healthcheck (exposes only safe boolean configuration flags, never secrets)
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'econova',
      database: 'supabase_postgresql',
      databaseConfigured: isDatabaseConfigured(),
      sessionConfigured: isSessionSecretConfigured(),
      aiConfigured: isAiConfigured(),
      sandboxEnabled: process.env.ENABLE_DEMO_SANDBOX === 'true',
    });
  });

  // --- AUTH ---
  app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser ?? null });
  });

  app.post(
    '/api/auth/register',
    requireDatabase,
    asyncHandler(async (req, res) => {
      if (process.env.NODE_ENV === 'production' && !isSessionSecretConfigured()) {
        res.status(503).json({
          error: 'SESSION_SECRET is not configured in production environment.',
        });
        return;
      }
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

      const exists = await db.queryOne<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [cleanEmail]
      );
      if (exists) {
        res.status(409).json({ error: 'An account with this email already exists.' });
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

      setSessionCookie(res, userId);
      res.status(201).json({ user: await loadUserSummaryById(userId) });
    })
  );

  app.post(
    '/api/auth/login',
    requireDatabase,
    asyncHandler(async (req, res) => {
      if (process.env.NODE_ENV === 'production' && !isSessionSecretConfigured()) {
        res.status(503).json({
          error: 'SESSION_SECRET is not configured in production environment.',
        });
        return;
      }
      const { email, password } = req.body as { email?: string; password?: string };
      const cleanEmail = (email ?? '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }
      const row = await db.queryOne<{ id: string; password_hash: string }>(
        'SELECT id, password_hash FROM users WHERE email = $1',
        [cleanEmail]
      );
      if (!row || !verifyPassword(password, row.password_hash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      setSessionCookie(res, row.id);
      res.json({ user: await loadUserSummaryById(row.id) });
    })
  );

  app.post(
    '/api/auth/sandbox',
    requireDatabase,
    asyncHandler(async (req, res) => {
      if (process.env.ENABLE_DEMO_SANDBOX !== 'true') {
        res.status(403).json({
          error:
            'Demo sandbox sign-in is disabled for real learner data. Please sign in or create a learner account.',
        });
        return;
      }
      const { account } = req.body as { account?: 'learner' | 'staff' };
      const targetId = account === 'staff' ? 'user-editor' : 'user-dilnoza';
      const user = await loadUserSummaryById(targetId);
      if (!user) {
        res.status(404).json({ error: 'Sandbox profile not found.' });
        return;
      }
      setSessionCookie(res, user.id);
      res.json({ user });
    })
  );

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // --- PUBLIC CATALOG & COURSES ---
  app.get(
    '/api/catalog',
    requireDatabase,
    asyncHandler(async (_req, res) => {
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
    })
  );

  app.get(
    '/api/courses/:courseId/editions/:locale',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const courseId = String(req.params.courseId);
      const locale = String(req.params.locale);
      if (locale !== 'en' && locale !== 'uz') {
        res.status(400).json({ error: 'Unsupported edition locale. Expected en or uz.' });
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
          simulationType: l.simulation_type as LessonPublic['simulationType'],
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
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.authUser!.id;
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

      res.json({
        enrollments: enrichedEnrollments,
        totalXp: Number(totalXpRow?.total ?? 0),
        xpToday: await getXpEarnedToday(userId, req.authUser!.timezone),
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
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const { courseId, locale } = req.body as { courseId?: string; locale?: LocaleCode };
      if (!courseId || (locale !== 'en' && locale !== 'uz')) {
        res.status(400).json({ error: 'Valid courseId and edition locale (en/uz) are required.' });
        return;
      }
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.authUser!.id, courseId]
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

  app.put(
    '/api/me/progress/:lessonId',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const lessonId = String(req.params.lessonId);
      const { evidence } = req.body as { evidence?: string };
      const lesson = await db.queryOne<{
        id: string;
        title: string;
        edition_id: string;
        course_id: string;
        locale: LocaleCode;
        version: number;
      }>(
        `SELECT l.id, l.title, l.edition_id, ce.course_id, ce.locale, ce.version
         FROM lessons l
         JOIN course_editions ce ON ce.id = l.edition_id
         WHERE l.id = $1 AND ce.status = 'published'`,
        [lessonId]
      );

      if (!lesson) {
        res.status(404).json({ error: 'Published lesson not found.' });
        return;
      }

      const out = await runInTransaction(async (tx) => {
        const now = new Date().toISOString();
        const existing = await tx.queryOne<{ id: string }>(
          'SELECT id FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
          [req.authUser!.id, lesson.id]
        );

        if (!existing) {
          await tx.execute(
            `INSERT INTO lesson_progress (id, user_id, lesson_id, edition_version, state, completion_evidence, updated_at)
             VALUES ($1, $2, $3, $4, 'completed', $5, $6)
             ON CONFLICT (user_id, lesson_id) DO NOTHING`,
            [uid('lp'), req.authUser!.id, lesson.id, lesson.version, evidence || 'study_and_practice', now]
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
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await db.query<Record<string, unknown>>(
        'SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC',
        [req.authUser!.id]
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
    '/api/verify/:token',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const token = String(req.params.token).trim();
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
        res.json(evaluateCertificateVerification(null));
        return;
      }

      if (row.status === 'valid' && !row.share_enabled) {
        res.json({ verificationStatus: 'not_found' });
        return;
      }

      res.json(
        evaluateCertificateVerification({
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
        })
      );
    })
  );

  // --- PROFILE, PRIVACY, LEADERBOARD, REFERRALS, REPORTS ---
  app.patch(
    '/api/me/profile',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const { displayName, preferredLocale, timezone, leaderboardOptIn, leaderboardPseudonym } =
        req.body as {
          displayName?: string;
          preferredLocale?: LocaleCode;
          timezone?: string;
          leaderboardOptIn?: boolean;
          leaderboardPseudonym?: string;
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

      await db.execute(
        `UPDATE learner_profiles
         SET display_name = $1, preferred_locale = $2, timezone = $3, leaderboard_opt_in = $4, leaderboard_pseudonym = $5
         WHERE user_id = $6`,
        [nextName, nextLocale, nextTz, nextOptIn, nextPseudo, current.id]
      );

      res.json({ user: await loadUserSummaryById(current.id) });
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
      if (userId === 'user-editor' && process.env.ENABLE_DEMO_SANDBOX === 'true') {
        res.status(400).json({ error: 'Staff operational account cannot be self-deleted from sandbox.' });
        return;
      }
      await db.execute('DELETE FROM users WHERE id = $1', [userId]);
      clearSessionCookie(res);
      res.json({ ok: true });
    })
  );

  app.get(
    '/api/leaderboards',
    requireDatabase,
    asyncHandler(async (req, res) => {
      const rows = await db.query<{
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
      );

      res.json({
        cohortName: 'Active Weekly Study Cohort (Opt-In Pseudonyms)',
        entries: rows.map((r, i) => ({
          rank: i + 1,
          pseudonym: r.leaderboard_pseudonym,
          cohortXp: Number(r.cohort_xp),
          lessonsCompleted: Number(r.lessons_done),
          isCurrentUser: req.authUser?.id === r.user_id,
        })),
      });
    })
  );

  app.get(
    '/api/me/referrals',
    requireDatabase,
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.authUser!.id;
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
      const { courseId, lessonId, category, description } = req.body as {
        courseId?: string;
        lessonId?: string;
        category?: string;
        description?: string;
      };
      const validCategories = new Set(['accuracy', 'translation', 'accessibility', 'rights', 'safety']);
      if (!category || !validCategories.has(category)) {
        res.status(400).json({ error: 'Select a valid report category.' });
        return;
      }
      if (!description || description.trim().length < 10) {
        res.status(400).json({ error: 'Please describe the issue in at least 10 characters.' });
        return;
      }
      const id = uid('rep');
      await db.execute(
        `INSERT INTO issue_reports (id, user_id, course_id, lesson_id, category, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)`,
        [
          id,
          req.authUser?.id ?? null,
          courseId ?? null,
          lessonId ?? null,
          category,
          description.trim(),
          new Date().toISOString(),
        ]
      );

      res.status(201).json({ ok: true, reportId: id });
    })
  );

  // --- ADMIN / CONTENT GOVERNANCE ROUTES ---
  app.get(
    '/api/admin/overview',
    requireDatabase,
    requireStaffRole,
    asyncHandler(async (_req, res) => {
      const [editions, reports, certificates, auditEvents, xpTotalRow] = await Promise.all([
        db.query<Record<string, unknown>>(
          `SELECT ce.*, c.subject, c.level
           FROM course_editions ce
           JOIN courses c ON c.id = ce.course_id
           ORDER BY ce.updated_at DESC`
        ),
        db.query<Record<string, unknown>>(
          'SELECT * FROM issue_reports ORDER BY created_at DESC LIMIT 50'
        ),
        db.query<Record<string, unknown>>(
          'SELECT * FROM certificates ORDER BY issued_at DESC LIMIT 50'
        ),
        db.query<Record<string, unknown>>(
          'SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 40'
        ),
        db.queryOne<{ total: number; count: number }>(
          "SELECT COALESCE(SUM(amount), 0)::int as total, COUNT(*)::int as count FROM xp_ledger WHERE status = 'valid'"
        ),
      ]);

      const mappedEditions = await Promise.all(
        editions.map(async (e) => ({
          ...(await mapEditionSummary(e)),
          subject: String(e.subject),
          level: String(e.level),
        }))
      );

      res.json({
        editions: mappedEditions,
        reports: reports.map((r) => ({
          id: String(r.id),
          courseId: r.course_id ? String(r.course_id) : null,
          lessonId: r.lesson_id ? String(r.lesson_id) : null,
          category: String(r.category),
          description: String(r.description),
          status: String(r.status),
          resolutionNote: r.resolution_note ? String(r.resolution_note) : null,
          createdAt: toIso(r.created_at) || '',
        })),
        certificates: certificates.map((c) => ({
          id: String(c.id),
          recipientDisplayName: String(c.recipient_display_name),
          courseTitle: String(c.course_title),
          locale: String(c.locale),
          publicToken: String(c.public_token),
          status: String(c.status),
          issuedAt: toIso(c.issued_at) || '',
          revokeReason: c.revoke_reason ? String(c.revoke_reason) : null,
        })),
        auditEvents: auditEvents.map((a) => ({
          id: String(a.id),
          actorUserId: a.actor_user_id ? String(a.actor_user_id) : null,
          action: String(a.action),
          targetType: String(a.target_type),
          targetId: String(a.target_id),
          reason: String(a.reason),
          createdAt: toIso(a.created_at) || '',
        })),
        ledgerSummary: {
          totalNonCashXpIssued: Number(xpTotalRow?.total ?? 0),
          validEntriesCount: Number(xpTotalRow?.count ?? 0),
        },
      });
    })
  );

  app.post(
    '/api/admin/editions/draft',
    requireDatabase,
    requireStaffRole,
    asyncHandler(async (req, res) => {
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
            'ECONOVA Editorial Studio',
            licenseBasis?.trim() || 'Original Draft — Pending Rights Sign-off',
            'Draft awaiting rights and subject review.',
            Boolean(aiAssisted),
            aiAssisted ? aiModel || 'gemini-4-hydrogen' : null,
            aiAssisted ? 'editorial-draft-v1' : null,
            'Created via Staff Editorial Studio; cannot publish without human review gates.',
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
            description?.trim() || 'Draft curriculum module created in Editorial Studio.',
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

  app.post(
    '/api/admin/editions/:editionId/transition',
    requireDatabase,
    requireStaffRole,
    asyncHandler(async (req, res) => {
      const editionId = String(req.params.editionId);
      const { nextStatus, signoffType, reason } = req.body as {
        nextStatus?: EditorialStatus;
        signoffType?: 'subject' | 'language' | 'rights';
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

      const now = new Date().toISOString();
      let subjectRev = row.subject_reviewer_id ? String(row.subject_reviewer_id) : null;
      let langRev = row.language_reviewer_id ? String(row.language_reviewer_id) : null;
      let rightsRev = row.rights_reviewer_id ? String(row.rights_reviewer_id) : null;

      if (signoffType === 'subject') subjectRev = req.authUser!.id;
      if (signoffType === 'language') langRev = req.authUser!.id;
      if (signoffType === 'rights') rightsRev = req.authUser!.id;

      const targetStatus = (nextStatus ?? row.status) as EditorialStatus;
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
            reason?.trim() || `Signoff (${signoffType || 'publisher'}) -> ${targetStatus}`,
            now,
          ]
        );
      });

      res.json({ ok: true, status: targetStatus });
    })
  );

  app.post(
    '/api/admin/certificates/:certificateId/revoke',
    requireDatabase,
    requireStaffRole,
    asyncHandler(async (req, res) => {
      const certificateId = String(req.params.certificateId);
      const { reason } = req.body as { reason?: string };
      if (!reason || reason.trim().length < 5) {
        res.status(400).json({ error: 'A clear audit reason is required to revoke a certificate.' });
        return;
      }
      const cert = await db.queryOne<{ id: string }>(
        'SELECT id FROM certificates WHERE id = $1',
        [certificateId]
      );
      if (!cert) {
        res.status(404).json({ error: 'Certificate not found.' });
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

  app.patch(
    '/api/admin/reports/:reportId',
    requireDatabase,
    requireStaffRole,
    asyncHandler(async (req, res) => {
      const reportId = String(req.params.reportId);
      const { status, resolutionNote } = req.body as {
        status?: 'open' | 'investigating' | 'resolved';
        resolutionNote?: string;
      };
      await db.execute('UPDATE issue_reports SET status = $1, resolution_note = $2 WHERE id = $3', [
        status || 'resolved',
        resolutionNote?.trim() || 'Reviewed by editorial operations.',
        reportId,
      ]);
      res.json({ ok: true });
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

  app.post('/api/ai/generate-image', requireStaffRole, async (req, res) => {
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`ECONOVA server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ECONOVA server:', err);
  process.exit(1);
});
