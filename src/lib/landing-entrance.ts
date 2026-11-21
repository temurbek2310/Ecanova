/**
 * Landing page entrance choreography, shared by the WebGL constellation and the DOM timeline.
 *
 * Timeline (ms from the shared start `t0`, i.e. the first frame the shapes are on screen):
 *   0    → 1100  shapes glide from a scattered state into formation (canvas, quintic ease-out)
 *   850  → 1350  navbar container, then a crisp stagger of its items
 *   1200 → ~1990 hero: badge → headline lines → body → CTAs → proof list (14px lift + fade)
 *
 * The canvas boots lazily (after first paint / idle), so whichever side is ready first starts the
 * shared clock; the other side reads `startedAt` and joins in sync. The entrance plays once per
 * landing mount and is skipped entirely under `prefers-reduced-motion` or in a background tab.
 */

export const ENTRANCE_SHAPES_MS = 1100;

/** DOM timeline positions, in seconds from `t0` (GSAP units). */
export const ENTRANCE_TIMELINE = {
  nav: { at: 0.85, duration: 0.45, y: -10 },
  navItems: { at: 0.92, duration: 0.32, stagger: 0.05, y: -6 },
  heroBadge: { at: 1.2, duration: 0.45 },
  heroLines: { at: 1.27, duration: 0.5, stagger: 0.07 },
  heroRise: { at: 1.42, duration: 0.45, stagger: 0.07 },
  heroLift: 14,
} as const;

/** Last DOM tween ends here (seconds); used for the fail-safe completion timer. */
export const ENTRANCE_DOM_END_S = (() => {
  const t = ENTRANCE_TIMELINE;
  return Math.max(
    t.nav.at + t.nav.duration,
    t.heroLines.at + t.heroLines.stagger + t.heroLines.duration,
    t.heroRise.at + t.heroRise.stagger * 2 + t.heroRise.duration,
  );
})();

/** If the canvas has not produced a frame by then, the DOM entrance starts on its own. */
export const ENTRANCE_CANVAS_WAIT_MS = 900;

export interface LandingEntrance {
  /** `performance.now()` timestamp of `t0`, or null while nothing has started yet. */
  startedAt: number | null;
  /** True when the entrance is skipped (reduced motion, hidden tab, already played). */
  skip: boolean;
  /** Starts the shared clock (idempotent) and returns `startedAt`. */
  start: (now?: number) => number;
  /** Listeners notified once when the clock starts. */
  onStart: Set<(startedAt: number) => void>;
}

export function createLandingEntrance(): LandingEntrance {
  const entrance: LandingEntrance = {
    startedAt: null,
    skip: false,
    onStart: new Set(),
    start(now?: number) {
      if (entrance.startedAt !== null) return entrance.startedAt;
      const t =
        typeof now === 'number' && Number.isFinite(now)
          ? now
          : typeof performance !== 'undefined'
          ? performance.now()
          : Date.now();
      entrance.startedAt = t;
      entrance.onStart.forEach((fn) => fn(t));
      entrance.onStart.clear();
      return t;
    },
  };
  return entrance;
}

/**
 * Raw (linear) shape-assembly progress 0..1 for the canvas. The vertex shader applies the per-particle
 * delay and quintic ease-out. Wall-clock based, so a tab that was throttled or hidden mid-entrance
 * resumes already assembled instead of replaying.
 */
export function resolveIntroProgress(
  now: number,
  startedAt: number | null,
  skip: boolean,
  durationMs: number = ENTRANCE_SHAPES_MS,
): number {
  if (skip || startedAt === null) return skip ? 1 : 0;
  if (!Number.isFinite(now) || durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, (now - startedAt) / durationMs));
}

/** Quintic ease-out (same curve the shader uses), exposed for tests and DOM parity. */
export function easeOutQuint(t: number): number {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1));
  return 1 - Math.pow(1 - x, 5);
}
