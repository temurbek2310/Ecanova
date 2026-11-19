import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';

/**
 * ECONOVA landing — full-viewport WebGL constellation.
 *
 * One InstancedBufferGeometry draw call. Every instance is an outlined equilateral
 * triangle whose position is the weighted blend of six pre-baked formation targets
 * (aT0..aT5), so morphing between scroll states runs entirely on the GPU.
 * Strokes are drawn in the fragment shader from barycentric coordinates, which keeps
 * them a constant ~1.5 CSS px wide regardless of triangle size or distance.
 *
 * `progressRef.current` (0..1) is read every frame; Phase 2 drives it from ScrollTrigger.
 */

interface ConstellationCanvasProps {
  progressRef: MutableRefObject<number>;
}

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

const COUNT_DESKTOP = 2600;
const COUNT_MOBILE = 1050;
const AMBIENT_RATIO = 0.16;
const MOBILE_QUERY_PX = 768;

const FOV = 45;
const REF_CAM_Z = 14; // layout reference plane
const STAGES = 6; // 0 brain · 1 economics · 2 mathematics · 3 business · 4 architecture · 5 halo
const STROKE_CSS_PX = 1.5;
const MIN_TRI_CSS_PX = 4.5;

/** Exact hex values — written to the buffer as-is (no sRGB→linear), shader outputs them untouched. */
const PALETTE: ReadonlyArray<readonly [number, number]> = [
  [0x8052ff, 0.3], // electric iris
  [0x5de1d2, 0.2], // aqua
  [0xffb829, 0.18], // saffron spark
  [0x15846e, 0.14], // deep verdant
  [0x2f6bff, 0.1], // cobalt spark
  [0xff3da5, 0.08], // magenta spark
];

/** progress → continuous stage index. Equal neighbouring values are holds. */
const STAGE_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0],
  [0.22, 0], // hero holds the brain
  [0.3, 1], // economics: equilibrium wave
  [0.33, 1],
  [0.4, 2], // mathematics: polyhedral lattice
  [0.43, 2],
  [0.5, 3], // business: orbital network
  [0.53, 3],
  [0.62, 4], // architecture: strata
  [0.74, 4],
  [0.84, 5], // final CTA: horizon halo
  [1.0, 5],
];

const CAM_Z_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 14],
  [0.22, 13.6],
  [0.55, 11.2], // glide forward through the disciplines
  [0.8, 12],
  [1.0, 17.5], // pull back for the halo
];

/** Lateral centre of the constellation as a fraction of the visible half-width. */
const STAGE_X_DESKTOP = [0.5, 0.42, -0.42, 0.42, 0, 0];
const STAGE_Y_DESKTOP = [0, 0, 0, 0, 0, 0];
/** Phones: stack above the copy instead of beside it. */
const STAGE_Y_MOBILE = [0.46, 0.4, 0.4, 0.4, 0.05, 0];
// Strata sit directly behind the architecture copy, so they are dimmed to keep it legible.
const STAGE_BRIGHTNESS_DESKTOP = [1, 0.95, 0.95, 0.95, 0.4, 1];
const STAGE_BRIGHTNESS_MOBILE = [0.75, 0.55, 0.55, 0.55, 0.3, 0.8];

/** Slow zero-gravity rotation per formation: [rotY, rotX] as a function of time. */
const STAGE_ROT: ReadonlyArray<(t: number) => readonly [number, number]> = [
  (t) => [0.4 + t * 0.1, 0.08 * Math.sin(t * 0.2)],
  (t) => [0.35 + 0.2 * Math.sin(t * 0.15), 0.35],
  (t) => [t * 0.12, 0.4 + t * 0.05],
  (t) => [t * 0.08, 0.25],
  (t) => [0.05 * Math.sin(t * 0.12), 0],
  () => [0, 0],
];

/* ------------------------------------------------------------------ */
/* Small math helpers                                                  */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

function sampleKeys(keys: ReadonlyArray<readonly [number, number]>, p: number): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i];
    if (p <= p1) {
      const [p0, v0] = keys[i - 1];
      const t = p1 === p0 ? 1 : (p - p0) / (p1 - p0);
      return v0 + (v1 - v0) * smootherstep(t);
    }
  }
  return keys[keys.length - 1][1];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Vec3 = [number, number, number];
