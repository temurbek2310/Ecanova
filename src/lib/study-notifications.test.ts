import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudyGoalNotificationPayload,
  shouldTriggerStudyGoalReminder,
} from './study-notifications';

test('shouldTriggerStudyGoalReminder fires only when enabled, granted, unsent today, and 1..30 min away', () => {
  // Exactly 30 minutes remaining (e.g., 15 / 45 min) -> fires
  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: true,
      permission: 'granted',
      completedMinutes: 15,
      targetMinutes: 45,
      alreadySentToday: false,
    }),
    true
  );

  // Within <= 30 minutes remaining (e.g., 15 / 30 min -> 15 min left) -> fires
  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: true,
      permission: 'granted',
      completedMinutes: 15,
      targetMinutes: 30,
      alreadySentToday: false,
    }),
    true
  );

  // More than 30 minutes away (e.g., 15 / 60 min -> 45 min left) -> does NOT fire yet
  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: true,
      permission: 'granted',
      completedMinutes: 15,
      targetMinutes: 60,
      alreadySentToday: false,
    }),
    false
  );

  // Already reached goal (remaining = 0) -> does NOT fire
  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: true,
      permission: 'granted',
      completedMinutes: 45,
      targetMinutes: 45,
      alreadySentToday: false,
    }),
    false
  );
});

test('shouldTriggerStudyGoalReminder respects opt-out toggle, permission, and daily dedupe', () => {
  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: false,
      permission: 'granted',
      completedMinutes: 15,
      targetMinutes: 45,
      alreadySentToday: false,
    }),
    false
  );

  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: true,
      permission: 'denied',
      completedMinutes: 15,
      targetMinutes: 45,
      alreadySentToday: false,
    }),
    false
  );

  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: true,
      permission: 'default',
      completedMinutes: 15,
      targetMinutes: 45,
      alreadySentToday: false,
    }),
    false
  );

  assert.equal(
    shouldTriggerStudyGoalReminder({
      notificationsEnabled: true,
      permission: 'granted',
      completedMinutes: 15,
      targetMinutes: 45,
      alreadySentToday: true,
    }),
    false
  );
});

test('buildStudyGoalNotificationPayload generates clear EN and UZ messages', () => {
  const en30 = buildStudyGoalNotificationPayload({
    completedMinutes: 15,
    targetMinutes: 45,
    locale: 'en',
  });
  assert.match(en30.title, /Daily Study Goal Reminder/);
  assert.match(en30.body, /30 minutes away/);
  assert.match(en30.body, /45 min/);

  const uz15 = buildStudyGoalNotificationPayload({
    completedMinutes: 15,
    targetMinutes: 30,
    locale: 'uz',
  });
  assert.match(uz15.title, /Kunlik o‘qish eslatmasi/);
  assert.match(uz15.body, /15 daqiqa qoldi/);
});
