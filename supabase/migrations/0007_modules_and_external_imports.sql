-- ECONOVA PostgreSQL / Supabase Migration 0007:
-- Modules within course editions, idempotent external content imports, and import audit runs.
-- Additive only: existing lessons stay valid with module_id = NULL, and course subjects
-- keep their existing CHECK constraint (external topics are stored as topic_tags).

-- 1. Modules: ordered groups of lessons inside one edition (Track -> Module -> Lesson).
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES course_editions(id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL CHECK (sequence_num >= 1),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (edition_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS idx_modules_edition_seq
  ON modules (edition_id, sequence_num);

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_module
  ON lessons (module_id)
  WHERE module_id IS NOT NULL;

-- 2. Original external topic strings, kept as tags so subject filters stay unchanged.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS topic_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Import audit runs.
CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  input_ref TEXT NOT NULL,
  triggered_by TEXT,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_runs_source_started
  ON import_runs (source, started_at DESC);

-- 4. External source references: one row per imported entity, keyed by the upstream ID.
-- content_hash lets re-imports skip unchanged content and version changed content.
CREATE TABLE IF NOT EXISTS external_source_refs (
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('course', 'edition', 'module', 'lesson')),
  external_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_import_run_id TEXT REFERENCES import_runs(id) ON DELETE SET NULL,
  last_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, entity_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_source_refs_entity
  ON external_source_refs (entity_type, entity_id);

-- 5. Row-level security, matching 0002: modules follow lesson visibility;
-- import bookkeeping is server/service_role only (no client policies).
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_source_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modules_published_select ON public.modules;
CREATE POLICY modules_published_select ON public.modules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_editions ce
      WHERE ce.id = modules.edition_id AND ce.status = 'published'
    )
    OR public.is_econova_staff()
  );

DROP POLICY IF EXISTS modules_staff_write ON public.modules;
CREATE POLICY modules_staff_write ON public.modules
  FOR ALL
  USING (public.is_econova_staff())
  WITH CHECK (public.is_econova_staff());
