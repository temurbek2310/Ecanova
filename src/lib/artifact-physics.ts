import {
  SUBJECT_WATERMARK_ACCENTS,
  SUBJECT_WATERMARK_KINDS,
  type ArtifactKind,
  type ArtifactSubject,
} from './subject-artifacts';

export interface ArtifactWaypoint {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  durationSec: number;
  holdSec: number;
}

export interface SubjectPhysicsProfile {
  subject: ArtifactSubject;
  profileName: 'structured-geometric' | 'market-flow' | 'strategic-tactical';
  ease: 'power1.inOut' | 'sine.inOut' | 'expo.inOut';
  waypoints: readonly ArtifactWaypoint[];
  cursorPullMaxPx: number;
  cursorPullDurationSec: number;
  cursorPullEase: 'power3.out';
  maxAnchorDriftRadiusPx: number;
}

export interface ConstellationParticleSpec {
  id: string;
  index: number;
  kind: ArtifactKind;
  accentColor: string;
  /** Starting anchor inside the card (% of width & height) */
  leftPercent: number;
  topPercent: number;
  /** Initial scale in [0.5, 1.2] */
  baseScale: number;
  /** Strict subtle opacity class so foreground copy remains crisp */
  opacityClass: 'opacity-10' | 'opacity-15';
  /** Energetic drift cycle duration in [3, 6] seconds */
  durationSec: number;
  /** Staggered start delay per particle */
  delaySec: number;
  /** Optional tactical hold between strides (used by Business) */
  repeatDelaySec: number;
  /** Randomized drift bounds for GSAP repeatRefresh */
  xRange: readonly [number, number];
  yRange: readonly [number, number];
  /** Continuous 360-degree spin on geometric elements */
  continuousSpin360: boolean;
  spinDurationSec: number;
  spinDirection: 1 | -1;
  /** Magnetic gravity weight on card hover */
  gravityWeight: number;
}

/**
 * Subject-specific GSAP motion profiles for Contained Floating Artifacts & Particle Swarms:
 * - Mathematics: Sharp, structured geometric trajectories (`power1.inOut`)
 * - Economics: Continuous undulating waves and market-trend flows (`sine.inOut`)
 * - Business: Calculated chess-like tactical glides with holds (`expo.inOut`)
 */
export const SUBJECT_PHYSICS_PROFILES: Record<ArtifactSubject, SubjectPhysicsProfile> = {
  Mathematics: {
    subject: 'Mathematics',
    profileName: 'structured-geometric',
    ease: 'power1.inOut',
    waypoints: [
      { x: -24, y: -12, rotation: -10, scale: 1.04, durationSec: 1.35, holdSec: 0 },
      { x: -34, y: -28, rotation: 14, scale: 0.98, durationSec: 1.35, holdSec: 0 },
      { x: -10, y: -26, rotation: -6, scale: 1.03, durationSec: 1.25, holdSec: 0 },
      { x: 0, y: 0, rotation: 0, scale: 1, durationSec: 1.35, holdSec: 0 },
    ],
    cursorPullMaxPx: 26,
    cursorPullDurationSec: 0.34,
    cursorPullEase: 'power3.out',
    maxAnchorDriftRadiusPx: 46,
  },
  Economics: {
    subject: 'Economics',
    profileName: 'market-flow',
    ease: 'sine.inOut',
    waypoints: [
      { x: -16, y: -24, rotation: 5, scale: 1.05, durationSec: 2.1, holdSec: 0 },
      { x: -34, y: -8, rotation: -6, scale: 1.02, durationSec: 2.2, holdSec: 0 },
      { x: -12, y: -18, rotation: 3, scale: 1.04, durationSec: 1.9, holdSec: 0 },
      { x: 0, y: 0, rotation: 0, scale: 1, durationSec: 2.0, holdSec: 0 },
    ],
    cursorPullMaxPx: 28,
    cursorPullDurationSec: 0.38,
    cursorPullEase: 'power3.out',
    maxAnchorDriftRadiusPx: 46,
  },
  Business: {
    subject: 'Business',
    profileName: 'strategic-tactical',
    ease: 'expo.inOut',
    waypoints: [
      { x: -28, y: 0, rotation: -4, scale: 1.03, durationSec: 1.05, holdSec: 0.7 },
      { x: -28, y: -26, rotation: 7, scale: 1.06, durationSec: 1.05, holdSec: 0.85 },
      { x: 0, y: -20, rotation: -3, scale: 1.02, durationSec: 1.05, holdSec: 0.65 },
      { x: 0, y: 0, rotation: 0, scale: 1, durationSec: 1.05, holdSec: 0.75 },
    ],
    cursorPullMaxPx: 24,
    cursorPullDurationSec: 0.32,
    cursorPullEase: 'power3.out',
    maxAnchorDriftRadiusPx: 46,
  },
};

