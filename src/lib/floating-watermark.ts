import {
  PRIMARY_ARTIFACT_ACCENT_COLORS,
  SUBJECT_WATERMARK_ACCENTS,
  SUBJECT_WATERMARK_KINDS,
  type ArtifactKind,
  type ArtifactSubject,
} from './subject-artifacts';

export type CanonicalWatermarkTheme =
  | 'sidebar'
  | 'gamification'
  | 'analytics'
  | 'course-mathematics'
  | 'course-economics'
  | 'course-business';

export type FloatingWatermarkTheme = CanonicalWatermarkTheme | (string & {});

export type SidebarGlyphKind =
  | 'compass'
  | 'cursor-pointer'
  | 'command-key'
  | 'nav-nodes';

export type GamificationGlyphKind =
  | 'wireframe-star'
  | 'lightning-bolt'
  | 'isometric-cube'
  | 'milestone-crest';

export type AnalyticsGlyphKind =
  | 'trendline-spark'
  | 'radar-grid'
  | 'target-crosshair'
  | 'bar-metrics';

export type WatermarkGlyphKind =
  | SidebarGlyphKind
  | GamificationGlyphKind
  | AnalyticsGlyphKind
  | ArtifactKind;

export interface WatermarkThemeConfig {
  theme: CanonicalWatermarkTheme;
  glyphs: readonly WatermarkGlyphKind[];
  accents: readonly string[];
  ease: 'power1.inOut' | 'sine.inOut' | 'expo.inOut' | 'power2.inOut';
  defaultCount: number;
  xRange: readonly [number, number];
  yRange: readonly [number, number];
  maxCursorPullPx: number;
}

export type FloatingWatermarkLayout = 'standard' | 'hero-right';

export interface FloatingWatermarkParticle {
  id: string;
  theme: CanonicalWatermarkTheme;
  index: number;
  glyph: WatermarkGlyphKind;
  accentColor: string;
  leftPercent: number;
  topPercent: number;
  baseScale: number;
  opacityClass: 'opacity-20' | 'opacity-25';
  durationSec: number;
  delaySec: number;
  xRange: readonly [number, number];
  yRange: readonly [number, number];
  continuousSpin360: boolean;
  spinDurationSec: number;
  spinDirection: 1 | -1;
  gravityWeight: number;
}

const AMBER_ACCENT = '#FFC96B';

export const FLOATING_WATERMARK_DICTIONARY: Record<
  CanonicalWatermarkTheme,
  WatermarkThemeConfig
