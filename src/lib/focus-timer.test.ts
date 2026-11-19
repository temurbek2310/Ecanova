import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_DURATION_OPTIONS,
  FOCUS_TIMER_STORAGE_KEY,
  computeRemainingSecondsFromDeadline,
  computeTimerProgress,
  formatTimerClock,
  getBreakMinutesForSession,
  getPhaseTotalSeconds,
  loadFocusTimerPreferences,
  resolveAudioActionForTimerTransition,
  sanitizeFocusTimerPreferences,
  saveFocusTimerPreferences,
} from './focus-timer.ts';
import type { StorageLike } from './ambient-audio.ts';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('focus-timer Pomodoro domain logic', () => {
  it('supports 25m and 50m focus sessions with proportional 5m and 10m breaks', () => {
    assert.deepEqual(FOCUS_DURATION_OPTIONS, [25, 50]);
    assert.equal(getBreakMinutesForSession(25), 5);
    assert.equal(getBreakMinutesForSession(50), 10);
    assert.equal(getPhaseTotalSeconds('focus', 25), 1500);
    assert.equal(getPhaseTotalSeconds('break', 25), 300);
    assert.equal(getPhaseTotalSeconds('focus', 50), 3000);
    assert.equal(getPhaseTotalSeconds('break', 50), 600);
  });

  it('formats zero-padded MM:SS clocks cleanly and clamps negative values', () => {
    assert.equal(formatTimerClock(1500), '25:00');
    assert.equal(formatTimerClock(3000), '50:00');
    assert.equal(formatTimerClock(65), '01:05');
    assert.equal(formatTimerClock(9), '00:09');
    assert.equal(formatTimerClock(0), '00:00');
    assert.equal(formatTimerClock(-12), '00:00');
  });

  it('computes normalized progress and drift-free deadline remaining seconds', () => {
    assert.equal(computeTimerProgress(1500, 1500), 0);
    assert.equal(computeTimerProgress(750, 1500), 0.5);
    assert.equal(computeTimerProgress(0, 1500), 1);
    assert.equal(computeTimerProgress(-10, 1500), 1);

    assert.equal(computeRemainingSecondsFromDeadline(10_000, 7_200), 3);
    assert.equal(computeRemainingSecondsFromDeadline(10_000, 10_500), 0);
  });

  it('resolves ambient audio sync transitions deterministically', () => {
    assert.equal(
      resolveAudioActionForTimerTransition({
        prevStatus: 'idle',
        nextStatus: 'running',
        phase: 'focus',
        autoSyncAudio: true,
      }),
      'start'
    );

    assert.equal(
      resolveAudioActionForTimerTransition({
        prevStatus: 'idle',
        nextStatus: 'running',
        phase: 'break',
        autoSyncAudio: true,
      }),
      'none'
    );

    assert.equal(
      resolveAudioActionForTimerTransition({
        prevStatus: 'running',
        nextStatus: 'paused',
        phase: 'focus',
        autoSyncAudio: true,
      }),
      'stop'
    );

    assert.equal(
      resolveAudioActionForTimerTransition({
        prevStatus: 'running',
        nextStatus: 'completed',
        phase: 'focus',
        autoSyncAudio: true,
      }),
      'stop'
    );

    assert.equal(
      resolveAudioActionForTimerTransition({
        prevStatus: 'idle',
        nextStatus: 'running',
        phase: 'focus',
        autoSyncAudio: false,
      }),
      'none'
    );
  });

  it('persists preferences, resets daily counters on a new day, and handles invalid storage', () => {
    const store = createMemoryStorage();
    saveFocusTimerPreferences(
      {
        durationMinutes: 50,
        autoSyncAudio: false,
        playCompletionChime: true,
        dateKey: '2026-11-18',
        completedSessionsToday: 3,
        completedFocusMinutesToday: 125,
      },
      store
    );

    const sameDay = loadFocusTimerPreferences('2026-11-18', store);
    assert.equal(sameDay.durationMinutes, 50);
    assert.equal(sameDay.autoSyncAudio, false);
    assert.equal(sameDay.completedSessionsToday, 3);
    assert.equal(sameDay.completedFocusMinutesToday, 125);

    // Next calendar day preserves user duration/audio prefs but resets daily counters
    const nextDay = loadFocusTimerPreferences('2026-11-19', store);
    assert.equal(nextDay.durationMinutes, 50);
    assert.equal(nextDay.autoSyncAudio, false);
    assert.equal(nextDay.completedSessionsToday, 0);
    assert.equal(nextDay.completedFocusMinutesToday, 0);

    // Invalid duration falls back cleanly to 25
    const sanitized = sanitizeFocusTimerPreferences(
      { durationMinutes: 99 as never, completedSessionsToday: -5 },
      '2026-11-19'
    );
    assert.equal(sanitized.durationMinutes, 25);
    assert.equal(sanitized.completedSessionsToday, 0);

    // Corrupt JSON recovers safely
    store.setItem(FOCUS_TIMER_STORAGE_KEY, '{broken');
    const recovered = loadFocusTimerPreferences('2026-11-19', store);
    assert.equal(recovered.durationMinutes, 25);
    assert.equal(recovered.autoSyncAudio, true);
  });
});
