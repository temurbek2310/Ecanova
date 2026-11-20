// Transform step: pure functions that turn an extracted learn-anything export into
// ECONOVA rows (Track -> Module -> Lesson, one draft edition per locale).
// No I/O and no clock: the same input always gives the same IDs and hashes.

import crypto from 'node:crypto';
import type { CourseLevel, EditorialStatus, LessonBlock, LocaleCode, Subject } from '../../../src/shared/types.ts';
import type { ExtractedTopic, LearnAnythingExport, SourceMetadata } from './extract.ts';

export const DEFAULT_LESSON_MINUTES = 10;
export const DEFAULT_PASSING_SCORE = 70;
export const PUBLISHER_PLATFORM = 'learn-anything.xyz';

// --- Deterministic identifiers and hashes ---

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Stable ID from its parts, e.g. stableId('la-course', 'economics-basics'). */
export function stableId(prefix: string, ...parts: Array<string | number>): string {
  return `${prefix}-${sha256(parts.map(String).join('\u0000')).slice(0, 16)}`;
}

/** JSON with sorted object keys, so hashes do not depend on key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function contentHash(value: unknown): string {
  return sha256(canonicalJson(value));
}

// --- Subject mapping (existing CHECK: Economics | Mathematics | Business) ---

const SUBJECT_KEYWORDS: ReadonlyArray<[Subject, readonly string[]]> = [
  [
    'Economics',
    ['econom', 'inflation', 'monetary', 'fiscal', 'game theory', 'supply and demand', 'trade policy'],
  ],
  [
    'Mathematics',
    ['math', 'algebra', 'calculus', 'statistic', 'probability', 'geometry', 'trigonometry', 'number theory', 'arithmetic', 'linear algebra'],
  ],
  [
    'Business',
    ['business', 'finance', 'accounting', 'marketing', 'startup', 'entrepreneur', 'investing', 'sales', 'product management'],
  ],
];

function normalizeText(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * Maps an upstream topic to one of the three existing subjects. The topic string
 * is checked first, then the title. Returns null when nothing matches.
 */
export function mapTopicToSubject(topic: string, title = ''): Subject | null {
  for (const text of [topic, title]) {
    const normalized = normalizeText(text);
    for (const [subject, keywords] of SUBJECT_KEYWORDS) {
      if (keywords.some((k) => normalized.includes(k))) return subject;
    }
  }
  return null;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'topic'
  );
}

// --- Transformed shapes ---

export interface TransformedLesson {
  externalId: string;
  sequenceNum: number;
  title: string;
  summary: string;
  bodyBlocks: LessonBlock[];
  transcript: string;
  estimatedMinutes: number;
  sourceUrl: string | null;
}

export interface TransformedModule {
  externalId: string;
  sequenceNum: number;
  title: string;
  summary: string;
  lessons: TransformedLesson[];
}

export interface TransformedProvenance {
  sourceTitle: string;
  authorCreator: string;
  originalUrl: string;
  publisherPlatform: string;
  licenseBasis: string;
  attributionText: string;
  commercialAllowed: boolean;
  adaptationAllowed: boolean;
  translationAllowed: boolean;
  aiAssisted: boolean;
  aiModel: string | null;
}

export interface TransformedEdition {
  /** `${topicId}:${locale}` — the external_source_refs key for this edition. */
  externalId: string;
  locale: LocaleCode;
  title: string;
  subtitle: string;
  description: string;
  outcomes: string[];
  completionRules: string;
  passingScorePercent: number;
  provenance: TransformedProvenance;
  modules: TransformedModule[];
  /** Hash of everything above; drives skip / replace-draft / new-version decisions. */
  contentHash: string;
}

export interface TransformedCourse {
  externalId: string;
  courseId: string;
  slug: string;
  subject: Subject;
  level: CourseLevel;
  estimatedMinutes: number;
  topicTags: string[];
  editions: TransformedEdition[];
  contentHash: string;
}

export interface TransformResult {
  courses: TransformedCourse[];
  warnings: string[];
}

export interface TransformOptions {
  /** Subject for topics that match no keyword; without it such topics are skipped. */
  defaultSubject?: Subject;
}

// --- Builders ---

