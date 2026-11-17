export const LESSON_MILESTONE_TARGET = 50;

export const GEOMETRIC_NOVA_ACCENTS = [
  '#5DE1D2', // Cyan
  '#9274FF', // Purple
  '#6FE0A1', // Green
] as const;

export type GeometricShardShapeKind =
  | 'triangle'
  | 'polygon'
  | 'shard'
  | 'wireframe-diamond';

export interface GeometricShardSpec {
  id: number;
  shapeKind: GeometricShardShapeKind;
  points: string;
  color: string;
  opacity: number;
  filled: boolean;
  strokeWidth: number;
  sizePx: number;
  explodeX: number;
  explodeY: number;
  driftX: number;
  fallY: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  delaySec: number;
  fallDurationSec: number;
}

const SHARD_POLYGON_POINTS: Record<GeometricShardShapeKind, string[]> = {
  triangle: ['16,2 30,28 2,28', '16,3 29,26 5,29'],
  polygon: ['16,2 29,11 24,28 8,28 3,11', '16,2 28,9 26,24 12,30 4,18'],
  shard: ['6,2 28,8 18,30 3,20', '18,2 30,18 9,30 4,10'],
  'wireframe-diamond': ['16,2 29,16 16,30 3,16'],
};

const SHAPE_ORDER: GeometricShardShapeKind[] = [
  'triangle',
  'shard',
  'polygon',
  'wireframe-diamond',
];

function seededFraction(index: number, salt: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function hasReachedLessonMilestone(
  completedLessonsCount: number,
  target: number = LESSON_MILESTONE_TARGET
): boolean {
  if (!Number.isFinite(completedLessonsCount) || completedLessonsCount < 0) {
    return false;
  }
  return Math.floor(completedLessonsCount) >= target;
}

export function buildGeometricShards(
  count = 36,
  seedOffset = 50
): GeometricShardSpec[] {
  const safeCount = Math.min(64, Math.max(12, Math.round(count)));

  return Array.from({ length: safeCount }, (_, i) => {
    const shapeKind = SHAPE_ORDER[i % SHAPE_ORDER.length];
    const pointOptions = SHARD_POLYGON_POINTS[shapeKind];
    const points = pointOptions[i % pointOptions.length];
    const color = GEOMETRIC_NOVA_ACCENTS[i % GEOMETRIC_NOVA_ACCENTS.length];

    const f1 = seededFraction(i, seedOffset + 1);
    const f2 = seededFraction(i, seedOffset + 2);
    const f3 = seededFraction(i, seedOffset + 3);
    const f4 = seededFraction(i, seedOffset + 4);
    const f5 = seededFraction(i, seedOffset + 5);

    const angle = (i / safeCount) * Math.PI * 2 + (f1 - 0.5) * 0.55;
    const radialDistance = 150 + f2 * 390;
    const explodeX = Math.round(Math.cos(angle) * radialDistance);
    const explodeY = Math.round(Math.sin(angle) * radialDistance * 0.72 - 35);

    const driftX = Math.round((f3 - 0.5) * 140);
    const fallY = Math.round(240 + f4 * 320);

    const opacity = Math.round((0.2 + f5 * 0.6) * 100) / 100;
    const filled = shapeKind !== 'wireframe-diamond' && i % 3 !== 2;
    const strokeWidth = filled ? 2 : 2.5;
    const sizePx = Math.round(18 + f1 * 20);
    const scale = Math.round((0.75 + f2 * 0.65) * 100) / 100;

    return {
      id: i,
      shapeKind,
      points,
      color,
      opacity,
      filled,
      strokeWidth,
      sizePx,
      explodeX,
      explodeY,
      driftX,
      fallY,
      rotX: Math.round((f1 - 0.5) * 520),
      rotY: Math.round((f2 - 0.5) * 520),
      rotZ: Math.round((f3 - 0.5) * 420),
      scale,
      delaySec: Math.round((i % 8) * 0.015 * 1000) / 1000,
      fallDurationSec: Math.round((4.2 + f4 * 2.6) * 100) / 100,
    };
  });
}
