-- ECONOVA PostgreSQL / Supabase Migration 0003: Daily Study Goal Preference
-- Adds a learner-configurable daily study target in minutes (bounded 5..480 min/day).

ALTER TABLE public.learner_profiles
  ADD COLUMN IF NOT EXISTS daily_study_goal_minutes INTEGER NOT NULL DEFAULT 30
  CHECK (daily_study_goal_minutes BETWEEN 5 AND 480);
