export type ArtifactSubject = 'Mathematics' | 'Economics' | 'Business';

export type ArtifactKind =
  | 'icosahedron'
  | 'sigma-symbol'
  | 'integral-symbol'
  | 'drafting-compass'
  | 'candlesticks'
  | 'line-graph'
  | 'network-nodes'
  | 'chess-knight'
  | 'bento-grid'
  | 'briefcase';

export type ArtifactAccentToken = 'accent' | 'teal' | 'success';

export interface SubjectArtifactSpec {
  id: string;
  subject: ArtifactSubject;
  kind: ArtifactKind;
  /** Horizontal viewport anchor in % (0..100) */
  xPercent: number;
  /** Vertical viewport anchor in % (0..100) */
  yPercent: number;
  /** Depth plane from 0.18 (distant background) to 1.0 (near foreground) */
  depth: number;
  /** Visual scale multiplier derived from depth */
  scale: number;
  /** Opacity derived from depth so distant artifacts recede */
  opacity: number;
  /** Initial rotation angle in degrees */
  initialRotationDeg: number;
  /** Continuous passive rotation delta in degrees per full cycle */
  passiveRotationDir: 1 | -1;
  /** Duration in seconds for one slow passive rotation cycle */
  passiveRotationDurationSec: number;
  /** Accent token for the hard unblurred drop shadow */
  accentToken: ArtifactAccentToken;
}

export const ARTIFACT_ACCENT_CSS_VAR: Record<ArtifactAccentToken, string> = {
  accent: 'var(--econova-accent)',
  teal: 'var(--econova-teal)',
  success: 'var(--econova-success)',
};

export const ARTIFACT_SURFACE_FILL = 'var(--econova-surface)';
export const ARTIFACT_BORDER_STROKE = 'var(--econova-line)';

