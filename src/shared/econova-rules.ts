import type {
  CertificateVerificationResult,
  EditorialSignoffs,
  EditorialStatus,
  JourneyStatus,
  QuestionWithKey,
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
