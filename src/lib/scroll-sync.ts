import type Lenis from '@studio-freight/lenis';
import type { CourseCatalogItem, LocaleCode } from '../shared/types';

export interface GlobalScrollSnapshot {
  scrollY: number;
  limit: number;
  progress: number;
  velocity: number;
  isScrolling: boolean;
  timestampMs: number;
}

export interface WebGLScrollState {
  cameraZ: number;
  scrollY: number;
  scrollBoost: number;
  timeSpeedMultiplier: number;
  accumulatedTime: number;
}

export interface ShowcaseCardItem {
  id: string;
  course: CourseCatalogItem;
  lessonIndex?: number;
  isModuleSpotlight?: boolean;
  title: string;
  subtitle: string;
  subjectLabel: string;
  levelLabel: string;
  metaSummary: string;
  accentColorClass: string;
  indexNumber: string;
}

export const DEFAULT_WEBGL_BASE_Z = 2.6;
export const DEFAULT_WEBGL_MIN_Z = 1.65;
export const DEFAULT_SHOWCASE_TILT_DEG = 2;

let currentSnapshot: GlobalScrollSnapshot = {
  scrollY: 0,
  limit: 1,
  progress: 0,
  velocity: 0,
  isScrolling: false,
  timestampMs: 0,
};

let activeLenisInstance: Lenis | null = null;
const listeners = new Set<(snapshot: GlobalScrollSnapshot) => void>();

export function registerLenisInstance(instance: Lenis | null): void {
  activeLenisInstance = instance;
}

export function getActiveLenisInstance(): Lenis | null {
  return activeLenisInstance;
}

export function scrollGlobalToTop(immediate = true): void {
  if (typeof window === 'undefined') return;
  if (activeLenisInstance) {
    activeLenisInstance.scrollTo(0, { immediate });
  } else {
    window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' });
  }
}

export function publishGlobalScrollSnapshot(next: Partial<GlobalScrollSnapshot>): GlobalScrollSnapshot {
  const scrollY = Number.isFinite(next.scrollY) ? Math.max(0, next.scrollY!) : currentSnapshot.scrollY;
  const limit = Number.isFinite(next.limit) ? Math.max(1, next.limit!) : currentSnapshot.limit;
  const progress = Number.isFinite(next.progress)
    ? Math.max(0, Math.min(1, next.progress!))
    : Math.max(0, Math.min(1, scrollY / limit));
  const velocity = Number.isFinite(next.velocity) ? next.velocity! : 0;
  const isScrolling = Boolean(next.isScrolling);
  const timestampMs = Number.isFinite(next.timestampMs) ? next.timestampMs! : Date.now();

  currentSnapshot = {
    scrollY,
    limit,
    progress,
    velocity,
    isScrolling,
    timestampMs,
  };

  listeners.forEach((listener) => {
    try {
      listener(currentSnapshot);
    } catch {
      // Isolate listener errors
    }
  });

  return currentSnapshot;
}

export function getGlobalScrollSnapshot(): GlobalScrollSnapshot {
  return currentSnapshot;
}

