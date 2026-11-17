import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  ListChecks,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import type { AssessmentPublic, LocaleCode } from '../shared/types';
import { formatTemplate, t } from '../lib/i18n';
import { apiFetch } from '../lib/auth-client';
import { recordQuizAttemptWeaknesses } from '../lib/study-features';

export type SlideDirection = 'forward' | 'backward';

export type QuestionSlideState = {
  initial: {
    opacity: number;
    x: number;
    y: number;
  };
  animate: {
    opacity: number;
    x: number;
    y: number;
    transition: {
      type: 'spring';
      stiffness: number;
      damping: number;
      mass: number;
      delay: number;
    };
  };
  exit: {
    opacity: number;
    x: number;
    y: number;
  };
};

export function computeQuestionSlideDelay(index: number): number {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return Number(Math.min(0.48, 0.04 + safeIndex * 0.075).toFixed(3));
}

export function buildQuestionSlideState(
  index = 0,
  direction: SlideDirection = 'forward'
): QuestionSlideState {
  const delay = computeQuestionSlideDelay(index);
  const horizontalOffset = direction === 'backward' ? -28 : 28;
  const exitOffset = direction === 'backward' ? 24 : -24;

  return {
    initial: {
      opacity: 0,
      x: horizontalOffset,
      y: 8,
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 360,
        damping: 28,
        mass: 0.85,
        delay,
      },
    },
    exit: {
      opacity: 0,
      x: exitOffset,
      y: -6,
    },
  };
}

export function evaluateAssessmentProgress(
  questionIds: readonly string[],
  answers: Readonly<Record<string, number>>,
  submissionResult?: { scorePercent: number; passed: boolean } | null
) {
  const totalQuestions = Array.isArray(questionIds) ? questionIds.length : 0;
  if (totalQuestions === 0) {
    return {
      totalQuestions: 0,
      answeredCount: 0,
      unansweredCount: 0,
      completionPercent: 0,
      displayPercent: 0,
      isAllAnswered: false,
      status: 'in_progress' as const,
    };
  }

  let answeredCount = 0;
  for (const id of questionIds) {
    const selected = answers[id];
    if (typeof selected === 'number' && Number.isFinite(selected) && selected >= 0) {
      answeredCount += 1;
    }
  }

  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const completionPercent = Math.min(
    100,
    Math.max(0, Math.round((answeredCount / totalQuestions) * 100))
  );
  const isAllAnswered = answeredCount === totalQuestions;

  if (submissionResult) {
    const clampedScore = Math.min(
      100,
      Math.max(0, Math.round(submissionResult.scorePercent))
    );
    return {
      totalQuestions,
      answeredCount,
      unansweredCount,
      completionPercent,
      displayPercent: clampedScore,
      isAllAnswered,
      status: submissionResult.passed
        ? ('submitted_passed' as const)
        : ('submitted_review' as const),
    };
  }

  return {
    totalQuestions,
    answeredCount,
    unansweredCount,
    completionPercent,
    displayPercent: completionPercent,
    isAllAnswered,
    status: isAllAnswered ? ('ready_to_submit' as const) : ('in_progress' as const),
  };
}

export function computeQuestionNavigationTarget(
  currentIndex: number,
  totalQuestions: number,
  target: 'prev' | 'next' | number
): { nextIndex: number; direction: SlideDirection } {
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
    return { nextIndex: 0, direction: 'forward' };
  }

  const maxIndex = totalQuestions - 1;
  const safeCurrent = Math.min(maxIndex, Math.max(0, Math.floor(currentIndex)));

  let desiredIndex = safeCurrent;
  if (target === 'prev') {
    desiredIndex = Math.max(0, safeCurrent - 1);
  } else if (target === 'next') {
    desiredIndex = Math.min(maxIndex, safeCurrent + 1);
  } else if (typeof target === 'number' && Number.isFinite(target)) {
    desiredIndex = Math.min(maxIndex, Math.max(0, Math.floor(target)));
  }

  const direction: SlideDirection =
    desiredIndex < safeCurrent ? 'backward' : 'forward';

  return {
    nextIndex: desiredIndex,
    direction,
  };
}

