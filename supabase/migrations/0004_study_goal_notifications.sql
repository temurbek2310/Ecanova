-- ECONOVA PostgreSQL / Supabase Migration 0004: Daily Study Goal Notifications Preference
-- Adds opt-in browser notification toggle to learner_profiles (disabled by default for privacy).

ALTER TABLE public.learner_profiles
  ADD COLUMN IF NOT EXISTS study_goal_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;
