-- ECONOVA PostgreSQL / Supabase Migration 0002: Row-Level Security (RLS) Policies
-- Ensures learner privacy defaults, server-only grading keys, immutable non-cash XP ledger,
-- role-scoped editorial governance, and minimal public certificate verification.

-- Helper functions work safely inside Supabase (where auth.uid() exists) as well as
-- standard PostgreSQL where request JWT claims may be passed via current_setting.
CREATE OR REPLACE FUNCTION public.econova_request_uid()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('app.current_user_id', true), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_econova_staff()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.econova_request_uid()
      AND u.role IN ('editor', 'reviewer', 'publisher', 'admin')
  );
$$;

-- Enable Row-Level Security on every table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._econova_migrations ENABLE ROW LEVEL SECURITY;

-- 1. Users & Profiles (never expose user list or private fields publicly)
DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
  FOR SELECT
  USING (id = public.econova_request_uid() OR public.is_econova_staff());

DROP POLICY IF EXISTS profiles_self_select ON public.learner_profiles;
CREATE POLICY profiles_self_select ON public.learner_profiles
  FOR SELECT
  USING (user_id = public.econova_request_uid());

DROP POLICY IF EXISTS profiles_self_update ON public.learner_profiles;
CREATE POLICY profiles_self_update ON public.learner_profiles
  FOR UPDATE
  USING (user_id = public.econova_request_uid())
  WITH CHECK (user_id = public.econova_request_uid());

-- 2. Published Curriculum Catalog (only published editions visible publicly; drafts/unreviewed staff-only)
DROP POLICY IF EXISTS courses_published_select ON public.courses;
CREATE POLICY courses_published_select ON public.courses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_editions ce
      WHERE ce.course_id = courses.id AND ce.status = 'published'
    )
    OR public.is_econova_staff()
  );

DROP POLICY IF EXISTS editions_published_select ON public.course_editions;
CREATE POLICY editions_published_select ON public.course_editions
  FOR SELECT
  USING (status = 'published' OR public.is_econova_staff());

DROP POLICY IF EXISTS editions_staff_write ON public.course_editions;
CREATE POLICY editions_staff_write ON public.course_editions
  FOR ALL
  USING (public.is_econova_staff())
  WITH CHECK (public.is_econova_staff());

DROP POLICY IF EXISTS lessons_published_select ON public.lessons;
CREATE POLICY lessons_published_select ON public.lessons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_editions ce
      WHERE ce.id = lessons.edition_id AND ce.status = 'published'
    )
    OR public.is_econova_staff()
  );

DROP POLICY IF EXISTS provenance_published_select ON public.provenance_records;
CREATE POLICY provenance_published_select ON public.provenance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_editions ce
      WHERE ce.provenance_id = provenance_records.id AND ce.status = 'published'
    )
    OR public.is_econova_staff()
  );

-- 3. Assessments & Questions
-- Assessments metadata is readable when published; questions table has NO client SELECT policy
-- so correct_option_index answer keys can never be queried directly from browser clients.
DROP POLICY IF EXISTS assessments_published_select ON public.assessments;
CREATE POLICY assessments_published_select ON public.assessments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_editions ce
      WHERE ce.id = assessments.edition_id AND ce.status = 'published'
    )
    OR public.is_econova_staff()
  );

DROP POLICY IF EXISTS questions_staff_only_select ON public.questions;
CREATE POLICY questions_staff_only_select ON public.questions
  FOR SELECT
  USING (public.is_econova_staff());

-- 4. Learner Progress, Attempts, XP Ledger, Streaks, Badges (Read-only self-scope; writes server/service_role only)
DROP POLICY IF EXISTS enrollments_self_select ON public.enrollments;
CREATE POLICY enrollments_self_select ON public.enrollments
  FOR SELECT
  USING (user_id = public.econova_request_uid());

DROP POLICY IF EXISTS lesson_progress_self_select ON public.lesson_progress;
CREATE POLICY lesson_progress_self_select ON public.lesson_progress
  FOR SELECT
  USING (user_id = public.econova_request_uid());

DROP POLICY IF EXISTS attempts_self_select ON public.assessment_attempts;
CREATE POLICY attempts_self_select ON public.assessment_attempts
  FOR SELECT
  USING (user_id = public.econova_request_uid());

