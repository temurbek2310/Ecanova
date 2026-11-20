// Pure, database-free rules for server-verified lesson progress.
// server.ts loads the facts (lesson, progress row, enrollment, assessment pass)
// and asks `decideLessonCompletion` whether a completion may be recorded.
//
// No schema change is needed: when a lesson is started, `lesson_progress` holds
// state = 'in_progress' and its `updated_at` is the start time, which is only
// written once (re-opening a lesson does not reset the clock).

export const LESSON_EVIDENCE_TYPES = [
  'lesson_read',
  'interactive_check',
  'assessment_passed',
  'local_sync',
] as const;

export type LessonEvidence = (typeof LESSON_EVIDENCE_TYPES)[number];

/** Evidence strings sent by earlier clients (including cached PWA builds). */
export const LEGACY_EVIDENCE_ALIASES: Readonly<Record<string, LessonEvidence>> = {
  study_and_practice: 'lesson_read',
  study_and_simulation: 'interactive_check',
  manual_syllabus_sync: 'local_sync',
};

/** Stored in `completion_evidence` while a lesson is only started. */
export const LESSON_STARTED_MARKER = 'lesson_started';

export const DWELL_FRACTION_OF_ESTIMATE = 0.2;
export const MIN_DWELL_SECONDS = 20;
export const MAX_DWELL_SECONDS = 180;

export type ParsedEvidence =
  | { ok: true; evidence: LessonEvidence }
  | { ok: false; error: string };

export function parseLessonEvidence(raw: unknown): ParsedEvidence {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      ok: false,
      error: `Evidence is required. Expected one of: ${LESSON_EVIDENCE_TYPES.join(', ')}.`,
    };
  }
  const value = raw.trim();
  if ((LESSON_EVIDENCE_TYPES as readonly string[]).includes(value)) {
    return { ok: true, evidence: value as LessonEvidence };
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_EVIDENCE_ALIASES, value)) {
    return { ok: true, evidence: LEGACY_EVIDENCE_ALIASES[value] };
  }
  return {
    ok: false,
    error: `Invalid evidence type. Expected one of: ${LESSON_EVIDENCE_TYPES.join(', ')}.`,
  };
}

/**
 * Minimum time a learner must have had the lesson open, server-measured:
 * 20% of the lesson's estimated minutes, clamped to 20s..180s.
 */
export function computeMinDwellSeconds(estimatedMinutes: number): number {
  const minutes = Number.isFinite(estimatedMinutes) && estimatedMinutes > 0 ? estimatedMinutes : 1;
  const raw = Math.round(minutes * 60 * DWELL_FRACTION_OF_ESTIMATE);
  return Math.min(MAX_DWELL_SECONDS, Math.max(MIN_DWELL_SECONDS, raw));
}

export interface ProgressRowFacts {
  state: 'not_started' | 'in_progress' | 'completed';
  /** For an in_progress row: when the lesson was first started. */
  updatedAt: Date;
}

export interface LessonCompletionInput {
  evidence: LessonEvidence;
  lessonEstimatedMinutes: number;
  existing: ProgressRowFacts | null;
  /** The learner is enrolled in this lesson's course. */
  isEnrolled: boolean;
  /** The learner has a passed, server-graded attempt on this edition's assessment. */
  hasPassedEditionAssessment: boolean;
  now: Date;
}

export type LessonCompletionDecision =
  | { ok: true; alreadyCompleted: boolean; evidence: LessonEvidence }
  | {
      ok: false;
      status: 422;
      code: 'lesson_not_started' | 'min_dwell_not_met' | 'assessment_not_passed' | 'not_enrolled';
      error: string;
      retryAfterSeconds?: number;
      minDwellSeconds?: number;
    };

/**
 * Decides whether a completion may be recorded.
 *
 * - Already completed: idempotent success (re-sync and double clicks stay safe).
 * - `assessment_passed`: needs a passed server-graded attempt for the edition.
 * - `lesson_read` / `interactive_check`: needs a server-recorded start at least
 *   `computeMinDwellSeconds` ago.
 * - `local_sync` (offline completions pushed later): if the lesson was started
 *   online, the same dwell rule applies; if it never was, the learner must be
 *   enrolled in the course (grace path for offline study). XP stays under the
 *   daily cap, and certificates still need a passed server-graded assessment.
 */
export function decideLessonCompletion(input: LessonCompletionInput): LessonCompletionDecision {
  const { evidence, existing, now } = input;

  if (existing?.state === 'completed') {
    return { ok: true, alreadyCompleted: true, evidence };
  }

  if (evidence === 'assessment_passed') {
    if (!input.hasPassedEditionAssessment) {
      return {
        ok: false,
        status: 422,
        code: 'assessment_not_passed',
        error: 'No passed assessment attempt was found for this course edition.',
      };
    }
    return { ok: true, alreadyCompleted: false, evidence };
  }

  const minDwellSeconds = computeMinDwellSeconds(input.lessonEstimatedMinutes);
  const started = existing?.state === 'in_progress' ? existing : null;

  if (!started) {
    if (evidence === 'local_sync') {
      if (!input.isEnrolled) {
        return {
          ok: false,
          status: 422,
          code: 'not_enrolled',
          error: 'Enroll in this course before syncing offline lesson progress.',
        };
      }
      return { ok: true, alreadyCompleted: false, evidence };
    }
    return {
      ok: false,
      status: 422,
      code: 'lesson_not_started',
      error: 'Open the lesson first so the server can record your study session.',
      minDwellSeconds,
    };
  }

  const elapsedSeconds = Math.floor((now.getTime() - started.updatedAt.getTime()) / 1000);
  if (elapsedSeconds < minDwellSeconds) {
    return {
      ok: false,
      status: 422,
      code: 'min_dwell_not_met',
      error: 'Spend a little more time with this lesson before marking it complete.',
      retryAfterSeconds: minDwellSeconds - Math.max(0, elapsedSeconds),
      minDwellSeconds,
    };
  }

  return { ok: true, alreadyCompleted: false, evidence };
}

export interface ProgressHttpError {
  status: 400 | 422;
  body: {
    error: string;
    code: string;
    retryAfterSeconds?: number;
    minDwellSeconds?: number;
  };
}

/** HTTP response for an evidence value that failed `parseLessonEvidence`. */
export function invalidEvidenceResponse(parsed: { ok: false; error: string }): ProgressHttpError {
  return { status: 400, body: { error: parsed.error, code: 'invalid_evidence' } };
}

/** HTTP response for a completion that `decideLessonCompletion` refused. */
export function completionRejectedResponse(
  decision: Extract<LessonCompletionDecision, { ok: false }>
): ProgressHttpError {
  return {
    status: decision.status,
    body: {
      error: decision.error,
      code: decision.code,
      retryAfterSeconds: decision.retryAfterSeconds,
      minDwellSeconds: decision.minDwellSeconds,
    },
  };
}