export function getSubjectPhysicsProfile(subject: ArtifactSubject): SubjectPhysicsProfile {
  return SUBJECT_PHYSICS_PROFILES[subject];
}

export function clampAxis(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

const GEOMETRIC_SPIN_KINDS = new Set<ArtifactKind>([
  'icosahedron',
  'drafting-compass',
  'network-nodes',
  'bento-grid',
  'sigma-symbol',
]);

// Negative-space pockets distributed across cards (right, bottom-right, lower-center, upper-right, mid-bottom-left)
const CONSTELLATION_ANCHORS: ReadonlyArray<{
  leftPercent: number;
  topPercent: number;
  baseScale: number;
  opacityClass: 'opacity-10' | 'opacity-15';
  gravityWeight: number;
}> = [
  { leftPercent: 80, topPercent: 68, baseScale: 1.15, opacityClass: 'opacity-15', gravityWeight: 1.15 },
  { leftPercent: 56, topPercent: 74, baseScale: 0.72, opacityClass: 'opacity-10', gravityWeight: 0.85 },
  { leftPercent: 84, topPercent: 24, baseScale: 0.62, opacityClass: 'opacity-15', gravityWeight: 0.95 },
  { leftPercent: 22, topPercent: 72, baseScale: 0.88, opacityClass: 'opacity-10', gravityWeight: 0.75 },
  { leftPercent: 68, topPercent: 44, baseScale: 0.54, opacityClass: 'opacity-10', gravityWeight: 1.25 },
];

const ENERGETIC_DURATIONS_SEC = [3.2, 4.4, 3.7, 5.1, 4.0] as const;

/**
 * Generates a deterministic constellation of 3..5 micro-particle SVGs per card
 * with varied sizes (`scale: 0.5..1.2`), distributed across negative space,
 * strict `opacity-10`/`opacity-15`, and energetic 3..6s subject-tuned lifecycles.
 */
export function buildArtifactConstellation(params: {
  subject: ArtifactSubject;
  seedIndex?: number;
  count?: number;
  preferredKind?: ArtifactKind;
}): ConstellationParticleSpec[] {
  const safeSeed = Number.isFinite(params.seedIndex)
    ? Math.max(0, Math.floor(params.seedIndex ?? 0))
    : 0;
  const clampedCount = Math.max(3, Math.min(5, Math.floor(params.count ?? 4)));
  const kinds = SUBJECT_WATERMARK_KINDS[params.subject];
  const accents = SUBJECT_WATERMARK_ACCENTS[params.subject];

  const particles: ConstellationParticleSpec[] = [];

  for (let i = 0; i < clampedCount; i++) {
    const anchor = CONSTELLATION_ANCHORS[i % CONSTELLATION_ANCHORS.length];
    const kind =
      i === 0 && params.preferredKind
        ? params.preferredKind
        : kinds[(safeSeed + i) % kinds.length];
    const accentColor = accents[(safeSeed + i) % accents.length];
    const durationSec = ENERGETIC_DURATIONS_SEC[(safeSeed + i) % ENERGETIC_DURATIONS_SEC.length];
    const delaySec = Math.round(((i * 0.27 + (safeSeed % 3) * 0.12) % 1.2) * 100) / 100;
    const repeatDelaySec =
      params.subject === 'Business'
        ? Math.round((0.45 + (i % 3) * 0.2) * 100) / 100
        : 0;

    // Slight deterministic offset per seed so sibling cards don't share identical starfields
    const jitterLeft = ((safeSeed * 7 + i * 5) % 9) - 4;
    const jitterTop = ((safeSeed * 5 + i * 7) % 9) - 4;
    const continuousSpin360 =
      GEOMETRIC_SPIN_KINDS.has(kind) || i % 2 === 1;

    particles.push({
      id: `${params.subject.toLowerCase()}-p${i}-${kind}`,
      index: i,
      kind,
      accentColor,
      leftPercent: clampAxis(anchor.leftPercent + jitterLeft, 10, 88),
      topPercent: clampAxis(anchor.topPercent + jitterTop, 12, 84),
      baseScale: anchor.baseScale,
      opacityClass: anchor.opacityClass,
      durationSec,
      delaySec,
      repeatDelaySec,
      xRange: [-25, 25],
      yRange: [-30, 30],
      continuousSpin360,
      spinDurationSec: 6.5 + (i % 3) * 2.2,
      spinDirection: i % 2 === 0 ? 1 : -1,
      gravityWeight: anchor.gravityWeight,
    });
  }

  return particles;
}

/**
 * Computes bounded magnetic gravity pull for an individual constellation particle
 * toward the hovered cursor coordinates inside the card.
 */
export function computeParticleMagneticGravity(params: {
  clientX: number;
  clientY: number;
  cardRect: { left: number; top: number; width: number; height: number };
  leftPercent: number;
  topPercent: number;
  gravityWeight: number;
  maxPullPx: number;
}): { x: number; y: number } {
  const safeW = params.cardRect.width > 0 ? params.cardRect.width : 1;
  const safeH = params.cardRect.height > 0 ? params.cardRect.height : 1;

  // Cursor normalized [0, 1] inside card
  const cursorNormX = clampAxis((params.clientX - params.cardRect.left) / safeW, 0, 1);
  const cursorNormY = clampAxis((params.clientY - params.cardRect.top) / safeH, 0, 1);

  // Delta from particle's anchor [0, 1] toward cursor [0, 1] -> [-1, 1]
  const deltaX = clampAxis(cursorNormX - params.leftPercent / 100, -1, 1);
  const deltaY = clampAxis(cursorNormY - params.topPercent / 100, -1, 1);

  const bound = params.maxPullPx * 1.25;
  return {
    x: Math.round(clampAxis(deltaX * params.maxPullPx * params.gravityWeight, -bound, bound) * 100) / 100,
    y: Math.round(clampAxis(deltaY * params.maxPullPx * params.gravityWeight, -bound, bound) * 100) / 100,
  };
}

/**
 * Computes bounded micro-parallax pull toward the cursor within card bounds.
 */
export function computeContainedArtifactCursorOffset(params: {
  clientX: number;
  clientY: number;
  cardRect: { left: number; top: number; width: number; height: number };
  maxPullPx: number;
}): { x: number; y: number; rotation: number; scale: number } {
  const safeWidth = params.cardRect.width > 0 ? params.cardRect.width : 1;
  const safeHeight = params.cardRect.height > 0 ? params.cardRect.height : 1;

  const normX = clampAxis(((params.clientX - params.cardRect.left) / safeWidth - 0.5) * 2, -1, 1);
  const normY = clampAxis(((params.clientY - params.cardRect.top) / safeHeight - 0.5) * 2, -1, 1);

  const x = Math.round(clampAxis((normX - 0.35) * params.maxPullPx, -params.maxPullPx * 1.35, params.maxPullPx * 0.65) * 100) / 100;
  const y = Math.round(clampAxis((normY - 0.35) * params.maxPullPx, -params.maxPullPx * 1.35, params.maxPullPx * 0.65) * 100) / 100;
  const rotation = Math.round(clampAxis(normX * 10 - normY * 4, -12, 12) * 100) / 100;

  return {
    x,
    y,
    rotation,
    scale: 1.08,
  };
}

/**
 * Guards against running continuous infinite GSAP physics loops on reduced-motion
 * settings, narrow mobile viewports, or constrained low-core devices.
 */
export function shouldEnableComplexArtifactPhysics(params: {
  isDesktopViewport: boolean;
  prefersReducedMotion: boolean;
  hardwareConcurrency?: number;
}): boolean {
  if (params.prefersReducedMotion) return false;
  if (!params.isDesktopViewport) return false;
  if (
    typeof params.hardwareConcurrency === 'number' &&
    Number.isFinite(params.hardwareConcurrency) &&
    params.hardwareConcurrency > 0 &&
    params.hardwareConcurrency <= 2
  ) {
    return false;
  }
  return true;
}
