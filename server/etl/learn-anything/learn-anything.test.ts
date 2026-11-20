import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { SqlExecutor } from '../../db.ts';
import { ExtractError, extractFromFile, extractFromUrl, parseLearnAnythingExport } from './extract.ts';
import { loadLearnAnything } from './load.ts';
import {
  buildEditionRowIds,
  canonicalJson,
  mapTopicToSubject,
  planEditionVersion,
  stableId,
  transformLearnAnything,
} from './transform.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, 'fixtures', 'sample-export.json');
const rawFixture = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<string, any>;

// --- extract ---

test('extract: fixture parses; licence metadata is mandatory and never assumed', async () => {
  const data = await extractFromFile(FIXTURE);
  assert.equal(data.topics.length, 3);
  assert.equal(data.source.license, 'Example licence for tests only');

  const noLicence = rawFixture();
  delete noLicence.source.license;
  assert.throws(() => parseLearnAnythingExport(noLicence), /source: "license"/);
  // A CLI --license override fills the gap.
  assert.equal(parseLearnAnythingExport(noLicence, { license: 'CC BY 4.0' }).source.license, 'CC BY 4.0');

  const noFlag = rawFixture();
  delete noFlag.source.translationAllowed;
  assert.throws(() => parseLearnAnythingExport(noFlag), /translationAllowed/);
});

test('extract: precise errors for bad structure, ids and URLs', () => {
  const dupLesson = rawFixture();
  dupLesson.topics[0].modules[1].lessons[0].id = 'opportunity-cost';
  assert.throws(() => parseLearnAnythingExport(dupLesson), /duplicate id "opportunity-cost"/);

  const badId = rawFixture();
  badId.topics[0].id = '../etc/passwd';
  assert.throws(() => parseLearnAnythingExport(badId), ExtractError);

  const badUrl = rawFixture();
  badUrl.topics[0].url = 'javascript:alert(1)';
  assert.throws(() => parseLearnAnythingExport(badUrl), /only http\(s\) URLs/);

  assert.throws(() => parseLearnAnythingExport({ source: rawFixture().source, topics: [] }), /non-empty array/);
});

test('extract: live fetch reports non-JSON and HTTP errors clearly', async () => {
  const html = (async () =>
    new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
  await assert.rejects(extractFromUrl('https://example.org/x', {}, html), /not JSON/);

  const notFound = (async () => new Response('nope', { status: 404 })) as typeof fetch;
  await assert.rejects(extractFromUrl('https://example.org/x', {}, notFound), /HTTP 404/);

  const ok = (async () =>
    new Response(JSON.stringify(rawFixture()), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })) as typeof fetch;
  assert.equal((await extractFromUrl('https://example.org/x', {}, ok)).topics.length, 3);

  await assert.rejects(extractFromUrl('file:///etc/passwd', {}, ok), /only http\(s\) URLs/);
});

// --- transform ---

test('transform: Track -> Module -> Lesson structure with EN and supplied UZ drafts', async () => {
  const { courses, warnings } = transformLearnAnything(await extractFromFile(FIXTURE));

  assert.equal(courses.length, 2, 'photography has no subject match and is skipped');
  assert.ok(warnings.some((w) => w.includes('street-photography') && w.includes('skipped')));

  const econ = courses.find((c) => c.externalId === 'intro-economics')!;
  assert.equal(econ.subject, 'Economics');
  assert.deepEqual(econ.topicTags, ['economics']);
  assert.equal(econ.slug, 'la-intro-economics');
  assert.equal(econ.estimatedMinutes, 8 + 12 + 10);
  assert.deepEqual(econ.editions.map((e) => e.locale), ['en', 'uz']);

  const [en, uz] = econ.editions;
  assert.equal(en.modules.length, 2);
  assert.deepEqual(en.modules.map((m) => m.sequenceNum), [1, 2]);
  assert.deepEqual(en.modules.flatMap((m) => m.lessons.map((l) => l.sequenceNum)), [1, 2, 3]);
  assert.equal(en.provenance.aiAssisted, false);
  assert.equal(en.provenance.licenseBasis, 'Example licence for tests only');
  assert.equal(en.modules[0].lessons[0].bodyBlocks[1].body, 'Original resource: https://example.org/r/opportunity-cost');

  assert.equal(uz.title, 'Iqtisodiyotga kirish');
  assert.equal(uz.modules[0].lessons[0].title, 'Muqobil xarajat');
  assert.equal(uz.provenance.aiAssisted, true, 'AI-translated Uzbek drafts are flagged');
  assert.equal(uz.provenance.aiModel, 'example-model');

  const algebra = courses.find((c) => c.externalId === 'linear-algebra-basics')!;
  assert.equal(algebra.subject, 'Mathematics');
  assert.deepEqual(algebra.editions.map((e) => e.locale), ['en'], 'no UZ text supplied -> EN only');
});

