import type { StorageLike } from './ambient-audio';

export type FocusDurationMinutes = 25 | 50;
export type FocusTimerPhase = 'focus' | 'break';
export type FocusTimerStatus = 'idle' | 'running' | 'paused' | 'completed';
export type TimerAudioSyncAction = 'start' | 'stop' | 'none';

export interface FocusTimerPreferences {
  durationMinutes: FocusDurationMinutes;
  autoSyncAudio: boolean;
  playCompletionChime: boolean;
  dateKey: string;
  completedSessionsToday: number;
  completedFocusMinutesToday: number;
}

export const FOCUS_TIMER_STORAGE_KEY = 'econova:focus-timer-prefs:v1';
export const FOCUS_DURATION_OPTIONS: readonly FocusDurationMinutes[] = [25, 50];

export function isFocusDurationMinutes(value: unknown): value is FocusDurationMinutes {
  return value === 25 || value === 50;
}

export function getBreakMinutesForSession(durationMinutes: FocusDurationMinutes): number {
  return durationMinutes === 50 ? 10 : 5;
}

export function getPhaseTotalSeconds(
  phase: FocusTimerPhase,
  durationMinutes: FocusDurationMinutes
): number {
  const minutes =
    phase === 'focus' ? durationMinutes : getBreakMinutesForSession(durationMinutes);
  return minutes * 60;
}

export function formatTimerClock(remainingSeconds: number): string {
  const clamped = Number.isFinite(remainingSeconds)
    ? Math.max(0, Math.ceil(remainingSeconds))
    : 0;
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function computeTimerProgress(
  remainingSeconds: number,
  totalSeconds: number
): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  if (!Number.isFinite(remainingSeconds)) return 0;
  const elapsed = totalSeconds - Math.max(0, remainingSeconds);
  return Math.min(1, Math.max(0, elapsed / totalSeconds));
}

export function computeRemainingSecondsFromDeadline(
  deadlineMs: number,
  nowMs: number
): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/**
 * Pure transition rule determining how the Pomodoro Focus Timer drives
 * ECONOVA's ambient Web Audio soundscape when auto-sync is enabled.
 */
export function resolveAudioActionForTimerTransition(params: {
  prevStatus: FocusTimerStatus;
  nextStatus: FocusTimerStatus;
  phase: FocusTimerPhase;
  autoSyncAudio: boolean;
}): TimerAudioSyncAction {
  const { prevStatus, nextStatus, phase, autoSyncAudio } = params;
  if (!autoSyncAudio) return 'none';

  if (nextStatus === 'running' && phase === 'focus' && prevStatus !== 'running') {
    return 'start';
  }

  if (
    prevStatus === 'running' &&
    (nextStatus === 'paused' || nextStatus === 'idle' || nextStatus === 'completed')
  ) {
    return 'stop';
  }

  return 'none';
}

export function getLocalTodayDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createDefaultFocusTimerPreferences(
  todayKey: string = getLocalTodayDateKey()
): FocusTimerPreferences {
  return {
    durationMinutes: 25,
    autoSyncAudio: true,
    playCompletionChime: true,
    dateKey: todayKey,
    completedSessionsToday: 0,
    completedFocusMinutesToday: 0,
  };
}

export function sanitizeFocusTimerPreferences(
  raw: Partial<FocusTimerPreferences> | null | undefined,
  todayKey: string = getLocalTodayDateKey()
): FocusTimerPreferences {
  const defaults = createDefaultFocusTimerPreferences(todayKey);
  if (!raw || typeof raw !== 'object') return defaults;

  const isSameDay = typeof raw.dateKey === 'string' && raw.dateKey === todayKey;
  const completedSessionsToday =
    isSameDay &&
    typeof raw.completedSessionsToday === 'number' &&
    Number.isFinite(raw.completedSessionsToday)
      ? Math.max(0, Math.floor(raw.completedSessionsToday))
      : 0;
  const completedFocusMinutesToday =
    isSameDay &&
    typeof raw.completedFocusMinutesToday === 'number' &&
    Number.isFinite(raw.completedFocusMinutesToday)
      ? Math.max(0, Math.floor(raw.completedFocusMinutesToday))
      : 0;

  return {
    durationMinutes: isFocusDurationMinutes(raw.durationMinutes)
      ? raw.durationMinutes
      : defaults.durationMinutes,
    autoSyncAudio:
      typeof raw.autoSyncAudio === 'boolean'
        ? raw.autoSyncAudio
        : defaults.autoSyncAudio,
    playCompletionChime:
      typeof raw.playCompletionChime === 'boolean'
        ? raw.playCompletionChime
        : defaults.playCompletionChime,
    dateKey: todayKey,
    completedSessionsToday,
    completedFocusMinutesToday,
  };
}

export function loadFocusTimerPreferences(
  todayKey: string = getLocalTodayDateKey(),
  storage?: StorageLike | null
): FocusTimerPreferences {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return createDefaultFocusTimerPreferences(todayKey);

  try {
    const raw = store.getItem(FOCUS_TIMER_STORAGE_KEY);
    if (!raw) return createDefaultFocusTimerPreferences(todayKey);
    const parsed = JSON.parse(raw) as Partial<FocusTimerPreferences>;
    return sanitizeFocusTimerPreferences(parsed, todayKey);
  } catch {
    return createDefaultFocusTimerPreferences(todayKey);
  }
}

export function saveFocusTimerPreferences(
  prefs: FocusTimerPreferences,
  storage?: StorageLike | null
): void {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return;

  try {
    const clean = sanitizeFocusTimerPreferences(prefs, prefs.dateKey);
    store.setItem(FOCUS_TIMER_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota or privacy-mode errors
  }
}
