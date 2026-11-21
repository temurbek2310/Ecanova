import { econovaThemePalettes } from '../../tailwind.config';
import type { ThemeMode } from './theme';

export interface RgbTuple {
  r: number;
  g: number;
  b: number;
}

export interface EconomicsShaderPalette {
  baseSlateHex: string;
  cyanAccentHex: string;
  greenAccentHex: string;
  baseSlateRgb: RgbTuple;
  cyanAccentRgb: RgbTuple;
  greenAccentRgb: RgbTuple;
}

/**
 * Converts a 6-digit hex color string into normalized 0..1 RGB floats for GLSL vec3 uniforms.
 */
export function hexToNormalizedRgb(hex: string): RgbTuple {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { r: 8 / 255, g: 11 / 255, b: 20 / 255 };
  }
  const num = parseInt(clean, 16);
  const r = Number((((num >> 16) & 255) / 255).toFixed(4));
  const g = Number((((num >> 8) & 255) / 255).toFixed(4));
  const b = Number(((num & 255) / 255).toFixed(4));
  return { r, g, b };
}

export function interpolateRgbTuple(from: RgbTuple, to: RgbTuple, t: number): RgbTuple {
  const alpha = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  return {
    r: Number((from.r + (to.r - from.r) * alpha).toFixed(4)),
    g: Number((from.g + (to.g - from.g) * alpha).toFixed(4)),
    b: Number((from.b + (to.b - from.b) * alpha).toFixed(4)),
  };
}

export const ECONOMICS_THEME_SHADER_PALETTES: Record<ThemeMode, EconomicsShaderPalette> = {
  dark: {
    baseSlateHex: econovaThemePalettes.dark.canvas,
    cyanAccentHex: econovaThemePalettes.dark.teal,
    greenAccentHex: econovaThemePalettes.dark.success,
    baseSlateRgb: hexToNormalizedRgb(econovaThemePalettes.dark.canvas),
    cyanAccentRgb: hexToNormalizedRgb(econovaThemePalettes.dark.teal),
    greenAccentRgb: hexToNormalizedRgb(econovaThemePalettes.dark.success),
  },
  light: {
    baseSlateHex: econovaThemePalettes.light.canvas,
    cyanAccentHex: econovaThemePalettes.light.teal,
    greenAccentHex: econovaThemePalettes.light.success,
    baseSlateRgb: hexToNormalizedRgb(econovaThemePalettes.light.canvas),
    cyanAccentRgb: hexToNormalizedRgb(econovaThemePalettes.light.teal),
    greenAccentRgb: hexToNormalizedRgb(econovaThemePalettes.light.success),
  },
};

export const ECONOMICS_SHADER_PALETTE: EconomicsShaderPalette =
  ECONOMICS_THEME_SHADER_PALETTES.dark;

export function getEconomicsShaderPaletteForTheme(theme: ThemeMode): EconomicsShaderPalette {
  return ECONOMICS_THEME_SHADER_PALETTES[theme];
}

/**
 * Reads active CSS custom properties (`--econova-canvas`, `--econova-teal`, `--econova-success`)
 * from `document.documentElement` if available, falling back to the theme's canonical palette.
 */
export function resolveActiveEconomicsShaderPalette(theme: ThemeMode): EconomicsShaderPalette {
  const fallback = getEconomicsShaderPaletteForTheme(theme);
  if (typeof document === 'undefined' || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return fallback;
  }

  const styles = window.getComputedStyle(document.documentElement);
  const rawBase = styles.getPropertyValue('--econova-canvas').trim();
  const rawCyan = styles.getPropertyValue('--econova-teal').trim();
  const rawGreen = styles.getPropertyValue('--econova-success').trim();

  const baseHex = /^#[0-9a-fA-F]{6}$/.test(rawBase) ? rawBase : fallback.baseSlateHex;
  const cyanHex = /^#[0-9a-fA-F]{6}$/.test(rawCyan) ? rawCyan : fallback.cyanAccentHex;
  const greenHex = /^#[0-9a-fA-F]{6}$/.test(rawGreen) ? rawGreen : fallback.greenAccentHex;

  return {
    baseSlateHex: baseHex,
    cyanAccentHex: cyanHex,
    greenAccentHex: greenHex,
    baseSlateRgb: hexToNormalizedRgb(baseHex),
    cyanAccentRgb: hexToNormalizedRgb(cyanHex),
    greenAccentRgb: hexToNormalizedRgb(greenHex),
  };
}

