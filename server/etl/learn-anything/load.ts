// Load step: writes transformed learn-anything content inside one transaction.
// - Deterministic IDs + ON CONFLICT upserts make re-runs idempotent.
// - Every edition it writes is a 'draft'; the human review gate still applies.
// - A published / in-review / retired edition is never modified: changed upstream
//   content becomes a new draft at version + 1 (see planEditionVersion).
// The CLI calls this; server startup (ensureDbReady) never does.

import crypto from 'node:crypto';
import { db as defaultDb, runInTransaction, type SqlExecutor } from '../../db.ts';
import type { EditorialStatus } from '../../../src/shared/types.ts';
import { LEARN_ANYTHING_SOURCE } from './extract.ts';
import {
  buildEditionRowIds,
  contentHash,
  planEditionVersion,
  type TransformedCourse,
  type TransformedEdition,
  type TransformResult,
} from './transform.ts';

export interface LoadStats {
  coursesUpserted: number;
  editionsCreated: number;
  draftsReplaced: number;
  editionsUnchanged: number;
  modulesWritten: number;
  lessonsWritten: number;
}

export interface EditionOutcome {
  courseId: string;
  locale: string;
  action: 'unchanged' | 'replace_draft' | 'create';
  editionId: string | null;
  version: number;
}

export interface LoadResult {
  runId: string;
  stats: LoadStats;
  editions: EditionOutcome[];
}

