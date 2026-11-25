import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ROLES,
  authorizeEditorialTransition,
  authorizeRoleChange,
  calculateAssessmentScore,
  calculateEligibleXp,
  normalizeSimulationType,
  canTransitionEditorialState,
  DAILY_XP_CAP,
  evaluateCertificateVerification,
  evaluateCourseCompletion,
  evaluateStreakUpdate,
  getRoleDisplayLabel,
  isAdminRole,
  normalizeUserRole,
  PLATFORM_ROLES,
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

test('canTransitionEditorialState restores a retired edition to approved only with every sign-off', () => {
  const complete = {
    hasProvenance: true,
    hasSubjectReview: true,
    hasLanguageReview: true,
    hasRightsAccessibilityReview: true,
  };
  assert.deepEqual(canTransitionEditorialState('retired', 'approved', complete), { allowed: true });

  const noLanguage = canTransitionEditorialState('retired', 'approved', { ...complete, hasLanguageReview: false });
  assert.equal(noLanguage.allowed, false);
  assert.match(noLanguage.reason ?? '', /language review sign-off/);
  assert.match(noLanguage.reason ?? '', /Restore to Draft/);
  assert.doesNotMatch(noLanguage.reason ?? '', /subject review/, 'only missing gates are named');

  const noSignoffs = {
    hasProvenance: false,
    hasSubjectReview: false,
    hasLanguageReview: false,
    hasRightsAccessibilityReview: false,
  };
  const none = canTransitionEditorialState('retired', 'approved', noSignoffs);
  assert.equal(none.allowed, false);
  assert.match(
    none.reason ?? '',
    /source provenance record, subject review sign-off, language review sign-off, rights\/accessibility review sign-off/
  );

  // Draft stays the always-available way back; other exits from retired are refused.
  assert.equal(canTransitionEditorialState('retired', 'draft', noSignoffs).allowed, true);
  const toPublished = canTransitionEditorialState('retired', 'published', complete);
  assert.equal(toPublished.allowed, false);
  assert.match(toPublished.reason ?? '', /only be restored to Approved or Draft/);
  assert.equal(canTransitionEditorialState('retired', 'subject_review', complete).allowed, false);
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

// --- RBAC: two roles (learner, admin) ---

const noReviewers = { subject: null, language: null, rights: null };
const LEGACY_ROLES = ['editor', 'reviewer', 'publisher'] as const;

test('platform roles are exactly learner and admin; only admin is privileged', () => {
  assert.deepEqual([...PLATFORM_ROLES], ['learner', 'admin']);
  assert.deepEqual([...ADMIN_ROLES], ['admin']);
  assert.equal(isAdminRole('admin'), true);
  for (const role of ['learner', ...LEGACY_ROLES, 'Admin', 'ADMIN', '', null, undefined, 42]) {
    assert.equal(isAdminRole(role), false, String(role));
  }
});

test('normalizeUserRole keeps admin and maps every other stored value to learner', () => {
  assert.equal(normalizeUserRole('admin'), 'admin');
  assert.equal(normalizeUserRole('learner'), 'learner');
  for (const legacy of [...LEGACY_ROLES, 'Admin', ' admin', 'superuser', '', null, undefined, {}]) {
    assert.equal(normalizeUserRole(legacy), 'learner', JSON.stringify(legacy));
  }
});

test('role display labels: Student / Talaba and Administrator', () => {
  assert.equal(getRoleDisplayLabel('learner', 'en'), 'Student');
  assert.equal(getRoleDisplayLabel('learner', 'uz'), 'Talaba');
  assert.equal(getRoleDisplayLabel('admin', 'en'), 'Administrator');
  assert.equal(getRoleDisplayLabel('admin', 'uz'), 'Administrator');
  // A legacy value that slipped through is shown as a learner.
  assert.equal(getRoleDisplayLabel('editor' as never, 'en'), 'Student');
});

test('learners and legacy staff roles cannot run any editorial action', () => {
  for (const role of ['learner', ...LEGACY_ROLES, null, undefined]) {
    const v = authorizeEditorialTransition({
      actorId: 'usr-x',
      actorRole: role as never,
      currentStatus: 'draft',
      targetStatus: 'subject_review',
      reviewers: noReviewers,
    });
    assert.equal(v.allowed, false, String(role));
    assert.match(v.allowed ? '' : v.reason, /Administrator/);
  }
});

test('unknown signoff types are rejected even for admins', () => {
  for (const bad of ['toString', 'publisher', '']) {
    const single = authorizeEditorialTransition({
      actorId: 'usr-a',
      actorRole: 'admin',
      currentStatus: 'subject_review',
      targetStatus: 'subject_review',
      signoffType: bad as never,
      reviewers: noReviewers,
    });
    // An empty string is "no signoff", every other unknown value is refused.
    assert.equal(single.allowed, bad === '', bad);
    const multi = authorizeEditorialTransition({
      actorId: 'usr-a',
      actorRole: 'admin',
      currentStatus: 'draft',
      targetStatus: 'approved',
      signoffTypes: ['subject', bad as never],
    });
    assert.equal(multi.allowed, false, `multi ${bad}`);
  }
});

test('an admin may record several sign-offs at once (deduplicated)', () => {
  const v = authorizeEditorialTransition({
    actorId: 'usr-admin',
    actorRole: 'admin',
    currentStatus: 'draft',
    targetStatus: 'approved',
    signoffType: 'subject',
    signoffTypes: ['subject', 'language', 'rights'],
  });
  assert.equal(v.allowed, true);
  assert.deepEqual(v.allowed ? v.signoffs : [], ['subject', 'language', 'rights']);
});

test('an admin runs the full lifecycle alone: draft → review → approve → publish → retire → restore', () => {
  const steps: Array<{ from: EditorialStatus; to: EditorialStatus; signoff: EditorialSignoffType | null }> = [
    { from: 'draft', to: 'subject_review', signoff: null },
    { from: 'subject_review', to: 'language_review', signoff: 'subject' },
    { from: 'language_review', to: 'rights_accessibility_review', signoff: 'language' },
    { from: 'rights_accessibility_review', to: 'approved', signoff: 'rights' },
    { from: 'approved', to: 'published', signoff: null },
    { from: 'published', to: 'retired', signoff: null },
    { from: 'retired', to: 'approved', signoff: null },
    { from: 'approved', to: 'draft', signoff: null },
  ];
  const reviewers: Record<EditorialSignoffType, string | null> = { subject: null, language: null, rights: null };
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

test('one-click approve from draft passes the gate only once all three sign-offs are recorded', () => {
  const all = { hasProvenance: true, hasSubjectReview: true, hasLanguageReview: true, hasRightsAccessibilityReview: true };
  assert.equal(canTransitionEditorialState('draft', 'approved', all).allowed, true);
  assert.equal(canTransitionEditorialState('language_review', 'approved', all).allowed, true);
  assert.equal(
    canTransitionEditorialState('draft', 'approved', { ...all, hasLanguageReview: false }).allowed,
    false
  );
  // Publishing still requires Approved first and provenance throughout.
  assert.equal(canTransitionEditorialState('draft', 'published', all).allowed, false);
  assert.equal(canTransitionEditorialState('draft', 'approved', { ...all, hasProvenance: false }).allowed, false);
});

test('authorizeRoleChange: admins toggle learner/admin, never demote themselves', () => {
  const base = { actorId: 'usr-admin', actorRole: 'admin' as const };

  const promote = authorizeRoleChange({ ...base, targetUserId: 'usr-1', requestedRole: 'admin', currentRole: 'learner' });
  assert.deepEqual(promote, { allowed: true, nextRole: 'admin', changed: true });

  const demote = authorizeRoleChange({ ...base, targetUserId: 'usr-2', requestedRole: 'learner', currentRole: 'admin' });
  assert.deepEqual(demote, { allowed: true, nextRole: 'learner', changed: true });

  const noop = authorizeRoleChange({ ...base, targetUserId: 'usr-3', requestedRole: 'learner', currentRole: 'learner' });
  assert.deepEqual(noop, { allowed: true, nextRole: 'learner', changed: false });

  // A legacy 'editor' row is already effectively a learner.
  const legacy = authorizeRoleChange({ ...base, targetUserId: 'usr-4', requestedRole: 'learner', currentRole: 'editor' });
  assert.deepEqual(legacy, { allowed: true, nextRole: 'learner', changed: false });

  const self = authorizeRoleChange({ ...base, targetUserId: 'usr-admin', requestedRole: 'learner', currentRole: 'admin' });
  assert.equal(self.allowed, false);
  assert.equal(self.allowed ? 0 : self.status, 403);
  assert.match(self.allowed ? '' : self.reason, /own administrator role/);

  // Re-affirming your own admin role is harmless.
  const selfAdmin = authorizeRoleChange({ ...base, targetUserId: 'usr-admin', requestedRole: 'admin', currentRole: 'admin' });
  assert.deepEqual(selfAdmin, { allowed: true, nextRole: 'admin', changed: false });

  for (const bad of ['editor', 'reviewer', 'publisher', 'ADMIN', '', null, undefined, 1]) {
    const v = authorizeRoleChange({ ...base, targetUserId: 'usr-5', requestedRole: bad, currentRole: 'learner' });
    assert.equal(v.allowed, false, String(bad));
    assert.equal(v.allowed ? 0 : v.status, 400, String(bad));
  }

  for (const actorRole of ['learner', 'editor', null] as const) {
    const v = authorizeRoleChange({
      actorId: 'usr-x',
      actorRole: actorRole as never,
      targetUserId: 'usr-1',
      requestedRole: 'admin',
      currentRole: 'learner',
    });
    assert.equal(v.allowed, false, String(actorRole));
    assert.equal(v.allowed ? 0 : v.status, 403);
  }
});

test('normalizeSimulationType maps DB derivative_tangent to the calculus simulator', () => {
  assert.equal(normalizeSimulationType('derivative_tangent'), 'calculus_derivative');
  assert.equal(normalizeSimulationType('calculus_derivative'), 'calculus_derivative');
  assert.equal(normalizeSimulationType('supply_demand'), 'supply_demand');
  assert.equal(normalizeSimulationType('unit_economics'), 'unit_economics');
  assert.equal(normalizeSimulationType('none'), 'none');
  assert.equal(normalizeSimulationType('bogus'), 'none');
  assert.equal(normalizeSimulationType(null), 'none');
});