/**
 * Vertex Shader for the 3D Reactive Data Topography plane.
 * Uses Three.js projection & modelView matrices so scrolling camera.position.z
 * genuinely scales perspective depth across the topographical field.
 */
export const ECONOMICS_LIQUID_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Fragment Shader generating a fluid "Data & Flow / Reactive Data Topography" liquid field
 * using 2D Simplex Noise (`snoise`) and domain warping. Connects dynamically to
 * `uTime`, `uScrollY`, and `uScrollVelocity` so fast scrolling accelerates fluid distortion
 * before smoothly settling back to a passive idle state.
 */
export const ECONOMICS_LIQUID_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uScrollY;
uniform float uScrollVelocity;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform vec3 uColorBase;
uniform vec3 uColorCyan;
uniform vec3 uColorGreen;

// Ashima / Stefan Gustavson 2D Simplex Noise
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,  // (3.0 - sqrt(3.0)) / 6.0
    0.366025403784439,  // 0.5 * (sqrt(3.0) - 1.0)
   -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439   // 1.0 / 41.0
  );

  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) +
    i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  // Subtle UV drift mapped from global scrollY for topographical scrubbing
  float scrollPhase = uScrollY * 0.00045;
  vec2 st = (vUv - 0.5) * vec2(aspect, 1.0) + vec2(0.0, scrollPhase * 0.35);

  // Slow passive flow accelerated smoothly by scroll velocity
  float t = uTime * 0.14 - scrollPhase * 0.65;
  float velocityWarp = clamp(uScrollVelocity, 0.0, 1.8);

  // Subtle pointer current distortion
  // Inverted: the current is centred on the mirrored point and pushes the field away
  vec2 pointerOffset = -(uPointer - 0.5) * vec2(aspect, 1.0);
  float pointerInfluence = exp(-length(st - pointerOffset) * 2.4) * 0.18;

  // Domain-warped 2D Simplex Noise fluid layers
  vec2 q = vec2(
    snoise(st * 1.45 + vec2(t * 0.7, -t * 0.45)),
    snoise(st * 1.45 + vec2(-t * 0.55, t * 0.65) + 4.2)
  );

  float warpGain = 1.35 + velocityWarp * 0.42;
  vec2 r = vec2(
    snoise(st * 2.15 + warpGain * q + vec2(1.7, 9.2) + t * 0.4 - pointerInfluence),
    snoise(st * 2.15 + warpGain * q + vec2(8.3, 2.8) - t * 0.35 + pointerInfluence)
  );

  float liquidField = snoise(st * 1.85 + (1.25 + velocityWarp * 0.25) * r);
  float contourWave = 0.5 + 0.5 * sin((st.x * 2.4 - st.y * 1.8) + liquidField * (3.6 + velocityWarp * 0.9) + t * 1.2);

  // Blend theme base with cyan and emerald accents
  float cyanWeight = smoothstep(0.08, 0.88, liquidField * 0.5 + 0.5) * (0.28 + velocityWarp * 0.08);
  float greenWeight = smoothstep(0.58, 0.96, contourWave * (0.55 + 0.45 * q.x)) * (0.22 + velocityWarp * 0.07);

  // Iso-contour topographical elevation lines react to velocity boost
  float isoBand = smoothstep(0.91 - velocityWarp * 0.03, 0.985, abs(sin(liquidField * 9.5 + t)));
  cyanWeight += isoBand * (0.08 + velocityWarp * 0.06);

  // Vignette keeps periphery anchored in theme base for calm readability
  float vignette = smoothstep(1.38, 0.2, length((vUv - 0.5) * vec2(aspect, 1.0) * 0.85));

  vec3 activeBase = length(u_colorA) > 0.0 ? u_colorA : uColorBase;
  vec3 activeCyan = length(u_colorB) > 0.0 ? u_colorB : uColorCyan;
  vec3 activeGreen = length(u_colorC) > 0.0 ? u_colorC : uColorGreen;

  vec3 color = activeBase;
  color = mix(color, activeCyan, cyanWeight * vignette);
  color = mix(color, activeGreen, greenWeight * vignette);

  gl_FragColor = vec4(color, 1.0);
}
`;
