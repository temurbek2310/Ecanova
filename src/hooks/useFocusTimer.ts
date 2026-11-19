import { useCallback, useEffect, useRef, useState } from 'react';
import type { AmbientFocusAudioController } from './useAmbientFocusAudio';
import { playGlacialCompletionChime } from '../lib/ambient-audio';
import {
  computeRemainingSecondsFromDeadline,
  computeTimerProgress,
  formatTimerClock,
  getBreakMinutesForSession,
  getLocalTodayDateKey,
  getPhaseTotalSeconds,
  loadFocusTimerPreferences,
  resolveAudioActionForTimerTransition,
  saveFocusTimerPreferences,
  type FocusDurationMinutes,
  type FocusTimerPhase,
  type FocusTimerPreferences,
  type FocusTimerStatus,
} from '../lib/focus-timer';

export interface FocusTimerController {
  durationMinutes: FocusDurationMinutes;
  breakMinutes: number;
  phase: FocusTimerPhase;
  status: FocusTimerStatus;
  remainingSeconds: number;
  totalSeconds: number;
  formattedClock: string;
  progress: number;
  autoSyncAudio: boolean;
  playCompletionChime: boolean;
  completedSessionsToday: number;
  completedFocusMinutesToday: number;
  activeLessonTitle: string | null;
  setActiveLessonTitle: (title: string | null) => void;
  selectDuration: (minutes: FocusDurationMinutes) => void;
  selectPhase: (nextPhase: FocusTimerPhase) => void;
  start: () => void;
  pause: () => void;
  toggleStartPause: () => void;
  reset: () => void;
  setAutoSyncAudio: (enabled: boolean) => void;
  setPlayCompletionChime: (enabled: boolean) => void;
}