type Rng = () => number;

const gauss = (r: Rng): number => (r() + r() + r() - 1.5) / 0.5; // ≈ N(0, 1), bounded ±3

function unitDir(r: Rng): Vec3 {
  const z = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), s * Math.sin(a), z];
}

function rotXYZ(p: Vec3, rx: number, ry: number, rz: number): Vec3 {
  let [x, y, z] = p;
  let c = Math.cos(rx);
  let s = Math.sin(rx);
  [y, z] = [c * y - s * z, s * y + c * z];
  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [c * x + s * z, -s * x + c * z];
  c = Math.cos(rz);
  s = Math.sin(rz);
  [x, y] = [c * x - s * y, s * x + c * y];
  return [x, y, z];
}

/* ------------------------------------------------------------------ */
/* Formations (unit space, extents ≲ 1)                                */
/* ------------------------------------------------------------------ */

interface FormationCtx {
  i: number; // index among constellation particles
  n: number; // number of constellation particles
  hub: boolean; // larger "star" particle
  r: Rng;
}

/** 0 — organic 3D brain: two hemispheres, cerebellum, brain stem, gyri. */
function brain({ hub, r }: FormationCtx): Vec3 {
  const roll = r();
  if (!hub && roll < 0.08) {
    const d = unitDir(r);
    return [-0.5 + d[0] * 0.3, -0.52 + d[1] * 0.2, d[2] * 0.28];
  }
  if (!hub && roll < 0.11) {
    const a = r() * Math.PI * 2;
    return [-0.15 + 0.09 * Math.cos(a), -0.5 - 0.4 * r(), 0.09 * Math.sin(a)];
  }
  const d = unitDir(r);
  const shell = 1 - 0.1 * r() * r();
  const bump =
    1 +
    0.065 * Math.sin(9 * d[0] + 5 * d[1]) * Math.sin(8 * d[2] + 4 * d[0]) +
    0.04 * Math.sin(14 * d[1] + 6 * d[2]);
  let x = d[0] * 1.0;
  let y = d[1] * (d[1] < 0 ? 0.4 : 0.72);
  let z = d[2] * 0.74;
  x *= bump * shell;
  y *= bump * shell;
  z *= bump * shell;
  z += Math.sign(z || 1) * 0.05; // longitudinal fissure
  if (y > 0) y -= 0.1 * Math.exp(-(z * z) / 0.012);
  return [x * 0.92, y * 0.92, z * 0.92];
}

/** 1 — Economics: two crossing supply/demand ribbons plus vertical equilibrium lines. */
function equilibriumWave({ hub, r }: FormationCtx): Vec3 {
  const k = 6;
  if (hub || r() < 0.12) {
    const node = Math.round(((r() * 2 - 1) * 0.95 * k) / Math.PI);
    return [(node * Math.PI) / k, (r() * 2 - 1) * 0.5, (r() * 2 - 1) * 0.4];
  }
  const x = (r() * 2 - 1) * 0.95;
  const z = (r() * 2 - 1) * 0.55;
  const layer = r() < 0.5 ? 1 : -1;
  const amp = 0.28 * (1 - 0.35 * (Math.abs(z) / 0.55));
  return [x, layer * amp * Math.sin(k * x + z * 1.2), z];
}

const ICO: { v: Vec3[]; e: Array<[number, number]> } = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw: Vec3[] = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1],
  ];
  const len = Math.hypot(1, phi);
  const v = raw.map((p): Vec3 => [(p[0] / len) * 0.95, (p[1] / len) * 0.95, (p[2] / len) * 0.95]);
  const edge = (2 / len) * 0.95;
  const e: Array<[number, number]> = [];
  for (let a = 0; a < v.length; a++) {
    for (let b = a + 1; b < v.length; b++) {
      const d = Math.hypot(v[a][0] - v[b][0], v[a][1] - v[b][1], v[a][2] - v[b][2]);
      if (Math.abs(d - edge) < 1e-4) e.push([a, b]);
    }
  }
  return { v, e };
})();

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** 2 — Mathematics: nested icosahedral lattice with spokes. */
function polyLattice({ hub, r }: FormationCtx): Vec3 {
  const innerOf = (p: Vec3): Vec3 => rotXYZ([p[0] * 0.5, p[1] * 0.5, p[2] * 0.5], 0, 0.6, 0);
  const j = () => (r() - 0.5) * 0.024;
  const roll = r();
  if (hub) {
    const p = ICO.v[Math.floor(r() * ICO.v.length)];
    return roll < 0.75 ? [p[0], p[1], p[2]] : innerOf(p);
  }
  let p: Vec3;
  if (roll < 0.62) {
    const [a, b] = ICO.e[Math.floor(r() * ICO.e.length)];
    p = lerp3(ICO.v[a], ICO.v[b], r());
  } else if (roll < 0.88) {
    const [a, b] = ICO.e[Math.floor(r() * ICO.e.length)];
    p = lerp3(innerOf(ICO.v[a]), innerOf(ICO.v[b]), r());
  } else {
    const a = ICO.v[Math.floor(r() * ICO.v.length)];
    p = lerp3(a, innerOf(a), r());
  }
  return [p[0] + j(), p[1] + j(), p[2] + j()];
}

