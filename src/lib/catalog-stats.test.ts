import test from 'node:test';
import assert from 'node:assert/strict';
import type { CourseCatalogItem, CourseEditionSummary, LocaleCode } from '../shared/types';
import { computeCatalogStats, formatCatalogStat } from './catalog-stats';

function edition(locale: LocaleCode, lessonCount: number): CourseEditionSummary {
  return {
    id: `ed-${locale}-${lessonCount}`,
    courseId: 'c',
    locale,
    version: 1,
    title: 'T',
    subtitle: '',
    description: '',
    outcomes: [],
    prerequisites: [],
    completionRules: '',
    passingScorePercent: 70,
    status: 'published',
    subjectReviewerId: null,
    languageReviewerId: null,
    rightsReviewerId: null,
    publishedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    lessonCount,
    estimatedMinutes: 30,
    provenance: null,
  };
}

function course(id: string, en: number | null, uz: number | null): CourseCatalogItem {
  return {
    id,
    slug: id,
    subject: 'Economics',
    level: 'Beginner',
    estimatedMinutes: 30,
    editions: { en: en === null ? null : edition('en', en), uz: uz === null ? null : edition('uz', uz) },
  };
}

test('computeCatalogStats counts courses and locale lessons with fallback', () => {
  const courses = [course('a', 5, 4), course('b', 3, null), course('c', null, 6)];
  assert.deepEqual(computeCatalogStats(courses, 'en'), { courseCount: 3, lessonCount: 5 + 3 + 6 });
  assert.deepEqual(computeCatalogStats(courses, 'uz'), { courseCount: 3, lessonCount: 4 + 3 + 6 });
  assert.deepEqual(computeCatalogStats([], 'en'), { courseCount: 0, lessonCount: 0 });
});

test('formatCatalogStat shows a placeholder while loading or unavailable, never a fake number', () => {
  assert.equal(formatCatalogStat(6, { loading: true, unavailable: false }), '—');
  assert.equal(formatCatalogStat(0, { loading: false, unavailable: true }), '—');
  assert.equal(formatCatalogStat(4, { loading: false, unavailable: false }), '4');
  assert.equal(formatCatalogStat(0, { loading: false, unavailable: false }), '0');
});
