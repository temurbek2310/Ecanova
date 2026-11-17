import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addRecentSearchQuery,
  filterCatalogCourses,
  getCourseTopicLabels,
  getMatchingLessonTitles,
  normalizeRecentSearches,
} from './catalog-filter';
import type { CourseCatalogItem, CourseEditionSummary } from '../shared/types';

function makeEdition(overrides: Partial<CourseEditionSummary>): CourseEditionSummary {
  return {
    id: 'ed-1',
    courseId: 'c-1',
    locale: 'en',
    version: 1,
    title: 'Sample Course',
    subtitle: 'Sample subtitle',
    description: 'Sample description',
    outcomes: [],
    prerequisites: [],
    completionRules: 'Pass assessment',
    passingScorePercent: 70,
    status: 'published',
    subjectReviewerId: null,
    languageReviewerId: null,
    rightsReviewerId: null,
    publishedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    lessonCount: 3,
    lessonTitles: [],
    estimatedMinutes: 45,
    provenance: null,
    ...overrides,
  };
}

const SAMPLE_COURSES: CourseCatalogItem[] = [
  {
    id: 'econ-1',
    slug: 'supply-demand',
    subject: 'Economics',
    level: 'Beginner',
    estimatedMinutes: 45,
    editions: {
      en: makeEdition({
        id: 'ed-econ-en',
        courseId: 'econ-1',
        locale: 'en',
        title: 'Foundations of Supply, Demand & Market Equilibrium',
        description: 'Learn how market prices coordinate scarce resources.',
        lessonTitles: [
          'The Law of Demand & Cotton Market Buyer Behavior',
          'Supply Curves, Input Costs & Equilibrium Price Clearing',
          'Price Elasticity & Surplus Welfare Dynamics',
        ],
      }),
      uz: makeEdition({
        id: 'ed-econ-uz',
        courseId: 'econ-1',
        locale: 'uz',
        title: 'Talab, taklif va bozor muvozanati asoslari',
        description: 'Bozor narxlari cheklangan resurslarni qanday taqsimlashini o‘rganing.',
        lessonTitles: [
          'Talab qonuni va xaridorlar xulq-atvori',
          'Taklif egri chizig‘i va bozor muvozanati',
        ],
      }),
    },
  },
  {
    id: 'math-1',
    slug: 'applied-calculus',
    subject: 'Mathematics',
    level: 'Intermediate',
    estimatedMinutes: 60,
    editions: {
      en: makeEdition({
        id: 'ed-math-en',
        courseId: 'math-1',
        locale: 'en',
        title: 'Applied Calculus: Derivatives, Marginal Rates & Optimization',
        description: 'Connect instantaneous rates of change to profit maximization.',
        lessonTitles: [
          'Secant Lines, Limits & The Derivative Slope',
          'First-Order Optimality Conditions: Marginal Revenue Equals Marginal Cost',
        ],
      }),
      uz: null,
    },
  },
  {
    id: 'bus-1',
    slug: 'unit-economics',
    subject: 'Business',
    level: 'Advanced',
    estimatedMinutes: 75,
    editions: {
      en: makeEdition({
        id: 'ed-bus-en',
        courseId: 'bus-1',
        locale: 'en',
        title: 'Unit Economics, Cash Flow Modeling & Capital Allocation',
        description: 'Evaluate durability using contribution margin, LTV/CAC, and payback discipline.',
        lessonTitles: [
          'Contribution Margin, Break-Even Volume & Cohort Payback',
          'Working Capital Cycles & Free Cash Flow Durability',
        ],
      }),
      uz: makeEdition({
        id: 'ed-bus-uz',
        courseId: 'bus-1',
        locale: 'uz',
        title: 'Birlik iqtisodiyoti va pul oqimini modellashtirish',
        description: 'Marja va o‘zini qoplash muddati orqali biznes barqarorligini baholang.',
        lessonTitles: ['Marja, zararsizlik nuqtasi va mijoz xarajati'],
      }),
    },
  },
];

