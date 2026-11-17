-- ECONOVA PostgreSQL / Supabase Migration 0006:
-- Weekly Study Digest Email Preference, Lesson Quick Notes Sync, and Student Segment Review Requests

ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS weekly_digest_email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lesson_notes_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE issue_reports
  ADD COLUMN IF NOT EXISTS segment_heading TEXT;

ALTER TABLE issue_reports
  DROP CONSTRAINT IF EXISTS issue_reports_category_check;

ALTER TABLE issue_reports
  ADD CONSTRAINT issue_reports_category_check
  CHECK (category IN ('accuracy', 'translation', 'accessibility', 'rights', 'safety', 'segment_review'));

CREATE TABLE IF NOT EXISTS lesson_review_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  student_display_name TEXT NOT NULL DEFAULT 'Learner',
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  lesson_title TEXT NOT NULL DEFAULT '',
  segment_heading TEXT NOT NULL DEFAULT 'General Lesson Segment',
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved')),
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_review_requests_status
  ON lesson_review_requests (status, created_at DESC);