export function subscribeGlobalScroll(
  listener: (snapshot: GlobalScrollSnapshot) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Maps `window.scrollY` smoothly into Three.js PerspectiveCamera Z-position (`[minZ, baseZ]`).
 * Inverted: scrolling down subtly pulls the camera AWAY from the Reactive Data Topography plane
 * (baseZ -> baseZ + (baseZ - minZ)); the 14x14 plane keeps the view fully covered.
 */
export function computeWebGLCameraZ(params: {
  scrollY: number;
  maxScroll?: number;
  baseZ?: number;
  minZ?: number;
}): number {
  const baseZ = params.baseZ ?? DEFAULT_WEBGL_BASE_Z;
  const minZ = params.minZ ?? DEFAULT_WEBGL_MIN_Z;
  const safeMax = Math.max(400, Number.isFinite(params.maxScroll) ? params.maxScroll! : 2400);
  const safeY = Number.isFinite(params.scrollY) ? Math.max(0, params.scrollY) : 0;
  const normalized = Math.max(0, Math.min(1, safeY / safeMax));

  const eased = 1 - Math.pow(1 - normalized, 1.35);
  const z = baseZ + (baseZ - minZ) * eased;
  return Number(z.toFixed(4));
}

/**
 * Converts instantaneous scroll velocity into a bounded fluid distortion boost [0, 1.8]
 * and a shader time speed multiplier [1.0, 5.2].
 * When velocity is 0, boost is 0 and time speed returns to 1.0 (passive idle).
 */
export function computeScrollDistortionBoost(velocity: number): {
  distortionBoost: number;
  timeSpeedMultiplier: number;
} {
  const speed = Number.isFinite(velocity) ? Math.abs(velocity) : 0;
  if (speed < 0.08) {
    return { distortionBoost: 0, timeSpeedMultiplier: 1.0 };
  }

  const normalized = Math.min(1, speed / 32);
  const distortionBoost = Number((normalized * 1.8).toFixed(4));
  const timeSpeedMultiplier = Number((1.0 + normalized * 4.2).toFixed(4));

  return { distortionBoost, timeSpeedMultiplier };
}

/**
 * Advances WebGL scroll-synchronized state over `dtSeconds` with frame-rate-independent
 * exponential damping. Fast scroll accelerates `accumulatedTime` & `scrollBoost`,
 * and stopping cleanly interpolates back to passive idle (`1.0x` time speed, `0` boost).
 */
export function stepWebGLScrollState(
  prev: WebGLScrollState,
  input: {
    scrollY: number;
    maxScroll?: number;
    velocity: number;
    baseZ?: number;
    minZ?: number;
  },
  dtSeconds: number
): WebGLScrollState {
  const dt = Math.max(0.001, Math.min(0.1, Number.isFinite(dtSeconds) ? dtSeconds : 0.016));
  const targetCameraZ = computeWebGLCameraZ({
    scrollY: input.scrollY,
    maxScroll: input.maxScroll,
    baseZ: input.baseZ,
    minZ: input.minZ,
  });

  const { distortionBoost, timeSpeedMultiplier } = computeScrollDistortionBoost(input.velocity);

  const zAlpha = 1 - Math.exp(-8.5 * dt);
  const boostAlpha = 1 - Math.exp(-(distortionBoost > prev.scrollBoost ? 14 : 4.2) * dt);
  const scrollAlpha = 1 - Math.exp(-10 * dt);

  const nextCameraZ = prev.cameraZ + (targetCameraZ - prev.cameraZ) * zAlpha;
  const nextScrollY = prev.scrollY + (Math.max(0, input.scrollY) - prev.scrollY) * scrollAlpha;
  const nextBoost = prev.scrollBoost + (distortionBoost - prev.scrollBoost) * boostAlpha;
  const nextSpeed =
    prev.timeSpeedMultiplier + (timeSpeedMultiplier - prev.timeSpeedMultiplier) * boostAlpha;

  const cleanBoost = nextBoost < 0.002 && distortionBoost === 0 ? 0 : nextBoost;
  const cleanSpeed =
    Math.abs(nextSpeed - 1.0) < 0.004 && timeSpeedMultiplier === 1.0 ? 1.0 : nextSpeed;

  const nextAccumulatedTime = prev.accumulatedTime + dt * cleanSpeed;

  return {
    cameraZ: Number(nextCameraZ.toFixed(5)),
    scrollY: Number(nextScrollY.toFixed(3)),
    scrollBoost: Number(cleanBoost.toFixed(4)),
    timeSpeedMultiplier: Number(cleanSpeed.toFixed(4)),
    accumulatedTime: Number(nextAccumulatedTime.toFixed(5)),
  };
}

export const DEFAULT_BG_PARALLAX_MAX_PX = 25;

export interface ViscousBackgroundScrollState {
  scrollY: number;
  scrollProgress: number;
  velocitySmooth: number;
  cameraZ: number;
  accumulatedTime: number;
}

/**
 * Maps viewport pointer coordinates to normalized [-1, 1] space and returns an
 * same-direction micro-parallax offset within [-maxOffsetPx, maxOffsetPx].
 */
export function computeBackgroundParallaxOffset(params: {
  clientX: number;
  clientY: number;
  viewportWidth: number;
  viewportHeight: number;
  maxOffsetPx?: number;
}): { x: number; y: number; normalizedX: number; normalizedY: number } {
  const maxOffset = Math.max(0, params.maxOffsetPx ?? DEFAULT_BG_PARALLAX_MAX_PX);
  const w = Math.max(1, Number.isFinite(params.viewportWidth) ? params.viewportWidth : 1);
  const h = Math.max(1, Number.isFinite(params.viewportHeight) ? params.viewportHeight : 1);
  const rawX = Number.isFinite(params.clientX) ? params.clientX : w / 2;
  const rawY = Number.isFinite(params.clientY) ? params.clientY : h / 2;

  const normalizedX = Math.max(-1, Math.min(1, (rawX / w) * 2 - 1));
  const normalizedY = Math.max(-1, Math.min(1, (rawY / h) * 2 - 1));

  // Inverted: the layer now drifts WITH the cursor (was opposite to it)
  const x = Number((normalizedX * maxOffset).toFixed(2));
  const y = Number((normalizedY * maxOffset).toFixed(2));

  return {
    x: Object.is(x, -0) ? 0 : x,
    y: Object.is(y, -0) ? 0 : y,
    normalizedX: Number(normalizedX.toFixed(4)),
    normalizedY: Number(normalizedY.toFixed(4)),
  };
}

/**
 * Heavy, viscous lerp damping for GSAP ScrollTrigger-scrubbed background physics.
 * Eliminates high-frequency scroll jitter by constraining velocity impulse and smoothing camera Z.
 */
export function stepViscousBackgroundScroll(
  prev: ViscousBackgroundScrollState,
  input: {
    scrubbedProgress: number;
    scrubbedScrollY: number;
    maxScroll?: number;
    baseZ?: number;
    minZ?: number;
  },
  dtSeconds: number
): ViscousBackgroundScrollState {
  const dt = Math.max(0.001, Math.min(0.05, Number.isFinite(dtSeconds) ? dtSeconds : 0.016));
  const targetProgress = Math.max(
    0,
    Math.min(1, Number.isFinite(input.scrubbedProgress) ? input.scrubbedProgress : 0)
  );
  const targetScrollY = Math.max(0, Number.isFinite(input.scrubbedScrollY) ? input.scrubbedScrollY : 0);

  // Heavy viscous damping coefficients so scroll transitions glide smoothly
  const posAlpha = 1 - Math.exp(-3.5 * dt);
  const delta = Math.abs(targetScrollY - prev.scrollY);
  const nextScrollY =
    delta < 0.01 ? targetScrollY : prev.scrollY + (targetScrollY - prev.scrollY) * posAlpha;
  const nextProgress = prev.scrollProgress + (targetProgress - prev.scrollProgress) * posAlpha;

  const targetVel = delta < 0.05 ? 0 : Math.min(0.32, delta * 0.0022);
  const velAlpha = 1 - Math.exp(-2.8 * dt);
  const nextVel = prev.velocitySmooth + (targetVel - prev.velocitySmooth) * velAlpha;
  const cleanVel = nextVel < 0.001 && targetVel === 0 ? 0 : nextVel;

  const baseZ = input.baseZ ?? DEFAULT_WEBGL_BASE_Z;
  const minZ = input.minZ ?? DEFAULT_WEBGL_MIN_Z;
  const targetCameraZ = computeWebGLCameraZ({
    scrollY: nextScrollY,
    maxScroll: input.maxScroll,
    baseZ,
    minZ,
  });
  const nextCameraZ = prev.cameraZ + (targetCameraZ - prev.cameraZ) * posAlpha;

  // Calm steady shader time progression (gentle max +0.35x drift instead of violent 5x jumps)
  const nextAccumulatedTime = prev.accumulatedTime + dt * (1.0 + cleanVel * 1.1);

  return {
    scrollY: Number(nextScrollY.toFixed(3)),
    scrollProgress: Number(nextProgress.toFixed(5)),
    velocitySmooth: Number(cleanVel.toFixed(4)),
    cameraZ: Number(nextCameraZ.toFixed(5)),
    accumulatedTime: Number(nextAccumulatedTime.toFixed(5)),
  };
}

/**
 * Computes staggered tactile tilt angle (in degrees) for horizontal CourseShowcase cards
 * during active ScrollTrigger scrubbing. Forward scroll produces negative tilt (e.g. ~ -2deg)
 * with subtle per-card stagger; reverse scroll produces positive tilt; settling returns 0deg.
 */
export function computeShowcaseCardTiltDeg(params: {
  velocity: number;
  cardIndex: number;
  baseTiltDeg?: number;
}): number {
  const vel = Number.isFinite(params.velocity) ? params.velocity : 0;
  const absVel = Math.abs(vel);
  if (absVel < 25) {
    return 0;
  }

  const baseTilt = params.baseTiltDeg ?? DEFAULT_SHOWCASE_TILT_DEG;
  const direction = vel > 0 ? -1 : 1;
  const speedRatio = Math.max(0.35, Math.min(1.35, absVel / 900));
  const staggerOffset = (params.cardIndex % 3) * 0.45 - 0.35;

  const rawDeg = direction * (baseTilt * speedRatio + staggerOffset);
  const clamped = Math.max(-4.5, Math.min(4.5, rawDeg));
  return Number(clamped.toFixed(2));
}

export function buildShowcaseCardItems(
  courses: CourseCatalogItem[],
  locale: LocaleCode,
  subjectLabels: Record<'Economics' | 'Mathematics' | 'Business', string>,
  levelLabels: Record<'Beginner' | 'Intermediate' | 'Advanced', string>
): ShowcaseCardItem[] {
  const ordered = [...courses];
  const minUnit = locale === 'uz' ? 'daq' : 'min';
  const lessonUnit = locale === 'uz' ? 'dars' : 'lessons';

  const items: ShowcaseCardItem[] = ordered.map((course, idx) => {
    const ed = course.editions[locale] ?? course.editions.en ?? course.editions.uz;
    const accentColorClass =
      course.subject === 'Economics'
        ? 'text-theme-cyan'
        : course.subject === 'Mathematics'
        ? 'text-theme-amber'
        : 'text-theme-accent';

    const lessonCount = ed?.lessonCount ?? 0;
    const mins = ed?.estimatedMinutes ?? course.estimatedMinutes;

    return {
      id: course.id,
      course,
      title: ed?.title ?? course.slug,
      subtitle: ed?.subtitle ?? ed?.description ?? '',
      subjectLabel: subjectLabels[course.subject] ?? course.subject,
      levelLabel: levelLabels[course.level] ?? course.level,
      metaSummary: `${lessonCount} ${lessonUnit} · ${mins} ${minUnit}`,
      accentColorClass,
      indexNumber: String(idx + 1).padStart(2, '0'),
    };
  });

  if (items.length > 0 && items.length < 6) {
    for (let cIdx = 0; cIdx < ordered.length && items.length < 6; cIdx += 1) {
      const course = ordered[cIdx]!;
      const ed = course.editions[locale] ?? course.editions.en ?? course.editions.uz;
      if (!ed) continue;
      const accentColorClass =
        course.subject === 'Economics'
          ? 'text-theme-cyan'
          : course.subject === 'Mathematics'
          ? 'text-theme-amber'
          : 'text-theme-accent';
      const spotlightLessonIdx = Math.min(1, Math.max(0, (ed.lessonTitles?.length ?? 1) - 1));
      const spotlightTitle =
        ed.lessonTitles?.[spotlightLessonIdx] ?? ed.outcomes?.[0] ?? ed.title;
      const spotlightDesc =
        ed.outcomes?.[spotlightLessonIdx] ?? ed.outcomes?.[0] ?? ed.description;

      items.push({
        id: `${course.id}-module-${spotlightLessonIdx}`,
        course,
        lessonIndex: spotlightLessonIdx,
        isModuleSpotlight: true,
        title: spotlightTitle,
        subtitle: spotlightDesc,
        subjectLabel: subjectLabels[course.subject] ?? course.subject,
        levelLabel: ed.title,
        metaSummary: `${locale === 'uz' ? 'Dars' : 'Module'} ${spotlightLessonIdx + 1} · ${Math.max(12, Math.round(ed.estimatedMinutes / Math.max(1, ed.lessonCount)))} ${minUnit}`,
        accentColorClass,
        indexNumber: String(items.length + 1).padStart(2, '0'),
      });
    }
  }

  return items;
}