DROP POLICY IF EXISTS xp_ledger_self_select ON public.xp_ledger;
CREATE POLICY xp_ledger_self_select ON public.xp_ledger
  FOR SELECT
  USING (user_id = public.econova_request_uid() OR public.is_econova_staff());

DROP POLICY IF EXISTS streak_records_self_select ON public.streak_records;
CREATE POLICY streak_records_self_select ON public.streak_records
  FOR SELECT
  USING (user_id = public.econova_request_uid());

DROP POLICY IF EXISTS badge_awards_self_select ON public.badge_awards;
CREATE POLICY badge_awards_self_select ON public.badge_awards
  FOR SELECT
  USING (user_id = public.econova_request_uid());

-- 5. Referrals
DROP POLICY IF EXISTS referral_codes_self_select ON public.referral_codes;
CREATE POLICY referral_codes_self_select ON public.referral_codes
  FOR SELECT
  USING (owner_user_id = public.econova_request_uid());

DROP POLICY IF EXISTS referral_claims_self_select ON public.referral_claims;
CREATE POLICY referral_claims_self_select ON public.referral_claims
  FOR SELECT
  USING (
    claimant_user_id = public.econova_request_uid()
    OR referrer_user_id = public.econova_request_uid()
  );

-- 6. Certificates (Private to owner/staff; public verification goes through minimal SECURITY DEFINER function or API)
DROP POLICY IF EXISTS certificates_self_or_staff_select ON public.certificates;
CREATE POLICY certificates_self_or_staff_select ON public.certificates
  FOR SELECT
  USING (user_id = public.econova_request_uid() OR public.is_econova_staff());

DROP POLICY IF EXISTS certificates_owner_share_update ON public.certificates;
CREATE POLICY certificates_owner_share_update ON public.certificates
  FOR UPDATE
  USING (user_id = public.econova_request_uid())
  WITH CHECK (user_id = public.econova_request_uid());

-- 7. Learner Reports & Audit Events
DROP POLICY IF EXISTS issue_reports_insert ON public.issue_reports;
CREATE POLICY issue_reports_insert ON public.issue_reports
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = public.econova_request_uid());

DROP POLICY IF EXISTS issue_reports_select ON public.issue_reports;
CREATE POLICY issue_reports_select ON public.issue_reports
  FOR SELECT
  USING (user_id = public.econova_request_uid() OR public.is_econova_staff());

DROP POLICY IF EXISTS audit_events_staff_select ON public.audit_events;
CREATE POLICY audit_events_staff_select ON public.audit_events
  FOR SELECT
  USING (public.is_econova_staff());

-- 8. Privacy-safe public leaderboard view (opt-in pseudonyms only; excludes email, legal name, age)
CREATE OR REPLACE VIEW public.leaderboard_cohort_opt_in AS
SELECT
  lp.leaderboard_pseudonym AS pseudonym,
  COALESCE(SUM(CASE WHEN xl.status = 'valid' THEN xl.amount ELSE 0 END), 0)::INTEGER AS cohort_xp,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.lesson_progress prog
    WHERE prog.user_id = lp.user_id AND prog.state = 'completed'
  ) AS lessons_completed
FROM public.learner_profiles lp
LEFT JOIN public.xp_ledger xl ON xl.user_id = lp.user_id
WHERE lp.leaderboard_opt_in = TRUE
GROUP BY lp.user_id, lp.leaderboard_pseudonym
ORDER BY cohort_xp DESC, lessons_completed DESC
LIMIT 25;

-- 9. Minimal public certificate verification RPC (only exposes approved public fields)
CREATE OR REPLACE FUNCTION public.verify_certificate_token(p_token TEXT)
RETURNS TABLE (
  verification_status TEXT,
  recipient_display_name TEXT,
  course_title TEXT,
  subject TEXT,
  level TEXT,
  locale TEXT,
  edition_version INTEGER,
  issued_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.status AS verification_status,
    c.recipient_display_name,
    c.course_title,
    c.subject,
    c.level,
    c.locale,
    c.edition_version,
    c.issued_at,
    c.revoked_at,
    c.revoke_reason
  FROM public.certificates c
  WHERE c.public_token = btrim(p_token)
    AND (c.status = 'revoked' OR c.share_enabled = TRUE)
  LIMIT 1;
$$;
