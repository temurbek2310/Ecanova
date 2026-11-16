-- ECONOVA PostgreSQL / Supabase Migration 0001: Core Relational Schema
-- Compliant with DOIT_v2.md (non-cash XP, separate reviewed EN/UZ editions,
-- Journey Status vs Course Level separation, idempotency, and audit trails).

CREATE TABLE IF NOT EXISTS _econova_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'learner'
    CHECK (role IN ('learner', 'editor', 'reviewer', 'publisher', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learner_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  preferred_locale TEXT NOT NULL DEFAULT 'en'
    CHECK (preferred_locale IN ('en', 'uz')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  age_band TEXT NOT NULL DEFAULT 'university'
    CHECK (age_band IN ('school', 'university', 'independent')),
  leaderboard_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  leaderboard_pseudonym TEXT NOT NULL,
  consent_accepted_at TIMESTAMPTZ,
  consent_version TEXT
);

CREATE TABLE IF NOT EXISTS provenance_records (
  id TEXT PRIMARY KEY,
  source_title TEXT NOT NULL,
  author_creator TEXT NOT NULL,
  original_url TEXT NOT NULL,
  publisher_platform TEXT NOT NULL,
  license_basis TEXT NOT NULL,
  attribution_text TEXT NOT NULL,
  commercial_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  adaptation_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  translation_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  ai_assisted BOOLEAN NOT NULL DEFAULT FALSE,
  ai_model TEXT,
  prompt_version TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL
    CHECK (subject IN ('Economics', 'Mathematics', 'Business')),
  level TEXT NOT NULL
    CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_editions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'uz')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  outcomes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_rules TEXT NOT NULL,
  passing_score_percent INTEGER NOT NULL DEFAULT 70
    CHECK (passing_score_percent BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'subject_review',
      'language_review',
      'rights_accessibility_review',
      'approved',
      'published',
      'retired'
    )),
  provenance_id TEXT REFERENCES provenance_records(id),
  subject_reviewer_id TEXT,
  language_reviewer_id TEXT,
  rights_reviewer_id TEXT,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, locale, version)
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES course_editions(id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL CHECK (sequence_num >= 1),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  objectives_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_blocks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_terms_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  simulation_type TEXT NOT NULL DEFAULT 'none'
    CHECK (simulation_type IN ('none', 'supply_demand', 'derivative_tangent', 'unit_economics')),
  video_url TEXT,
  captions_vtt TEXT,
  transcript TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes > 0),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  provenance_id TEXT REFERENCES provenance_records(id)
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES course_editions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score_percent INTEGER NOT NULL DEFAULT 70
    CHECK (passing_score_percent BETWEEN 1 AND 100),
  max_attempts_per_day INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts_per_day >= 1),
  retry_policy_text TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL CHECK (sequence_num >= 1),
  objective_ref TEXT NOT NULL,
  prompt TEXT NOT NULL,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option_index INTEGER NOT NULL CHECK (correct_option_index >= 0),
  explanation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'uz')),
  journey_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (journey_status IN ('not_started', 'progressing', 'completed', 'paused')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  edition_version INTEGER NOT NULL CHECK (edition_version >= 1),
  state TEXT NOT NULL DEFAULT 'completed'
    CHECK (state IN ('not_started', 'in_progress', 'completed')),
  completion_evidence TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  edition_version INTEGER NOT NULL CHECK (edition_version >= 1),
  responses_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_percent INTEGER NOT NULL CHECK (score_percent BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only Non-Cash XP Ledger (no cash balance, withdrawal, or conversion fields)
CREATE TABLE IF NOT EXISTS xp_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('lesson_completed', 'assessment_passed', 'course_completed', 'referral_reward', 'manual_reversal')),
  reference_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  rule_version TEXT NOT NULL,
  description TEXT NOT NULL,
  reversed_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS streak_records (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  last_activity_local_date TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent'
);

CREATE TABLE IF NOT EXISTS badge_awards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  title TEXT NOT NULL,
  criteria TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_claims (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL REFERENCES referral_codes(code),
  claimant_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'credited'
    CHECK (status IN ('credited', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (claimant_user_id <> referrer_user_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES course_editions(id),
  edition_version INTEGER NOT NULL CHECK (edition_version >= 1),
  locale TEXT NOT NULL CHECK (locale IN ('en', 'uz')),
  recipient_display_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  subject TEXT NOT NULL
    CHECK (subject IN ('Economics', 'Mathematics', 'Business')),
  level TEXT NOT NULL
    CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  public_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'revoked')),
  share_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  template_version TEXT NOT NULL DEFAULT 'cert-template-v1',
  UNIQUE (user_id, course_id, edition_version)
);

CREATE TABLE IF NOT EXISTS issue_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  course_id TEXT,
  lesson_id TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('accuracy', 'translation', 'accessibility', 'rights', 'safety')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved')),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editions_course_locale_status
  ON course_editions (course_id, locale, status, version DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_edition_seq
  ON lessons (edition_id, sequence_num);
CREATE INDEX IF NOT EXISTS idx_enrollments_user
  ON enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_assess
  ON assessment_attempts (user_id, assessment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_ledger_user_created
  ON xp_ledger (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificates_user
  ON certificates (user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificates_public_token
  ON certificates (public_token);