const COPY: Record<LocaleCode, { completion: string; furtherStudy: string; resource: string; counts: (m: number, l: number) => string }> = {
  en: {
    completion: 'Complete all required lessons in every module.',
    furtherStudy: 'Further study',
    resource: 'Original resource:',
    counts: (m, l) => `${m} ${m === 1 ? 'module' : 'modules'} · ${l} ${l === 1 ? 'lesson' : 'lessons'}`,
  },
  uz: {
    completion: 'Har bir moduldagi barcha majburiy darslarni yakunlang.',
    furtherStudy: 'Qo‘shimcha o‘qish',
    resource: 'Asl manba:',
    counts: (m, l) => `${m} modul · ${l} dars`,
  },
};

function buildLesson(
  locale: LocaleCode,
  externalId: string,
  sequenceNum: number,
  title: string,
  summary: string,
  body: string | null,
  url: string | null,
  minutes: number | null
): TransformedLesson {
  const blocks: LessonBlock[] = [{ kind: 'concept', heading: title, body: body || summary || title }];
  if (url) {
    blocks.push({ kind: 'example', heading: COPY[locale].furtherStudy, body: `${COPY[locale].resource} ${url}` });
  }
  return {
    externalId,
    sequenceNum,
    title,
    summary: summary || title,
    bodyBlocks: blocks,
    transcript: blocks.map((b) => `${b.heading}\n${b.body}`).join('\n\n'),
    estimatedMinutes: minutes && minutes > 0 ? minutes : DEFAULT_LESSON_MINUTES,
    sourceUrl: url,
  };
}

function buildProvenance(
  topic: ExtractedTopic,
  source: SourceMetadata,
  ai: { aiAssisted: boolean; aiModel: string | null }
): TransformedProvenance {
  return {
    sourceTitle: topic.title,
    authorCreator: source.author ?? source.name,
    originalUrl: topic.url ?? source.url,
    publisherPlatform: PUBLISHER_PLATFORM,
    licenseBasis: source.license,
    attributionText: source.attribution,
    commercialAllowed: source.commercialAllowed,
    adaptationAllowed: source.adaptationAllowed,
    translationAllowed: source.translationAllowed,
    aiAssisted: ai.aiAssisted,
    aiModel: ai.aiModel,
  };
}

function finishEdition(edition: Omit<TransformedEdition, 'contentHash'>): TransformedEdition {
  return { ...edition, contentHash: contentHash(edition) };
}

function buildEnglishEdition(topic: ExtractedTopic, source: SourceMetadata): TransformedEdition {
  let seq = 0;
  const modules = topic.modules.map((m, mi) => ({
    externalId: `${topic.id}/${m.id}`,
    sequenceNum: mi + 1,
    title: m.title,
    summary: m.summary,
    lessons: m.lessons.map((l) =>
      buildLesson('en', `${topic.id}/${l.id}`, ++seq, l.title, l.summary, l.body, l.url, l.estimatedMinutes)
    ),
  }));
  return finishEdition({
    externalId: `${topic.id}:en`,
    locale: 'en',
    title: topic.title,
    subtitle: COPY.en.counts(modules.length, seq),
    description: topic.description || topic.title,
    outcomes: modules.map((m) => m.title),
    completionRules: COPY.en.completion,
    passingScorePercent: DEFAULT_PASSING_SCORE,
    provenance: buildProvenance(topic, source, { aiAssisted: false, aiModel: null }),
    modules,
  });
}

/**
 * Builds the Uzbek edition only from supplied Uzbek text. Returns a reason string
 * instead when it cannot (no translation, translation not allowed, or incomplete):
 * ECONOVA never fills Uzbek editions with English or machine-translated text here.
 */
function buildUzbekEdition(topic: ExtractedTopic, source: SourceMetadata): TransformedEdition | string {
  const uz = topic.translations.uz;
  if (!uz) return `topic "${topic.id}": no Uzbek translation supplied; only the EN draft was built.`;
  if (!source.translationAllowed) {
    return `topic "${topic.id}": source licence does not allow translation; Uzbek draft skipped.`;
  }
  const missing = [
    ...topic.modules.filter((m) => !uz.modules[m.id]).map((m) => `module ${m.id}`),
    ...topic.modules.flatMap((m) => m.lessons).filter((l) => !uz.lessons[l.id]).map((l) => `lesson ${l.id}`),
  ];
  if (missing.length > 0) {
    return `topic "${topic.id}": Uzbek translation is incomplete (${missing.join(', ')}); Uzbek draft skipped.`;
  }
  let seq = 0;
  const modules = topic.modules.map((m, mi) => ({
    externalId: `${topic.id}/${m.id}`,
    sequenceNum: mi + 1,
    title: uz.modules[m.id].title,
    summary: uz.modules[m.id].summary,
    lessons: m.lessons.map((l) => {
      const t = uz.lessons[l.id];
      return buildLesson('uz', `${topic.id}/${l.id}`, ++seq, t.title, t.summary, t.body, l.url, l.estimatedMinutes);
    }),
  }));
  return finishEdition({
    externalId: `${topic.id}:uz`,
    locale: 'uz',
    title: uz.title,
    subtitle: COPY.uz.counts(modules.length, seq),
    description: uz.description || uz.title,
    outcomes: modules.map((m) => m.title),
    completionRules: COPY.uz.completion,
    passingScorePercent: DEFAULT_PASSING_SCORE,
    provenance: buildProvenance(topic, source, { aiAssisted: uz.aiAssisted, aiModel: uz.aiModel }),
    modules,
  });
}

