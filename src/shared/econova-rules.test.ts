import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeEditorialTransition,
  calculateAssessmentScore,
  calculateEligibleXp,
  canTransitionEditorialState,
  DAILY_XP_CAP,
  evaluateCertificateVerification,
  evaluateCourseCompletion,
  evaluateStreakUpdate,
  getRoleDisplayLabel,
  STAFF_ROLES,
} from './econova-rules.ts';
import type { EditorialSignoffType, EditorialStatus, QuestionWithKey } from './types.ts';

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

// --- RBAC: editorial signoff role enforcement ---

const noReviewers = { subject: null, language: null, rights: null };

test('signoffs require reviewer or admin; editors and publishers cannot sign', () => {
  for (const signoffType of ['subject', 'language', 'rights'] as const) {
    for (const role of ['editor', 'publisher'] as const) {
      const v = authorizeEditorialTransition({
        actorId: `usr-${role}`,
        actorRole: role,
        currentStatus: 'subject_review',
        targetStatus: 'subject_review',
        signoffType,
        reviewers: noReviewers,
      });
      assert.equal(v.allowed, false, `${role} ${signoffType}`);
    }
    for (const role of ['reviewer', 'admin'] as const) {
      const v = authorizeEditorialTransition({
        actorId: `usr-${role}`,
        actorRole: role,
        currentStatus: 'subject_review',
        targetStatus: 'subject_review',
        signoffType,
        reviewers: noReviewers,
      });
      assert.equal(v.allowed, true, `${role} ${signoffType}`);
    }
  }
});

test('learners and unknown signoff types are rejected', () => {
  assert.equal(
    authorizeEditorialTransition({
      actorId: 'usr-l',
      actorRole: 'learner',
      currentStatus: 'draft',
      targetStatus: 'subject_review',
      reviewers: noReviewers,
    }).allowed,
    false
  );
  assert.equal(
    authorizeEditorialTransition({
      actorId: 'usr-a',
      actorRole: 'admin',
      currentStatus: 'subject_review',
      targetStatus: 'subject_review',
      signoffType: 'toString' as never,
      reviewers: noReviewers,
    }).allowed,
    false
  );
});

test('a non-admin reviewer cannot hold two signoff slots on one edition', () => {
  const v = authorizeEditorialTransition({
    actorId: 'usr-rev1',
    actorRole: 'reviewer',
    currentStatus: 'language_review',
    targetStatus: 'rights_accessibility_review',
    signoffType: 'language',
    reviewers: { subject: 'usr-rev1', language: null, rights: null },
  });
  assert.equal(v.allowed, false);
  assert.match(v.allowed ? '' : v.reason, /different reviewer/);

  // A second, distinct reviewer may sign.
  assert.equal(
    authorizeEditorialTransition({
      actorId: 'usr-rev2',
      actorRole: 'reviewer',
      currentStatus: 'language_review',
      targetStatus: 'rights_accessibility_review',
      signoffType: 'language',
      reviewers: { subject: 'usr-rev1', language: null, rights: null },
    }).allowed,
    true
  );
});

test('editors can submit drafts but cannot advance review stages, publish or retire', () => {
  const base = { actorId: 'usr-ed', actorRole: 'editor' as const, reviewers: noReviewers };
  const allowed = (currentStatus: EditorialStatus, targetStatus: EditorialStatus) =>
    authorizeEditorialTransition({ ...base, currentStatus, targetStatus }).allowed;

  assert.equal(allowed('draft', 'subject_review'), true);
  assert.equal(allowed('subject_review', 'language_review'), false);
  assert.equal(allowed('approved', 'published'), false);
  assert.equal(allowed('published', 'retired'), false);
  assert.equal(allowed('published', 'draft'), false);
  // Sending an in-review edition back to draft stays open to editors.
  assert.equal(allowed('language_review', 'draft'), true);
});

test('publishing needs publisher/admin, and a non-admin publisher must be independent of reviewers', () => {
  const signed = { subject: 'usr-r1', language: 'usr-r2', rights: 'usr-r3' };
  assert.equal(
    authorizeEditorialTransition({
      actorId: 'usr-r1',
      actorRole: 'reviewer',
      currentStatus: 'approved',
      targetStatus: 'published',
      reviewers: signed,
    }).allowed,
    false
  );
  assert.equal(
    authorizeEditorialTransition({
      actorId: 'usr-pub',
      actorRole: 'publisher',
      currentStatus: 'approved',
      targetStatus: 'published',
      reviewers: signed,
    }).allowed,
    true
  );
  const selfReviewed = authorizeEditorialTransition({
    actorId: 'usr-pub',
    actorRole: 'publisher',
    currentStatus: 'approved',
    targetStatus: 'published',
    reviewers: { ...signed, rights: 'usr-pub' },
  });
  assert.equal(selfReviewed.allowed, false);
  assert.match(selfReviewed.allowed ? '' : selfReviewed.reason, /independent/);

  // Publishers may retire; reviewers may not restore a retired edition.
  assert.equal(
    authorizeEditorialTransition({
      actorId: 'usr-pub',
      actorRole: 'publisher',
      currentStatus: 'published',
      targetStatus: 'retired',
      reviewers: signed,
    }).allowed,
    true
  );
  assert.equal(
    authorizeEditorialTransition({
      actorId: 'usr-rev',
      actorRole: 'reviewer',
      currentStatus: 'retired',
      targetStatus: 'approved',
      reviewers: signed,
    }).allowed,
    false
  );
});

test('an admin is explicitly authorized to run the whole workflow alone', () => {
  const steps: Array<{ from: EditorialStatus; to: EditorialStatus; signoff: EditorialSignoffType | null }> = [
    { from: 'draft', to: 'subject_review', signoff: null },
    { from: 'subject_review', to: 'language_review', signoff: 'subject' },
    { from: 'language_review', to: 'rights_accessibility_review', signoff: 'language' },
    { from: 'rights_accessibility_review', to: 'approved', signoff: 'rights' },
    { from: 'approved', to: 'published', signoff: null },
  ];
  const reviewers: Record<EditorialSignoffType, string | null> = {
    subject: null,
    language: null,
    rights: null,
  };
  for (const step of steps) {
    const v = authorizeEditorialTransition({
      actorId: 'usr-admin',
      actorRole: 'admin',
      currentStatus: step.from,
      targetStatus: step.to,
      signoffType: step.signoff,
      reviewers,
    });
    assert.equal(v.allowed, true, `${step.from} -> ${step.to}`);
    if (step.signoff) reviewers[step.signoff] = 'usr-admin';
    const gate = canTransitionEditorialState(step.from, step.to, {
      hasProvenance: true,
      hasSubjectReview: Boolean(reviewers.subject),
      hasLanguageReview: Boolean(reviewers.language),
      hasRightsAccessibilityReview: Boolean(reviewers.rights),
    });
    assert.equal(gate.allowed, true, `gate ${step.from} -> ${step.to}`);
  }
});

test('role display labels map internal roles without changing them', () => {
  assert.equal(getRoleDisplayLabel('learner', 'en'), 'Student');
  assert.equal(getRoleDisplayLabel('reviewer', 'en'), 'Moderator');
  assert.equal(getRoleDisplayLabel('learner', 'uz'), 'Talaba');
  assert.equal(getRoleDisplayLabel('admin', 'uz'), 'Administrator');
  assert.deepEqual([...STAFF_ROLES], ['editor', 'reviewer', 'publisher', 'admin']);
});
