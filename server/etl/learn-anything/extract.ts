// Extract step: read learn-anything topic/path data from a local JSON file or a URL,
// and validate it into a typed export. Nothing here touches the database.
//
// Input format (JSON). Licence/source metadata is mandatory: the importer never
// assumes a licence. Uzbek text is used only when supplied in `translations.uz`;
// the importer does not machine-translate.
//
// {
//   "source": {
//     "name": "learn-anything.xyz",
//     "url": "https://learn-anything.xyz",
//     "license": "<licence the content is used under>",
//     "attribution": "<attribution text to show>",
//     "author": "<optional creator>",
//     "commercialAllowed": true, "adaptationAllowed": true, "translationAllowed": true
//   },
//   "topics": [{
//     "id": "economics-basics", "title": "Economics basics", "topic": "economics",
//     "description": "...", "url": "https://...", "level": "Beginner",
//     "modules": [{
//       "id": "m1", "title": "...", "summary": "...",
//       "lessons": [{ "id": "l1", "title": "...", "summary": "...", "url": "https://...",
//                     "body": "...", "estimatedMinutes": 10 }]
//     }],
//     "translations": { "uz": {
//       "title": "...", "description": "...", "aiAssisted": true, "aiModel": "...",
//       "modules": { "m1": { "title": "...", "summary": "..." } },
//       "lessons": { "l1": { "title": "...", "summary": "...", "body": "..." } }
//     } }
//   }]
// }

import fs from 'node:fs/promises';
import type { CourseLevel } from '../../../src/shared/types.ts';

export const LEARN_ANYTHING_SOURCE = 'learn-anything';

export interface SourceMetadata {
  name: string;
  url: string;
  license: string;
  attribution: string;
  author: string | null;
  commercialAllowed: boolean;
  adaptationAllowed: boolean;
  translationAllowed: boolean;
}

export interface ExtractedLesson {
  id: string;
  title: string;
  summary: string;
  url: string | null;
  body: string | null;
  estimatedMinutes: number | null;
}

export interface ExtractedModule {
  id: string;
  title: string;
  summary: string;
  lessons: ExtractedLesson[];
}

export interface ExtractedTranslation {
  title: string;
  description: string;
  aiAssisted: boolean;
  aiModel: string | null;
  modules: Record<string, { title: string; summary: string }>;
  lessons: Record<string, { title: string; summary: string; body: string | null }>;
}

export interface ExtractedTopic {
  id: string;
  title: string;
  topic: string;
  description: string;
  url: string | null;
  level: CourseLevel | null;
  modules: ExtractedModule[];
  translations: { uz?: ExtractedTranslation };
}

export interface LearnAnythingExport {
  source: SourceMetadata;
  topics: ExtractedTopic[];
}

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractError';
  }
}

type Json = Record<string, unknown>;

const LEVELS: readonly CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const EXTERNAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(obj: Json, key: string, where: string, required = true): string {
  const v = obj[key];
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (!required && (v === undefined || v === null || v === '')) return '';
  throw new ExtractError(`${where}: "${key}" must be a non-empty string.`);
}

function optStr(obj: Json, key: string, where: string): string | null {
  const v = obj[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new ExtractError(`${where}: "${key}" must be a string.`);
  return v.trim() || null;
}

function bool(obj: Json, key: string, where: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new ExtractError(`${where}: "${key}" must be true or false (licence terms are never assumed).`);
  }
  return v;
}

function externalId(obj: Json, where: string): string {
  const id = str(obj, 'id', where);
  if (!EXTERNAL_ID.test(id)) {
    throw new ExtractError(`${where}: id "${id}" may only use letters, digits, ".", "_", ":" or "-".`);
  }
  return id;
}

