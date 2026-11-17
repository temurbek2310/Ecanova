import type { LocaleCode } from '../shared/types';

export type MilestoneKind =
  | 'course_completed'
  | 'streak_reached'
  | 'daily_goal_reached'
  | 'badge_unlocked';

export interface MilestoneSnapshot {
  completedCourseIds: string[];
  currentStreak: number;
  badgeKeys: string[];
  dailyGoalMet: boolean;
}

export interface MilestoneCelebrationEvent {
  id: string;
  kind: MilestoneKind;
  title: string;
  subtitle: string;
  accentTone: 'success' | 'teal' | 'accent' | 'warning';
}

export function detectMilestoneCelebration(
  prev: MilestoneSnapshot | null,
  next: MilestoneSnapshot,
  locale: LocaleCode
): MilestoneCelebrationEvent | null {
  if (!prev) {
    return null;
  }

  const prevCourseSet = new Set(prev.completedCourseIds);
  const newlyCompletedCourse = next.completedCourseIds.find((id) => !prevCourseSet.has(id));
  if (newlyCompletedCourse) {
    return {
      id: `course-${newlyCompletedCourse}-${Date.now()}`,
      kind: 'course_completed',
      title: locale === 'uz' ? 'Kurs muvaffaqiyatli yakunlandi!' : 'Course Completed!',
      subtitle:
        locale === 'uz'
          ? 'Barcha darslar va yakuniy test topshirildi. Sertifikatingiz tayyor.'
          : 'All required lessons and the final assessment passed. Your certificate is ready.',
      accentTone: 'success',
    };
  }

  if (next.currentStreak > prev.currentStreak && next.currentStreak >= 1) {
    return {
      id: `streak-${next.currentStreak}-${Date.now()}`,
      kind: 'streak_reached',
      title:
        locale === 'uz'
          ? `${next.currentStreak} kunlik o‘qish seriyasi!`
          : `${next.currentStreak}-Day Study Streak!`,
      subtitle:
        locale === 'uz'
          ? 'Bugungi faol o‘qish seriyangiz uzluksiz davom etmoqda.'
          : 'Consistent daily learning keeps your momentum growing.',
      accentTone: 'teal',
    };
  }

  if (!prev.dailyGoalMet && next.dailyGoalMet) {
    return {
      id: `goal-${Date.now()}`,
      kind: 'daily_goal_reached',
      title: locale === 'uz' ? 'Kunlik maqsad bajarildi!' : 'Daily Study Goal Reached!',
      subtitle:
        locale === 'uz'
          ? 'Bugun rejalashtirgan o‘qish daqiqalaringizga yetdingiz.'
          : 'You hit your target study minutes for today.',
      accentTone: 'accent',
    };
  }

  const prevBadgeSet = new Set(prev.badgeKeys);
  const newBadge = next.badgeKeys.find((k) => !prevBadgeSet.has(k));
  if (newBadge) {
    return {
      id: `badge-${newBadge}-${Date.now()}`,
      kind: 'badge_unlocked',
      title: locale === 'uz' ? 'Yangi nishon ochildi!' : 'New Badge Unlocked!',
      subtitle:
        locale === 'uz'
          ? 'Yutuqlaringiz bo‘limida yangi o‘quv nishoni qo‘shildi.'
          : 'Check XP & Streaks to view your newest milestone badge.',
      accentTone: 'warning',
    };
  }

  return null;
}

export interface ConfettiPieceSpec {
  id: number;
  leftPercent: number;
  delayMs: number;
  durationMs: number;
  driftPx: number;
  rotateDeg: number;
  colorVar: string;
}

const CONFETTI_COLORS = [
  'var(--econova-accent)',
  'var(--econova-teal)',
  'var(--econova-success)',
  'var(--econova-warning)',
];

export function generateSubtleConfettiPieces(count = 18): ConfettiPieceSpec[] {
  const safeCount = Math.min(28, Math.max(6, Math.round(count)));
  return Array.from({ length: safeCount }, (_, i) => {
    const spreadRatio = (i + 0.5) / safeCount;
    const leftPercent = Math.round(8 + spreadRatio * 84);
    const delayMs = (i % 6) * 70;
    const durationMs = 1500 + (i % 4) * 220;
    const driftPx = ((i % 2 === 0 ? 1 : -1) * (14 + (i % 5) * 8));
    const rotateDeg = (i % 2 === 0 ? 1 : -1) * (110 + (i % 4) * 55);
    const colorVar = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return {
      id: i,
      leftPercent,
      delayMs,
      durationMs,
      driftPx,
      rotateDeg,
      colorVar,
    };
  });
}
