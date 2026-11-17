export interface MagneticRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MagneticTransformInput {
  clientX: number;
  clientY: number;
  rect: MagneticRect;
  maxTranslatePx?: number;
  hoverScale?: number;
}

export interface MagneticTransformState {
  isHovered: boolean;
  x: number;
  y: number;
  scale: number;
  normalizedX: number;
  normalizedY: number;
  boxShadow: string;
}

export const DEFAULT_MAGNETIC_MAX_TRANSLATE_PX = 6;
export const DEFAULT_MAGNETIC_HOVER_SCALE = 1.018;
export const RESTING_BRUTAL_BOX_SHADOW = '8px 8px 0px rgb(var(--theme-shadow-rgb))';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

export function buildMagneticBoxShadow(
  isHovered: boolean,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): string {
  if (!isHovered) {
    return RESTING_BRUTAL_BOX_SHADOW;
  }
  const dx = Math.round((13 - offset.x * 0.35) * 10) / 10;
  const dy = Math.round((13 - offset.y * 0.35) * 10) / 10;
  return `${dx}px ${dy}px 0px rgb(var(--theme-shadow-rgb)), 0px 0px 0px 2px rgb(var(--theme-accent) / 0.45)`;
}

export function computeMagneticCardTransform(
  input: MagneticTransformInput
): MagneticTransformState {
  const maxTranslate = input.maxTranslatePx ?? DEFAULT_MAGNETIC_MAX_TRANSLATE_PX;
  const hoverScale = input.hoverScale ?? DEFAULT_MAGNETIC_HOVER_SCALE;
  const { rect, clientX, clientY } = input;

  if (rect.width <= 0 || rect.height <= 0) {
    return {
      isHovered: true,
      x: 0,
      y: 0,
      scale: hoverScale,
      normalizedX: 0,
      normalizedY: 0,
      boxShadow: buildMagneticBoxShadow(true, { x: 0, y: 0 }),
    };
  }

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const rawNx = (clientX - centerX) / (rect.width / 2);
  const rawNy = (clientY - centerY) / (rect.height / 2);

  const normalizedX = clamp(rawNx, -1, 1);
  const normalizedY = clamp(rawNy, -1, 1);

  const x = Math.round(normalizedX * maxTranslate * 100) / 100;
  const y = Math.round(normalizedY * maxTranslate * 100) / 100;

  return {
    isHovered: true,
    x,
    y,
    scale: hoverScale,
    normalizedX: Math.round(normalizedX * 1000) / 1000,
    normalizedY: Math.round(normalizedY * 1000) / 1000,
    boxShadow: buildMagneticBoxShadow(true, { x, y }),
  };
}

export function getRestingMagneticCardState(): MagneticTransformState {
  return {
    isHovered: false,
    x: 0,
    y: 0,
    scale: 1,
    normalizedX: 0,
    normalizedY: 0,
    boxShadow: RESTING_BRUTAL_BOX_SHADOW,
  };
}