export const SUBJECT_ARTIFACT_SPECS: readonly SubjectArtifactSpec[] = [
  {
    id: 'math-icosahedron-nw',
    subject: 'Mathematics',
    kind: 'icosahedron',
    xPercent: 23,
    yPercent: 14,
    depth: 0.92,
    scale: 1.12,
    opacity: 0.82,
    initialRotationDeg: -8,
    passiveRotationDir: 1,
    passiveRotationDurationSec: 54,
    accentToken: 'accent',
  },
  {
    id: 'econ-candlesticks-ne',
    subject: 'Economics',
    kind: 'candlesticks',
    xPercent: 95,
    yPercent: 16,
    depth: 0.85,
    scale: 1.04,
    opacity: 0.78,
    initialRotationDeg: 6,
    passiveRotationDir: -1,
    passiveRotationDurationSec: 62,
    accentToken: 'teal',
  },
  {
    id: 'biz-knight-mid-right',
    subject: 'Business',
    kind: 'chess-knight',
    xPercent: 94,
    yPercent: 48,
    depth: 0.96,
    scale: 1.16,
    opacity: 0.84,
    initialRotationDeg: -5,
    passiveRotationDir: 1,
    passiveRotationDurationSec: 68,
    accentToken: 'success',
  },
  {
    id: 'math-sigma-center-left',
    subject: 'Mathematics',
    kind: 'sigma-symbol',
    xPercent: 21,
    yPercent: 46,
    depth: 0.44,
    scale: 0.72,
    opacity: 0.52,
    initialRotationDeg: 11,
    passiveRotationDir: -1,
    passiveRotationDurationSec: 76,
    accentToken: 'accent',
  },
  {
    id: 'econ-network-upper-mid',
    subject: 'Economics',
    kind: 'network-nodes',
    xPercent: 56,
    yPercent: 10,
    depth: 0.36,
    scale: 0.64,
    opacity: 0.46,
    initialRotationDeg: -14,
    passiveRotationDir: 1,
    passiveRotationDurationSec: 84,
    accentToken: 'teal',
  },
  {
    id: 'biz-bento-center',
    subject: 'Business',
    kind: 'bento-grid',
    xPercent: 38,
    yPercent: 34,
    depth: 0.28,
    scale: 0.58,
    opacity: 0.38,
    initialRotationDeg: 9,
    passiveRotationDir: -1,
    passiveRotationDurationSec: 88,
    accentToken: 'success',
  },
  {
    id: 'math-integral-mid-right',
    subject: 'Mathematics',
    kind: 'integral-symbol',
    xPercent: 78,
    yPercent: 28,
    depth: 0.58,
    scale: 0.82,
    opacity: 0.58,
    initialRotationDeg: 7,
    passiveRotationDir: 1,
    passiveRotationDurationSec: 70,
    accentToken: 'accent',
  },
  {
    id: 'econ-linegraph-lower-left',
    subject: 'Economics',
    kind: 'line-graph',
    xPercent: 24,
    yPercent: 76,
    depth: 0.88,
    scale: 1.08,
    opacity: 0.78,
    initialRotationDeg: -6,
    passiveRotationDir: -1,
    passiveRotationDurationSec: 60,
    accentToken: 'teal',
  },
  {
    id: 'biz-briefcase-sw',
    subject: 'Business',
    kind: 'briefcase',
    xPercent: 22,
    yPercent: 91,
    depth: 0.50,
    scale: 0.76,
    opacity: 0.54,
    initialRotationDeg: 12,
    passiveRotationDir: 1,
    passiveRotationDurationSec: 74,
    accentToken: 'success',
  },
  {
    id: 'math-compass-bottom-center',
    subject: 'Mathematics',
    kind: 'drafting-compass',
    xPercent: 58,
    yPercent: 86,
    depth: 0.78,
    scale: 0.96,
    opacity: 0.72,
    initialRotationDeg: -11,
    passiveRotationDir: -1,
    passiveRotationDurationSec: 64,
    accentToken: 'accent',
  },
  {
    id: 'econ-candlesticks-center-low',
    subject: 'Economics',
    kind: 'candlesticks',
    xPercent: 45,
    yPercent: 62,
    depth: 0.24,
    scale: 0.54,
    opacity: 0.36,
    initialRotationDeg: 15,
    passiveRotationDir: 1,
    passiveRotationDurationSec: 90,
    accentToken: 'teal',
  },
  {
    id: 'biz-knight-se',
    subject: 'Business',
    kind: 'chess-knight',
    xPercent: 90,
    yPercent: 88,
    depth: 0.66,
    scale: 0.88,
    opacity: 0.64,
    initialRotationDeg: 8,
    passiveRotationDir: -1,
    passiveRotationDurationSec: 66,
    accentToken: 'success',
  },
  {
    id: 'math-icosahedron-center-right',
    subject: 'Mathematics',
    kind: 'icosahedron',
    xPercent: 72,
    yPercent: 60,
    depth: 0.32,
    scale: 0.60,
    opacity: 0.42,
    initialRotationDeg: 18,
    passiveRotationDir: 1,
    passiveRotationDurationSec: 82,
    accentToken: 'accent',
  },
  {
    id: 'econ-network-se-edge',
    subject: 'Economics',
    kind: 'network-nodes',
    xPercent: 95,
    yPercent: 69,
    depth: 0.54,
    scale: 0.78,
    opacity: 0.56,
    initialRotationDeg: -9,
    passiveRotationDir: -1,
    passiveRotationDurationSec: 72,
    accentToken: 'teal',
  },
];

/**
 * Clamps normalized pointer coordinate to [-1, 1].
 */
