import test from 'node:test';
import assert from 'node:assert/strict';
import type { CourseCatalogItem, EnrollmentRecord } from '../shared/types';
import {
  isCourseBookmarked,
  normalizeBookmarkedCourseIds,
  resolveBookmarkedCourses,
  toggleBookmarkedCourseId,
} from './course-bookmarks';

const sampleCourses: CourseCatalogItem[] = [
  {
    id: 'course-econ-1',
    slug: 'supply-demand',
    subject: 'Economics',
    level: 'Beginner',
    estimatedMinutes: 45,
    editions: {
      en: {
        id: 'ed-econ-en',
        courseId: 'course-econ-1',
        locale: 'en',
        version: 1,
        title: 'Foundations of Supply, Demand & Market Equilibrium',
        subtitle: 'Analyze price signals and market shifts.',
        description: 'Microeconomics foundation.',
        outcomes: [],
        prerequisites: [],
        completionRules: '',
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
      },
      uz: {
        id: 'ed-econ-uz',
        courseId: 'course-econ-1',
        locale: 'uz',
        version: 1,
        title: 'Talab, taklif va bozor muvozanati asoslari',
        subtitle: 'Narx signallarini tahlil qilish.',
        description: 'Mikroiqtisodiyot asoslari.',
        outcomes: [],
        prerequisites: [],
        completionRules: '',
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
      },
    },
  },
  {
    id: 'course-math-1',
    slug: 'applied-calculus',
    subject: 'Mathematics',
    level: 'Intermediate',
    estimatedMinutes: 60,
    editions: {
      en: {
        id: 'ed-math-en',
        courseId: 'course-math-1',
        locale: 'en',
        version: 1,
        title: 'Applied Calculus for Marginal Analysis',
        subtitle: 'Derivatives and optimization.',
        description: 'Calculus for economics.',
        outcomes: [],
        prerequisites: [],
        completionRules: '',
        passingScorePercent: 70,
        status: 'published',
        subjectReviewerId: null,
        languageReviewerId: null,
        rightsReviewerId: null,
        publishedAt: null,
        updatedAt: '2026-01-01T00:00:00.000Z',
        lessonCount: 4,
        estimatedMinutes: 60,
        provenance: null,
      },
      uz: null,
    },
  },
];

test('normalizeBookmarkedCourseIds deduplicates, trims, and parses JSON strings safely', () => {
  assert.deepEqual(
    normalizeBookmarkedCourseIds([' course-econ-1 ', '', 'course-math-1', 'course-econ-1']),
    ['course-econ-1', 'course-math-1']
  );
  assert.deepEqual(
    normalizeBookmarkedCourseIds('["course-math-1","course-econ-1","course-math-1"]'),
    ['course-math-1', 'course-econ-1']
  );
  assert.deepEqual(normalizeBookmarkedCourseIds('not-json'), []);
  assert.deepEqual(normalizeBookmarkedCourseIds(null), []);
});

test('toggleBookmarkedCourseId adds new items at the front and removes existing ones', () => {
  const addedFirst = toggleBookmarkedCourseId([], 'course-econ-1');
  assert.equal(addedFirst.bookmarked, true);
  assert.deepEqual(addedFirst.nextIds, ['course-econ-1']);

  const addedSecond = toggleBookmarkedCourseId(addedFirst.nextIds, 'course-math-1');
  assert.equal(addedSecond.bookmarked, true);
  assert.deepEqual(addedSecond.nextIds, ['course-math-1', 'course-econ-1']);

  const removedFirst = toggleBookmarkedCourseId(addedSecond.nextIds, 'course-econ-1');
  assert.equal(removedFirst.bookmarked, false);
  assert.deepEqual(removedFirst.nextIds, ['course-math-1']);
});

test('toggleBookmarkedCourseId honors explicit forceBookmarked flag idempotently', () => {
  const forcedAdd = toggleBookmarkedCourseId(['course-econ-1'], 'course-econ-1', true);
  assert.equal(forcedAdd.bookmarked, true);
  assert.deepEqual(forcedAdd.nextIds, ['course-econ-1']);

  const forcedRemoveMissing = toggleBookmarkedCourseId(['course-econ-1'], 'course-math-1', false);
  assert.equal(forcedRemoveMissing.bookmarked, false);
  assert.deepEqual(forcedRemoveMissing.nextIds, ['course-econ-1']);
});

test('isCourseBookmarked matches trimmed IDs accurately', () => {
  assert.equal(isCourseBookmarked(['course-econ-1'], 'course-econ-1'), true);
  assert.equal(isCourseBookmarked(['course-econ-1'], 'course-math-1'), false);
  assert.equal(isCourseBookmarked(['course-econ-1'], '  '), false);
});

test('resolveBookmarkedCourses preserves bookmark order, fallback locale, and enrollment state', () => {
  const enrollments: EnrollmentRecord[] = [
    {
      id: 'enr-1',
      courseId: 'course-econ-1',
      locale: 'uz',
      journeyStatus: 'progressing',
      completedLessonIds: ['l1'],
      requiredLessonIds: ['l1', 'l2'],
      bestScorePercent: null,
      passedAssessment: false,
      enrolledAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      pausedAt: null,
    },
  ];

  const cards = resolveBookmarkedCourses({
    bookmarkedIds: ['course-math-1', 'course-missing', 'course-econ-1'],
    courses: sampleCourses,
    locale: 'uz',
    enrollments,
  });

  assert.equal(cards.length, 2);
  assert.equal(cards[0].courseId, 'course-math-1');
  assert.equal(cards[0].hasEditionInLocale, false);
  assert.equal(cards[0].openLocale, 'en');
  assert.equal(cards[0].title, 'Applied Calculus for Marginal Analysis');
  assert.equal(cards[0].enrollment, null);

  assert.equal(cards[1].courseId, 'course-econ-1');
  assert.equal(cards[1].hasEditionInLocale, true);
  assert.equal(cards[1].openLocale, 'uz');
  assert.equal(cards[1].title, 'Talab, taklif va bozor muvozanati asoslari');
  assert.equal(cards[1].enrollment?.journeyStatus, 'progressing');
});
