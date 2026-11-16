import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAssessmentScore,
  calculateEligibleXp,
  canTransitionEditorialState,
  DAILY_XP_CAP,
  evaluateCertificateVerification,
  evaluateCourseCompletion,
  evaluateStreakUpdate,
} from './econova-rules.ts';
import type { QuestionWithKey } from './types.ts';

const sampleQuestions: QuestionWithKey[] = [
  {
    id: 'q1',
    sequenceNum: 1,
    objectiveRef: 'obj-1',
    prompt: 'What happens when demand increases while supply stays constant?',
    options: ['Equilibrium price rises', 'Equilibrium price falls', 'Supply shifts left'],
    correctOptionIndex: 0,
    explanation: 'Higher demand shifts the curve right, raising equilibrium price and quantity.',
  },
  {
    id: 'q2',
    sequenceNum: 2,
    objectiveRef: 'obj-2',
    prompt: 'What is opportunity cost?',
    options: ['Total money spent', 'Value of next best foregone alternative', 'Tax rate'],
    correctOptionIndex: 1,
    explanation: 'Opportunity cost measures the highest-valued alternative given up.',
  },
  {
    id: 'q3',
    sequenceNum: 3,
    objectiveRef: 'obj-3',
    prompt: 'Which curve slopes upward under the law of supply?',
    options: ['Demand curve', 'Supply curve', 'Budget line'],
    correctOptionIndex: 1,
    explanation: 'Higher prices incentivize producers to supply greater quantities.',
  },
];

test('calculateAssessmentScore grades answers accurately and enforces passing threshold', () => {
  const passResult = calculateAssessmentScore(
    sampleQuestions,
    { q1: 0, q2: 1, q3: 0 },
    65
  );
  assert.equal(passResult.correctCount, 2);
  assert.equal(passResult.scorePercent, 67);
  assert.equal(passResult.passed, true);
  assert.equal(passResult.questionFeedback[2].isCorrect, false);

  const failResult = calculateAssessmentScore(
    sampleQuestions,
    { q1: 2, q2: 0, q3: 1 },
    70
  );
  assert.equal(failResult.correctCount, 1);
  assert.equal(failResult.scorePercent, 33);
  assert.equal(failResult.passed, false);
});

test('evaluateCourseCompletion distinguishes not_started, progressing, and completed', () => {
  const notStarted = evaluateCourseCompletion({
    requiredLessonIds: ['l1', 'l2'],
    completedLessonIds: [],
    passingScorePercent: 70,
    bestScorePercent: null,
    hasAssessment: true,
  });
  assert.equal(notStarted.journeyStatus, 'not_started');
  assert.equal(notStarted.isCompleted, false);

  const progressing = evaluateCourseCompletion({
    requiredLessonIds: ['l1', 'l2'],
    completedLessonIds: ['l1'],
    passingScorePercent: 70,
    bestScorePercent: null,
    hasAssessment: true,
  });
  assert.equal(progressing.journeyStatus, 'progressing');
  assert.equal(progressing.isCompleted, false);
  assert.equal(progressing.percentComplete, 33);

  const completed = evaluateCourseCompletion({
    requiredLessonIds: ['l1', 'l2'],
    completedLessonIds: ['l1', 'l2'],
    passingScorePercent: 70,
    bestScorePercent: 80,
    hasAssessment: true,
  });
  assert.equal(completed.journeyStatus, 'completed');
  assert.equal(completed.isCompleted, true);
  assert.equal(completed.percentComplete, 100);
});

test('calculateEligibleXp enforces idempotency and daily non-cash XP cap', () => {
  const duplicate = calculateEligibleXp({
    eventType: 'lesson_completed',
    alreadyAwardedForIdempotencyKey: true,
    xpEarnedToday: 0,
  });
  assert.equal(duplicate.eligibleAmount, 0);

  const nearCap = calculateEligibleXp({
    eventType: 'course_completed',
    alreadyAwardedForIdempotencyKey: false,
    xpEarnedToday: DAILY_XP_CAP - 35,
  });
  assert.equal(nearCap.eligibleAmount, 35);

  const overCap = calculateEligibleXp({
    eventType: 'assessment_passed',
    alreadyAwardedForIdempotencyKey: false,
    xpEarnedToday: DAILY_XP_CAP,
  });
  assert.equal(overCap.eligibleAmount, 0);
});

test('evaluateStreakUpdate prevents duplicate same-day increments and tracks consecutive days', () => {
  const sameDay = evaluateStreakUpdate({
    lastActivityLocalDate: '2026-11-15',
    currentStreak: 3,
    bestStreak: 5,
    todayLocalDate: '2026-11-15',
  });
  assert.equal(sameDay.currentStreak, 3);
  assert.equal(sameDay.incremented, false);

  const consecutive = evaluateStreakUpdate({
    lastActivityLocalDate: '2026-11-14',
    currentStreak: 3,
    bestStreak: 3,
    todayLocalDate: '2026-11-15',
  });
  assert.equal(consecutive.currentStreak, 4);
  assert.equal(consecutive.bestStreak, 4);
  assert.equal(consecutive.incremented, true);

  const gapReset = evaluateStreakUpdate({
    lastActivityLocalDate: '2026-11-10',
    currentStreak: 4,
    bestStreak: 6,
    todayLocalDate: '2026-11-15',
  });
  assert.equal(gapReset.currentStreak, 1);
  assert.equal(gapReset.bestStreak, 6);
});

test('canTransitionEditorialState prevents publishing unreviewed AI or draft content', () => {
  const skipAttempt = canTransitionEditorialState('draft', 'published', {
    hasProvenance: true,
    hasSubjectReview: false,
    hasLanguageReview: false,
    hasRightsAccessibilityReview: false,
  });
  assert.equal(skipAttempt.allowed, false);

  const approvedToPublish = canTransitionEditorialState('approved', 'published', {
    hasProvenance: true,
    hasSubjectReview: true,
    hasLanguageReview: true,
    hasRightsAccessibilityReview: true,
  });
  assert.equal(approvedToPublish.allowed, true);
});

test('evaluateCertificateVerification distinguishes valid, revoked, and not_found', () => {
  assert.equal(evaluateCertificateVerification(null).verificationStatus, 'not_found');

  const revoked = evaluateCertificateVerification({
    status: 'revoked',
    shareEnabled: false,
    recipientDisplayName: 'Dilnoza R.',
    courseTitle: 'Foundations of Supply & Demand',
    subject: 'Economics',
    level: 'Beginner',
    locale: 'en',
    editionVersion: 1,
    issuedAt: '2026-11-15T10:00:00Z',
    revokedAt: '2026-11-15T12:00:00Z',
    revokeReason: 'Issued in error during QA test.',
  });
  assert.equal(revoked.verificationStatus, 'revoked');
  assert.equal(revoked.certificate?.revokeReason, 'Issued in error during QA test.');

  const valid = evaluateCertificateVerification({
    status: 'valid',
    shareEnabled: true,
    recipientDisplayName: 'Dilnoza R.',
    courseTitle: 'Foundations of Supply & Demand',
    subject: 'Economics',
    level: 'Beginner',
    locale: 'en',
    editionVersion: 1,
    issuedAt: '2026-11-15T10:00:00Z',
    revokedAt: null,
    revokeReason: null,
  });
  assert.equal(valid.verificationStatus, 'valid');
  assert.ok(valid.certificate?.nonAccreditationNotice.includes('not academic credit'));
});