> = {
  sidebar: {
    theme: 'sidebar',
    glyphs: ['compass', 'cursor-pointer', 'command-key', 'nav-nodes'],
    accents: [
      PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
      PRIMARY_ARTIFACT_ACCENT_COLORS.purple,
      PRIMARY_ARTIFACT_ACCENT_COLORS.green,
      AMBER_ACCENT,
    ],
    ease: 'sine.inOut',
    defaultCount: 4,
    xRange: [-40, 40],
    yRange: [-35, 35],
    maxCursorPullPx: 22,
  },
  gamification: {
    theme: 'gamification',
    glyphs: [
      'wireframe-star',
      'lightning-bolt',
      'isometric-cube',
      'milestone-crest',
    ],
    accents: [
      AMBER_ACCENT,
      PRIMARY_ARTIFACT_ACCENT_COLORS.purple,
      PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
      PRIMARY_ARTIFACT_ACCENT_COLORS.green,
    ],
    ease: 'sine.inOut',
    defaultCount: 4,
    xRange: [-40, 40],
    yRange: [-35, 35],
    maxCursorPullPx: 26,
  },
  analytics: {
    theme: 'analytics',
    glyphs: [
      'trendline-spark',
      'radar-grid',
      'target-crosshair',
      'bar-metrics',
    ],
    accents: [
      PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
      PRIMARY_ARTIFACT_ACCENT_COLORS.purple,
      PRIMARY_ARTIFACT_ACCENT_COLORS.green,
      AMBER_ACCENT,
    ],
    ease: 'sine.inOut',
    defaultCount: 4,
    xRange: [-40, 40],
    yRange: [-35, 35],
    maxCursorPullPx: 26,
  },
  'course-mathematics': {
    theme: 'course-mathematics',
    glyphs: SUBJECT_WATERMARK_KINDS.Mathematics,
    accents: SUBJECT_WATERMARK_ACCENTS.Mathematics,
    ease: 'power1.inOut',
    defaultCount: 4,
    xRange: [-40, 40],
    yRange: [-35, 35],
    maxCursorPullPx: 28,
  },
  'course-economics': {
    theme: 'course-economics',
    glyphs: SUBJECT_WATERMARK_KINDS.Economics,
    accents: SUBJECT_WATERMARK_ACCENTS.Economics,
    ease: 'sine.inOut',
    defaultCount: 4,
    xRange: [-40, 40],
    yRange: [-35, 35],
    maxCursorPullPx: 28,
  },
  'course-business': {
    theme: 'course-business',
    glyphs: SUBJECT_WATERMARK_KINDS.Business,
    accents: SUBJECT_WATERMARK_ACCENTS.Business,
    ease: 'power2.inOut',
    defaultCount: 5,
    xRange: [-40, 40],
    yRange: [-35, 35],
    maxCursorPullPx: 26,
  },
};

export function resolveFloatingWatermarkTheme(
  theme: FloatingWatermarkTheme
): CanonicalWatermarkTheme {
  const normalized = String(theme ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'sidebar' || normalized === 'nav' || normalized === 'navigation') {
    return 'sidebar';
  }
  if (
    normalized === 'gamification' ||
    normalized === 'xp' ||
    normalized === 'leaderboard' ||
    normalized === 'achievements'
  ) {
    return 'gamification';
  }
  if (
    normalized === 'analytics' ||
    normalized === 'goal' ||
    normalized === 'progress' ||
    normalized === 'weakness'
  ) {
    return 'analytics';
  }
  if (
    normalized === 'course-mathematics' ||
    normalized === 'course-math' ||
    normalized === 'mathematics' ||
    normalized === 'math'
  ) {
    return 'course-mathematics';
  }
  if (
    normalized === 'course-economics' ||
    normalized === 'course-econ' ||
    normalized === 'economics' ||
    normalized === 'econ'
  ) {
    return 'course-economics';
  }
  if (
    normalized === 'course-business' ||
    normalized === 'course-biz' ||
    normalized === 'business'
  ) {
    return 'course-business';
  }

  return 'analytics';
}

export function isCourseArtifactGlyph(glyph: WatermarkGlyphKind): glyph is ArtifactKind {
  return (
    glyph === 'icosahedron' ||
    glyph === 'sigma-symbol' ||
    glyph === 'integral-symbol' ||
    glyph === 'drafting-compass' ||
    glyph === 'candlesticks' ||
    glyph === 'line-graph' ||
    glyph === 'network-nodes' ||
    glyph === 'chess-knight' ||
    glyph === 'bento-grid' ||
    glyph === 'briefcase'
  );
}

export function themeToCourseSubject(
  theme: CanonicalWatermarkTheme
): ArtifactSubject | null {
  switch (theme) {
    case 'course-mathematics':
      return 'Mathematics';
    case 'course-economics':
      return 'Economics';
    case 'course-business':
      return 'Business';
    default:
      return null;
  }
}

const SPIN_ENABLED_GLYPHS = new Set<WatermarkGlyphKind>([
  'compass',
  'command-key',
  'nav-nodes',
  'wireframe-star',
  'isometric-cube',
  'radar-grid',
  'target-crosshair',
  'icosahedron',
  'drafting-compass',
  'network-nodes',
  'bento-grid',
  'sigma-symbol',
]);

