import React, { useEffect, useState } from 'react';
import { CheckCircle2, Target } from 'lucide-react';
import type { LocaleCode } from '../shared/types';
import { t } from '../lib/i18n';
import {
  DAILY_GOAL_PRESETS,
  MAX_DAILY_GOAL_MINUTES,
  MIN_DAILY_GOAL_MINUTES,
  evaluateDailyGoalProgress,
  parseDailyGoalMinutes,
} from '../lib/study-goal';
import { FloatingWatermark } from './FloatingWatermark';

interface DailyStudyGoalCardProps {
  locale: LocaleCode;
  isAuthenticated: boolean;
  completedMinutesToday: number;
  targetMinutes: number;
  onUpdateTarget: (nextTargetMinutes: number) => Promise<void>;
  onRequireAuth: () => void;
}

const RING_RADIUS = 52;
const RING_STROKE = 10;
const SVG_SIZE = 132;
const CENTER = SVG_SIZE / 2;

export const DailyStudyGoalCard: React.FC<DailyStudyGoalCardProps> = ({
  locale,
  isAuthenticated,
  completedMinutesToday,
  targetMinutes,
  onUpdateTarget,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const [inputValue, setInputValue] = useState(String(targetMinutes));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setInputValue(String(targetMinutes));
  }, [targetMinutes]);

  const progress = evaluateDailyGoalProgress({
    completedMinutes: isAuthenticated ? completedMinutesToday : 0,
    targetMinutes,
    radius: RING_RADIUS,
  });

  const commitGoal = async (rawValue: unknown) => {
    setErrorMsg(null);
    setSavedNotice(false);
    const parsed = parseDailyGoalMinutes(rawValue);
    if (!parsed.valid) {
      setErrorMsg(parsed.error || 'Invalid study goal.');
      return;
    }

    setSaving(true);
    try {
      await onUpdateTarget(parsed.value);
      setInputValue(String(parsed.value));
      setSavedNotice(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save study goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await commitGoal(inputValue);
  };

  return (
    <section
      aria-labelledby="daily-study-goal-title"
      className="relative flex flex-col justify-between overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl sm:p-6 dark:border-[#222B3D] dark:bg-[#101522]/40"
      data-testid="daily-study-goal-card"
    >
      <FloatingWatermark
        theme="analytics"
        seedIndex={0}
        testId="daily-goal-floating-watermark"
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2
              id="daily-study-goal-title"
              className="flex items-center gap-2 text-base font-semibold text-ink"
            >
              <Target className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>{strings.dailyGoal.title}</span>
            </h2>
            <p className="mt-1 text-xs text-muted">{strings.dailyGoal.subtitle}</p>
          </div>

          {progress.goalMet && (
            <span className="animate-milestone-pop inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{strings.dailyGoal.goalReached}</span>
            </span>
          )}
        </div>

        {/* Progress Ring & Summary Readout */}
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
          <div
            role="progressbar"
            aria-label={strings.dailyGoal.ringAriaLabel}
            aria-valuenow={progress.completedMinutes}
            aria-valuemin={0}
            aria-valuemax={progress.targetMinutes}
            className="relative flex h-[132px] w-[132px] shrink-0 items-center justify-center"
            data-testid="daily-goal-progressbar"
          >
            <svg
              width={SVG_SIZE}
              height={SVG_SIZE}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--econova-line)"
                strokeWidth={RING_STROKE}
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke={progress.goalMet ? 'var(--econova-success)' : 'var(--econova-teal)'}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={progress.circumference}
                strokeDashoffset={progress.strokeDashoffset}
                className="transition-[stroke-dashoffset,stroke] duration-500 ease-out"
                data-testid="daily-goal-ring-arc"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${
                  progress.goalMet ? 'text-success' : 'text-ink'
                }`}
                data-testid="daily-goal-percent"
              >
                {progress.percent}%
              </span>
              <span
                className="mt-0.5 font-mono text-[11px] tabular-nums text-muted"
                data-testid="daily-goal-minutes-readout"
              >
                {progress.completedMinutes} / {progress.targetMinutes} {strings.dailyGoal.minUnit}
              </span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border-2 border-slate-400 bg-white/50 px-3 py-2 backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55">
                <div className="text-[11px] text-muted">{strings.dailyGoal.studiedLabel}</div>
                <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-teal">
                  {progress.completedMinutes} {strings.dailyGoal.minUnit}
                </div>
              </div>
              <div className="rounded-lg border-2 border-slate-400 bg-white/50 px-3 py-2 backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55">
                <div className="text-[11px] text-muted">{strings.dailyGoal.targetSummaryLabel}</div>
                <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-ink">
                  {progress.targetMinutes} {strings.dailyGoal.minUnit}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted">
              {progress.goalMet ? (
                <span className="font-medium text-success">{strings.dailyGoal.goalReached}</span>
              ) : (
                <span>
                  <strong className="font-mono tabular-nums text-ink">
                    {progress.remainingMinutes}
                  </strong>{' '}
                  {strings.dailyGoal.remainingSuffix}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Controls */}
      <div className="relative z-10 mt-5 space-y-3 border-t border-line pt-4">
        <div>
          <div className="mb-2 text-[11px] font-medium text-muted">
            {strings.dailyGoal.presetsLabel}
          </div>
          <div className="flex flex-wrap gap-2">
            {DAILY_GOAL_PRESETS.map((preset) => {
              const active = targetMinutes === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={saving}
                  onClick={() => void commitGoal(preset)}
                  className={`min-h-[34px] rounded-lg border px-2.5 py-1 font-mono text-xs font-medium tabular-nums transition-colors ${
                    active
                      ? 'border-accent bg-elevated text-accent'
                      : 'border-line bg-chrome text-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {preset} {strings.dailyGoal.minUnit}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor="daily-goal-minutes-input"
              className="block text-[11px] font-medium text-muted"
            >
              {strings.dailyGoal.targetLabel}
            </label>
            <input
              id="daily-goal-minutes-input"
              type="number"
              min={MIN_DAILY_GOAL_MINUTES}
              max={MAX_DAILY_GOAL_MINUTES}
              step={1}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (errorMsg) setErrorMsg(null);
                if (savedNotice) setSavedNotice(false);
              }}
              className="mt-1 h-[38px] w-full rounded-lg border border-line bg-chrome px-3 font-mono text-xs tabular-nums text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-[38px] shrink-0 rounded-lg bg-accent px-4 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? strings.dailyGoal.saving : strings.dailyGoal.saveButton}
          </button>
        </form>

        {errorMsg && (
          <p role="alert" className="text-xs text-danger-text">
            {errorMsg}
          </p>
        )}

        {savedNotice && !errorMsg && (
          <p className="text-xs font-medium text-success" data-testid="daily-goal-saved-notice">
            {strings.dailyGoal.savedNotice}
          </p>
        )}

        {!isAuthenticated && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-chrome px-3 py-2 text-[11px]">
            <span className="text-muted">{strings.dailyGoal.guestHint}</span>
            <button
              type="button"
              onClick={onRequireAuth}
              className="font-semibold text-teal hover:underline"
            >
              {strings.signIn}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