export function transformLearnAnything(
  data: LearnAnythingExport,
  options: TransformOptions = {}
): TransformResult {
  const warnings: string[] = [];
  const courses: TransformedCourse[] = [];

  for (const topic of data.topics) {
    const mapped = mapTopicToSubject(topic.topic, topic.title);
    const subject = mapped ?? options.defaultSubject ?? null;
    if (!subject) {
      warnings.push(
        `topic "${topic.id}" ("${topic.topic}") matches no ECONOVA subject; skipped. Pass --default-subject to include it.`
      );
      continue;
    }
    if (!mapped) {
      warnings.push(`topic "${topic.id}" ("${topic.topic}") had no subject match; used default ${subject}.`);
    }

    const editions: TransformedEdition[] = [buildEnglishEdition(topic, data.source)];
    const uz = buildUzbekEdition(topic, data.source);
    if (typeof uz === 'string') warnings.push(uz);
    else editions.push(uz);

    const estimatedMinutes = editions[0].modules
      .flatMap((m) => m.lessons)
      .reduce((sum, l) => sum + l.estimatedMinutes, 0);
    const topicTags = [topic.topic];
    const course = {
      externalId: topic.id,
      courseId: stableId('la-course', topic.id),
      slug: `la-${slugify(topic.id)}`,
      subject,
      level: topic.level ?? 'Beginner',
      estimatedMinutes: Math.max(1, estimatedMinutes),
      topicTags,
    };
    courses.push({ ...course, editions, contentHash: contentHash(course) });
  }

  return { courses, warnings };
}

// --- Versioning: never mutate a published (or in-review) edition in place ---

export interface LatestEditionState {
  id: string;
  version: number;
  status: EditorialStatus;
}

export interface EditionSourceRef {
  /** Edition ID this importer last wrote for this external edition. */
  entityId: string;
  contentHash: string;
}

export type EditionVersionPlan =
  | { action: 'unchanged'; version: number }
  | { action: 'replace_draft'; version: number }
  | { action: 'create'; version: number };

/**
 * Decides what an import does for one course + locale:
 * - upstream content unchanged since the last import: nothing;
 * - the latest edition is a draft this importer created: rewrite that draft;
 * - otherwise (published, in review, retired, or staff-made): new draft at latest + 1.
 */
export function planEditionVersion(
  latest: LatestEditionState | null,
  ref: EditionSourceRef | null,
  newContentHash: string
): EditionVersionPlan {
  if (ref && ref.contentHash === newContentHash) {
    return { action: 'unchanged', version: latest?.version ?? 1 };
  }
  if (!latest) return { action: 'create', version: 1 };
  if (latest.status === 'draft' && ref?.entityId === latest.id) {
    return { action: 'replace_draft', version: latest.version };
  }
  return { action: 'create', version: latest.version + 1 };
}

export interface EditionRowIds {
  editionId: string;
  provenanceId: string;
  moduleIds: string[];
  /** Lesson IDs in edition order (all modules flattened). */
  lessonIds: string[];
}

/** Deterministic row IDs for one edition version. */
export function buildEditionRowIds(edition: TransformedEdition, version: number): EditionRowIds {
  return {
    editionId: stableId('la-ed', edition.externalId, version),
    provenanceId: stableId('la-prov', edition.externalId, version),
    moduleIds: edition.modules.map((m) => stableId('la-mod', edition.externalId, version, m.externalId)),
    lessonIds: edition.modules.flatMap((m) =>
      m.lessons.map((l) => stableId('la-les', edition.externalId, version, l.externalId))
    ),
  };
}