test('transform: Uzbek is never filled with English or partial translations', async () => {
  const partial = rawFixture();
  delete partial.topics[0].translations.uz.lessons.ppf;
  const { courses, warnings } = transformLearnAnything(parseLearnAnythingExport(partial));
  assert.deepEqual(courses[0].editions.map((e) => e.locale), ['en']);
  assert.ok(warnings.some((w) => w.includes('incomplete') && w.includes('lesson ppf')));

  const noTranslation = rawFixture();
  noTranslation.source.translationAllowed = false;
  const out = transformLearnAnything(parseLearnAnythingExport(noTranslation));
  assert.deepEqual(out.courses[0].editions.map((e) => e.locale), ['en']);
});

test('transform: default subject is opt-in and the topic stays as a tag', async () => {
  const { courses } = transformLearnAnything(await extractFromFile(FIXTURE), { defaultSubject: 'Business' });
  const photo = courses.find((c) => c.externalId === 'street-photography')!;
  assert.equal(photo.subject, 'Business');
  assert.deepEqual(photo.topicTags, ['photography']);

  assert.equal(mapTopicToSubject('microeconomics'), 'Economics');
  assert.equal(mapTopicToSubject('statistics'), 'Mathematics');
  assert.equal(mapTopicToSubject('accounting'), 'Business');
  assert.equal(mapTopicToSubject('cooking', 'Kitchen basics'), null);
});

test('transform: deterministic and idempotent — same input, same IDs and hashes', async () => {
  const a = transformLearnAnything(await extractFromFile(FIXTURE));
  const b = transformLearnAnything(await extractFromFile(FIXTURE));
  assert.equal(canonicalJson(a), canonicalJson(b));

  // Key order in the input does not change hashes.
  const reordered = rawFixture();
  reordered.source = Object.fromEntries(Object.entries(reordered.source).reverse());
  const c = transformLearnAnything(parseLearnAnythingExport(reordered));
  assert.equal(c.courses[0].editions[0].contentHash, a.courses[0].editions[0].contentHash);

  // Changing upstream content changes only that edition's hash.
  const edited = rawFixture();
  edited.topics[0].modules[0].lessons[0].summary = 'Updated upstream summary.';
  const d = transformLearnAnything(parseLearnAnythingExport(edited));
  assert.notEqual(d.courses[0].editions[0].contentHash, a.courses[0].editions[0].contentHash);
  assert.equal(d.courses[1].editions[0].contentHash, a.courses[1].editions[0].contentHash);

  assert.equal(stableId('la-course', 'x'), stableId('la-course', 'x'));
  assert.notEqual(stableId('la-course', 'x'), stableId('la-course', 'y'));
});

test('transform: row IDs differ per version so new drafts never collide with published rows', async () => {
  const edition = transformLearnAnything(await extractFromFile(FIXTURE)).courses[0].editions[0];
  const v1 = buildEditionRowIds(edition, 1);
  const v2 = buildEditionRowIds(edition, 2);
  assert.equal(v1.moduleIds.length, 2);
  assert.equal(v1.lessonIds.length, 3);
  assert.notEqual(v1.editionId, v2.editionId);
  assert.notEqual(v1.provenanceId, v2.provenanceId);
  assert.ok(v1.lessonIds.every((id) => !v2.lessonIds.includes(id)));
  assert.deepEqual(buildEditionRowIds(edition, 1), v1);
});

test('versions: unchanged skips, own draft is replaced, anything else gets version + 1', () => {
  const hash = 'h-new';
  assert.deepEqual(planEditionVersion(null, null, hash), { action: 'create', version: 1 });
  assert.deepEqual(
    planEditionVersion({ id: 'ed1', version: 1, status: 'published' }, { entityId: 'ed1', contentHash: hash }, hash),
    { action: 'unchanged', version: 1 }
  );
  assert.deepEqual(
    planEditionVersion({ id: 'ed1', version: 1, status: 'draft' }, { entityId: 'ed1', contentHash: 'h-old' }, hash),
    { action: 'replace_draft', version: 1 }
  );
  for (const status of ['published', 'subject_review', 'language_review', 'rights_accessibility_review', 'approved', 'retired'] as const) {
    assert.deepEqual(
      planEditionVersion({ id: 'ed1', version: 1, status }, { entityId: 'ed1', contentHash: 'h-old' }, hash),
      { action: 'create', version: 2 },
      status
    );
  }
  // A staff-made draft (not created by the importer) is never overwritten.
  assert.deepEqual(
    planEditionVersion({ id: 'staff-ed', version: 3, status: 'draft' }, { entityId: 'ed1', contentHash: 'h-old' }, hash),
    { action: 'create', version: 4 }
  );
});

