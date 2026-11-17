import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMilestoneCelebration,
  generateSubtleConfettiPieces,
  type MilestoneSnapshot,
} from './celebrations';

const baseSnapshot: MilestoneSnapshot = {
  completedCourseIds: [],
  currentStreak: 0,
  badgeKeys: [],
  dailyGoalMet: false,
};

test('detectMilestoneCelebration returns null on initial load without baseline', () => {
  assert.equal(detectMilestoneCelebration(null, baseSnapshot, 'en'), null);
});

test('detectMilestoneCelebration prioritizes course completion over streak and badges', () => {
  const result = detectMilestoneCelebration(
    baseSnapshot,
    {
      completedCourseIds: ['course-econ-101'],
      currentStreak: 1,
      badgeKeys: ['course_complete_economics'],
      dailyGoalMet: true,
    },
    'en'
  );
  assert.ok(result);
  assert.equal(result.kind, 'course_completed');
  assert.match(result.title, /Course Completed/);
});

test('detectMilestoneCelebration detects streak increment, daily goal completion, and new badges', () => {
  const streakEvt = detectMilestoneCelebration(
    baseSnapshot,
    { ...baseSnapshot, currentStreak: 1 },
    'en'
  );
  assert.equal(streakEvt?.kind, 'streak_reached');
  assert.match(streakEvt?.title || '', /1-Day Study Streak/);

  const goalEvt = detectMilestoneCelebration(
    { ...baseSnapshot, currentStreak: 1 },
    { ...baseSnapshot, currentStreak: 1, dailyGoalMet: true },
    'uz'
  );
  assert.equal(goalEvt?.kind, 'daily_goal_reached');
  assert.match(goalEvt?.title || '', /Kunlik maqsad/);

  const badgeEvt = detectMilestoneCelebration(
    { ...baseSnapshot, currentStreak: 1, dailyGoalMet: true },
    { ...baseSnapshot, currentStreak: 1, dailyGoalMet: true, badgeKeys: ['first_lesson'] },
    'en'
  );
  assert.equal(badgeEvt?.kind, 'badge_unlocked');
});

test('generateSubtleConfettiPieces generates bounded deterministic particle array', () => {
  const pieces = generateSubtleConfettiPieces(16);
  assert.equal(pieces.length, 16);
  for (const p of pieces) {
    assert.ok(p.leftPercent >= 8 && p.leftPercent <= 92);
    assert.ok(p.durationMs >= 1500);
    assert.ok(p.colorVar.startsWith('var(--econova-'));
  }
});