export interface LoadOptions {
  /** File path or URL the data came from (stored on import_runs). */
  inputRef: string;
  triggeredBy?: string | null;
  /** Injection points for tests; default to the real pool and transaction helper. */
  executor?: SqlExecutor;
  transaction?: <T>(fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;
  now?: () => Date;
}

function emptyStats(): LoadStats {
  return {
    coursesUpserted: 0,
    editionsCreated: 0,
    draftsReplaced: 0,
    editionsUnchanged: 0,
    modulesWritten: 0,
    lessonsWritten: 0,
  };
}

async function upsertRef(
  tx: SqlExecutor,
  entityType: 'course' | 'edition' | 'module' | 'lesson',
  externalId: string,
  entityId: string,
  hash: string,
  metadata: Record<string, unknown>,
  runId: string,
  now: string
): Promise<void> {
  await tx.execute(
    `INSERT INTO external_source_refs
       (source, entity_type, external_id, entity_id, content_hash, metadata_json, last_import_run_id, last_imported_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     ON CONFLICT (source, entity_type, external_id) DO UPDATE
       SET entity_id = EXCLUDED.entity_id,
           content_hash = EXCLUDED.content_hash,
           metadata_json = EXCLUDED.metadata_json,
           last_import_run_id = EXCLUDED.last_import_run_id,
           last_imported_at = EXCLUDED.last_imported_at`,
    [LEARN_ANYTHING_SOURCE, entityType, externalId, entityId, hash, JSON.stringify(metadata), runId, now]
  );
}

async function upsertCourse(tx: SqlExecutor, course: TransformedCourse, runId: string, now: string) {
  // Subject, level and minutes are set on first import only; later imports refresh tags.
  await tx.execute(
    `INSERT INTO courses (id, slug, subject, level, estimated_minutes, topic_tags, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (id) DO UPDATE SET topic_tags = EXCLUDED.topic_tags`,
    [course.courseId, course.slug, course.subject, course.level, course.estimatedMinutes, JSON.stringify(course.topicTags), now]
  );
  await upsertRef(tx, 'course', course.externalId, course.courseId, course.contentHash, { slug: course.slug }, runId, now);
}

async function writeEdition(
  tx: SqlExecutor,
  course: TransformedCourse,
  edition: TransformedEdition,
  runId: string,
  now: string,
  stats: LoadStats
): Promise<EditionOutcome> {
  const latest = await tx.queryOne<{ id: string; version: number; status: EditorialStatus }>(
    `SELECT id, version, status FROM course_editions
     WHERE course_id = $1 AND locale = $2
     ORDER BY version DESC LIMIT 1
     FOR UPDATE`,
    [course.courseId, edition.locale]
  );
  const ref = await tx.queryOne<{ entity_id: string; content_hash: string }>(
    `SELECT entity_id, content_hash FROM external_source_refs
     WHERE source = $1 AND entity_type = 'edition' AND external_id = $2`,
    [LEARN_ANYTHING_SOURCE, edition.externalId]
  );

  const plan = planEditionVersion(
    latest ? { id: latest.id, version: Number(latest.version), status: latest.status } : null,
    ref ? { entityId: ref.entity_id, contentHash: ref.content_hash } : null,
    edition.contentHash
  );

  if (plan.action === 'unchanged') {
    stats.editionsUnchanged += 1;
    await tx.execute(
      `UPDATE external_source_refs SET last_import_run_id = $1, last_imported_at = $2
       WHERE source = $3 AND entity_type = 'edition' AND external_id = $4`,
      [runId, now, LEARN_ANYTHING_SOURCE, edition.externalId]
    );
    return { courseId: course.courseId, locale: edition.locale, action: 'unchanged', editionId: ref?.entity_id ?? null, version: plan.version };
  }

  const ids = buildEditionRowIds(edition, plan.version);
  const editionId = plan.action === 'replace_draft' ? latest!.id : ids.editionId;
  const p = edition.provenance;

  await tx.execute(
    `INSERT INTO provenance_records (
       id, source_title, author_creator, original_url, publisher_platform, license_basis,
       attribution_text, commercial_allowed, adaptation_allowed, translation_allowed,
       ai_assisted, ai_model, prompt_version, reviewed_by, reviewed_at, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, NULL, NULL, $13)
     ON CONFLICT (id) DO UPDATE SET
       source_title = EXCLUDED.source_title, author_creator = EXCLUDED.author_creator,
       original_url = EXCLUDED.original_url, publisher_platform = EXCLUDED.publisher_platform,
       license_basis = EXCLUDED.license_basis, attribution_text = EXCLUDED.attribution_text,
       commercial_allowed = EXCLUDED.commercial_allowed, adaptation_allowed = EXCLUDED.adaptation_allowed,
       translation_allowed = EXCLUDED.translation_allowed, ai_assisted = EXCLUDED.ai_assisted,
       ai_model = EXCLUDED.ai_model, notes = EXCLUDED.notes`,
    [
      ids.provenanceId, p.sourceTitle, p.authorCreator, p.originalUrl, p.publisherPlatform, p.licenseBasis,
      p.attributionText, p.commercialAllowed, p.adaptationAllowed, p.translationAllowed,
      p.aiAssisted, p.aiModel, `Imported by ETL run ${runId}; awaiting human review.`,
    ]
  );

  if (plan.action === 'replace_draft') {
    // Only ever rewrite a draft this importer created; its lessons have no learner
    // progress because unpublished lessons cannot be started or completed.
    await tx.execute('DELETE FROM lessons WHERE edition_id = $1', [editionId]);
    await tx.execute('DELETE FROM modules WHERE edition_id = $1', [editionId]);
    const updated = await tx.execute(
      `UPDATE course_editions
       SET title = $1, subtitle = $2, description = $3, outcomes_json = $4::jsonb,
           completion_rules = $5, passing_score_percent = $6, provenance_id = $7, updated_at = $8
       WHERE id = $9 AND status = 'draft'`,
      [
        edition.title, edition.subtitle, edition.description, JSON.stringify(edition.outcomes),
        edition.completionRules, edition.passingScorePercent, ids.provenanceId, now, editionId,
      ]
    );
    if (updated !== 1) {
      throw new Error(`Edition ${editionId} is no longer a draft; refusing to modify it.`);
    }
    stats.draftsReplaced += 1;
  } else {
    await tx.execute(
      `INSERT INTO course_editions (
         id, course_id, locale, version, title, subtitle, description,
         outcomes_json, prerequisites_json, completion_rules, passing_score_percent,
         status, provenance_id, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, '[]'::jsonb, $9, $10, 'draft', $11, $12)`,
      [
        editionId, course.courseId, edition.locale, plan.version, edition.title, edition.subtitle,
        edition.description, JSON.stringify(edition.outcomes), edition.completionRules,
        edition.passingScorePercent, ids.provenanceId, now,
      ]
    );
    stats.editionsCreated += 1;
  }

  let lessonIndex = 0;
  for (const [mi, mod] of edition.modules.entries()) {
    const moduleId = ids.moduleIds[mi];
    await tx.execute(
      `INSERT INTO modules (id, edition_id, sequence_num, title, summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [moduleId, editionId, mod.sequenceNum, mod.title, mod.summary, now]
    );
    stats.modulesWritten += 1;
    const { lessons, ...moduleFields } = mod;
    await upsertRef(tx, 'module', `${edition.locale}:${mod.externalId}`, moduleId, contentHash(moduleFields), { editionId }, runId, now);

    for (const lesson of lessons) {
      const lessonId = ids.lessonIds[lessonIndex++];
      await tx.execute(
        `INSERT INTO lessons (
           id, edition_id, module_id, sequence_num, title, summary, objectives_json, body_blocks_json,
           key_terms_json, simulation_type, video_url, captions_vtt, transcript, estimated_minutes,
           is_required, provenance_id
         ) VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7::jsonb, '[]'::jsonb, 'none', NULL, NULL, $8, $9, TRUE, $10)`,
        [
          lessonId, editionId, moduleId, lesson.sequenceNum, lesson.title, lesson.summary,
          JSON.stringify(lesson.bodyBlocks), lesson.transcript, lesson.estimatedMinutes, ids.provenanceId,
        ]
      );
      stats.lessonsWritten += 1;
      await upsertRef(tx, 'lesson', `${edition.locale}:${lesson.externalId}`, lessonId, contentHash(lesson), { editionId, sourceUrl: lesson.sourceUrl }, runId, now);
    }
  }

  await upsertRef(
    tx, 'edition', edition.externalId, editionId, edition.contentHash,
    { courseId: course.courseId, locale: edition.locale, version: plan.version, aiAssisted: p.aiAssisted },
    runId, now
  );

  return { courseId: course.courseId, locale: edition.locale, action: plan.action, editionId, version: plan.version };
}

export async function loadLearnAnything(result: TransformResult, options: LoadOptions): Promise<LoadResult> {
  const executor = options.executor ?? defaultDb;
  const transaction = options.transaction ?? runInTransaction;
  const clock = options.now ?? (() => new Date());
  const runId = `imp-${crypto.randomUUID()}`;

  await executor.execute(
    `INSERT INTO import_runs (id, source, input_ref, triggered_by, status, started_at)
     VALUES ($1, $2, $3, $4, 'running', $5)`,
    [runId, LEARN_ANYTHING_SOURCE, options.inputRef, options.triggeredBy ?? null, clock().toISOString()]
  );

  try {
    const out = await transaction(async (tx) => {
      const now = clock().toISOString();
      const stats = emptyStats();
      const editions: EditionOutcome[] = [];
      for (const course of result.courses) {
        await upsertCourse(tx, course, runId, now);
        stats.coursesUpserted += 1;
        for (const edition of course.editions) {
          editions.push(await writeEdition(tx, course, edition, runId, now, stats));
        }
      }
      return { stats, editions };
    });

    await executor.execute(
      `UPDATE import_runs SET status = 'succeeded', stats_json = $1::jsonb, finished_at = $2 WHERE id = $3`,
      [JSON.stringify({ ...out.stats, warnings: result.warnings }), clock().toISOString(), runId]
    );
    return { runId, ...out };
  } catch (err) {
    await executor
      .execute(`UPDATE import_runs SET status = 'failed', error = $1, finished_at = $2 WHERE id = $3`, [
        err instanceof Error ? err.message : String(err),
        clock().toISOString(),
        runId,
      ])
      .catch(() => undefined);
    throw err;
  }
}
