import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCachedCourseEdition,
  extractCachedCourseEditions,
  makeEditionCacheKey,
  parseEditionCacheKey,
  resolveCachedCourseDetails,
  resolveCourseOfflineStatus,
} from './offline-cache';
import type { CourseCatalogItem, CourseEditionSummary } from '../shared/types';

function makeEdition(overrides: Partial<CourseEditionSummary>): CourseEditionSummary {
  return {
    id: 'ed-1',
    courseId: 'course-1',
    locale: 'en',
    version: 1,
    title: 'Sample Course',
    subtitle: 'Subtitle',
    description: 'Description',
    outcomes: [],
    prerequisites: [],
    completionRules: 'Pass',
    passingScorePercent: 70,
    status: 'published',
    subjectReviewerId: null,
    languageReviewerId: null,
    rightsReviewerId: null,
    publishedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    lessonCount: 3,
    estimatedMinutes: 45,
    provenance: null,
    ...overrides,
  };
}

test('extractCachedCourseEditions parses catalog and locale-specific course edition URLs', () => {
  const result = extractCachedCourseEditions([
    'https://econova.example/api/catalog',
    'https://econova.example/api/courses/course-econ-101/editions/en',
    'https://econova.example/api/courses/course-bus-301/editions/UZ?v=1',
    'https://econova.example/assets/index-123.js',
  ]);

  assert.equal(result.hasCatalog, true);
  assert.equal(result.editionKeys.has(makeEditionCacheKey('course-econ-101', 'en')), true);
  assert.equal(result.editionKeys.has(makeEditionCacheKey('course-bus-301', 'uz')), true);
  assert.equal(result.editionKeys.has(makeEditionCacheKey('course-econ-101', 'uz')), false);
});

test('resolveCourseOfflineStatus reflects PWA service worker state accurately', () => {
  const cachedKeys = new Set([makeEditionCacheKey('course-econ-101', 'en')]);

  assert.equal(
    resolveCourseOfflineStatus({
      swStatus: 'active',
      cachedEditionKeys: cachedKeys,
      courseId: 'course-econ-101',
      locale: 'en',
      hasEditionInLocale: true,
    }),
    'cached_full'
  );

  // Caching English edition must not falsely mark Uzbek edition as cached
  assert.equal(
    resolveCourseOfflineStatus({
      swStatus: 'active',
      cachedEditionKeys: cachedKeys,
      courseId: 'course-econ-101',
      locale: 'uz',
      hasEditionInLocale: true,
    }),
    'not_cached'
  );

  assert.equal(
    resolveCourseOfflineStatus({
      swStatus: 'registering',
      cachedEditionKeys: cachedKeys,
      courseId: 'course-econ-101',
      locale: 'en',
      hasEditionInLocale: true,
    }),
    'sw_pending'
  );

  assert.equal(
    resolveCourseOfflineStatus({
      swStatus: 'unsupported',
      cachedEditionKeys: cachedKeys,
      courseId: 'course-econ-101',
      locale: 'en',
      hasEditionInLocale: true,
    }),
    'sw_unavailable'
  );
});

test('resolveCachedCourseDetails maps cached edition keys to sorted course metadata', () => {
  const courses: CourseCatalogItem[] = [
    {
      id: 'course-econ-101',
      slug: 'supply-demand',
      subject: 'Economics',
      level: 'Beginner',
      estimatedMinutes: 45,
      editions: {
        en: makeEdition({
          courseId: 'course-econ-101',
          locale: 'en',
          title: 'Foundations of Supply & Demand',
          estimatedMinutes: 45,
        }),
        uz: makeEdition({
          courseId: 'course-econ-101',
          locale: 'uz',
          title: 'Talab va taklif asoslari',
          estimatedMinutes: 50,
        }),
      },
    },
  ];

  assert.deepEqual(parseEditionCacheKey('course-econ-101:uz'), {
    courseId: 'course-econ-101',
    locale: 'uz',
  });
  assert.equal(parseEditionCacheKey('invalid'), null);

  const items = resolveCachedCourseDetails(
    new Set(['course-econ-101:en', 'course-econ-101:uz']),
    courses
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Foundations of Supply & Demand');
  assert.equal(items[1].title, 'Talab va taklif asoslari');
  assert.equal(items[1].estimatedMinutes, 50);
});

test('clearCachedCourseEdition deletes only the targeted course edition entry', async () => {
  const entries = new Map<string, string>([
    ['https://econova.example/api/courses/course-econ-101/editions/en', 'en-payload'],
    ['https://econova.example/api/courses/course-econ-101/editions/uz', 'uz-payload'],
  ]);

  const fakeStorage = {
    async keys() {
      return ['econova-public-catalog'];
    },
    async open() {
      return {
        async keys() {
          return Array.from(entries.keys()).map((url) => ({ url }) as Request);
        },
        async delete(req: Request | string) {
          const url = typeof req === 'string' ? req : req.url;
          return entries.delete(url);
        },
      } as unknown as Cache;
    },
  } as unknown as CacheStorage;

  const removed = await clearCachedCourseEdition('course-econ-101', 'en', fakeStorage);
  assert.equal(removed, true);
  assert.equal(
    entries.has('https://econova.example/api/courses/course-econ-101/editions/en'),
    false
  );
  assert.equal(
    entries.has('https://econova.example/api/courses/course-econ-101/editions/uz'),
    true
  );
});
