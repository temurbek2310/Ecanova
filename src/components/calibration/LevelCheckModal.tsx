'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Gauge, X } from 'lucide-react';
import type { CourseCatalogItem, LocaleCode, Subject } from '../../shared/types';
import { formatTemplate, t } from '../../lib/i18n';
import {
  calculatePlacementLevel,
  getLevelCheckCopy,
  getLevelCheckQuestions,
  getRecommendedCourses,
  gradeLevelCheckSelections,
  localizeText,
  markLevelCheckSkipped,
  saveLevelCheckResult,
  tierLabel,
  type LevelCheckState,
  type LevelCheckTier,
  type PlacementResult,
} from '../../lib/level-check';
import { InteractiveDotGrid } from '../ui/InteractiveDotGrid';

type Stage = 'intro' | 'quiz' | 'result';

export interface LevelCheckModalProps {
  locale: LocaleCode;
  subject: Subject;
  userId: string;
  courses: CourseCatalogItem[];
  /** Course the learner originally clicked; null when opened from Profile. */
  pendingCourse: CourseCatalogItem | null;
  onClose: () => void;
  onOpenCourse: (courseId: string) => void;
  onStateChange: (state: LevelCheckState) => void;
}

const TIER_PILL_CLASS: Record<LevelCheckTier, string> = {
  1: 'text-teal-700 dark:text-teal-300',
  2: 'text-sky-700 dark:text-sky-300',
  3: 'text-[#6B4FE0] dark:text-[#B9A6FF]',
};

const SECONDARY_BTN =
  'inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border-2 border-slate-500 bg-white/55 px-4 py-2 text-xs font-bold text-ink transition-colors hover:border-slate-900 hover:bg-slate-900/10 hover:text-slate-950 dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:bg-[#9274FF]/10 dark:hover:text-ink';

const PRIMARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-[#9274FF] px-5 py-2.5 text-sm font-extrabold text-white shadow-[4px_4px_0px_#090D16] transition-colors hover:bg-[#7F5FF5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#090D16] dark:shadow-[4px_4px_0px_#000000]';

export const LevelCheckModal: React.FC<LevelCheckModalProps> = ({
  locale,
  subject,
  userId,
  courses,
  pendingCourse,
  onClose,
  onOpenCourse,
  onStateChange,
}) => {
  const copy = getLevelCheckCopy(locale);
  const strings = t(locale);
  const subjectLabel = strings.subjects[subject];
  const questions = useMemo(() => getLevelCheckQuestions(subject), [subject]);

  const [stage, setStage] = useState<Stage>(pendingCourse ? 'intro' : 'quiz');
  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [stepVisible, setStepVisible] = useState(true);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const question = questions[index];
  const selected = question ? selections[question.id] : undefined;
  const isLast = index === questions.length - 1;

  useEffect(() => {
    dialogRef.current?.focus();
    return () => {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const recommendations = useMemo(
    () => (result ? getRecommendedCourses(courses, subject, result.level).slice(0, 4) : []),
    [courses, subject, result]
  );
  const isFallback = Boolean(result && recommendations.length > 0 && recommendations[0].level !== result.level);

  const courseTitle = useCallback(
    (course: CourseCatalogItem) =>
      course.editions[locale]?.title || course.editions.en?.title || course.editions.uz?.title || course.slug,
    [locale]
  );

  const handleSkip = useCallback(() => {
    onStateChange(markLevelCheckSkipped(userId, subject));
    if (pendingCourse) onOpenCourse(pendingCourse.id);
    else onClose();
  }, [onClose, onOpenCourse, onStateChange, pendingCourse, subject, userId]);

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (!question || !stepVisible) return;
      setSelections((prev) => ({ ...prev, [question.id]: optionIndex }));
    },
    [question, stepVisible]
  );

  const handleNext = useCallback(() => {
    if (!question || selected === undefined || !stepVisible) return;
    if (isLast) {
      const placement = calculatePlacementLevel(gradeLevelCheckSelections(subject, selections));
      onStateChange(saveLevelCheckResult(userId, subject, placement));
      setResult(placement);
      setStage('result');
      return;
    }
    setStepVisible(false);
    transitionTimerRef.current = window.setTimeout(() => {
      setIndex((i) => i + 1);
      setStepVisible(true);
    }, 140);
  }, [isLast, onStateChange, question, selected, selections, stepVisible, subject, userId]);

  const handleStartRecommended = useCallback(() => {
    const top = recommendations[0];
    if (top) onOpenCourse(top.id);
  }, [onOpenCourse, recommendations]);

  // Keyboard: 1–4 pick, Enter advance, Esc close.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (stage === 'quiz') {
        if (/^[1-4]$/.test(event.key)) {
          event.preventDefault();
          handleSelect(Number(event.key) - 1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          handleNext();
        }
      } else if (stage === 'intro' && event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'BUTTON') return; // let the focused button handle it
        event.preventDefault();
        setStage('quiz');
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handleNext, handleSelect, onClose, stage]);

  const telemetry =
    stage === 'quiz'
      ? formatTemplate(copy.telemetryRunner, {
          subject: subjectLabel.toUpperCase(),
          current: String(index + 1).padStart(2, '0'),
          total: String(questions.length).padStart(2, '0'),
        })
      : stage === 'result'
      ? formatTemplate(copy.telemetryResult, { subject: subjectLabel.toUpperCase() })
      : formatTemplate(copy.telemetryIntro, { subject: subjectLabel.toUpperCase() });

  const pendingIsHigherLevel = Boolean(pendingCourse && pendingCourse.level !== 'Beginner');

  const content = (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4"
      data-testid="level-check-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-check-title"
        tabIndex={-1}
        data-testid="level-check-modal"
        className="relative my-auto w-full max-w-xl overflow-hidden rounded-xl border-2 border-slate-500 bg-white/30 p-6 shadow-[8px_8px_0px_#9274FF] outline-none backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/35"
      >
        <InteractiveDotGrid testId="level-check-dot-grid" />
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-bold tracking-wider text-slate-700 dark:text-slate-300">
                {telemetry}
              </div>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-md border-2 border-slate-900 bg-white/70 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_#9274FF] dark:border-[#9274FF] dark:bg-[#080B14]/70 dark:text-ink">
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                {subjectLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              data-testid="level-check-close-btn"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-slate-500 bg-white/55 text-ink transition-colors hover:border-slate-900 hover:bg-slate-900/10 dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Stage 1 — Soft-gate intro */}
          {stage === 'intro' && (
            <div className="mt-5" data-testid="level-check-intro">
              <h2 id="level-check-title" className="text-xl font-extrabold text-ink">
                {copy.introTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {pendingIsHigherLevel && pendingCourse
                  ? formatTemplate(copy.introHigherLevel, {
                      course: courseTitle(pendingCourse),
                      level: strings.levels[pendingCourse.level],
                    })
                  : formatTemplate(copy.introBody, { subject: subjectLabel })}
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setStage('quiz')}
                  data-testid="level-check-start-btn"
                  className={PRIMARY_BTN}
                >
                  <span>{copy.startCheck}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  data-testid="level-check-skip-btn"
                  className="min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 underline-offset-4 transition-colors hover:bg-slate-900/5 hover:text-slate-950 hover:underline dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-ink"
                >
                  {pendingCourse ? copy.skipToCourse : copy.skipNoCourse}
                </button>
              </div>
            </div>
          )}

          {/* Stage 2 — 6-question runner */}
          {stage === 'quiz' && question && (
            <div className="mt-5" data-testid="level-check-runner">
              <div className="flex items-center gap-3">
                <div className="flex flex-1 gap-1.5" aria-hidden="true">
                  {questions.map((q, i) => (
                    <span
                      key={q.id}
                      className={`h-2.5 flex-1 rounded-sm border-2 border-slate-700 transition-colors dark:border-[#2C3650] ${
                        i < index ? 'bg-[#9274FF]' : i === index ? 'bg-[#9274FF]/45' : 'bg-white/40 dark:bg-white/5'
                      }`}
                    />
                  ))}
                </div>
                <span
                  data-testid="level-check-tier-pill"
                  className={`shrink-0 rounded-md border-2 border-slate-500 bg-white/60 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider dark:border-[#222B3D] dark:bg-[#080B14]/70 ${TIER_PILL_CLASS[question.tier]}`}
                >
                  {tierLabel(copy, question.tier)}
                </span>
              </div>

              <div className={`transition-opacity duration-150 ${stepVisible ? 'opacity-100' : 'opacity-0'}`}>
                <h2 id="level-check-title" className="mt-5 text-base font-bold leading-snug text-ink sm:text-lg">
                  {localizeText(question.prompt, locale)}
                </h2>
                <div className="mt-4 grid gap-2.5" role="radiogroup" aria-labelledby="level-check-title">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = selected === optionIndex;
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleSelect(optionIndex)}
                        data-testid={`level-check-option-${optionIndex}`}
                        className={`flex min-h-[46px] w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                          isSelected
                            ? 'border-[#9274FF] bg-[#9274FF]/15 text-slate-950 shadow-[3px_3px_0px_#9274FF] dark:bg-[#9274FF]/20 dark:text-ink'
                            : 'border-slate-500 bg-white/55 text-ink hover:border-slate-900 hover:bg-slate-900/10 hover:text-slate-950 dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:bg-[#9274FF]/10 dark:hover:text-ink'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 font-mono text-[11px] font-extrabold ${
                            isSelected
                              ? 'border-[#9274FF] bg-[#9274FF] text-white'
                              : 'border-slate-500 text-slate-700 dark:border-[#2C3650] dark:text-slate-300'
                          }`}
                        >
                          {optionIndex + 1}
                        </span>
                        <span>{localizeText(option, locale)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <span className="hidden font-mono text-[10px] text-slate-600 sm:inline dark:text-slate-400">
                  {copy.keyboardHint}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={selected === undefined}
                  data-testid="level-check-next-btn"
                  className={`${PRIMARY_BTN} ml-auto`}
                >
                  <span>{isLast ? copy.finish : copy.next}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Stage 3 — Result & recommendations */}
          {stage === 'result' && result && (
            <div className="mt-5" data-testid="level-check-result">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                    {copy.resultTitle}
                  </div>
                  <h2
                    id="level-check-title"
                    data-testid="level-check-placed-level"
                    className="mt-2 inline-flex rounded-lg border-2 border-slate-900 bg-[#9274FF] px-4 py-1.5 text-xl font-extrabold text-white shadow-[4px_4px_0px_#090D16] dark:border-[#090D16] dark:shadow-[4px_4px_0px_#000000]"
                  >
                    {strings.levels[result.level]}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                    {copy.scoreLabel}
                  </div>
                  <div className="font-mono text-2xl font-extrabold tabular-nums text-ink" data-testid="level-check-score">
                    {result.score} / {result.total}
                  </div>
                </div>
              </div>

              {/* Mini 3-tier breakdown */}
              <div className="mt-5 grid grid-cols-3 gap-2.5" data-testid="level-check-tier-breakdown">
                {([1, 2, 3] as LevelCheckTier[]).map((tier) => {
                  const entry = result.tierBreakdown[tier];
                  return (
                    <div
                      key={tier}
                      className="rounded-lg border-2 border-slate-500 bg-white/55 p-2.5 dark:border-[#222B3D] dark:bg-[#080B14]/60"
                    >
                      <div className={`font-mono text-[10px] font-extrabold uppercase tracking-wider ${TIER_PILL_CLASS[tier]}`}>
                        {tierLabel(copy, tier)}
                      </div>
                      <div className="mt-2 flex gap-1" aria-hidden="true">
                        {Array.from({ length: entry.total }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-2 flex-1 rounded-sm border-2 border-slate-700 dark:border-[#2C3650] ${
                              i < entry.correct ? 'bg-[#9274FF]' : 'bg-white/40 dark:bg-white/5'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="mt-1.5 font-mono text-xs font-bold tabular-nums text-ink">
                        {entry.correct} / {entry.total}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-bold text-ink">{copy.recommendedHeading}</h3>
                {isFallback && (
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{copy.fallbackNote}</p>
                )}
                {recommendations.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{copy.noCourses}</p>
                ) : (
                  <ul className="mt-2 grid gap-2">
                    {recommendations.map((course) => (
                      <li key={course.id}>
                        <button
                          type="button"
                          onClick={() => onOpenCourse(course.id)}
                          data-testid={`level-check-rec-${course.id}`}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border-2 border-slate-500 bg-white/55 px-3 py-2.5 text-left transition-colors hover:border-slate-900 hover:bg-slate-900/10 dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:bg-[#9274FF]/10"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-ink">{courseTitle(course)}</span>
                            <span className="block text-[11px] text-slate-600 dark:text-slate-400">
                              {strings.levels[course.level]} · {course.estimatedMinutes} {strings.overview.minUnit}
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-theme-accent" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleStartRecommended}
                  disabled={recommendations.length === 0}
                  data-testid="level-check-start-recommended-btn"
                  className={PRIMARY_BTN}
                >
                  <span>{copy.startRecommended}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                {pendingCourse ? (
                  <button
                    type="button"
                    onClick={() => onOpenCourse(pendingCourse.id)}
                    data-testid="level-check-open-original-btn"
                    className="min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 underline underline-offset-4 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-ink"
                  >
                    {copy.openOriginal}
                  </button>
                ) : (
                  <button type="button" onClick={onClose} className={SECONDARY_BTN}>
                    {copy.close}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};