export type TimerUrgencyLevel = 'normal' | 'warning' | 'critical' | 'expired';

export function computeAssessmentTimerDurationSeconds(
  questionCount: number,
  overrideSeconds?: number
): number {
  if (typeof overrideSeconds === 'number' && Number.isFinite(overrideSeconds) && overrideSeconds > 0) {
    return Math.max(10, Math.floor(overrideSeconds));
  }
  const safeCount = Number.isFinite(questionCount) ? Math.max(1, Math.floor(questionCount)) : 3;
  return Math.max(120, safeCount * 90);
}

export function formatCountdownClock(remainingSeconds: number): string {
  const safe = Number.isFinite(remainingSeconds) ? Math.max(0, Math.floor(remainingSeconds)) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function evaluateCountdownUrgency(
  remainingSeconds: number,
  totalSeconds: number
): TimerUrgencyLevel {
  const safeRem = Number.isFinite(remainingSeconds) ? Math.max(0, Math.floor(remainingSeconds)) : 0;
  const safeTotal = Number.isFinite(totalSeconds) ? Math.max(1, Math.floor(totalSeconds)) : 180;
  if (safeRem <= 0) return 'expired';
  if (safeRem <= Math.min(30, Math.floor(safeTotal * 0.15))) return 'critical';
  if (safeRem <= Math.min(60, Math.floor(safeTotal * 0.3))) return 'warning';
  return 'normal';
}

export function buildAutoSubmitAnswersPayload(
  questionIds: readonly string[],
  currentAnswers: Readonly<Record<string, number>>
): Record<string, number> {
  const payload: Record<string, number> = {};
  for (const qId of questionIds) {
    const val = currentAnswers[qId];
    payload[qId] = typeof val === 'number' && Number.isFinite(val) ? val : -1;
  }
  return payload;
}

interface AssessmentAttemptFeedback {
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  xpAwarded: number;
  xpNote: string;
  journeyStatus: string;
  certificateIssuedNow: boolean;
  certificateToken: string | null;
  questionFeedback: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanation: string;
  }>;
}