const RINGS = Array.from({ length: 7 }, (_, k) => ({
  radius: 0.28 + k * 0.11,
  rx: 0.5 + k * 0.45,
  rz: -0.6 + k * 0.38,
}));
const RING_WEIGHT_SUM = RINGS.reduce((s, ring) => s + ring.radius, 0);

/** 3 — Business: expanding orbital network around a dense core. */
function orbitalNetwork({ hub, r }: FormationCtx): Vec3 {
  if (!hub && r() < 0.1) {
    const d = unitDir(r);
    const rad = 0.13 * Math.cbrt(r());
    return [d[0] * rad, d[1] * rad, d[2] * rad];
  }
  let pick = r() * RING_WEIGHT_SUM;
  let ring = RINGS[RINGS.length - 1];
  for (const candidate of RINGS) {
    pick -= candidate.radius;
    if (pick <= 0) {
      ring = candidate;
      break;
    }
  }
  const a = r() * Math.PI * 2;
  const noise = hub ? 0 : 0.015;
  const p: Vec3 = [
    ring.radius * Math.cos(a) + gauss(r) * noise,
    gauss(r) * noise,
    ring.radius * Math.sin(a) * 0.82 + gauss(r) * noise,
  ];
  return rotXYZ(p, ring.rx, 0, ring.rz);
}

const STRATA_LEVELS = [-0.78, -0.26, 0.26, 0.78];
const STRATA_COLS = 30;

/** 4 — Architecture: four suspended grid plates joined by vertical sync filaments. */
function strata({ i, n, hub, r }: FormationCtx): Vec3 {
  let p: Vec3;
  if (i % 10 === 0 || hub) {
    const col = Math.floor(r() * 5);
    const x = (col / 4) * 2 - 1;
    p = [x * 1.45, -0.78 + r() * 1.56, ((col * 7) % 5) / 4 * 1.24 - 0.62];
  } else {
    const k = i - Math.floor((i + 9) / 10);
    const layer = k % 4;
    const q = Math.floor(k / 4);
    const perLayer = Math.ceil((n * 0.9) / 4);
    const rows = Math.max(2, Math.ceil(perLayer / STRATA_COLS));
    const col = q % STRATA_COLS;
    const row = Math.floor(q / STRATA_COLS) % rows;
    p = [
      (col / (STRATA_COLS - 1) * 2 - 1) * 1.45 + (r() - 0.5) * 0.004,
      STRATA_LEVELS[layer],
      (row / (rows - 1) * 2 - 1) * 0.62 + (r() - 0.5) * 0.004,
    ];
  }
  return rotXYZ(p, 0.28, -0.35, 0);
}

/** 5 — Final CTA: serene luminous horizon halo with an empty centre. */
function horizonHalo({ hub, i, r }: FormationCtx): Vec3 {
  const roll = r();
  if (hub) {
    const a = (i % 12) * (Math.PI / 6);
    return [1.55 * Math.cos(a), 0.95 * Math.sin(a), -0.3];
  }
  if (roll < 0.14) {
    return [(r() * 2 - 1) * 1.9, -0.92 + gauss(r) * 0.012, -0.3 + gauss(r) * 0.08];
  }
  const a = r() * Math.PI * 2;
  const rho = roll < 0.3 ? 1.14 + Math.abs(gauss(r)) * 0.07 : 1 + gauss(r) * 0.035;
  return [1.55 * rho * Math.cos(a), 0.95 * rho * Math.sin(a), -0.3 + gauss(r) * 0.12];
}

