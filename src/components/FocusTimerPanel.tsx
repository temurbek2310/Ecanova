import React, { useEffect, useId, useRef } from 'react';
import gsap from 'gsap';
import {
  Bell,
  BellOff,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { LocaleCode } from '../shared/types';
import type { AmbientFocusAudioController } from '../hooks/useAmbientFocusAudio';
import type { FocusTimerController } from '../hooks/useFocusTimer';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import { notificationCopy } from '../lib/notification-copy';
import { notify } from '../lib/notifications';
import {
  FOCUS_DURATION_OPTIONS,
  getBreakMinutesForSession,
  type FocusDurationMinutes,
} from '../lib/focus-timer';

interface FocusTimerCopy {
  title: string;
  subtitle: string;
  phaseFocus: string;
  phaseBreak: string;
  start: string;
  pause: string;
  resume: string;
  reset: string;
  startBreak: string;
  nextFocus: string;
  durationLabel: string;
  syncAudioLabel: string;
  syncAudioHint: string;
  audioActive: string;
  audioStandby: string;
  chimeOn: string;
  chimeOff: string;
  audioControlsBtn: string;
  completedBannerFocus: string;
  completedBannerBreak: string;
  todaySummary: (blocks: number, minutes: number) => string;
  breakBadge: (mins: number) => string;
  lessonContextLabel: string;
}

export function getFocusTimerCopy(locale: LocaleCode): FocusTimerCopy {
  if (locale === 'uz') {
    return {
      title: 'Fokus taymeri',
      subtitle: 'Darslarni izchil yakunlash uchun 25 yoki 50 daqiqalik Pomodoro sessiyalari.',
      phaseFocus: 'Fokus',
      phaseBreak: 'Tanaffus',
      start: 'Boshlash',
      pause: 'Pauza',
      resume: 'Davom ettirish',
      reset: 'Qayta',
      startBreak: 'Tanaffusni boshlash',
      nextFocus: 'Yangi fokus bloki',
      durationLabel: 'Sessiya davomiyligi',
      syncAudioLabel: 'Ambient audio bilan sinxronlash',
      syncAudioHint: 'Fokus boshlanganda muzlik tovushini yoqadi, pauza va tanaffusda o‘chiradi.',
      audioActive: 'Audio faol',
      audioStandby: 'Audio o‘chiq',
      chimeOn: 'Yakuniy signal: Yoqilgan',
      chimeOff: 'Yakuniy signal: O‘chiq',
      audioControlsBtn: 'Audio sozlamalari',
      completedBannerFocus: 'Fokus sessiyasi yakunlandi. Qisqa tanaffus oling.',
      completedBannerBreak: 'Tanaffus tugadi. Keyingi dars blokiga tayyormisiz?',
      todaySummary: (blocks, minutes) =>
        `Bugun: ${blocks} blok · ${minutes} daqiqa`,
      breakBadge: (mins) => `${mins} daq tanaffus`,
      lessonContextLabel: 'Faol dars',
    };
  }

  return {
    title: 'Focus Timer',
    subtitle: 'Structured 25m or 50m Pomodoro intervals synchronized with glacial ambient audio.',
    phaseFocus: 'Focus',
    phaseBreak: 'Break',
    start: 'Start Focus',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    startBreak: 'Start Break',
    nextFocus: 'Next Focus Block',
    durationLabel: 'Session Duration',
    syncAudioLabel: 'Sync Ambient Audio',
    syncAudioHint: 'Starts glacial soundscape on Focus start; fades out on pause or break.',
    audioActive: 'Soundscape Active',
    audioStandby: 'Soundscape Off',
    chimeOn: 'Completion Chime On',
    chimeOff: 'Completion Chime Off',
    audioControlsBtn: 'Audio Controls',
    completedBannerFocus: 'Focus session complete. Take a short break before your next lesson.',
    completedBannerBreak: 'Break complete. Ready for your next focused study block.',
    todaySummary: (blocks, minutes) =>
      `Today: ${blocks} ${blocks === 1 ? 'block' : 'blocks'} · ${minutes} min`,
    breakBadge: (mins) => `${mins}m break`,
    lessonContextLabel: 'Active Lesson',
  };
}

interface FocusTimerPanelProps {
  locale: LocaleCode;
  timer: FocusTimerController;
  audio: AmbientFocusAudioController;
  variant?: 'card' | 'popover' | 'lesson-bar';
  lessonTitle?: string;
  onOpenAudioTab?: () => void;
}

export const FocusTimerPanel: React.FC<FocusTimerPanelProps> = ({
  locale,
  timer,
  audio,
  variant = 'card',
  lessonTitle,
  onOpenAudioTab,
}) => {
  const copy = getFocusTimerCopy(locale);
  const syncSwitchId = useId();
  const clockRef = useRef<HTMLDivElement | null>(null);

  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isCompleted = timer.status === 'completed';
  const isBreak = timer.phase === 'break';

  const testPrefix =
    variant === 'popover'
      ? 'popover-timer'
      : variant === 'lesson-bar'
      ? 'lesson-timer'
      : 'card-timer';

  // Tactile GSAP scale pulse whenever session duration or phase switches
  useEconovaGSAP(
    clockRef,
    () => {
      if (!clockRef.current) return;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      gsap.fromTo(
        clockRef.current,
        { scale: 0.96, opacity: 0.85 },
        { scale: 1, opacity: 1, duration: 0.22, ease: 'power3.out', overwrite: 'auto' }
      );
    },
    [timer.durationMinutes, timer.phase]
  );

  const primaryButtonLabel = isRunning
    ? copy.pause
    : isPaused
    ? copy.resume
    : isBreak
    ? copy.startBreak
    : copy.start;

  const progressPercent = Math.round(timer.progress * 100);
  const displayLesson = lessonTitle || timer.activeLessonTitle;

  if (variant === 'lesson-bar') {
    return (
      <div
        data-testid="lesson-focus-timer-bar"
        className="no-print mt-3 rounded-xl border-2 border-slate-500 bg-white/40 p-3 shadow-[5px_5px_0px_#000000] backdrop-blur-xl dark:border-[#222B3D] dark:bg-[#080B14]/85"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Clock + Phase */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black ${
                isBreak
                  ? 'bg-[#9274FF] text-black'
                  : isRunning
                  ? 'bg-[#5DE1D2] text-black'
                  : 'bg-theme-base text-ink'
              }`}
            >
              {isBreak ? (
                <Coffee className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Timer className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  {isBreak ? copy.phaseBreak : copy.phaseFocus}
                </span>
                <span className="font-mono text-[11px] font-semibold text-muted tabular-nums">
                  {timer.durationMinutes}m / {timer.breakMinutes}m
                </span>
              </div>
              <div
                ref={clockRef}
                data-testid={`${testPrefix}-clock`}
                className="font-mono text-2xl font-black leading-none tracking-tight tabular-nums text-ink"
              >
                {timer.formattedClock}
              </div>
            </div>
          </div>

          {/* 25m / 50m Duration Toggle */}
          <div
            role="group"
            aria-label={copy.durationLabel}
            className="inline-flex rounded-lg border-2 border-theme-border bg-theme-panel p-0.5"
          >
            {FOCUS_DURATION_OPTIONS.map((mins) => {
              const active = timer.durationMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  aria-pressed={active}
                  onClick={() => timer.selectDuration(mins)}
                  data-testid={`${testPrefix}-duration-${mins}`}
                  className={`min-h-[32px] rounded-md px-2.5 font-mono text-xs font-bold transition-colors ${
                    active
                      ? 'border border-black bg-[#5DE1D2] text-black shadow-[2px_2px_0px_#000000]'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {mins}m
                </button>
              );
            })}
          </div>

          {/* Controls + Audio Sync */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={timer.toggleStartPause}
              data-testid={`${testPrefix}-toggle`}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 border-black px-3 py-1.5 text-xs font-bold shadow-[3px_3px_0px_#000000] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                isRunning
                  ? 'bg-[#9274FF] text-black'
                  : 'bg-[#5DE1D2] text-black'
              }`}
            >
              {isRunning ? (
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{primaryButtonLabel}</span>
            </button>

            <button
              type="button"
              onClick={timer.reset}
              aria-label={copy.reset}
              title={copy.reset}
              data-testid={`${testPrefix}-reset`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-theme-border bg-theme-base text-muted shadow-brutal-sm hover:border-theme-accent hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => timer.setAutoSyncAudio(!timer.autoSyncAudio)}
              aria-pressed={timer.autoSyncAudio}
              data-testid={`${testPrefix}-audio-sync`}
              title={copy.syncAudioHint}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-xs font-semibold shadow-brutal-sm transition-colors ${
                timer.autoSyncAudio
                  ? 'border-black bg-[#5DE1D2]/20 text-ink dark:border-[#5DE1D2] dark:text-[#5DE1D2]'
                  : 'border-theme-border bg-theme-base text-muted hover:text-ink'
              }`}
            >
              {audio.isPlaying ? (
                <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {locale === 'uz' ? 'Audio sinx.' : 'Audio Sync'}
              </span>
            </button>
          </div>
        </div>

        {/* Crisp progress track */}
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={copy.title}
          className="mt-2.5 h-2 w-full overflow-hidden rounded-sm border border-black bg-slate-200 dark:bg-[#101522]"
        >
          <div
            className={`h-full transition-[width] duration-300 ease-out ${
              isBreak ? 'bg-[#9274FF]' : 'bg-[#5DE1D2]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  const isPopover = variant === 'popover';

  const outerClasses = isPopover
    ? 'space-y-3.5'
    : 'space-y-4 rounded-xl border-2 border-slate-500 bg-white/25 p-4 sm:p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25';

  return (
    <section
      data-testid={isPopover ? 'header-focus-timer-panel' : 'sidebar-focus-timer-card'}
      aria-label={copy.title}
      className={outerClasses}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 border-b-2 border-slate-300/80 pb-3 dark:border-[#222B3D]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Timer
              className={`h-4 w-4 shrink-0 ${
                isRunning
                  ? isBreak
                    ? 'text-[#9274FF]'
                    : 'text-[#5DE1D2]'
                  : 'text-muted'
              }`}
              aria-hidden="true"
            />
            <h2
              className={`${
                isPopover ? 'text-sm' : 'text-base'
              } font-semibold tracking-tight text-ink`}
            >
              {copy.title}
            </h2>
          </div>
          {!isPopover && (
            <p className="mt-1 text-xs leading-relaxed text-muted">{copy.subtitle}</p>
          )}
        </div>

        {/* Phase Switcher (Focus / Break) */}
        <div
          role="group"
          aria-label="Timer phase"
          className="inline-flex shrink-0 rounded-lg border-2 border-theme-border bg-theme-base p-0.5 text-[11px]"
        >
          <button
            type="button"
            aria-pressed={!isBreak}
            onClick={() => timer.selectPhase('focus')}
            data-testid={`${testPrefix}-phase-focus`}
            className={`rounded-md px-2 py-1 font-bold transition-colors ${
              !isBreak
                ? 'bg-[#5DE1D2] text-black'
                : 'text-muted hover:text-ink'
            }`}
          >
            {copy.phaseFocus}
          </button>
          <button
            type="button"
            aria-pressed={isBreak}
            onClick={() => timer.selectPhase('break')}
            data-testid={`${testPrefix}-phase-break`}
            className={`rounded-md px-2 py-1 font-bold transition-colors ${
              isBreak
                ? 'bg-[#9274FF] text-black'
                : 'text-muted hover:text-ink'
            }`}
          >
            {copy.phaseBreak}
          </button>
        </div>
      </div>

      {/* Active Lesson Context (when inside a course) */}
      {displayLesson && (
        <div className="rounded-lg border border-slate-400/70 bg-white/40 px-3 py-1.5 text-[11px] dark:border-[#222B3D] dark:bg-[#080B14]/70">
          <span className="font-mono uppercase tracking-wider text-muted">
            {copy.lessonContextLabel}:{' '}
          </span>
          <span className="font-semibold text-ink">{displayLesson}</span>
        </div>
      )}

      {/* Quantitative Countdown Display & Precision Progress Track */}
      <div className="rounded-lg border-2 border-slate-400/80 bg-slate-100/80 p-4 dark:border-[#222B3D] dark:bg-[#080B14]/90">
        <div className="flex items-end justify-between gap-2">
          <div
            ref={clockRef}
            data-testid={`${testPrefix}-clock`}
            className="font-mono text-4xl font-black leading-none tracking-tight tabular-nums text-ink"
          >
            {timer.formattedClock}
          </div>
          <div className="text-right">
            <div
              data-testid={`${testPrefix}-status-label`}
              className={`font-mono text-[11px] font-bold uppercase tracking-wider ${
                isRunning
                  ? isBreak
                    ? 'text-[#5D3FD3] dark:text-[#9274FF]'
                    : 'text-[#0E7C70] dark:text-[#5DE1D2]'
                  : isCompleted
                  ? 'text-emerald-700 dark:text-[#6FE0A1]'
                  : 'text-muted'
              }`}
            >
              {isRunning
                ? isBreak
                  ? copy.phaseBreak
                  : copy.phaseFocus
                : isPaused
                ? copy.pause
                : isCompleted
                ? locale === 'uz'
                  ? 'YAKUNLANDI'
                  : 'COMPLETE'
                : locale === 'uz'
                ? 'TAYYOR'
                : 'READY'}
            </div>
            <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
              {progressPercent}%
            </div>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={copy.title}
          className="mt-3 h-2.5 w-full overflow-hidden rounded-sm border-2 border-black bg-slate-200 dark:bg-[#101522]"
        >
          <div
            className={`h-full transition-[width] duration-300 ease-out ${
              isBreak ? 'bg-[#9274FF]' : 'bg-[#5DE1D2]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Session Duration Selector (25m / 50m) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">{copy.durationLabel}</span>
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {copy.breakBadge(getBreakMinutesForSession(timer.durationMinutes))}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label={copy.durationLabel}
          className="grid grid-cols-2 gap-2"
        >
          {FOCUS_DURATION_OPTIONS.map((mins: FocusDurationMinutes) => {
            const active = timer.durationMinutes === mins;
            const breakMins = getBreakMinutesForSession(mins);
            return (
              <button
                key={mins}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => timer.selectDuration(mins)}
                data-testid={`${testPrefix}-duration-${mins}`}
                className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 text-left transition-all ${
                  active
                    ? 'border-black bg-[#5DE1D2]/20 text-ink shadow-[3px_3px_0px_#000000] dark:border-[#5DE1D2] dark:bg-[#5DE1D2]/15'
                    : 'border-slate-400/70 bg-white/55 text-muted hover:border-slate-600 hover:text-ink dark:border-[#222B3D] dark:bg-[#080B14]/70 dark:hover:border-[#5DE1D2]/60'
                }`}
              >
                <span className="font-mono text-sm font-black tabular-nums text-ink">
                  {mins}m
                </span>
                <span className="font-mono text-[10px] font-semibold tabular-nums text-muted">
                  +{breakMins}m
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Transport Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={timer.toggleStartPause}
          data-testid={`${testPrefix}-toggle`}
          className={`inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border-2 border-black px-4 py-2 text-xs font-bold shadow-[4px_4px_0px_#000000] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
            isRunning
              ? 'bg-[#9274FF] text-black'
              : 'bg-[#5DE1D2] text-black'
          }`}
        >
          {isRunning ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{primaryButtonLabel}</span>
        </button>

        <button
          type="button"
          onClick={timer.reset}
          aria-label={copy.reset}
          title={copy.reset}
          data-testid={`${testPrefix}-reset`}
          className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg border-2 border-theme-border bg-theme-base text-muted shadow-brutal-sm transition-colors hover:border-theme-accent hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => timer.setPlayCompletionChime(!timer.playCompletionChime)}
          aria-pressed={timer.playCompletionChime}
          aria-label={timer.playCompletionChime ? copy.chimeOn : copy.chimeOff}
          title={timer.playCompletionChime ? copy.chimeOn : copy.chimeOff}
          data-testid={`${testPrefix}-chime-toggle`}
          className={`inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg border-2 shadow-brutal-sm transition-colors ${
            timer.playCompletionChime
              ? 'border-black bg-white/75 text-ink dark:border-[#222B3D] dark:bg-[#080B14] dark:text-[#6FE0A1]'
              : 'border-theme-border bg-theme-base text-muted'
          }`}
        >
          {timer.playCompletionChime ? (
            <Bell className="h-4 w-4" aria-hidden="true" />
          ) : (
            <BellOff className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Ambient Audio Integration Strip */}
      <div className="rounded-lg border-2 border-slate-400/70 bg-white/50 p-3 dark:border-[#222B3D] dark:bg-[#080B14]/75">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div id={syncSwitchId} className="text-xs font-semibold text-ink">
              {copy.syncAudioLabel}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">
              {copy.syncAudioHint}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={timer.autoSyncAudio}
            aria-labelledby={syncSwitchId}
            onClick={() => timer.setAutoSyncAudio(!timer.autoSyncAudio)}
            data-testid={`${testPrefix}-audio-sync-switch`}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-md border-2 border-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5DE1D2] ${
              timer.autoSyncAudio
                ? 'bg-[#5DE1D2] shadow-[2px_2px_0px_#000000]'
                : 'bg-slate-200 dark:bg-[#101522]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-3.5 w-3.5 rounded-sm border border-black transition-transform duration-200 ${
                timer.autoSyncAudio
                  ? 'translate-x-5 bg-[#080B14]'
                  : 'translate-x-1 bg-slate-500 dark:bg-slate-400'
              }`}
            />
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-300/70 pt-2 dark:border-[#222B3D]">
          <button
            type="button"
            onClick={() => void audio.togglePlay()}
            data-testid={`${testPrefix}-manual-audio-toggle`}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink hover:text-[#0E7C70] dark:hover:text-[#5DE1D2]"
          >
            {audio.isPlaying ? (
              <Volume2 className="h-3.5 w-3.5 text-[#0E7C70] dark:text-[#5DE1D2]" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            )}
            <span>{audio.isPlaying ? copy.audioActive : copy.audioStandby}</span>
            {audio.isPlaying && (
              <span className="font-mono text-[10px] tabular-nums text-muted">
                · {Math.round(audio.settings.volume * 100)}%
              </span>
            )}
          </button>

          {onOpenAudioTab && (
            <button
              type="button"
              onClick={onOpenAudioTab}
              data-testid={`${testPrefix}-open-audio-tab`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-400/80 px-2 py-0.5 font-mono text-[10px] font-bold text-muted transition-colors hover:border-[#5DE1D2] hover:text-ink dark:border-[#222B3D]"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              <span>{copy.audioControlsBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quantitative Daily Session Footer */}
      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-muted">
        <span data-testid={`${testPrefix}-today-summary`}>
          {copy.todaySummary(
            timer.completedSessionsToday,
            timer.completedFocusMinutesToday
          )}
        </span>
        <span>{timer.durationMinutes}m / {timer.breakMinutes}m</span>
      </div>
    </section>
  );
};

export const FOCUS_TIMER_COMPLETE_NOTIFICATION_ID = 'focus-timer-complete';

/**
 * Announces a finished focus/break session as a HUD toast with the follow-up
 * action, once per completion, regardless of which timer panel is mounted.
 */
export function useFocusTimerCompletionToast(timer: FocusTimerController, locale: LocaleCode): void {
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const wasCompletedRef = useRef(timer.status === 'completed');

  useEffect(() => {
    const isCompleted = timer.status === 'completed';
    if (isCompleted && !wasCompletedRef.current) {
      const copy = getFocusTimerCopy(locale);
      const toastCopy = notificationCopy(locale);
      const isBreak = timer.phase === 'break';
      notify.success(
        isBreak ? toastCopy.focus.breakComplete : toastCopy.focus.focusComplete,
        isBreak ? copy.completedBannerBreak : copy.completedBannerFocus,
        {
          id: FOCUS_TIMER_COMPLETE_NOTIFICATION_ID,
          durationMs: 12000,
          action: {
            label: isBreak ? copy.nextFocus : `${copy.startBreak} (${timer.breakMinutes}m)`,
            onAction: () => {
              const current = timerRef.current;
              current.selectPhase(current.phase === 'break' ? 'focus' : 'break');
              current.start();
            },
          },
        }
      );
    }
    if (!isCompleted && wasCompletedRef.current) {
      notify.dismiss(FOCUS_TIMER_COMPLETE_NOTIFICATION_ID);
    }
    wasCompletedRef.current = isCompleted;
  }, [timer.status, timer.phase, timer.breakMinutes, locale]);
}
