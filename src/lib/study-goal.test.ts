import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DAILY_GOAL_MINUTES,
  MAX_DAILY_GOAL_MINUTES,
  MIN_DAILY_GOAL_MINUTES,
  evaluateDailyGoalProgress,
  parseDailyGoalMinutes,
  sanitizeDailyGoalMinutes,
} from './study-goal';

test('parseDailyGoalMinutes validates integer bounds 5..480 cleanly', () => {
  assert.deepEqual(parseDailyGoalMinutes(30), { valid: true, value: 30 });
  assert.deepEqual(parseDailyGoalMinutes('45'), { valid: true, value: 45 });
  assert.equal(parseDailyGoalMinutes(MIN_DAILY_GOAL_MINUTES).valid, true);
  assert.equal(parseDailyGoalMinutes(MAX_DAILY_GOAL_MINUTES).valid, true);

  assert.equal(parseDailyGoalMinutes('').valid, false);
  assert.equal(parseDailyGoalMinutes(4).valid, false);
  assert.equal(parseDailyGoalMinutes(481).valid, false);
  assert.equal(parseDailyGoalMinutes(15.5).valid, false);
  assert.equal(parseDailyGoalMinutes('abc').valid, false);
});

test('sanitizeDailyGoalMinutes falls back to 30 on invalid inputs', () => {
  assert.equal(sanitizeDailyGoalMinutes(60), 60);
  assert.equal(sanitizeDailyGoalMinutes(0), DEFAULT_DAILY_GOAL_MINUTES);
  assert.equal(sanitizeDailyGoalMinutes(999), DEFAULT_DAILY_GOAL_MINUTES);
  assert.equal(sanitizeDailyGoalMinutes(null), DEFAULT_DAILY_GOAL_MINUTES);
});

test('evaluateDailyGoalProgress computes ring circumference, offset, and goal status', () => {
  const zero = evaluateDailyGoalProgress({
    completedMinutes: 0,
    targetMinutes: 30,
    radius: 50,
  });
  assert.equal(zero.percent, 0);
  assert.equal(zero.rawPercent, 0);
  assert.equal(zero.remainingMinutes, 30);
  assert.equal(zero.goalMet, false);
  assert.equal(zero.strokeDashoffset, zero.circumference);

  const half = evaluateDailyGoalProgress({
    completedMinutes: 15,
    targetMinutes: 30,
    radius: 50,
  });
  assert.equal(half.percent, 50);
  assert.equal(half.rawPercent, 50);
  assert.equal(half.remainingMinutes, 15);
  assert.equal(half.goalMet, false);
  assert.ok(Math.abs(half.strokeDashoffset - half.circumference / 2) < 0.01);

  const exceeded = evaluateDailyGoalProgress({
    completedMinutes: 45,
    targetMinutes: 30,
    radius: 50,
  });
  assert.equal(exceeded.percent, 100);
  assert.equal(exceeded.rawPercent, 150);
  assert.equal(exceeded.remainingMinutes, 0);
  assert.equal(exceeded.goalMet, true);
  assert.equal(exceeded.strokeDashoffset, 0);
});

test('evaluateDailyGoalProgress guards against negative completed minutes', () => {
  const safe = evaluateDailyGoalProgress({
    completedMinutes: -20,
    targetMinutes: 30,
    radius: 50,
  });
  assert.equal(safe.completedMinutes, 0);
  assert.equal(safe.percent, 0);
  assert.equal(safe.goalMet, false);
});
