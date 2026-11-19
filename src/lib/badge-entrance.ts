import type { BadgeAward } from '../shared/types';

export type BadgePopTransitionConfig = {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass: number;
  delay: number;
};

export type BadgeEntranceState = {
  opacity: number;
  scale: number;
  y: number;
};

export type BadgePopVariants = {
  hidden: BadgeEntranceState;
  visible: BadgeEntranceState & {
    transition: BadgePopTransitionConfig;
  };
  hover: {
    scale: number;
    y: number;
    transition: {
      type: 'spring';
      stiffness: number;
      damping: number;
    };
  };
};

export interface AnnotatedBadgeAward extends BadgeAward {
  index: number;
  staggerDelaySec: number;
  isRecentAward: boolean;
}

const MAX_STAGGER_DELAY_SEC = 0.45;
const STAGGER_STEP_SEC = 0.065;
const BASE_DELAY_SEC = 0.03;
const DEFAULT_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Computes the staggered delay (in seconds) for a badge item at a given index,
 * clamped so large badge lists never feel sluggish.
 */
export function computeBadgeStaggerDelay(index: number): number {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const raw = BASE_DELAY_SEC + safeIndex * STAGGER_STEP_SEC;
  return Number(Math.min(MAX_STAGGER_DELAY_SEC, raw).toFixed(3));
}

/**
 * Builds Framer Motion pop-in variants for an individual badge card in AchievementsView.
 */
export function buildBadgePopVariants(index = 0): BadgePopVariants {
  const delay = computeBadgeStaggerDelay(index);
  return {
    hidden: {
      opacity: 0,
      scale: 0.86,
      y: 12,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 420,
        damping: 26,
        mass: 0.8,
        delay,
      },
    },
    hover: {
      scale: 1.015,
      y: -2,
      transition: {
        type: 'spring',
        stiffness: 460,
        damping: 24,
      },
    },
  };
}

/**
 * Annotates a list of badges with deterministic stagger timings and recent-award metadata.
 */
export function annotateBadgesForEntrance(
  badges: readonly BadgeAward[],
  nowMs: number = Date.now(),
  recentWindowMs: number = DEFAULT_RECENT_WINDOW_MS
): AnnotatedBadgeAward[] {
  if (!Array.isArray(badges) || badges.length === 0) {
    return [];
  }

  return badges.map((badge, index) => {
    const awardedMs = Date.parse(badge.awardedAt);
    const isRecentAward =
      Number.isFinite(awardedMs) &&
      nowMs >= awardedMs &&
      nowMs - awardedMs <= Math.max(0, recentWindowMs);

    return {
      ...badge,
      index,
      staggerDelaySec: computeBadgeStaggerDelay(index),
      isRecentAward,
    };
  });
}

export const BADGE_SLIDE_IN_DEFAULTS = {
  initialScale: 0.9,
  unlockScale: 0.86,
  initialXOffsetPx: -16,
  unlockXOffsetPx: -24,
  initialYOffsetPx: 14,
  durationSec: 0.5,
  unlockDurationSec: 0.55,
  staggerSec: 0.08,
  ease: 'power3.out',
} as const;

/**
 * Computes which badge IDs in `currentBadges` were not present in `previousBadgeIds`.
 * Used by AchievementsView to apply a targeted GSAP Glass-Brutalist animation
 * whenever a new badge is unlocked.
 */
export function resolveNewlyUnlockedBadgeIds(
  previousBadgeIds: readonly string[],
  currentBadges: readonly BadgeAward[]
): string[] {
  if (!Array.isArray(currentBadges) || currentBadges.length === 0) {
    return [];
  }
  const prevSet = new Set(previousBadgeIds);
  return currentBadges
    .filter((badge) => Boolean(badge?.id) && !prevSet.has(badge.id))
    .map((badge) => badge.id);
}

export interface BadgeEntranceAnimationPlan {
  mode: 'none' | 'initial-stagger' | 'unlock-stagger';
  targetIds: string[];
  ease: typeof BADGE_SLIDE_IN_DEFAULTS.ease;
  fromScale: number;
  staggerSec: number;
}

/**
 * Determines whether AchievementsView should run a staggered full-list fade+scale entrance
 * or target newly unlocked badges exclusively.
 */
export function buildBadgeEntranceAnimationPlan(params: {
  hasHydratedBaseline: boolean;
  previousBadgeIds: readonly string[];
  currentBadges: readonly BadgeAward[];
}): BadgeEntranceAnimationPlan {
  if (!Array.isArray(params.currentBadges) || params.currentBadges.length === 0) {
    return {
      mode: 'none',
      targetIds: [],
      ease: BADGE_SLIDE_IN_DEFAULTS.ease,
      fromScale: BADGE_SLIDE_IN_DEFAULTS.initialScale,
      staggerSec: BADGE_SLIDE_IN_DEFAULTS.staggerSec,
    };
  }

  if (params.hasHydratedBaseline) {
    const newlyUnlockedIds = resolveNewlyUnlockedBadgeIds(
      params.previousBadgeIds,
      params.currentBadges
    );
    if (newlyUnlockedIds.length > 0) {
      return {
        mode: 'unlock-stagger',
        targetIds: newlyUnlockedIds,
        ease: BADGE_SLIDE_IN_DEFAULTS.ease,
        fromScale: BADGE_SLIDE_IN_DEFAULTS.unlockScale,
        staggerSec: BADGE_SLIDE_IN_DEFAULTS.staggerSec,
      };
    }
  }

  return {
    mode: 'initial-stagger',
    targetIds: params.currentBadges.map((b) => b.id),
    ease: BADGE_SLIDE_IN_DEFAULTS.ease,
    fromScale: BADGE_SLIDE_IN_DEFAULTS.initialScale,
    staggerSec: BADGE_SLIDE_IN_DEFAULTS.staggerSec,
  };
}
