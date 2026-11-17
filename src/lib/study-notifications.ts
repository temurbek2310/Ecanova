import type { LocaleCode } from '../shared/types';
import { sanitizeDailyGoalMinutes } from './study-goal';

export const GOAL_REMINDER_THRESHOLD_MINUTES = 30;
export const GOAL_NOTIFICATIONS_ENABLED_KEY = 'econova_goal_notifications_enabled';
export const GOAL_REMINDER_SENT_PREFIX = 'econova_goal_reminder_sent_';

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export interface ReminderEvaluationInput {
  notificationsEnabled: boolean;
  permission: BrowserNotificationPermission;
  completedMinutes: number;
  targetMinutes: number;
  alreadySentToday: boolean;
}

export interface StudyGoalNotificationPayload {
  title: string;
  body: string;
  tag: string;
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export function shouldTriggerStudyGoalReminder(input: ReminderEvaluationInput): boolean {
  if (!input.notificationsEnabled) return false;
  if (input.permission !== 'granted') return false;
  if (input.alreadySentToday) return false;

  const safeTarget = sanitizeDailyGoalMinutes(input.targetMinutes);
  const safeCompleted = Number.isFinite(input.completedMinutes)
    ? Math.max(0, Math.round(input.completedMinutes))
    : 0;
  const remainingMinutes = Math.max(0, safeTarget - safeCompleted);

  return remainingMinutes > 0 && remainingMinutes <= GOAL_REMINDER_THRESHOLD_MINUTES;
}

export function buildStudyGoalNotificationPayload(params: {
  completedMinutes: number;
  targetMinutes: number;
  locale: LocaleCode;
}): StudyGoalNotificationPayload {
  const safeTarget = sanitizeDailyGoalMinutes(params.targetMinutes);
  const safeCompleted = Math.max(0, Math.round(params.completedMinutes));
  const remainingMinutes = Math.max(1, safeTarget - safeCompleted);

  if (params.locale === 'uz') {
    return {
      title: 'ECONOVA · Kunlik o‘qish eslatmasi',
      body:
        remainingMinutes === GOAL_REMINDER_THRESHOLD_MINUTES
          ? `Kunlik ${safeTarget} daqiqalik maqsadingizga atigi 30 daqiqa qoldi. Yana bitta darsni yakunlang!`
          : `Kunlik ${safeTarget} daqiqalik maqsadingizga ${remainingMinutes} daqiqa qoldi. Davom eting!`,
      tag: 'econova-daily-study-goal-reminder',
    };
  }

  return {
    title: 'ECONOVA · Daily Study Goal Reminder',
    body:
      remainingMinutes === GOAL_REMINDER_THRESHOLD_MINUTES
        ? `You are 30 minutes away from hitting your ${safeTarget} min daily study goal. Jump into a lesson to hit your target!`
        : `You are ${remainingMinutes} minutes away from hitting your ${safeTarget} min daily study goal. One focused session gets you there!`,
    tag: 'econova-daily-study-goal-reminder',
  };
}

export async function dispatchBrowserNotification(
  payload: StudyGoalNotificationPayload
): Promise<{ sent: boolean; reason?: string }> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { sent: false, reason: 'Notifications API is not supported in this browser.' };
  }
  if (Notification.permission !== 'granted') {
    return { sent: false, reason: 'Notification permission has not been granted.' };
  }

  try {
    new Notification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag,
    });
    return { sent: true };
  } catch {
    // Fallback to active PWA service worker registration when window Notification constructor is restricted
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: payload.tag,
        });
        return { sent: true };
      } catch {
        return { sent: false, reason: 'Unable to display browser notification.' };
      }
    }
    return { sent: false, reason: 'Unable to display browser notification.' };
  }
}

export function loadSavedGoalNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GOAL_NOTIFICATIONS_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveGoalNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GOAL_NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota or privacy errors
  }
}

export function hasSentReminderToday(scopeKey: string, dateKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${GOAL_REMINDER_SENT_PREFIX}${scopeKey}`) === dateKey;
  } catch {
    return false;
  }
}

export function markReminderSentToday(scopeKey: string, dateKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${GOAL_REMINDER_SENT_PREFIX}${scopeKey}`, dateKey);
  } catch {
    // Ignore storage errors
  }
}
