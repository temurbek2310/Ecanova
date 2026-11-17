import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRankingMatrixRows,
  computeAccuracyEfficiencyIndex,
  formatAchievedUtcStamp,
  getSubjectTrackCode,
} from './ranking-matrix';
import type { QuizLeaderboardEntry } from '../shared/types';

test('getSubjectTrackCode and formatAchievedUtcStamp format subject codes and UTC stamps deterministically', () => {
  assert.equal(getSubjectTrackCode('Economics'), 'ECON');
  assert.equal(getSubjectTrackCode('Mathematics'), 'MATH');
  assert.equal(getSubjectTrackCode('Business'), 'BUS');
  assert.equal(formatAchievedUtcStamp('2026-11-17T16:05:00.000Z'), '11/17 16:05 UTC');
  assert.equal(formatAchievedUtcStamp('invalid-date'), '--/-- --:-- UTC');
});

test('computeAccuracyEfficiencyIndex penalizes higher attempts smoothly and clamps bounds', () => {
  assert.equal(computeAccuracyEfficiencyIndex(96, 1), 96);
  assert.equal(computeAccuracyEfficiencyIndex(96, 4), 48);
  assert.equal(computeAccuracyEfficiencyIndex(140, 0), 100);
});

test('buildRankingMatrixRows builds high-density terminal grid rows for EN and UZ', () => {
  const entries: QuizLeaderboardEntry[] = [
    {
      rank: 1,
      pseudonym: 'MacroAlpha',
      courseId: 'course-econ-beg',
      courseTitle: 'Foundations of Supply, Demand & Equilibrium',
      subject: 'Economics',
      assessmentId: 'asmt-1',
      assessmentTitle: 'Equilibrium Synthesis Check',
      bestScorePercent: 95,
      attemptsCountThisWeek: 1,
      passed: true,
      achievedAt: '2026-11-17T08:30:00.000Z',
      isCurrentUser: true,
    },
    {
      rank: 2,
      pseudonym: 'EulerVector',
      courseId: 'course-math-int',
      courseTitle: 'Applied Calculus',
      subject: 'Mathematics',
      assessmentId: 'asmt-2',
      assessmentTitle: 'Derivatives Exam',
      bestScorePercent: 64,
      attemptsCountThisWeek: 4,
      passed: false,
      achievedAt: '2026-11-16T14:15:00.000Z',
      isCurrentUser: false,
    },
  ];

  const enRows = buildRankingMatrixRows(entries, 'en');
  assert.equal(enRows.length, 2);
  assert.equal(enRows[0].indexCode, '01');
  assert.equal(enRows[0].trackCode, 'ECON');
  assert.equal(enRows[0].accuracyText, '95.0%');
  assert.equal(enRows[0].efficiencyIndex, '95.0');
  assert.equal(enRows[0].statusCode, 'PASS');
  assert.equal(enRows[0].cadenceText, '1 try · 1st-pass');
  assert.equal(enRows[0].achievedUtcText, '11/17 08:30 UTC');

  assert.equal(enRows[1].indexCode, '02');
  assert.equal(enRows[1].trackCode, 'MATH');
  assert.equal(enRows[1].efficiencyIndex, '32.0');
  assert.equal(enRows[1].statusCode, 'RETRY');

  const uzRows = buildRankingMatrixRows(entries, 'uz');
  assert.equal(uzRows[0].cadenceText, '1 urinish · 1-urinishda');
  assert.equal(uzRows[1].cadenceText, '4 urinish');
});
