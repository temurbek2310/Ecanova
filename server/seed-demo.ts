/**
 * DEV-ONLY demo cohort (learners, XP, attempts, referral code).
 *
 * Never imported by the production server. Run explicitly with
 * `npm run db:seed:demo` against a local/staging database only.
 */
import { hashPassword } from './auth.ts';
import { runInTransaction, type SqlExecutor } from './db.ts';

export const DEMO_USER_IDS = ['user-dilnoza', 'user-azamat', 'user-malika', 'user-editor'] as const;

export async function seedDemoCohort(options: { includeStaff?: boolean } = {}): Promise<void> {
  const now = new Date().toISOString();
  await runInTransaction(async (tx: SqlExecutor) => {
    const insertUser = async (id: string, email: string, pw: string, role: string) => {
      await tx.execute(
        `INSERT INTO users (id, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [id, email, hashPassword(pw), role, now]
      );
    };
    const insertProfile = async (
      userId: string,
      displayName: string,
      locale: string,
      ageBand: string,
      optIn: boolean,
      pseudo: string
    ) => {
      await tx.execute(
        `INSERT INTO learner_profiles (
          user_id, display_name, preferred_locale, timezone, age_band,
          leaderboard_opt_in, leaderboard_pseudonym, consent_accepted_at, consent_version
        ) VALUES ($1, $2, $3, 'Asia/Tashkent', $4, $5, $6, $7, 'v1')
        ON CONFLICT (user_id) DO NOTHING`,
        [userId, displayName, locale, ageBand, optIn, pseudo, now]
      );
    };

    await insertUser('user-dilnoza', 'dilnoza@econova.uz', 'EconovaLearn!2026', 'learner');
    await insertProfile('user-dilnoza', 'Dilnoza R.', 'en', 'university', true, 'TashkentScholar');

    await insertUser('user-azamat', 'azamat@econova.uz', 'EconovaPeer!2026', 'learner');
    await insertProfile('user-azamat', 'Azamat K.', 'uz', 'university', true, 'SamarkandQuant');

    await insertUser('user-malika', 'malika@econova.uz', 'EconovaPeer2!2026', 'learner');
    await insertProfile('user-malika', 'Malika T.', 'en', 'school', true, 'BukharaAnalyst');

    if (options.includeStaff) {
      await insertUser('user-editor', 'editor@econova.uz', 'EconovaStaff!2026', 'admin');
      await insertProfile('user-editor', 'Editorial Lead', 'en', 'independent', false, 'StaffEditorial');
    }

    await tx.execute(
      `INSERT INTO enrollments (id, user_id, course_id, locale, journey_status, enrolled_at)
       VALUES ('enr-dilnoza-econ', 'user-dilnoza', 'course-econ-beg', 'en', 'progressing', $1)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    await tx.execute(
      `INSERT INTO lesson_progress (id, user_id, lesson_id, edition_version, state, completion_evidence, updated_at)
       VALUES ('lp-dilnoza-1', 'user-dilnoza', 'les-econ-en-1', 1, 'completed', 'simulation_and_read', $1)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    await tx.execute(
      `INSERT INTO xp_ledger (id, user_id, event_type, reference_id, amount, status, idempotency_key, rule_version, description, created_at)
       VALUES ('xp-dilnoza-1', 'user-dilnoza', 'lesson_completed', 'les-econ-en-1', 25, 'valid', 'lesson:user-dilnoza:les-econ-en-1:v1', 'v1-non-cash', 'Completed Lesson 1: Why Prices Move (Economics Beginner)', $1)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    await tx.execute(
      `INSERT INTO xp_ledger (id, user_id, event_type, reference_id, amount, status, idempotency_key, rule_version, description, created_at)
       VALUES ('xp-azamat-1', 'user-azamat', 'course_completed', 'course-math-int', 175, 'valid', 'seed:azamat:1', 'v1-non-cash', 'Completed Applied Calculus modules', $1)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    await tx.execute(
      `INSERT INTO xp_ledger (id, user_id, event_type, reference_id, amount, status, idempotency_key, rule_version, description, created_at)
       VALUES ('xp-malika-1', 'user-malika', 'assessment_passed', 'asmt-econ-beg-en', 100, 'valid', 'seed:malika:1', 'v1-non-cash', 'Passed Economics foundations check', $1)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    await tx.execute(
      `INSERT INTO streak_records (user_id, current_streak, best_streak, last_activity_local_date, timezone)
       VALUES ('user-dilnoza', 2, 2, $1, 'Asia/Tashkent')
       ON CONFLICT (user_id) DO NOTHING`,
      [new Date().toISOString().slice(0, 10)]
    );
    await tx.execute(
      `INSERT INTO badge_awards (id, user_id, badge_key, title, criteria, awarded_at, idempotency_key)
       VALUES ('bdg-dilnoza-1', 'user-dilnoza', 'first_lesson', 'First Step in Economics', 'Complete your first reviewed lesson in any ECONOVA course.', $1, 'badge:user-dilnoza:first_lesson')
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    await tx.execute(
      `INSERT INTO referral_codes (code, owner_user_id, created_at)
       VALUES ('ECO-DILNOZA', 'user-dilnoza', $1)
       ON CONFLICT (code) DO NOTHING`,
      [now]
    );

    // Seed current-week course assessment attempts for the Weekly Quiz Leaderboard
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const insertWeeklyAttempt = async (
      id: string,
      userId: string,
      assessmentId: string,
      scorePercent: number,
      passed: boolean,
      daysAgo: number
    ) => {
      const createdAt = new Date(nowMs - daysAgo * dayMs).toISOString();
      await tx.execute(
        `INSERT INTO assessment_attempts (
          id, user_id, assessment_id, edition_version, responses_json, score_percent, passed, created_at
        ) VALUES ($1, $2, $3, 1, '{}'::jsonb, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at, score_percent = EXCLUDED.score_percent`,
        [id, userId, assessmentId, scorePercent, passed, createdAt]
      );
    };

    await insertWeeklyAttempt('att-seed-math-azamat', 'user-azamat', 'asmt-math-int-en', 100, true, 1);
    await insertWeeklyAttempt('att-seed-econ-malika', 'user-malika', 'asmt-econ-beg-en', 100, true, 2);
    await insertWeeklyAttempt('att-seed-econ-dilnoza-1', 'user-dilnoza', 'asmt-econ-beg-en', 80, true, 3);
    await insertWeeklyAttempt('att-seed-econ-dilnoza-2', 'user-dilnoza', 'asmt-econ-beg-en', 94, true, 1);
    await insertWeeklyAttempt('att-seed-biz-azamat', 'user-azamat', 'asmt-biz-adv-en', 92, true, 2);
    await insertWeeklyAttempt('att-seed-math-malika', 'user-malika', 'asmt-math-int-en', 88, true, 3);
    await insertWeeklyAttempt('att-seed-biz-dilnoza', 'user-dilnoza', 'asmt-biz-adv-en', 84, true, 2);
  });
}
