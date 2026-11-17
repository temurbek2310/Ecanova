import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterQuizLeaderboardEntriesByCourse,
  formatWeekWindowLabel,
  getCurrentWeekWindow,
  rankWeeklyQuizAttempts,
  summarizeQuizLeaderboard,
  type RawQuizAttemptRow,
} from './quiz-leaderboard';

const sampleAttempts: RawQuizAttemptRow[] = [
  {
    userId: 'user-1',
    pseudonym: 'TashkentScholar',
    leaderboardOptIn: true,
    courseId: 'course-econ-beg',
    courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
    subject: 'Economics',
    assessmentId: 'asmt-econ-beg-en',
    assessmentTitle: 'Supply, Demand & Equilibrium Final Check',
    scorePercent: 80,
    passed: true,
    createdAt: '2026-11-14T10:00:00.000Z',
  },
  {
    userId: 'user-1',
    pseudonym: 'TashkentScholar',
    leaderboardOptIn: true,
    courseId: 'course-econ-beg',
    courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
    subject: 'Economics',
    assessmentId: 'asmt-econ-beg-en',
    assessmentTitle: 'Supply, Demand & Equilibrium Final Check',
    scorePercent: 100,
    passed: true,
    createdAt: '2026-11-15T12:00:00.000Z',
  },
  {
    userId: 'user-2',
    pseudonym: 'SamarkandQuant',
    leaderboardOptIn: true,
    courseId: 'course-math-int',
    courseTitle: 'Applied Calculus: Derivatives, Marginal Rates & Optimization',
    subject: 'Mathematics',
    assessmentId: 'asmt-math-int-en',
    assessmentTitle: 'Applied Calculus & Marginal Optimization Check',
    scorePercent: 100,
    passed: true,
    createdAt: '2026-11-14T08:00:00.000Z',
  },
  {
    userId: 'user-3',
    pseudonym: 'BukharaAnalyst',
    leaderboardOptIn: true,
    courseId: 'course-econ-beg',
    courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
    subject: 'Economics',
    assessmentId: 'asmt-econ-beg-en',
    assessmentTitle: 'Supply, Demand & Equilibrium Final Check',
    scorePercent: 80,
    passed: true,
    createdAt: '2026-11-16T09:00:00.000Z',
  },
  {
    userId: 'user-hidden',
    pseudonym: 'PrivateLearner',
    leaderboardOptIn: false,
    courseId: 'course-econ-beg',
    courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
    subject: 'Economics',
    assessmentId: 'asmt-econ-beg-en',
    assessmentTitle: 'Supply, Demand & Equilibrium Final Check',
    scorePercent: 100,
    passed: true,
    createdAt: '2026-11-16T11:00:00.000Z',
  },
  {
    userId: 'user-stale',
    pseudonym: 'OldWeekScholar',
    leaderboardOptIn: true,
    courseId: 'course-econ-beg',
    courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
    subject: 'Economics',
    assessmentId: 'asmt-econ-beg-en',
    assessmentTitle: 'Supply, Demand & Equilibrium Final Check',
    scorePercent: 100,
    passed: true,
    createdAt: '2026-10-01T11:00:00.000Z',
  },
];

test('getCurrentWeekWindow and formatWeekWindowLabel compute 7-day rolling window', () => {
  const ref = new Date('2026-11-16T12:00:00.000Z');
  const window = getCurrentWeekWindow(ref);
  assert.equal(window.weekEndIso, '2026-11-16T12:00:00.000Z');
  assert.equal(window.weekStartIso, '2026-11-09T12:00:00.000Z');

  const labelEn = formatWeekWindowLabel(window.weekStartIso, window.weekEndIso, 'en');
  assert.ok(labelEn.includes('Nov'));
});

test('rankWeeklyQuizAttempts aggregates best weekly score per course, excludes opt-out and stale attempts, and ranks ties by fewer attempts', () => {
  const window = getCurrentWeekWindow(new Date('2026-11-16T23:59:59.000Z'));
  const ranked = rankWeeklyQuizAttempts(sampleAttempts, {
    currentUserId: 'user-1',
    weekStartIso: window.weekStartIso,
    weekEndIso: window.weekEndIso,
  });

  // user-hidden (opt-out) and user-stale (outside week) excluded
  assert.equal(ranked.length, 3);

  // SamarkandQuant got 100% in 1 attempt, TashkentScholar got 100% in 2 attempts
  assert.equal(ranked[0].pseudonym, 'SamarkandQuant');
  assert.equal(ranked[0].bestScorePercent, 100);
  assert.equal(ranked[0].attemptsCountThisWeek, 1);
  assert.equal(ranked[0].rank, 1);

  assert.equal(ranked[1].pseudonym, 'TashkentScholar');
  assert.equal(ranked[1].bestScorePercent, 100);
  assert.equal(ranked[1].attemptsCountThisWeek, 2);
  assert.equal(ranked[1].isCurrentUser, true);
  assert.equal(ranked[1].rank, 2);

  assert.equal(ranked[2].pseudonym, 'BukharaAnalyst');
  assert.equal(ranked[2].bestScorePercent, 80);
  assert.equal(ranked[2].rank, 3);
});

test('filterQuizLeaderboardEntriesByCourse and summarizeQuizLeaderboard compute course-specific rankings and stats', () => {
  const window = getCurrentWeekWindow(new Date('2026-11-16T23:59:59.000Z'));
  const allEntries = rankWeeklyQuizAttempts(sampleAttempts, {
    weekStartIso: window.weekStartIso,
    weekEndIso: window.weekEndIso,
  });

  const econOnly = filterQuizLeaderboardEntriesByCourse(allEntries, 'course-econ-beg');
  assert.equal(econOnly.length, 2);
  assert.equal(econOnly[0].rank, 1);
  assert.equal(econOnly[0].pseudonym, 'TashkentScholar');
  assert.equal(econOnly[1].rank, 2);
  assert.equal(econOnly[1].pseudonym, 'BukharaAnalyst');

  const summary = summarizeQuizLeaderboard(econOnly);
  assert.equal(summary.topScorePercent, 100);
  assert.equal(summary.averageScorePercent, 90);
  assert.equal(summary.passRatePercent, 100);
  assert.equal(summary.participantCount, 2);
});