export function useFocusTimer(
  ambientAudio: AmbientFocusAudioController
): FocusTimerController {
  const [prefs, setPrefs] = useState<FocusTimerPreferences>(() =>
    loadFocusTimerPreferences(getLocalTodayDateKey())
  );
  const [phase, setPhase] = useState<FocusTimerPhase>('focus');
  const [status, setStatus] = useState<FocusTimerStatus>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    getPhaseTotalSeconds('focus', loadFocusTimerPreferences(getLocalTodayDateKey()).durationMinutes)
  );
  const [activeLessonTitle, setActiveLessonTitle] = useState<string | null>(null);

  const deadlineMsRef = useRef<number | null>(null);
  const statusRef = useRef<FocusTimerStatus>(status);
  const phaseRef = useRef<FocusTimerPhase>(phase);
  const prefsRef = useRef<FocusTimerPreferences>(prefs);
  const ambientAudioRef = useRef<AmbientFocusAudioController>(ambientAudio);

  statusRef.current = status;
  phaseRef.current = phase;
  prefsRef.current = prefs;
  ambientAudioRef.current = ambientAudio;

  const updatePrefs = useCallback(
    (updater: (prev: FocusTimerPreferences) => FocusTimerPreferences) => {
      setPrefs((prev) => {
        const next = updater(prev);
        saveFocusTimerPreferences(next);
        return next;
      });
    },
    []
  );

  const applyAudioSync = useCallback(
    (prevStatus: FocusTimerStatus, nextStatus: FocusTimerStatus, targetPhase: FocusTimerPhase) => {
      const action = resolveAudioActionForTimerTransition({
        prevStatus,
        nextStatus,
        phase: targetPhase,
        autoSyncAudio: prefsRef.current.autoSyncAudio,
      });
      if (action === 'start') {
        void ambientAudioRef.current.setPlaying(true);
      } else if (action === 'stop') {
        void ambientAudioRef.current.setPlaying(false);
      }
    },
    []
  );

  const handleTimerCompleted = useCallback(() => {
    const prevStatus = statusRef.current;
    const finishedPhase = phaseRef.current;
    const currentPrefs = prefsRef.current;

    deadlineMsRef.current = null;
    setRemainingSeconds(0);
    setStatus('completed');

    applyAudioSync(prevStatus, 'completed', finishedPhase);

    if (currentPrefs.playCompletionChime) {
      playGlacialCompletionChime(ambientAudioRef.current.settings.volume);
    }

    if (finishedPhase === 'focus') {
      const todayKey = getLocalTodayDateKey();
      updatePrefs((prev) => {
        const sameDay = prev.dateKey === todayKey;
        return {
          ...prev,
          dateKey: todayKey,
          completedSessionsToday: (sameDay ? prev.completedSessionsToday : 0) + 1,
          completedFocusMinutesToday:
            (sameDay ? prev.completedFocusMinutesToday : 0) + prev.durationMinutes,
        };
      });
    }
  }, [applyAudioSync, updatePrefs]);

  // Drift-free wall-clock countdown loop while running
  useEffect(() => {
    if (status !== 'running') return;

    const tick = () => {
      if (deadlineMsRef.current === null) return;
      const left = computeRemainingSecondsFromDeadline(deadlineMsRef.current, Date.now());
      if (left <= 0) {
        handleTimerCompleted();
      } else {
        setRemainingSeconds((prev) => (prev === left ? prev : left));
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [status, handleTimerCompleted]);

  const start = useCallback(() => {
    const prevStatus = statusRef.current;
    const currentPhase = phaseRef.current;
    const total = getPhaseTotalSeconds(currentPhase, prefsRef.current.durationMinutes);
    const secondsToRun =
      prevStatus === 'completed' || remainingSeconds <= 0 ? total : remainingSeconds;

    deadlineMsRef.current = Date.now() + secondsToRun * 1000;
    setRemainingSeconds(secondsToRun);
    setStatus('running');
    applyAudioSync(prevStatus, 'running', currentPhase);
  }, [applyAudioSync, remainingSeconds]);

  const pause = useCallback(() => {
    const prevStatus = statusRef.current;
    if (prevStatus !== 'running') return;

    if (deadlineMsRef.current !== null) {
      const left = computeRemainingSecondsFromDeadline(deadlineMsRef.current, Date.now());
      setRemainingSeconds(left);
    }
    deadlineMsRef.current = null;
    setStatus('paused');
    applyAudioSync(prevStatus, 'paused', phaseRef.current);
  }, [applyAudioSync]);

  const toggleStartPause = useCallback(() => {
    if (statusRef.current === 'running') {
      pause();
    } else {
      start();
    }
  }, [pause, start]);

  const reset = useCallback(() => {
    const prevStatus = statusRef.current;
    const currentPhase = phaseRef.current;
    deadlineMsRef.current = null;
    const total = getPhaseTotalSeconds(currentPhase, prefsRef.current.durationMinutes);
    setRemainingSeconds(total);
    setStatus('idle');
    applyAudioSync(prevStatus, 'idle', currentPhase);
  }, [applyAudioSync]);

  const selectDuration = useCallback(
    (minutes: FocusDurationMinutes) => {
      const prevStatus = statusRef.current;
      deadlineMsRef.current = null;
      updatePrefs((prev) => ({
        ...prev,
        durationMinutes: minutes,
      }));
      const nextTotal = getPhaseTotalSeconds(phaseRef.current, minutes);
      setRemainingSeconds(nextTotal);
      setStatus('idle');
      applyAudioSync(prevStatus, 'idle', phaseRef.current);
    },
    [applyAudioSync, updatePrefs]
  );

  const selectPhase = useCallback(
    (nextPhase: FocusTimerPhase) => {
      const prevStatus = statusRef.current;
      deadlineMsRef.current = null;
      setPhase(nextPhase);
      setRemainingSeconds(getPhaseTotalSeconds(nextPhase, prefsRef.current.durationMinutes));
      setStatus('idle');
      applyAudioSync(prevStatus, 'idle', nextPhase);
    },
    [applyAudioSync]
  );

  const setAutoSyncAudio = useCallback(
    (enabled: boolean) => {
      updatePrefs((prev) => ({ ...prev, autoSyncAudio: enabled }));
      if (enabled && statusRef.current === 'running' && phaseRef.current === 'focus') {
        void ambientAudioRef.current.setPlaying(true);
      }
    },
    [updatePrefs]
  );

  const setPlayCompletionChime = useCallback(
    (enabled: boolean) => {
      updatePrefs((prev) => ({ ...prev, playCompletionChime: enabled }));
    },
    [updatePrefs]
  );

  const totalSeconds = getPhaseTotalSeconds(phase, prefs.durationMinutes);

  return {
    durationMinutes: prefs.durationMinutes,
    breakMinutes: getBreakMinutesForSession(prefs.durationMinutes),
    phase,
    status,
    remainingSeconds,
    totalSeconds,
    formattedClock: formatTimerClock(remainingSeconds),
    progress: computeTimerProgress(remainingSeconds, totalSeconds),
    autoSyncAudio: prefs.autoSyncAudio,
    playCompletionChime: prefs.playCompletionChime,
    completedSessionsToday: prefs.completedSessionsToday,
    completedFocusMinutesToday: prefs.completedFocusMinutesToday,
    activeLessonTitle,
    setActiveLessonTitle,
    selectDuration,
    selectPhase,
    start,
    pause,
    toggleStartPause,
    reset,
    setAutoSyncAudio,
    setPlayCompletionChime,
  };
}