const STANDARD_POCKETS: ReadonlyArray<{
  leftPercent: number;
  topPercent: number;
  baseScale: number;
  gravityWeight: number;
}> = [
  { leftPercent: 84, topPercent: 70, baseScale: 1.08, gravityWeight: 1.15 },
  { leftPercent: 56, topPercent: 78, baseScale: 0.78, gravityWeight: 0.85 },
  { leftPercent: 86, topPercent: 22, baseScale: 0.72, gravityWeight: 0.95 },
  { leftPercent: 18, topPercent: 74, baseScale: 0.86, gravityWeight: 0.8 },
  { leftPercent: 68, topPercent: 42, baseScale: 0.68, gravityWeight: 1.2 },
];

// Hero section concentrates kinetic artifacts in the open right-side negative space
const HERO_RIGHT_CLUSTER_POCKETS: ReadonlyArray<{
  leftPercent: number;
  topPercent: number;
  baseScale: number;
  gravityWeight: number;
}> = [
  { leftPercent: 66, topPercent: 18, baseScale: 0.88, gravityWeight: 1.0 },
  { leftPercent: 86, topPercent: 20, baseScale: 1.06, gravityWeight: 1.15 },
  { leftPercent: 75, topPercent: 48, baseScale: 0.8, gravityWeight: 0.95 },
  { leftPercent: 88, topPercent: 68, baseScale: 1.12, gravityWeight: 1.2 },
  { leftPercent: 64, topPercent: 78, baseScale: 0.94, gravityWeight: 0.9 },
];

// Sidebar is tall & narrow (w-64 x 100vh), so distribute pockets vertically across negative space
const SIDEBAR_POCKETS: ReadonlyArray<{
  leftPercent: number;
  topPercent: number;
  baseScale: number;
  gravityWeight: number;
}> = [
  { leftPercent: 78, topPercent: 18, baseScale: 0.78, gravityWeight: 0.9 },
  { leftPercent: 26, topPercent: 44, baseScale: 0.74, gravityWeight: 0.85 },
  { leftPercent: 76, topPercent: 66, baseScale: 0.94, gravityWeight: 1.1 },
  { leftPercent: 32, topPercent: 86, baseScale: 0.82, gravityWeight: 0.95 },
  { leftPercent: 66, topPercent: 35, baseScale: 0.68, gravityWeight: 1.05 },
];

const ENERGETIC_DURATIONS_SEC = [2.5, 3.1, 3.6, 4.1, 4.5] as const;

