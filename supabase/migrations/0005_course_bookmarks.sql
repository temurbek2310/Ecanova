-- ECONOVA PostgreSQL / Supabase Migration 0005: Course Bookmarks in Learner Profile
-- Stores an ordered, deduplicated JSONB array of bookmarked course IDs on public.learner_profiles.

ALTER TABLE public.learner_profiles
  ADD COLUMN IF NOT EXISTS bookmarked_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