export function clampNormalizedPointer(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

/**
 * Converts viewport pixel coordinates into normalized pointer space [-1, 1].
 */
export function normalizeViewportPointer(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  const safeW = viewportWidth > 0 ? viewportWidth : 1;
  const safeH = viewportHeight > 0 ? viewportHeight : 1;
  const rawX = (clientX / safeW - 0.5) * 2;
  const rawY = (clientY / safeH - 0.5) * 2;
  return {
    x: clampNormalizedPointer(rawX),
    y: clampNormalizedPointer(rawY),
  };
}

/**
 * Computes GSAP mouse parallax displacement in pixels for a given artifact depth.
 * Nearer items (higher depth) translate significantly further than distant items,
 * producing a crisp 3D parallax hierarchy.
 */
export function computeArtifactParallaxOffset(params: {
  normalizedPointerX: number;
  normalizedPointerY: number;
  depth: number;
  maxDisplacementPx?: number;
}): { x: number; y: number } {
  const maxPx = params.maxDisplacementPx ?? 46;
  const clampedDepth = Math.max(0.1, Math.min(1.2, params.depth));
  const nx = clampNormalizedPointer(params.normalizedPointerX);
  const ny = clampNormalizedPointer(params.normalizedPointerY);

  // Subtle quadratic depth curve exaggerates foreground vs far background separation
  const depthFactor = clampedDepth * (0.45 + 0.55 * clampedDepth);

  return {
    x: Math.round(nx * maxPx * depthFactor * 100) / 100,
    y: Math.round(ny * maxPx * depthFactor * 100) / 100,
  };
}

/**
 * Resolves Neobrutalist shadow offset & CSS color tokens for an artifact.
 */
export function resolveArtifactShadowStyle(spec: Pick<SubjectArtifactSpec, 'depth' | 'accentToken'>): {
  shadowOffsetPx: number;
  accentColorVar: string;
  dropShadowFilter: string;
} {
  const shadowOffsetPx = spec.depth >= 0.75 ? 6 : spec.depth >= 0.45 ? 4 : 3;
  const accentColorVar = ARTIFACT_ACCENT_CSS_VAR[spec.accentToken];
  return {
    shadowOffsetPx,
    accentColorVar,
    dropShadowFilter: `drop-shadow(${shadowOffsetPx}px ${shadowOffsetPx}px 0px ${accentColorVar})`,
  };
}

export const PRIMARY_ARTIFACT_ACCENT_COLORS = {
  cyan: '#5DE1D2',
  purple: '#9274FF',
  green: '#6FE0A1',
} as const;

export const SUBJECT_WATERMARK_KINDS: Record<ArtifactSubject, readonly ArtifactKind[]> = {
  Business: ['chess-knight', 'bento-grid', 'briefcase'],
  Economics: ['candlesticks', 'line-graph', 'network-nodes'],
  Mathematics: ['icosahedron', 'sigma-symbol', 'integral-symbol', 'drafting-compass'],
};

export const SUBJECT_WATERMARK_ACCENTS: Record<ArtifactSubject, readonly string[]> = {
  Business: [
    PRIMARY_ARTIFACT_ACCENT_COLORS.purple,
    PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
    PRIMARY_ARTIFACT_ACCENT_COLORS.green,
  ],
  Economics: [
    PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
    PRIMARY_ARTIFACT_ACCENT_COLORS.purple,
    PRIMARY_ARTIFACT_ACCENT_COLORS.green,
  ],
  Mathematics: [
    PRIMARY_ARTIFACT_ACCENT_COLORS.purple,
    PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
    PRIMARY_ARTIFACT_ACCENT_COLORS.green,
  ],
};

export interface EmbeddedWatermarkSpec {
  kind: ArtifactKind;
  accentColor: string;
}

const BUSINESS_MODULE_WATERMARKS: Record<string, EmbeddedWatermarkSpec> = {
  'unit-economics': {
    kind: 'chess-knight',
    accentColor: PRIMARY_ARTIFACT_ACCENT_COLORS.purple,
  },
  'cash-conversion': {
    kind: 'bento-grid',
    accentColor: PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
  },
  'capital-allocation': {
    kind: 'briefcase',
    accentColor: PRIMARY_ARTIFACT_ACCENT_COLORS.green,
  },
  'moat-pricing': {
    kind: 'chess-knight',
    accentColor: PRIMARY_ARTIFACT_ACCENT_COLORS.cyan,
  },
};

export function resolveBusinessModuleWatermark(
  moduleId: string,
  index = 0
): EmbeddedWatermarkSpec {
  if (moduleId in BUSINESS_MODULE_WATERMARKS) {
    return BUSINESS_MODULE_WATERMARKS[moduleId];
  }
  return resolveCourseWatermarkArtifact('Business', index);
}

export function resolveCourseWatermarkArtifact(
  subject: ArtifactSubject,
  index = 0
): EmbeddedWatermarkSpec {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const kinds = SUBJECT_WATERMARK_KINDS[subject];
  const accents = SUBJECT_WATERMARK_ACCENTS[subject];
  return {
    kind: kinds[safeIndex % kinds.length],
    accentColor: accents[safeIndex % accents.length],
  };
}

export const BENTO_HOVER_PHYSICS = {
  resting: {
    scale: 1,
    y: 0,
    boxShadow: '8px 8px 0px #000000',
    svgRotation: 0,
    svgScale: 1,
    duration: 0.3,
    ease: 'power2.out',
  },
  hover: {
    scale: 1.02,
    y: -5,
    boxShadow: '14px 14px 0px #000000',
    svgRotation: 15,
    svgScale: 1.1,
    duration: 0.3,
    ease: 'power2.out',
  },
} as const;