interface AssessmentViewProps {
  courseId?: string;
  assessment: AssessmentPublic;
  locale: LocaleCode;
  isAuthenticated: boolean;
  initialTimerSeconds?: number;
  onRequireAuth: () => void;
  onAttemptCompleted: () => Promise<void>;
  onViewCertificates: () => void;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  courseId = 'course-econ-101',
  assessment,
  locale,
  isAuthenticated,
  initialTimerSeconds,
  onRequireAuth,
  onAttemptCompleted,
  onViewCertificates,
}) => {
  const totalDurationSeconds = useMemo(
    () => computeAssessmentTimerDurationSeconds(assessment.questions.length, initialTimerSeconds),
    [assessment.questions.length, initialTimerSeconds]
  );

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentAttemptFeedback | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(totalDurationSeconds);
  const [autoSubmittedNotice, setAutoSubmittedNotice] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('forward');
  const [navigationStepCount, setNavigationStepCount] = useState(0);
  const questionRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const autoSubmitTriggeredRef = useRef(false);

  const questionIds = useMemo(
    () => assessment.questions.map((q) => q.id),
    [assessment.questions]
  );

  const progress = useMemo(
    () => evaluateAssessmentProgress(questionIds, answers, result),
    [questionIds, answers, result]
  );

  const timerUrgency = useMemo(
    () => evaluateCountdownUrgency(remainingSeconds, totalDurationSeconds),
    [remainingSeconds, totalDurationSeconds]
  );

  const allAnswered = progress.isAllAnswered;

  const handleNavigateQuestion = (target: 'prev' | 'next' | number) => {
    const nav = computeQuestionNavigationTarget(
      activeQuestionIndex,
      assessment.questions.length,
      target
    );
    setSlideDirection(nav.direction);
    setActiveQuestionIndex(nav.nextIndex);
    setNavigationStepCount((prev) => prev + 1);

    const targetQuestion = assessment.questions[nav.nextIndex];
    if (targetQuestion) {
      const el = questionRefs.current[targetQuestion.id];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const handleSelectOption = (questionId: string, questionIdx: number, optIdx: number) => {
    const nav = computeQuestionNavigationTarget(
      activeQuestionIndex,
      assessment.questions.length,
      questionIdx
    );
    setSlideDirection(nav.direction);
    setActiveQuestionIndex(questionIdx);
    setAnswers((prev) => ({ ...prev, [questionId]: optIdx }));
    if (result) setResult(null);
  };

  const submitGradingRequest = useCallback(
    async (payloadAnswers: Record<string, number>, isAutoTimeout = false) => {
      setErrorMsg(null);
      setSubmitting(true);
      if (isAutoTimeout) {
        setAutoSubmittedNotice(
          locale === 'uz'
            ? 'Vaqt tugadi! Kechikib topshirishning oldini olish uchun joriy javoblaringiz avtomatik tarzda yuborildi.'
            : 'Time expired! Your current assessment state was automatically submitted to prevent late completion.'
        );
      }

      if (!isAuthenticated) {
        setSubmitting(false);
        if (!isAutoTimeout) {
          onRequireAuth();
        }
        return;
      }

      try {
        const res = await apiFetch(`/api/assessments/${assessment.id}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: payloadAnswers, autoSubmitted: isAutoTimeout }),
        });
        const data = (await res.json()) as AssessmentAttemptFeedback & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Could not grade assessment.');
        setResult(data);

        // Record any missed question topics for the Overview Weakness Detection card
        const missed = data.questionFeedback
          .filter((fb) => !fb.isCorrect)
          .map((fb) => {
            const qObj = assessment.questions.find((q) => q.id === fb.questionId);
            return {
              questionId: fb.questionId,
              questionSequenceNum: qObj?.sequenceNum ?? 1,
              objectiveRef: qObj?.objectiveRef ?? 'Core Topic',
              prompt: qObj?.prompt ?? '',
            };
          });
        if (missed.length > 0) {
          recordQuizAttemptWeaknesses({
            courseId,
            assessmentId: assessment.id,
            missedQuestions: missed,
          });
        }

        await onAttemptCompleted();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Grading request failed.');
      } finally {
        setSubmitting(false);
      }
    },
    [assessment.id, assessment.questions, courseId, isAuthenticated, locale, onAttemptCompleted, onRequireAuth]
  );

  // Reset timer when assessment changes
  useEffect(() => {
    setRemainingSeconds(totalDurationSeconds);
    setAutoSubmittedNotice(null);
    autoSubmitTriggeredRef.current = false;
  }, [assessment.id, totalDurationSeconds]);

  // Active per-second countdown timer while attempt is in progress
  useEffect(() => {
    if (result || submitting) return;
    if (remainingSeconds <= 0) {
      if (!autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        const autoPayload = buildAutoSubmitAnswersPayload(questionIds, answers);
        void submitGradingRequest(autoPayload, true);
      }
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [remainingSeconds, result, submitting, questionIds, answers, submitGradingRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (!allAnswered) {
      setErrorMsg(
        locale === 'uz'
          ? 'Iltimos, yuborishdan oldin barcha savollarga javob bering.'
          : 'Please answer every question before submitting.'
      );
      return;
    }
    setAutoSubmittedNotice(null);
    await submitGradingRequest(answers, false);
  };

  return (
    <section className="space-y-6 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
      <header className="space-y-4 border-b border-line pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{locale === 'uz' ? `Versiya ${assessment.version}` : `Version ${assessment.version}`}</span>
              <span aria-hidden="true">·</span>
              <span>
                {locale === 'uz'
                  ? `O‘tish chegarasi: ${assessment.passingScorePercent}%`
                  : `Passing Threshold: ${assessment.passingScorePercent}%`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{assessment.questions.length} {locale === 'uz' ? 'savol' : 'questions'}</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">{assessment.title}</h2>
            <p className="mt-1 text-xs text-muted">{assessment.retryPolicyText}</p>
          </div>

          {/* Individual Quiz Attempt Countdown Timer */}
          <div
            data-testid="assessment-countdown-timer"
            data-timer-urgency={timerUrgency}
            data-remaining-seconds={remainingSeconds}
            role="timer"
            aria-live="off"
            aria-label={locale === 'uz' ? 'Test uchun qolgan vaqt' : 'Assessment Attempt Countdown Timer'}
            className={`inline-flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 font-mono text-xs font-bold tabular-nums shadow-brutal-sm transition-colors ${
              timerUrgency === 'expired' || timerUrgency === 'critical'
                ? 'border-danger bg-danger-surface/40 text-danger-text animate-pulse'
                : timerUrgency === 'warning'
                ? 'border-warning bg-chrome text-warning'
                : 'border-theme-border bg-chrome text-theme-cyan'
            }`}
          >
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-[10px] font-sans font-medium text-muted">
                {locale === 'uz' ? 'Qolgan vaqt' : 'Attempt Timer'}
              </div>
              <div data-testid="assessment-countdown-clock" className="text-sm font-extrabold">
                {formatCountdownClock(remainingSeconds)}
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Submission Notification Banner when Timer Expires */}
        {autoSubmittedNotice && (
          <div
            role="alert"
            data-testid="assessment-timeout-banner"
            className="flex items-start gap-2.5 rounded-xl border-2 border-warning bg-chrome p-3.5 text-xs font-medium text-warning shadow-brutal-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>{autoSubmittedNotice}</span>
          </div>
        )}

        {/* Subtle Framer Motion Progress Bar Transition & Sequential Question Navigator */}
        <div
          data-testid="assessment-progress-container"
          data-progress-status={progress.status}
          data-progress-percent={progress.displayPercent}
          className="rounded-xl border-2 border-theme-border bg-chrome p-3.5 shadow-brutal-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-medium text-ink">
              <ListChecks className="h-4 w-4 text-theme-cyan" aria-hidden="true" />
              <span>
                {result
                  ? locale === 'uz'
                    ? `Yakuniy natija: ${result.scorePercent}% (${result.correctCount}/${result.totalQuestions})`
                    : `Submitted Score: ${result.scorePercent}% (${result.correctCount}/${result.totalQuestions})`
                  : locale === 'uz'
                  ? `Belgilangan javoblar: ${progress.answeredCount} / ${progress.totalQuestions}`
                  : `Answered Progress: ${progress.answeredCount} of ${progress.totalQuestions} questions`}
              </span>
            </div>

            <motion.span
              key={`${progress.status}-${progress.displayPercent}`}
              initial={{ opacity: 0.6, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
                progress.status === 'submitted_passed'
                  ? 'border-success/50 bg-success/15 text-success'
                  : progress.status === 'submitted_review'
                  ? 'border-warning/50 bg-warning/15 text-warning'
                  : progress.status === 'ready_to_submit'
                  ? 'border-theme-emerald/50 bg-theme-emerald/15 text-theme-emerald'
                  : 'border-theme-border bg-theme-base text-theme-cyan'
              }`}
            >
              {progress.status === 'ready_to_submit' && (
                <Sparkles className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{progress.displayPercent}%</span>
            </motion.span>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.displayPercent}
            aria-label={locale === 'uz' ? 'Baholash jarayoni' : 'Assessment completion progress'}
            data-testid="assessment-progress-bar"
            className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full border border-theme-border bg-theme-base"
          >
            <motion.div
              layout
              data-testid="assessment-progress-fill"
              initial={{ width: '0%' }}
              animate={{
                width: `${progress.displayPercent}%`,
                scaleY: submitting ? [1, 1.18, 1] : 1,
              }}
              transition={{
                width: { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 },
                scaleY: { duration: 0.35 },
              }}
              className={`h-full rounded-full ${
                progress.status === 'submitted_passed'
                  ? 'bg-success'
                  : progress.status === 'submitted_review'
                  ? 'bg-warning'
                  : progress.status === 'ready_to_submit'
                  ? 'bg-theme-emerald'
                  : 'bg-theme-accent'
              }`}
            />
          </div>

          {/* Sequential Question Stepper Controls */}
          {assessment.questions.length > 1 && (
            <div
              data-testid="assessment-question-nav"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {assessment.questions.map((q, idx) => {
                  const isAnswered = typeof answers[q.id] === 'number';
                  const isCurrent = activeQuestionIndex === idx;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleNavigateQuestion(idx)}
                      data-testid={`assessment-step-pill-${idx + 1}`}
                      aria-label={`${locale === 'uz' ? 'Savol' : 'Question'} ${idx + 1}`}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-2 font-mono text-xs font-bold tabular-nums transition-colors ${
                        isCurrent
                          ? 'border-theme-accent bg-theme-accent text-theme-accent-ink'
                          : isAnswered
                          ? 'border-theme-emerald/60 bg-theme-emerald/15 text-theme-emerald'
                          : 'border-theme-border bg-theme-base text-muted hover:text-ink'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={activeQuestionIndex <= 0}
                  onClick={() => handleNavigateQuestion('prev')}
                  data-testid="assessment-prev-question-btn"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-theme-border bg-theme-base px-2.5 text-xs font-medium text-ink hover:border-theme-accent disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'Oldingi' : 'Prev'}</span>
                </button>
                <button
                  type="button"
                  disabled={activeQuestionIndex >= assessment.questions.length - 1}
                  onClick={() => handleNavigateQuestion('next')}
                  data-testid="assessment-next-question-btn"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-theme-border bg-theme-base px-2.5 text-xs font-medium text-ink hover:border-theme-accent disabled:opacity-40"
                >
                  <span>{locale === 'uz' ? 'Keyingi' : 'Next'}</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <AnimatePresence mode="sync">
        {result && (
          <motion.div
            key="assessment-result-banner"
            layout
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            role="status"
            className={`rounded-xl border p-4 ${
              result.passed
                ? 'border-success/50 bg-chrome'
                : 'border-warning/50 bg-chrome'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className={`text-sm font-semibold ${result.passed ? 'text-success' : 'text-warning'}`}>
                  {result.passed
                    ? locale === 'uz'
                      ? 'Baholashdan muvaffaqiyatli o‘tdingiz'
                      : 'Assessment Passed'
                    : locale === 'uz'
                    ? 'O‘tish baliga yetmadi — qayta urinib ko‘ring'
                    : 'Below Passing Threshold — Review Explanations & Retry'}
                </div>
                <p className="mt-1 font-mono text-xs tabular-nums text-muted">
                  {formatTemplate(t(locale).assessment.scoreSummary, {
                    scorePercent: result.scorePercent,
                    correctCount: result.correctCount,
                    totalQuestions: result.totalQuestions,
                  })}{' '}
                  ·{' '}
                  {result.xpAwarded > 0
                    ? formatTemplate(t(locale).assessment.xpAwardedBadge, { xp: result.xpAwarded })
                    : result.xpNote}
                </p>
              </div>

              {result.certificateToken && (
                <button
                  type="button"
                  onClick={onViewCertificates}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-teal-ink hover:bg-teal-hover"
                >
                  <Award className="h-4 w-4" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'Sertifikatni ko‘rish' : 'View Course Certificate'}</span>
                </button>
              )}
            </div>
            {result.certificateIssuedNow && (
              <p className="mt-2 text-xs text-teal">
                {locale === 'uz'
                  ? 'Tabriklaymiz! Ushbu kurs bo‘yicha shaxsiy tasdiqlanadigan sertifikatingiz yaratildi.'
                  : 'Course completion criteria met! Your verifiable course-specific certificate has been issued.'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <LayoutGroup id={`assessment-questions-${assessment.id}`}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div data-testid="assessment-question-list" className="space-y-4">
            <AnimatePresence initial={true} mode="popLayout">
              {assessment.questions.map((q, qIdx) => {
                const fb = result?.questionFeedback.find((f) => f.questionId === q.id);
                const isFocusedQuestion = activeQuestionIndex === qIdx;
                const slideState = buildQuestionSlideState(
                  navigationStepCount > 0 && isFocusedQuestion ? 0 : qIdx,
                  slideDirection
                );

                return (
                  <motion.fieldset
                    key={`${q.id}-${isFocusedQuestion ? navigationStepCount : 0}`}
                    ref={(el) => {
                      questionRefs.current[q.id] = el;
                    }}
                    layout
                    data-testid={`assessment-question-card-${qIdx + 1}`}
                    data-question-id={q.id}
                    data-question-active={isFocusedQuestion ? 'true' : 'false'}
                    data-slide-direction={slideDirection}
                    initial={slideState.initial}
                    animate={slideState.animate}
                    exit={slideState.exit}
                    className={`rounded-lg border-2 bg-chrome p-4 transition-colors ${
                      isFocusedQuestion
                        ? 'border-theme-accent shadow-brutal-sm'
                        : 'border-line'
                    }`}
                  >
                    <legend className="px-1 text-sm font-medium text-ink">
                      <span className="mr-2 font-mono text-xs text-muted tabular-nums">
                        {qIdx + 1}.
                      </span>
                      {q.prompt}
                    </legend>

                    <div className="mt-3 space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const selected = answers[q.id] === optIdx;
                        const isCorrectOption = fb && fb.correctIndex === optIdx;
                        const isWrongSelected = fb && selected && !fb.isCorrect;

                        return (
                          <motion.label
                            key={optIdx}
                            layout
                            whileTap={{ scale: 0.992 }}
                            className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                              isCorrectOption
                                ? 'border-success/70 bg-success/10 text-ink'
                                : isWrongSelected
                                ? 'border-danger/70 bg-danger-surface/50 text-danger-text'
                                : selected
                                ? 'border-accent bg-elevated text-ink'
                                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={optIdx}
                              checked={selected}
                              onChange={() => handleSelectOption(q.id, qIdx, optIdx)}
                              className="h-4 w-4 accent-accent"
                            />
                            <span className="flex-1">{opt}</span>
                          </motion.label>
                        );
                      })}
                    </div>

                    {fb && (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        className="mt-3 flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-xs"
                      >
                        {fb.isCorrect ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                        )}
                        <p className="leading-relaxed text-muted">{fb.explanation}</p>
                      </motion.div>
                    )}
                  </motion.fieldset>
                );
              })}
            </AnimatePresence>
          </div>

          {errorMsg && (
            <div role="alert" className="rounded-lg border border-danger/50 bg-danger-surface/40 px-4 py-2.5 text-xs text-danger-text">
              {errorMsg}
            </div>
          )}

          <div data-print-hide="assessment-actions" className="no-print flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {locale === 'uz'
                  ? 'Javob kalitlari xavfsiz tarzda faqat serverda tekshiriladi.'
                  : 'Answer keys remain protected server-side until submission.'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(result && !result.passed) || remainingSeconds === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setResult(null);
                    setActiveQuestionIndex(0);
                    setRemainingSeconds(totalDurationSeconds);
                    setAutoSubmittedNotice(null);
                    autoSubmitTriggeredRef.current = false;
                  }}
                  data-testid="assessment-reset-retry-btn"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-4 py-2 text-sm font-medium text-ink"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'Qayta urinish' : 'Reset Answers'}</span>
                </button>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? locale === 'uz'
                      ? 'Tekshirilmoqda...'
                      : 'Grading...'
                    : isAuthenticated
                    ? locale === 'uz'
                      ? 'Natijani tekshirish'
                      : 'Submit Assessment'
                    : locale === 'uz'
                    ? 'Topshirish uchun kiring'
                    : 'Sign in to Submit'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </LayoutGroup>
    </section>
  );
};