const FORMATIONS: ReadonlyArray<(c: FormationCtx) => Vec3> = [
  brain,
  equilibriumWave,
  polyLattice,
  orbitalNetwork,
  strata,
  horizonHalo,
];

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = /* glsl */ `
attribute vec3 bary;
attribute vec3 aT0;
attribute vec3 aT1;
attribute vec3 aT2;
attribute vec3 aT3;
attribute vec3 aT4;
attribute vec3 aT5;
attribute vec4 aSeed; // x phase, y size, z spin, w ambient flag
attribute vec3 aColor;

uniform float uTime;
uniform float uW[6];
uniform float uEnergy;
uniform float uScale;
uniform vec3 uOffset;
uniform vec2 uRot;
uniform vec2 uHalf;
uniform float uBrightness;
uniform float uViewH;
uniform float uPixelFloor;

varying vec3 vBary;
varying vec3 vColor;
varying float vAlpha;

vec3 rotY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 rotX(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

void main() {
  float amb = aSeed.w;
  float tw = aSeed.x * 6.2831853;

  vec3 p = aT0 * uW[0] + aT1 * uW[1] + aT2 * uW[2] + aT3 * uW[3] + aT4 * uW[4] + aT5 * uW[5];

  // Constellation: breathing jitter, extra turbulence + swirl while morphing, group transform.
  vec3 q = p;
  vec3 idle = vec3(
    sin(p.y * 3.1 + uTime * 0.7 + tw),
    sin(p.z * 2.7 + uTime * 0.6 + tw * 1.3),
    sin(p.x * 3.3 + uTime * 0.8 + tw * 0.7)
  );
  q += idle * (0.012 + 0.1 * uEnergy);
  q = rotY(q, uEnergy * (aSeed.x - 0.5) * 1.6);
  q = rotX(rotY(q, uRot.x), uRot.y) * uScale + uOffset;

  // Ambient field: screen-relative drifting dust, independent of the constellation transform.
  float dz = 1.0 - p.z / 16.0;
  vec3 a = vec3(p.x * uHalf.x * dz, p.y * uHalf.y * dz, p.z);
  a += vec3(
    sin(uTime * 0.11 + tw),
    cos(uTime * 0.09 + tw * 1.7),
    sin(uTime * 0.07 + tw * 0.6)
  ) * 0.45;

  vec4 mv = modelViewMatrix * vec4(mix(q, a, amb), 1.0);
  float dist = max(-mv.z, 0.5);

  // Billboarded equilateral triangle, spinning in the view plane.
  float size = aSeed.y * (1.0 + 0.12 * sin(uTime * 1.3 + tw * 2.0));
  float pxPerUnit = projectionMatrix[1][1] * uViewH * 0.5 / dist;
  size *= max(1.0, uPixelFloor / max(size * pxPerUnit, 0.0001));
  float ang = tw + uTime * aSeed.z;
  float c = cos(ang);
  float s = sin(ang);
  mv.xy += mat2(c, s, -s, c) * position.xy * size;
  gl_Position = projectionMatrix * mv;

  vBary = bary;
  vColor = aColor;
  float depthFade = (1.0 - smoothstep(14.0, 46.0, dist)) * smoothstep(0.8, 3.0, dist);
  float twinkle = 0.82 + 0.18 * sin(uTime * 1.7 + tw * 3.0);
  vAlpha = uBrightness * mix(1.0, 0.5, amb) * depthFade * twinkle;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform float uStroke; // device pixels

varying vec3 vBary;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float edge = min(vBary.x, min(vBary.y, vBary.z));
  float aa = max(length(vec2(dFdx(edge), dFdy(edge))), 1e-5);
  float d = edge / aa; // ≈ distance from nearest edge in device px
  float line = clamp(uStroke + 0.5 - d, 0.0, 1.0);
  float a = max(line, 0.05) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

/* ------------------------------------------------------------------ */
/* Particle system construction                                        */
/* ------------------------------------------------------------------ */

interface Particles {
  mesh: THREE.Mesh;
  geometry: THREE.InstancedBufferGeometry;
  material: THREE.ShaderMaterial;
}

function pickColor(r: Rng, out: Float32Array, offset: number): void {
  let pick = r();
  let hex = PALETTE[0][0];
  for (const [value, weight] of PALETTE) {
    hex = value;
    pick -= weight;
    if (pick <= 0) break;
  }
  out[offset] = ((hex >> 16) & 255) / 255;
  out[offset + 1] = ((hex >> 8) & 255) / 255;
  out[offset + 2] = (hex & 255) / 255;
}

function createParticles(count: number, pixelRatio: number): Particles {
  const r = mulberry32(0x0ec0a0a);
  const ambientCount = Math.round(count * AMBIENT_RATIO);
  const coreCount = count - ambientCount;

  const targets = Array.from({ length: STAGES }, () => new Float32Array(count * 3));
  const seed = new Float32Array(count * 4);
  const color = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const ambient = i >= coreCount;
    const hub = !ambient && r() < 0.04;
    pickColor(r, color, i * 3);

    seed[i * 4] = r(); // phase
    seed[i * 4 + 2] = (r() < 0.5 ? -1 : 1) * (0.08 + r() * 0.4); // spin
    seed[i * 4 + 3] = ambient ? 1 : 0;

    if (ambient) {
      seed[i * 4 + 1] = 0.06 + r() * 0.06;
      // Normalised screen-space home (x,y ∈ [-1,1]) + world depth; each stage re-scatters slightly.
      const hx = r() * 2 - 1;
      const hy = r() * 2 - 1;
      const hz = -9 + r() * 11;
      for (let s = 0; s < STAGES; s++) {
        targets[s][i * 3] = hx + (r() - 0.5) * 0.18;
        targets[s][i * 3 + 1] = hy + (r() - 0.5) * 0.18;
        targets[s][i * 3 + 2] = hz + (r() - 0.5) * 1.2;
      }
    } else {
      seed[i * 4 + 1] = hub ? 0.14 + r() * 0.06 : 0.04 + r() * 0.045;
      for (let s = 0; s < STAGES; s++) {
        const p = FORMATIONS[s]({ i, n: coreCount, hub, r });
        targets[s][i * 3] = p[0];
        targets[s][i * 3 + 1] = p[1];
        targets[s][i * 3 + 2] = p[2];
      }
    }
  }

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 1, 0, -0.8660254, -0.5, 0, 0.8660254, -0.5, 0]), 3),
  );
  geometry.setAttribute(
    'bary',
    new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3),
  );
  for (let s = 0; s < STAGES; s++) {
    geometry.setAttribute(`aT${s}`, new THREE.InstancedBufferAttribute(targets[s], 3));
  }
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
  geometry.instanceCount = count;

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uW: { value: [1, 0, 0, 0, 0, 0] },
      uEnergy: { value: 0 },
      uScale: { value: 4 },
      uOffset: { value: new THREE.Vector3() },
      uRot: { value: new THREE.Vector2() },
      uHalf: { value: new THREE.Vector2(10, 6) },
      uBrightness: { value: 1 },
      uViewH: { value: 800 },
      uPixelFloor: { value: MIN_TRI_CSS_PX },
      uStroke: { value: STROKE_CSS_PX * pixelRatio },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, geometry, material };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ConstellationCanvas({ progressRef }: ConstellationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false, // strokes are antialiased analytically in the fragment shader
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return; // WebGL unavailable — the landing page still works on pure black
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 1);
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, REF_CAM_Z);

    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let reduced = reducedQuery.matches;

    let isMobile = window.innerWidth < MOBILE_QUERY_PX;
    let particles = createParticles(isMobile ? COUNT_MOBILE : COUNT_DESKTOP, pixelRatio);
    scene.add(particles.mesh);

    let width = 1;
    let height = 1;
    let dirty = true;

    const resize = () => {
      width = Math.max(1, container.clientWidth || window.innerWidth);
      height = Math.max(1, container.clientHeight || window.innerHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const mobile = window.innerWidth < MOBILE_QUERY_PX;
      if (mobile !== isMobile) {
        isMobile = mobile;
        scene.remove(particles.mesh);
        particles.geometry.dispose();
        particles.material.dispose();
        particles = createParticles(isMobile ? COUNT_MOBILE : COUNT_DESKTOP, pixelRatio);
        scene.add(particles.mesh);
      }
      dirty = true;
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Mouse parallax — fine pointers only, never on touch.
    const pointer = { x: 0, y: 0 };
    const parallax = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (finePointer) window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onReducedChange = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      dirty = true;
    };
    reducedQuery.addEventListener('change', onReducedChange);

    const onContextLost = (e: Event) => e.preventDefault();
    const onContextRestored = () => {
      dirty = true;
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    /* ---- per-frame state ---- */
    const halfRefH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let smoothed = clamp01(progressRef.current);
    let lastRendered = -1;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const target = clamp01(progressRef.current);
      smoothed = reduced ? target : smoothed + (target - smoothed) * (1 - Math.exp(-dt * 5));
      if (Math.abs(target - smoothed) < 1e-5) smoothed = target;

      if (reduced) {
        if (!dirty && Math.abs(smoothed - lastRendered) < 1e-5) return;
      } else {
        elapsed += dt;
      }
      dirty = false;
      lastRendered = smoothed;

      const { material } = particles;
      const u = material.uniforms;
      const time = reduced ? 0 : elapsed;

      // Stage blend weights.
      const stage = sampleKeys(STAGE_KEYS, smoothed);
      const i0 = Math.min(Math.floor(stage), STAGES - 1);
      const f = i0 >= STAGES - 1 ? 0 : stage - i0;
      const weights = u.uW.value as number[];
      for (let k = 0; k < STAGES; k++) weights[k] = 0;
      weights[i0] = 1 - f;
      if (f > 0) weights[i0 + 1] = f;
      u.uEnergy.value = reduced ? 0 : 4 * f * (1 - f);

      const blend = (values: number[]): number => {
        let v = 0;
        for (let k = 0; k < STAGES; k++) v += values[k] * weights[k];
        return v;
      };

      // Camera path + damped mouse parallax (desktop only).
      const camZ = sampleKeys(CAM_Z_KEYS, smoothed);
      if (finePointer && !reduced) {
        const k = 1 - Math.exp(-dt * 3);
        parallax.x += (pointer.x - parallax.x) * k;
        parallax.y += (pointer.y - parallax.y) * k;
      } else {
        parallax.x = 0;
        parallax.y = 0;
      }
      camera.position.set(
        Math.sin(smoothed * Math.PI * 2) * 0.5 + parallax.x * 0.9,
        -parallax.y * 0.55,
        camZ,
      );
      camera.lookAt(0, 0, 0);

      // Layout: constellation scale is fixed to the reference plane, lateral offset to the live frustum.
      const aspect = width / height;
      const halfHRef = halfRefH * REF_CAM_Z;
      const halfWRef = halfHRef * aspect;
      const halfHCam = halfRefH * camZ;
      const halfWCam = halfHCam * aspect;
      const scale = isMobile
        ? Math.min(halfWRef * 0.8, halfHRef * 0.5)
        : Math.min(halfHRef * 0.78, halfWRef * 0.42);
      const offsetX = isMobile ? 0 : blend(STAGE_X_DESKTOP) * halfWCam;
      const offsetY = (isMobile ? blend(STAGE_Y_MOBILE) : blend(STAGE_Y_DESKTOP)) * halfHCam;

      let rotY = 0;
      let rotX = 0;
      for (let k = 0; k < STAGES; k++) {
        if (weights[k] === 0) continue;
        const [ry, rx] = STAGE_ROT[k](time);
        rotY += ry * weights[k];
        rotX += rx * weights[k];
      }

      const halfHMax = halfRefH * 17.5 * 1.15;
      u.uTime.value = time;
      u.uScale.value = scale;
      (u.uOffset.value as THREE.Vector3).set(offsetX, offsetY, 0);
      (u.uRot.value as THREE.Vector2).set(rotY, rotX);
      (u.uHalf.value as THREE.Vector2).set(halfHMax * aspect, halfHMax);
      u.uBrightness.value = blend(isMobile ? STAGE_BRIGHTNESS_MOBILE : STAGE_BRIGHTNESS_DESKTOP);
      u.uViewH.value = height;

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      reducedQuery.removeEventListener('change', onReducedChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      scene.remove(particles.mesh);
      particles.geometry.dispose();
      particles.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [progressRef]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none bg-black"
    />
  );
}

export default ConstellationCanvas;