// --- load (recording fake executor; no database) ---

interface Recorded {
  sql: string;
  params: unknown[];
}

function fakeDb(answers: { latest: unknown; ref: unknown }) {
  const calls: Recorded[] = [];
  const exec: SqlExecutor = {
    async query() {
      return [];
    },
    async queryOne(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.includes('FROM course_editions')) return answers.latest as never;
      if (sql.includes('FROM external_source_refs')) return answers.ref as never;
      return null;
    },
    async execute(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      return 1;
    },
  };
  return { exec, calls, transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) => fn(exec) };
}

async function oneEditionResult() {
  const result = transformLearnAnything(await extractFromFile(FIXTURE));
  const econ = result.courses[0];
  return { ...result, courses: [{ ...econ, editions: [econ.editions[0]] }] };
}

const writes = (calls: Recorded[], pattern: RegExp) => calls.filter((c) => pattern.test(c.sql));

test('load: changed content for a published edition creates a v+1 draft and never touches v1', async () => {
  const result = await oneEditionResult();
  const { exec, calls, transaction } = fakeDb({
    latest: { id: 'ed-published', version: 1, status: 'published' },
    ref: { entity_id: 'ed-published', content_hash: 'stale' },
  });
  const out = await loadLearnAnything(result, { inputRef: 'fixture', executor: exec, transaction });

  assert.equal(out.editions[0].action, 'create');
  assert.equal(out.editions[0].version, 2);
  const inserts = writes(calls, /INSERT INTO course_editions/);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].params[3], 2, 'version');
  assert.match(inserts[0].sql, /'draft'/);
  assert.equal(writes(calls, /UPDATE course_editions/).length, 0);
  assert.equal(writes(calls, /DELETE FROM/).length, 0);
  assert.ok(calls.every((c) => !c.params.includes('ed-published') || /SELECT|external_source_refs/.test(c.sql)));
  assert.equal(out.stats.modulesWritten, 2);
  assert.equal(out.stats.lessonsWritten, 3);
  assert.equal(writes(calls, /UPDATE import_runs SET status = 'succeeded'/).length, 1);
});

test('load: unchanged upstream content writes no edition rows', async () => {
  const result = await oneEditionResult();
  const hash = result.courses[0].editions[0].contentHash;
  const { exec, calls, transaction } = fakeDb({
    latest: { id: 'ed1', version: 1, status: 'published' },
    ref: { entity_id: 'ed1', content_hash: hash },
  });
  const out = await loadLearnAnything(result, { inputRef: 'fixture', executor: exec, transaction });
  assert.equal(out.stats.editionsUnchanged, 1);
  assert.equal(writes(calls, /INSERT INTO (course_editions|modules|lessons)/).length, 0);
});

test('load: an importer-owned draft is rewritten in place, guarded by status = draft', async () => {
  const result = await oneEditionResult();
  const { exec, calls, transaction } = fakeDb({
    latest: { id: 'ed-draft', version: 1, status: 'draft' },
    ref: { entity_id: 'ed-draft', content_hash: 'stale' },
  });
  const out = await loadLearnAnything(result, { inputRef: 'fixture', executor: exec, transaction });
  assert.equal(out.editions[0].action, 'replace_draft');
  assert.equal(out.stats.draftsReplaced, 1);
  const update = writes(calls, /UPDATE course_editions/)[0];
  assert.match(update.sql, /status = 'draft'/);
  assert.equal(writes(calls, /DELETE FROM lessons WHERE edition_id/)[0].params[0], 'ed-draft');
});

test('load: a failure marks the import run failed and rethrows', async () => {
  const result = await oneEditionResult();
  const { exec, calls } = fakeDb({ latest: null, ref: null });
  const failing = async () => {
    throw new Error('boom');
  };
  await assert.rejects(loadLearnAnything(result, { inputRef: 'fixture', executor: exec, transaction: failing }), /boom/);
  assert.equal(writes(calls, /UPDATE import_runs SET status = 'failed'/).length, 1);
});