function resolveOpacityClass(accentColor: string): 'opacity-20' | 'opacity-25' {
  const upper = accentColor.toUpperCase();
  if (upper === '#5DE1D2' || upper === '#9274FF') {
    return 'opacity-25';
  }
  return 'opacity-20';
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export const RESPONSIVE_WATERMARK_BREAKPOINTS = {
  compactMaxPx: 260,
  mediumMaxPx: 460,
  wideMinPx: 760,
} as const;

/**
 * Computes the optimal number of watermark particles based on the observed container width.
 * Narrow containers (such as sidebars or compact cards) use 2–3 particles while wider panels
 * scale cleanly up to 5 particles.
 */
export function computeResponsiveParticleCount(params: {
  containerWidth: number;
  theme: CanonicalWatermarkTheme;
  explicitCount?: number;
}): number {
  const config = FLOATING_WATERMARK_DICTIONARY[params.theme];
  const fallback = clamp(
    Math.floor(params.explicitCount ?? config.defaultCount),
    2,
    5
  );

  if (!Number.isFinite(params.containerWidth) || params.containerWidth <= 0) {
    return fallback;
  }

  let widthCount: number;
  if (params.containerWidth < RESPONSIVE_WATERMARK_BREAKPOINTS.compactMaxPx) {
    widthCount = 2;
  } else if (params.containerWidth < RESPONSIVE_WATERMARK_BREAKPOINTS.mediumMaxPx) {
    widthCount = 3;
  } else if (params.containerWidth < RESPONSIVE_WATERMARK_BREAKPOINTS.wideMinPx) {
    widthCount = 4;
  } else {
    widthCount = 5;
  }

  if (typeof params.explicitCount === 'number' && Number.isFinite(params.explicitCount)) {
    return clamp(Math.min(widthCount, Math.floor(params.explicitCount)), 2, 5);
  }

  return widthCount;
}

export function buildFloatingWatermarkParticles(params: {
  theme: FloatingWatermarkTheme;
  seedIndex?: number;
  count?: number;
  containerWidth?: number;
  layout?: FloatingWatermarkLayout;
}): FloatingWatermarkParticle[] {
  const canonical = resolveFloatingWatermarkTheme(params.theme);
  const config = FLOATING_WATERMARK_DICTIONARY[canonical];
  const safeSeed = Number.isFinite(params.seedIndex)
    ? Math.max(0, Math.floor(params.seedIndex ?? 0))
    : 0;
  const hasWidth =
    typeof params.containerWidth === 'number' &&
    Number.isFinite(params.containerWidth) &&
    params.containerWidth > 0;
  const clampedCount = hasWidth
    ? computeResponsiveParticleCount({
        containerWidth: params.containerWidth!,
        theme: canonical,
        explicitCount: params.count,
      })
    : clamp(Math.floor(params.count ?? config.defaultCount), 3, 5);
  const pockets =
    canonical === 'sidebar'
      ? SIDEBAR_POCKETS
      : params.layout === 'hero-right'
      ? HERO_RIGHT_CLUSTER_POCKETS
      : STANDARD_POCKETS;

  const particles: FloatingWatermarkParticle[] = [];

  for (let i = 0; i < clampedCount; i++) {
    const pocket = pockets[i % pockets.length];
    const glyph = config.glyphs[(safeSeed + i) % config.glyphs.length];
    const accentColor = config.accents[(safeSeed + i) % config.accents.length];
    const durationSec =
      ENERGETIC_DURATIONS_SEC[(safeSeed + i) % ENERGETIC_DURATIONS_SEC.length];
    const delaySec =
      Math.round(((i * 0.22 + (safeSeed % 3) * 0.12) % 0.9) * 100) / 100;

    const jitterLeft = ((safeSeed * 5 + i * 7) % 7) - 3;
    const jitterTop = ((safeSeed * 7 + i * 5) % 7) - 3;
    const minLeft = params.layout === 'hero-right' ? 58 : 12;

    particles.push({
      id: `${canonical}-p${i}-${glyph}`,
      theme: canonical,
      index: i,
      glyph,
      accentColor,
      leftPercent: clamp(pocket.leftPercent + jitterLeft, minLeft, 90),
      topPercent: clamp(pocket.topPercent + jitterTop, 10, 88),
      baseScale: pocket.baseScale,
      opacityClass: resolveOpacityClass(accentColor),
      durationSec,
      delaySec,
      xRange: config.xRange,
      yRange: config.yRange,
      continuousSpin360: SPIN_ENABLED_GLYPHS.has(glyph),
      spinDurationSec: 6.4 + (i % 3) * 1.8,
      spinDirection: i % 2 === 0 ? 1 : -1,
      gravityWeight: pocket.gravityWeight,
    });
  }

  return particles;
}

/**
 * Safely reads the OS/browser `prefers-reduced-motion: reduce` setting.
 */
export function detectPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Evaluates whether watermark motion is enabled.
 * Runs unconditionally across all viewport widths (including 320px–480px mobile),
 * only disabling when OS/browser `prefers-reduced-motion: reduce` is enabled.
 */
export function shouldEnableWatermarkMotion(params: {
  viewportWidth: number;
  prefersReducedMotion: boolean;
  hardwareConcurrency?: number;
}): boolean {
  return !params.prefersReducedMotion;
}

/**
 * Evaluates whether a watermark instance should pause its internal loop when
 * explicitly hidden (e.g. display:none), without gating by viewport width.
 */
export function shouldPauseWatermarkOnMobile(params: {
  theme: CanonicalWatermarkTheme;
  viewportWidth: number;
  isElementHidden?: boolean;
}): boolean {
  return Boolean(params.isElementHidden);
}

export interface WatermarkScrollTriggerConfig {
  start: 'top bottom';
  end: 'max' | 'bottom top';
  toggleActions: 'play pause resume pause';
  invalidateOnRefresh: true;
}

/**
 * Produces ScrollTrigger settings with `invalidateOnRefresh: true` so
 * GSAP recalculates function-based trajectories and clears cached geometry on browser resize.
 * Sticky sidebars use `end: 'max'` so they remain active throughout page scrolling.
 */
export function resolveWatermarkScrollTriggerConfig(params: {
  isSticky: boolean;
}): WatermarkScrollTriggerConfig {
  return {
    start: 'top bottom',
    end: params.isSticky ? 'max' : 'bottom top',
    toggleActions: 'play pause resume pause',
    invalidateOnRefresh: true,
  };
}

export type WatermarkParallaxMode = 'raf' | 'immediate';

export interface WatermarkParallaxConfig {
  mode: WatermarkParallaxMode;
  minPointerDeltaPx: number;
  pauseDuringScroll: boolean;
  scrollCooldownMs: number;
}

export interface ParallaxPointerPoint {
  x: number;
  y: number;
}

export const SIDEBAR_PARALLAX_MIN_DELTA_PX = 1.5;
export const SIDEBAR_PARALLAX_SCROLL_COOLDOWN_MS = 120;

/**
 * Resolves the micro-parallax execution strategy for a FloatingWatermark instance.
 * Defaults to a `requestAnimationFrame`-throttled loop for the Sidebar (and respects
 * explicit overrides) with scroll-cooldown gating to minimize CPU work while scrolling.
 */
export function resolveWatermarkParallaxConfig(params: {
  theme: CanonicalWatermarkTheme;
  parallaxMode?: WatermarkParallaxMode;
}): WatermarkParallaxConfig {
  const mode: WatermarkParallaxMode =
    params.parallaxMode ?? (params.theme === 'sidebar' ? 'raf' : 'raf');

  if (params.theme === 'sidebar') {
    return {
      mode,
      minPointerDeltaPx: SIDEBAR_PARALLAX_MIN_DELTA_PX,
      pauseDuringScroll: true,
      scrollCooldownMs: SIDEBAR_PARALLAX_SCROLL_COOLDOWN_MS,
    };
  }

  return {
    mode,
    minPointerDeltaPx: 1,
    pauseDuringScroll: true,
    scrollCooldownMs: 90,
  };
}

/**
 * Pure guard deciding whether the rAF micro-parallax loop should run GSAP quickTo
 * updates on the current animation frame. Skips work when not hovering, while scrolling,
 * or when pointer movement since the previous applied frame is below `minDeltaPx`.
 */
export function shouldApplyRafParallaxFrame(params: {
  isHovering: boolean;
  isScrolling: boolean;
  pendingPoint: ParallaxPointerPoint | null;
  lastAppliedPoint: ParallaxPointerPoint | null;
  minDeltaPx: number;
}): boolean {
  if (!params.isHovering || params.isScrolling || !params.pendingPoint) {
    return false;
  }
  const { x, y } = params.pendingPoint;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }
  if (!params.lastAppliedPoint) {
    return true;
  }
  const threshold = Number.isFinite(params.minDeltaPx)
    ? Math.max(0, params.minDeltaPx)
    : 0;
  const dist = Math.hypot(
    x - params.lastAppliedPoint.x,
    y - params.lastAppliedPoint.y
  );
  return dist >= threshold;
}