function httpUrl(value: string | null, where: string): string | null {
  if (value === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ExtractError(`${where}: "${value}" is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ExtractError(`${where}: only http(s) URLs are allowed.`);
  }
  return parsed.toString();
}

function parseSource(raw: unknown): SourceMetadata {
  if (!isObject(raw)) throw new ExtractError('"source" licence/source metadata is required.');
  const where = 'source';
  return {
    name: str(raw, 'name', where),
    url: httpUrl(str(raw, 'url', where), where)!,
    license: str(raw, 'license', where),
    attribution: str(raw, 'attribution', where),
    author: optStr(raw, 'author', where),
    commercialAllowed: bool(raw, 'commercialAllowed', where),
    adaptationAllowed: bool(raw, 'adaptationAllowed', where),
    translationAllowed: bool(raw, 'translationAllowed', where),
  };
}

function parseLesson(raw: unknown, where: string): ExtractedLesson {
  if (!isObject(raw)) throw new ExtractError(`${where} must be an object.`);
  const minutes = raw.estimatedMinutes;
  if (minutes !== undefined && minutes !== null && (typeof minutes !== 'number' || !(minutes > 0))) {
    throw new ExtractError(`${where}: "estimatedMinutes" must be a positive number.`);
  }
  return {
    id: externalId(raw, where),
    title: str(raw, 'title', where),
    summary: str(raw, 'summary', where, false),
    url: httpUrl(optStr(raw, 'url', where), where),
    body: optStr(raw, 'body', where),
    estimatedMinutes: typeof minutes === 'number' ? Math.round(minutes) || 1 : null,
  };
}

function parseModule(raw: unknown, where: string): ExtractedModule {
  if (!isObject(raw)) throw new ExtractError(`${where} must be an object.`);
  const lessons = raw.lessons;
  if (!Array.isArray(lessons) || lessons.length === 0) {
    throw new ExtractError(`${where}: "lessons" must be a non-empty array.`);
  }
  const parsed = lessons.map((l, i) => parseLesson(l, `${where}.lessons[${i}]`));
  assertUniqueIds(parsed, `${where}.lessons`);
  return {
    id: externalId(raw, where),
    title: str(raw, 'title', where),
    summary: str(raw, 'summary', where, false),
    lessons: parsed,
  };
}

function parseTextMap<T>(
  raw: unknown,
  where: string,
  map: (entry: Json, where: string) => T
): Record<string, T> {
  if (raw === undefined || raw === null) return {};
  if (!isObject(raw)) throw new ExtractError(`${where} must be an object keyed by id.`);
  const out: Record<string, T> = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!isObject(entry)) throw new ExtractError(`${where}.${id} must be an object.`);
    out[id] = map(entry, `${where}.${id}`);
  }
  return out;
}

function parseTranslation(raw: unknown, where: string): ExtractedTranslation | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObject(raw)) throw new ExtractError(`${where} must be an object.`);
  const aiAssisted = raw.aiAssisted ?? false;
  if (typeof aiAssisted !== 'boolean') throw new ExtractError(`${where}: "aiAssisted" must be true or false.`);
  return {
    title: str(raw, 'title', where),
    description: str(raw, 'description', where, false),
    aiAssisted,
    aiModel: optStr(raw, 'aiModel', where),
    modules: parseTextMap(raw.modules, `${where}.modules`, (e, w) => ({
      title: str(e, 'title', w),
      summary: str(e, 'summary', w, false),
    })),
    lessons: parseTextMap(raw.lessons, `${where}.lessons`, (e, w) => ({
      title: str(e, 'title', w),
      summary: str(e, 'summary', w, false),
      body: optStr(e, 'body', w),
    })),
  };
}

function parseTopic(raw: unknown, where: string): ExtractedTopic {
  if (!isObject(raw)) throw new ExtractError(`${where} must be an object.`);
  const level = optStr(raw, 'level', where);
  if (level !== null && !LEVELS.includes(level as CourseLevel)) {
    throw new ExtractError(`${where}: "level" must be one of ${LEVELS.join(', ')}.`);
  }
  const modules = raw.modules;
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new ExtractError(`${where}: "modules" must be a non-empty array.`);
  }
  const parsedModules = modules.map((m, i) => parseModule(m, `${where}.modules[${i}]`));
  assertUniqueIds(parsedModules, `${where}.modules`);
  assertUniqueIds(
    parsedModules.flatMap((m) => m.lessons),
    `${where} lessons (lesson ids must be unique across the whole topic)`
  );
  const translations = isObject(raw.translations) ? raw.translations : {};
  return {
    id: externalId(raw, where),
    title: str(raw, 'title', where),
    topic: str(raw, 'topic', where),
    description: str(raw, 'description', where, false),
    url: httpUrl(optStr(raw, 'url', where), where),
    level: level as CourseLevel | null,
    modules: parsedModules,
    translations: { uz: parseTranslation(translations.uz, `${where}.translations.uz`) },
  };
}

function assertUniqueIds(items: Array<{ id: string }>, where: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new ExtractError(`${where}: duplicate id "${item.id}".`);
    seen.add(item.id);
  }
}

/** Validates raw JSON into a typed export. Pure; throws ExtractError with a precise path. */
export function parseLearnAnythingExport(
  raw: unknown,
  sourceOverrides: Partial<SourceMetadata> = {}
): LearnAnythingExport {
  if (!isObject(raw)) throw new ExtractError('Input must be a JSON object with "source" and "topics".');
  // CLI flags (e.g. --license) override or fill in the file's source metadata.
  const baseSource = isObject(raw.source) ? raw.source : {};
  const source = parseSource({ ...baseSource, ...stripUndefined(sourceOverrides) });
  if (!Array.isArray(raw.topics) || raw.topics.length === 0) {
    throw new ExtractError('"topics" must be a non-empty array.');
  }
  const topics = raw.topics.map((t, i) => parseTopic(t, `topics[${i}]`));
  assertUniqueIds(topics, 'topics');
  return { source, topics };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export async function extractFromFile(
  filePath: string,
  sourceOverrides: Partial<SourceMetadata> = {}
): Promise<LearnAnythingExport> {
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    throw new ExtractError(`Could not read ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ExtractError(`${filePath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parseLearnAnythingExport(raw, sourceOverrides);
}

export async function extractFromUrl(
  url: string,
  sourceOverrides: Partial<SourceMetadata> = {},
  fetchImpl: typeof fetch = fetch
): Promise<LearnAnythingExport> {
  const target = httpUrl(url, '--url');
  if (!target) throw new ExtractError('--url is required.');
  let res: Response;
  try {
    res = await fetchImpl(target, {
      headers: { accept: 'application/json', 'user-agent': 'econova-etl/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new ExtractError(`Could not fetch ${target}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    throw new ExtractError(`Fetching ${target} failed with HTTP ${res.status}.`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    throw new ExtractError(
      `${target} returned "${contentType || 'unknown content type'}", not JSON. ` +
        'Point --url at a JSON export in the documented format, or save one locally and use --file.'
    );
  }
  let raw: unknown;
  try {
    raw = await res.json();
  } catch (err) {
    throw new ExtractError(`${target} did not return valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parseLearnAnythingExport(raw, sourceOverrides);
}
