import test from 'node:test';
import assert from 'node:assert/strict';
import type { CourseCatalogItem, CourseLevel, EnrollmentRecord, Subject } from '../shared/types';
import enMessages from '../messages/en.json';
import uzMessages from '../messages/uz.json';
import {
  LEVEL_CHECK_COPY_RU,
  LEVEL_CHECK_QUESTIONS,
  LEVEL_CHECK_SUBJECTS,
  calculatePlacementLevel,
  getLevelCheckCopy,
  getLevelCheckQuestions,
  getLevelCheckState,
  getPlacedLevel,
  getRecommendedCourses,
  gradeLevelCheckSelections,
  hasSubjectEnrollment,
  levelCheckStorageKey,
  markLevelCheckSkipped,
  resetSubjectLevelCheck,
  saveLevelCheckResult,
  shouldPromptLevelCheck,
  type LevelCheckAnswer,
  type LevelCheckTier,
  type StorageLike,
} from './level-check';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Build answers from per-tier correct counts (2 questions per tier). */
function answers(f: number, a: number, x: number): LevelCheckAnswer[] {
  const mk = (tier: LevelCheckTier, correct: number): LevelCheckAnswer[] => [
    { tier, correct: correct >= 1 },
    { tier, correct: correct >= 2 },
  ];
  return [...mk(1, f), ...mk(2, a), ...mk(3, x)];
}

function course(id: string, subject: Subject, level: CourseLevel): CourseCatalogItem {
  return { id, slug: id, subject, level, estimatedMinutes: 30, editions: { en: null, uz: null } };
}

function enrollment(courseId: string): EnrollmentRecord {
  return {
    id: `enr-${courseId}`,
    courseId,
    locale: 'en',
    journeyStatus: 'progressing',
    completedLessonIds: [],
    requiredLessonIds: [],
    bestScorePercent: null,
    passedAssessment: false,
    enrolledAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    pausedAt: null,
  };
}

// ---------------------------------------------------------------- question bank

test('question bank has 6 questions per subject (2 per tier) with 4 localized options', () => {
  assert.equal(LEVEL_CHECK_QUESTIONS.length, 18);
  for (const subject of LEVEL_CHECK_SUBJECTS) {
    const qs = getLevelCheckQuestions(subject);
    assert.equal(qs.length, 6, subject);
    for (const tier of [1, 2, 3] as const) {
      assert.equal(qs.filter((q) => q.tier === tier).length, 2, `${subject} tier ${tier}`);
    }
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      for (const text of [q.prompt, ...q.options]) {
        assert.ok(text.en && text.uz && text.ru, `${q.id} missing locale text`);
      }
      assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3);
    }
  }
  assert.equal(new Set(LEVEL_CHECK_QUESTIONS.map((q) => q.id)).size, 18, 'ids are unique');
});

// ---------------------------------------------------------------- scoring

test('0–2 correct places Beginner', () => {
  assert.equal(calculatePlacementLevel(answers(0, 0, 0)).level, 'Beginner');
  assert.equal(calculatePlacementLevel(answers(2, 0, 0)).level, 'Beginner');
  assert.equal(calculatePlacementLevel(answers(1, 1, 0)).level, 'Beginner');
});

test('failing every foundation question places Beginner regardless of total', () => {
  const r = calculatePlacementLevel(answers(0, 2, 2));
  assert.equal(r.score, 4);
  assert.equal(r.level, 'Beginner');
});

test('3–4 correct places Intermediate', () => {
  assert.equal(calculatePlacementLevel(answers(2, 1, 0)).level, 'Intermediate');
  assert.equal(calculatePlacementLevel(answers(2, 2, 0)).level, 'Intermediate');
  assert.equal(calculatePlacementLevel(answers(1, 2, 1)).level, 'Intermediate');
});

test('5–6 correct with an advanced answer places Advanced and reports breakdown', () => {
  const five = calculatePlacementLevel(answers(2, 2, 1));
  assert.equal(five.level, 'Advanced');
  assert.equal(five.score, 5);
  const six = calculatePlacementLevel(answers(2, 2, 2));
  assert.equal(six.level, 'Advanced');
  assert.deepEqual(six.tierBreakdown, {
    1: { correct: 2, total: 2 },
    2: { correct: 2, total: 2 },
    3: { correct: 2, total: 2 },
  });
  assert.equal(six.total, 6);
});

test('gradeLevelCheckSelections grades against the correct indices', () => {
  const qs = getLevelCheckQuestions('Mathematics');
  const allCorrect = Object.fromEntries(qs.map((q) => [q.id, q.correctIndex]));
  assert.equal(calculatePlacementLevel(gradeLevelCheckSelections('Mathematics', allCorrect)).level, 'Advanced');
  const allWrong = Object.fromEntries(qs.map((q) => [q.id, (q.correctIndex + 1) % 4]));
  const r = calculatePlacementLevel(gradeLevelCheckSelections('Mathematics', allWrong));
  assert.equal(r.score, 0);
  assert.equal(r.level, 'Beginner');
});

// ---------------------------------------------------------------- persistence