test('returns all courses when search query is blank or whitespace', () => {
  const result = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: '   ',
    locale: 'en',
  });
  assert.equal(result.length, 3);
});

test('matches courses case-insensitively by title', () => {
  const result = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: 'CALCULUS',
    locale: 'en',
  });
  assert.deepEqual(
    result.map((c) => c.id),
    ['math-1']
  );
});

test('matches courses case-insensitively by description', () => {
  const result = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: 'payback discipline',
    locale: 'en',
  });
  assert.deepEqual(
    result.map((c) => c.id),
    ['bus-1']
  );
});

test('matches courses by specific lesson content titles and returns matched lesson titles', () => {
  const result = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: 'Secant Lines',
    locale: 'en',
  });
  assert.deepEqual(
    result.map((c) => c.id),
    ['math-1']
  );

  const matchedLessons = getMatchingLessonTitles(SAMPLE_COURSES[1], 'Secant Lines', 'en');
  assert.deepEqual(matchedLessons, ['Secant Lines, Limits & The Derivative Slope']);
});

test('matches courses by topic labels such as Macroeconomics or Linear Algebra', () => {
  const macroResult = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: 'Macroeconomics',
    locale: 'en',
  });
  assert.deepEqual(
    macroResult.map((c) => c.id),
    ['econ-1']
  );

  const linAlgResult = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: 'Linear Algebra',
    locale: 'en',
  });
  assert.deepEqual(
    linAlgResult.map((c) => c.id),
    ['math-1']
  );
});

test('getCourseTopicLabels returns color-coded subject labels', () => {
  const econLabels = getCourseTopicLabels(SAMPLE_COURSES[0], 'en');
  assert.ok(econLabels.some((l) => l.label === 'Macroeconomics'));
  const mathLabels = getCourseTopicLabels(SAMPLE_COURSES[1], 'en');
  assert.ok(mathLabels.some((l) => l.label === 'Linear Algebra'));
});

test('Recent Searches helper stores up to 5 unique queries with most recent first', () => {
  let list: string[] = [];
  list = addRecentSearchQuery(list, 'Elasticity');
  list = addRecentSearchQuery(list, 'Linear Algebra');
  list = addRecentSearchQuery(list, 'Secant Lines');
  list = addRecentSearchQuery(list, 'Macroeconomics');
  list = addRecentSearchQuery(list, 'Cash Flow');
  list = addRecentSearchQuery(list, 'Break-Even');
  assert.equal(list.length, 5);
  assert.equal(list[0], 'Break-Even');
  assert.ok(!list.includes('Elasticity'));

  // Deduplicates case-insensitively and moves to front
  list = addRecentSearchQuery(list, 'linear algebra');
  assert.equal(list.length, 5);
  assert.equal(list[0], 'linear algebra');
  assert.deepEqual(normalizeRecentSearches(['  a  ', 'A', 'b']), ['a', 'b']);
});

test('combines search query with subject and level filters', () => {
  const match = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'Business',
    level: 'Advanced',
    searchQuery: 'ltv/cac',
    locale: 'en',
  });
  assert.deepEqual(
    match.map((c) => c.id),
    ['bus-1']
  );

  const mismatch = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'Economics',
    level: 'ALL',
    searchQuery: 'ltv/cac',
    locale: 'en',
  });
  assert.equal(mismatch.length, 0);
});

test('filters against active Uzbek edition title and description', () => {
  const byTitle = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: 'taklif',
    locale: 'uz',
  });
  assert.deepEqual(
    byTitle.map((c) => c.id),
    ['econ-1']
  );

  const byDescription = filterCatalogCourses(SAMPLE_COURSES, {
    subject: 'ALL',
    level: 'ALL',
    searchQuery: 'marja',
    locale: 'uz',
  });
  assert.deepEqual(
    byDescription.map((c) => c.id),
    ['bus-1']
  );
});
