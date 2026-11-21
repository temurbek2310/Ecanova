import type {
  CertificateVerificationResult,
  EditorialSignoffs,
  EditorialSignoffType,
  EditorialStatus,
  JourneyStatus,
  LocaleCode,
  QuestionWithKey,
  UserRole,
} from './types.ts';

export const NON_ACCREDITATION_NOTICE =
  'This certificate confirms completion of the named ECONOVA course edition only. It is not academic credit, institutional accreditation, or a professional license.';

export const XP_RULE_VERSION = 'v1-non-cash';
export const DAILY_XP_CAP = 300;

export const XP_AMOUNTS = {
  lesson_completed: 25,
  assessment_passed: 50,
  course_completed: 100,
  referral_reward: 40,
} as const;

export type XpEventKind = keyof typeof XP_AMOUNTS;

export interface AssessmentEvaluationResult {
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  questionFeedback: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanation: string;
  }>;
}

export function calculateAssessmentScore(
  questions: QuestionWithKey[],
  selectedAnswers: Record<string, number>,
  passingScorePercent: number
): AssessmentEvaluationResult {
  if (questions.length === 0) {
    return {
      totalQuestions: 0,
      correctCount: 0,
      scorePercent: 0,
      passed: false,
      questionFeedback: [],
    };
  }

  let correctCount = 0;
  const questionFeedback = questions.map((q) => {
    const selectedIndex =
      typeof selectedAnswers[q.id] === 'number' ? selectedAnswers[q.id] : -1;
    const isCorrect = selectedIndex === q.correctOptionIndex;
    if (isCorrect) {
      correctCount += 1;
    }
    return {
      questionId: q.id,
      selectedIndex,
      correctIndex: q.correctOptionIndex,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const scorePercent = Math.round((correctCount / questions.length) * 100);
  const passed = scorePercent >= passingScorePercent;

  return {
    totalQuestions: questions.length,
    correctCount,
    scorePercent,
    passed,
    questionFeedback,
  };
}

export interface CourseCompletionInput {
  requiredLessonIds: string[];
  completedLessonIds: string[];
  passingScorePercent: number;
  bestScorePercent: number | null;
  hasAssessment: boolean;
  isPaused?: boolean;
}

export interface CourseCompletionDecision {
  allRequiredLessonsDone: boolean;
  assessmentPassed: boolean;
  isCompleted: boolean;
  journeyStatus: JourneyStatus;
  percentComplete: number;
}

export function evaluateCourseCompletion(
  input: CourseCompletionInput
): CourseCompletionDecision {
  const completedSet = new Set(input.completedLessonIds);
  const requiredCount = input.requiredLessonIds.length;
  const completedRequiredCount = input.requiredLessonIds.filter((id) =>
    completedSet.has(id)
  ).length;

  const allRequiredLessonsDone =
    requiredCount > 0 && completedRequiredCount === requiredCount;
  const assessmentPassed = input.hasAssessment
    ? input.bestScorePercent !== null &&
      input.bestScorePercent >= input.passingScorePercent
    : true;

  const isCompleted = allRequiredLessonsDone && assessmentPassed;

  // Progressing is strictly a learner journey/status, never a fourth course level
  let journeyStatus: JourneyStatus = 'not_started';
  if (isCompleted) {
    journeyStatus = 'completed';
  } else if (input.isPaused) {
    journeyStatus = 'paused';
  } else if (completedRequiredCount > 0 || input.bestScorePercent !== null) {
    journeyStatus = 'progressing';
  }

  const totalUnits = requiredCount + (input.hasAssessment ? 1 : 0);
  const doneUnits = completedRequiredCount + (assessmentPassed && input.hasAssessment ? 1 : 0);
  const percentComplete = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;

  return {
    allRequiredLessonsDone,
    assessmentPassed,
    isCompleted,
    journeyStatus,
    percentComplete,
  };
}

export function calculateEligibleXp(params: {
  eventType: XpEventKind;
  alreadyAwardedForIdempotencyKey: boolean;
  xpEarnedToday: number;
}): { eligibleAmount: number; reason: string } {
  if (params.alreadyAwardedForIdempotencyKey) {
    return {
      eligibleAmount: 0,
      reason: 'Duplicate event blocked by idempotency key.',
    };
  }

  const baseAmount = XP_AMOUNTS[params.eventType];
  const remainingCap = Math.max(0, DAILY_XP_CAP - params.xpEarnedToday);
  if (remainingCap === 0) {
    return {
      eligibleAmount: 0,
      reason: `Daily non-cash XP cap (${DAILY_XP_CAP} XP) reached.`,
    };
  }

  const eligibleAmount = Math.min(baseAmount, remainingCap);
  return {
    eligibleAmount,
    reason:
      eligibleAmount < baseAmount
        ? `Partial non-cash XP awarded up to daily cap (${DAILY_XP_CAP} XP).`
        : 'Verified learning milestone awarded.',
  };
}

export function formatLocalDateKey(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function evaluateStreakUpdate(params: {
  lastActivityLocalDate: string | null;
  currentStreak: number;
  bestStreak: number;
  todayLocalDate: string;
}): {
  currentStreak: number;
  bestStreak: number;
  lastActivityLocalDate: string;
  incremented: boolean;
} {
  if (params.lastActivityLocalDate === params.todayLocalDate) {
    return {
      currentStreak: params.currentStreak,
      bestStreak: Math.max(params.bestStreak, params.currentStreak),
      lastActivityLocalDate: params.todayLocalDate,
      incremented: false,
    };
  }

  const yesterday = previousDateKey(params.todayLocalDate);
  const nextCurrent =
    params.lastActivityLocalDate === yesterday ? params.currentStreak + 1 : 1;
  const nextBest = Math.max(params.bestStreak, nextCurrent);

  return {
    currentStreak: nextCurrent,
    bestStreak: nextBest,
    lastActivityLocalDate: params.todayLocalDate,
    incremented: true,
  };
}

export function canTransitionEditorialState(
  current: EditorialStatus,
  next: EditorialStatus,
  signoffs: EditorialSignoffs
): { allowed: boolean; reason?: string } {
  if (current === next) {
    return { allowed: true };
  }

  if (next === 'retired') {
    return { allowed: true };
  }

  if (next === 'draft') {
    return { allowed: true };
  }

  // A retired edition sits outside the review pipeline. It can go back to draft
  // (handled above) or straight to approved, but only if every sign-off it earned
  // before retirement is still on record; otherwise it must be re-reviewed from draft.
  if (current === 'retired') {
    if (next !== 'approved') {
      return {
        allowed: false,
        reason: 'A retired edition can only be restored to Approved or Draft.',
      };
    }
    const missing = [
      !signoffs.hasProvenance && 'source provenance record',
      !signoffs.hasSubjectReview && 'subject review sign-off',
      !signoffs.hasLanguageReview && 'language review sign-off',
      !signoffs.hasRightsAccessibilityReview && 'rights/accessibility review sign-off',
    ].filter((item): item is string => Boolean(item));
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Cannot restore to Approved without: ${missing.join(', ')}. Restore to Draft and complete the review first.`,
      };
    }
    return { allowed: true };
  }

  const order: EditorialStatus[] = [
    'draft',
    'subject_review',
    'language_review',
    'rights_accessibility_review',
    'approved',
    'published',
  ];

  const currIdx = order.indexOf(current);
  const nextIdx = order.indexOf(next);
  if (currIdx === -1 || nextIdx === -1) {
    return { allowed: false, reason: 'Invalid editorial state transition.' };
  }

  // Enforce step-by-step review gate so AI drafts or unreviewed items can never jump straight to published
  if (next === 'published') {
    if (!signoffs.hasProvenance) {
      return { allowed: false, reason: 'Source provenance record is required before publishing.' };
    }
    if (!signoffs.hasSubjectReview) {
      return { allowed: false, reason: 'Human subject-matter review sign-off is required.' };
    }
    if (!signoffs.hasLanguageReview) {
      return { allowed: false, reason: 'Independent language edition review sign-off is required.' };
    }
    if (!signoffs.hasRightsAccessibilityReview) {
      return { allowed: false, reason: 'Rights and accessibility review sign-off is required.' };
    }
    if (current !== 'approved') {
      return { allowed: false, reason: 'Edition must be in Approved status before publishing.' };
    }
  }

  if (next === 'approved') {
    if (
      !signoffs.hasProvenance ||
      !signoffs.hasSubjectReview ||
      !signoffs.hasLanguageReview ||
      !signoffs.hasRightsAccessibilityReview
    ) {
      return {
        allowed: false,
        reason: 'All review gates (provenance, subject, language, rights/accessibility) must be signed off before approval.',
      };
    }
  }

  if (nextIdx > currIdx + 1 && next !== 'approved') {
    return {
      allowed: false,
      reason: 'Editorial workflow stages must progress sequentially through human review.',
    };
  }

  return { allowed: true };
}

export function evaluateCertificateVerification(
  cert: {
    status: 'valid' | 'revoked';
    shareEnabled: boolean;
    recipientDisplayName: string;
    courseTitle: string;
    subject: 'Economics' | 'Mathematics' | 'Business';
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    locale: 'en' | 'uz';
    editionVersion: number;
    issuedAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
  } | null
): CertificateVerificationResult {
  if (!cert) {
    return { verificationStatus: 'not_found' };
  }
  // If revoked, still return revoked status clearly without revealing private account details
  if (cert.status === 'revoked') {
    return {
      verificationStatus: 'revoked',
      certificate: {
        recipientDisplayName: cert.recipientDisplayName,
        courseTitle: cert.courseTitle,
        subject: cert.subject,
        level: cert.level,
        locale: cert.locale,
        editionVersion: cert.editionVersion,
        issuedAt: cert.issuedAt,
        revokedAt: cert.revokedAt,
        revokeReason: cert.revokeReason,
        nonAccreditationNotice: NON_ACCREDITATION_NOTICE,
      },
    };
  }

  return {
    verificationStatus: 'valid',
    certificate: {
      recipientDisplayName: cert.recipientDisplayName,
      courseTitle: cert.courseTitle,
      subject: cert.subject,
      level: cert.level,
      locale: cert.locale,
      editionVersion: cert.editionVersion,
      issuedAt: cert.issuedAt,
      revokedAt: null,
      revokeReason: null,
      nonAccreditationNotice: NON_ACCREDITATION_NOTICE,
    },
  };
}

// --- Role-based access control (RBAC) ---
// Two active roles: `learner` (Student / Talaba) and `admin` (Administrator).
// The database may still hold legacy staff values ('editor', 'reviewer',
// 'publisher') because its CHECK constraint was never narrowed; every read of
// `users.role` goes through `normalizeUserRole`, so only an exact 'admin' is
// privileged and anything else is a learner.

/** Every role a user can hold today. */
export const PLATFORM_ROLES: readonly UserRole[] = ['learner', 'admin'];

/** Roles allowed into the admin console and every `/api/admin/*` endpoint. */
export const ADMIN_ROLES: readonly UserRole[] = ['admin'];

/** Maps any stored role value onto the active model: only `'admin'` is privileged. */
export function normalizeUserRole(raw: unknown): UserRole {
  return raw === 'admin' ? 'admin' : 'learner';
}

export function isAdminRole(role: unknown): boolean {
  return role === 'admin';
}

export function hasAnyRole(
  role: UserRole | null | undefined,
  allowed: readonly UserRole[]
): boolean {
  return Boolean(role && allowed.includes(role));
}

const ROLE_DISPLAY_LABELS: Readonly<Record<LocaleCode, Record<UserRole, string>>> = {
  en: { learner: 'Student', admin: 'Administrator' },
  uz: { learner: 'Talaba', admin: 'Administrator' },
};

export function getRoleDisplayLabel(role: UserRole, locale: LocaleCode): string {
  return ROLE_DISPLAY_LABELS[locale]?.[normalizeUserRole(role)] ?? role;
}

export type RoleChangeDecision =
  | { allowed: true; nextRole: UserRole; changed: boolean }
  | { allowed: false; status: 400 | 403; reason: string };

/**
 * Decides whether `actor` may set `targetUserId`'s role to `requestedRole`.
 * Only admins may change roles, only to 'learner' or 'admin', and an admin can
 * never remove their own admin role (so the platform cannot lose its last
 * operator by accident).
 */
export function authorizeRoleChange(input: {
  actorId: string;
  actorRole: UserRole | null | undefined;
  targetUserId: string;
  requestedRole: unknown;
  currentRole: unknown;
}): RoleChangeDecision {
  if (!isAdminRole(input.actorRole)) {
    return { allowed: false, status: 403, reason: 'Administrator permission required.' };
  }
  if (input.requestedRole !== 'learner' && input.requestedRole !== 'admin') {
    return { allowed: false, status: 400, reason: "Role must be 'learner' or 'admin'." };
  }
  const nextRole = input.requestedRole;
  if (input.actorId === input.targetUserId && nextRole !== 'admin') {
    return {
      allowed: false,
      status: 403,
      reason: 'You cannot remove your own administrator role.',
    };
  }
  return { allowed: true, nextRole, changed: normalizeUserRole(input.currentRole) !== nextRole };
}

export interface EditorialTransitionAuthorizationInput {
  actorId: string;
  actorRole: UserRole | null | undefined;
  currentStatus: EditorialStatus;
  targetStatus: EditorialStatus;
  /** A single sign-off recorded with this transition. */
  signoffType?: EditorialSignoffType | null;
  /** Several sign-offs recorded at once (e.g. "approve" from any review stage). */
  signoffTypes?: readonly EditorialSignoffType[] | null;
  /** Reviewer IDs already recorded on the edition, before this request (kept for provenance). */
  reviewers?: {
    subject: string | null;
    language: string | null;
    rights: string | null;
  };
}

export type EditorialTransitionAuthorization =
  | { allowed: true; signoffs: EditorialSignoffType[] }
  | { allowed: false; reason: string };

const SIGNOFF_TYPES: readonly EditorialSignoffType[] = ['subject', 'language', 'rights'];

export function isEditorialSignoffType(value: unknown): value is EditorialSignoffType {
  return typeof value === 'string' && (SIGNOFF_TYPES as readonly string[]).includes(value);
}

/**
 * Role layer for editorial actions. An administrator may run the whole
 * lifecycle alone (draft, sign-offs, approve, publish, retire, restore);
 * learners may run none of it. Sign-offs are still recorded per slot with the
 * acting admin's ID and every transition is audit-logged by the server, and
 * `canTransitionEditorialState` still enforces workflow order and gates.
 */
export function authorizeEditorialTransition(
  input: EditorialTransitionAuthorizationInput
): EditorialTransitionAuthorization {
  if (!isAdminRole(input.actorRole)) {
    return { allowed: false, reason: 'Administrator permission required.' };
  }
  const requested = [
    ...(input.signoffType ? [input.signoffType] : []),
    ...(input.signoffTypes ?? []),
  ];
  for (const signoff of requested) {
    if (!isEditorialSignoffType(signoff)) {
      return { allowed: false, reason: 'Unknown signoff type. Expected subject, language or rights.' };
    }
  }
  return { allowed: true, signoffs: [...new Set(requested)] };
}