test('results persist per user and per subject under the v1 key', () => {
  const store = memoryStorage();
  const placement = calculatePlacementLevel(answers(2, 1, 0));
  saveLevelCheckResult('user-a', 'Economics', placement, store, new Date('2026-11-25T10:00:00Z'));

  assert.ok(store.data.has('econova:level-check:v1:user-a'));
  assert.equal(levelCheckStorageKey('user-a'), 'econova:level-check:v1:user-a');

  const state = getLevelCheckState('user-a', store);
  assert.equal(state.Economics?.status, 'completed');
  assert.equal(state.Economics?.level, 'Intermediate');
  assert.equal(state.Economics?.score, 3);
  assert.equal(state.Economics?.total, 6);
  assert.equal(state.Economics?.updatedAt, '2026-11-25T10:00:00.000Z');
  assert.equal(state.Mathematics, undefined);
  assert.deepEqual(getLevelCheckState('user-b', store), {}, 'other users are isolated');
  assert.equal(getPlacedLevel(state, 'Economics'), 'Intermediate');
});

test('corrupt or unavailable storage degrades safely', () => {
  const store = memoryStorage();
  store.setItem(levelCheckStorageKey('u'), '{not json');
  assert.deepEqual(getLevelCheckState('u', store), {});
  const throwing: StorageLike = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
    removeItem: () => undefined,
  };
  assert.deepEqual(getLevelCheckState('u', throwing), {});
  assert.doesNotThrow(() => markLevelCheckSkipped('u', 'Business', throwing));
  assert.deepEqual(getLevelCheckState(null, store), {});
});

test('skipping marks the subject so it is not prompted again, and never overrides a completion', () => {
  const store = memoryStorage();
  assert.equal(shouldPromptLevelCheck('u', 'Business', false, store), true);
  markLevelCheckSkipped('u', 'Business', store);
  const state = getLevelCheckState('u', store);
  assert.equal(state.Business?.status, 'skipped');
  assert.equal(getPlacedLevel(state, 'Business'), null);
  assert.equal(shouldPromptLevelCheck('u', 'Business', false, store), false);
  assert.equal(shouldPromptLevelCheck('u', 'Economics', false, store), true, 'other subjects still prompt');

  saveLevelCheckResult('u', 'Economics', calculatePlacementLevel(answers(2, 2, 2)), store);
  markLevelCheckSkipped('u', 'Economics', store);
  assert.equal(getLevelCheckState('u', store).Economics?.status, 'completed');
});

test('existing subject enrollment bypasses the prompt; guests are never prompted', () => {
  const store = memoryStorage();
  const courses = [course('e1', 'Economics', 'Beginner'), course('m1', 'Mathematics', 'Advanced')];
  const enrolled = [enrollment('m1')];
  assert.equal(hasSubjectEnrollment(courses, enrolled, 'Mathematics'), true);
  assert.equal(hasSubjectEnrollment(courses, enrolled, 'Economics'), false);
  assert.equal(hasSubjectEnrollment(courses, [], 'Economics'), false);

  assert.equal(shouldPromptLevelCheck('u', 'Mathematics', true, store), false);
  assert.equal(shouldPromptLevelCheck('u', 'Economics', false, store), true);
  assert.equal(shouldPromptLevelCheck(null, 'Economics', false, store), false);
  assert.equal(shouldPromptLevelCheck(undefined, 'Economics', false, store), false);
});

test('resetSubjectLevelCheck clears only that subject', () => {
  const store = memoryStorage();
  saveLevelCheckResult('u', 'Economics', calculatePlacementLevel(answers(2, 2, 2)), store);
  markLevelCheckSkipped('u', 'Business', store);
  resetSubjectLevelCheck('u', 'Economics', store);
  const state = getLevelCheckState('u', store);
  assert.equal(state.Economics, undefined);
  assert.equal(state.Business?.status, 'skipped');
  assert.equal(shouldPromptLevelCheck('u', 'Economics', false, store), true);
});

// ---------------------------------------------------------------- recommendations

test('recommends exact-level courses in the subject', () => {
  const courses = [
    course('e-b', 'Economics', 'Beginner'),
    course('e-i', 'Economics', 'Intermediate'),
    course('e-i2', 'Economics', 'Intermediate'),
    course('m-i', 'Mathematics', 'Intermediate'),
  ];
  assert.deepEqual(
    getRecommendedCourses(courses, 'Economics', 'Intermediate').map((c) => c.id),
    ['e-i', 'e-i2']
  );
});

test('falls back to the closest level, preferring the easier one on ties', () => {
  const courses = [course('b-b', 'Business', 'Beginner'), course('b-a', 'Business', 'Advanced')];
  assert.deepEqual(getRecommendedCourses(courses, 'Business', 'Intermediate').map((c) => c.id), ['b-b']);
  assert.deepEqual(getRecommendedCourses([course('b-i', 'Business', 'Intermediate')], 'Business', 'Advanced').map((c) => c.id), ['b-i']);
  assert.deepEqual(getRecommendedCourses(courses, 'Mathematics', 'Beginner'), []);
});

// ---------------------------------------------------------------- copy

test('level-check copy exists for EN, UZ and RU with identical keys', () => {
  const enKeys = Object.keys(enMessages.levelCheck).sort();
  assert.deepEqual(Object.keys((uzMessages as { levelCheck: object }).levelCheck).sort(), enKeys);
  assert.deepEqual(Object.keys(LEVEL_CHECK_COPY_RU).sort(), enKeys);
  assert.equal(getLevelCheckCopy('en').startCheck, 'Check My Level (2 min · 6 questions)');
  assert.equal(getLevelCheckCopy('uz').recommendedBadge, 'Sizning darajangiz');
  assert.equal(getLevelCheckCopy('ru'), LEVEL_CHECK_COPY_RU);
});
