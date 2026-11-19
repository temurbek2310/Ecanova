import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';

/**
 * ECONOVA landing — full-viewport WebGL constellation.
 *
 * One `THREE.Points` draw call. Every point sprite is a true 3D wireframe tetrahedron: the vertex
 * shader tumbles four canonical vertices per particle and projects them with mild perspective; the
 * fragment shader draws the 6 edges as `fwidth()`-antialiased 1.2px segment SDFs (hollow interior,
 * back edges dimmed) with a faint micro-glow, composited additively. Foreground pyramids get a
 * depth-of-field blur.
 *
 * Fidelity model:
 *  - Structured shell sampling — every formation is a hollow surface (torus tubes, a geodesic
 *    icosahedral core, superellipse ribbons extruded along icon strokes) sampled on Fibonacci
 *    lattices with ±0.015 organic jitter, so centres stay sparse and silhouettes stack densely.
 *  - Each particle carries a per-formation surface normal (aN0..aN4, blended like the positions);
 *    the vertex shader computes view-space Fresnel and drives opacity, size and glow from it:
 *    grazing rims burn bright, front-facing centres stay larger, cleaner and dimmer.
 *  - Colour is a smooth function of formation-space position + low-frequency 3D simplex noise
 *    (violet ↔ mint core, cyan / amber crown & rim, deep teal recesses), never per-particle random.
 *  - Two ambient layers share the same draw call: a near-camera foreground parallax layer of large
 *    faint triangles and a deep pinprick field across the whole void.
 *
 * Each particle's position is the weighted blend of five pre-baked formation targets
 * (position=aT0, aT1..aT4: gyroscope → growth chart → sigma → briefcase → shield), so morphing
 * between scroll states, idle drift, twinkle, spin and cursor repulsion all run on the GPU.
 *
 * `progressRef.current` (0..1) is read every frame; Phase 2 drives it from ScrollTrigger.
 */

interface ConstellationCanvasProps {
  progressRef: MutableRefObject<number>;
}

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

/** Total particles per draw call (formation + both ambient layers). Formation share is unchanged. */
const COUNT_DESKTOP = 4510;
const COUNT_MOBILE = 1592;
/** Foreground parallax layer: free-floating pyramids that drift through a Z corridor up to the lens. */
const FG_DESKTOP = 54;
const FG_MOBILE = 28;
/** Deep background pinprick layer. */
const BG_DESKTOP = 440;
const BG_MOBILE = 220;
const MOBILE_QUERY_PX = 768;

const FOV = 45;
const REF_CAM_Z = 14; // layout reference plane
const STAGES = 5; // 0 gyroscope · 1 growth chart · 2 sigma · 3 briefcase · 4 certificate shield

/** Formation triangle size bands (circumscribed diameter, CSS px at the reference depth). */
const SIZE_BANDS: ReadonlyArray<readonly [number, number, number]> = [
  // [probability, min px, max px]
  [0.75, 5, 9], // micro pinpricks
  [0.2, 10, 14], // medium
  [0.05, 15, 20], // hero
];
/** Every HUB_STRIDE-th formation particle is a hero-sized "star" pinned on a formation vertex. */
const HUB_STRIDE = 80;

/** Ambient layer sizes (CSS px) and placement. */
const BG_SIZE: readonly [number, number] = [4, 8];
/** Foreground glyph size (CSS px) at FG_SIZE_REF camera distance; perspective scales it from there. */
const FG_SIZE: readonly [number, number] = [14, 26];
const FG_SIZE_REF = 5;
/** Near-lens point-size ceilings (CSS px) — formations keep their own, much tighter TRI_MAX_CSS. */
const FG_MAX_PX_DESKTOP = 88;
const FG_MAX_PX_MOBILE = 60;
/** Z corridor (distance in front of the camera): pyramids drift from FG_FAR to FG_NEAR, then wrap. */
const FG_FAR = 12;
const FG_NEAR = 0.9;
const FG_SPEED = 0.22; // world units / s (± per-particle variation) — slow, meditative approach
const FG_FAR_FADE = 1.5; // fade-in length at the far end so the wrap is seamless
const FG_NEAR_FADE_START = 1.7; // near-plane dissolve: alpha 1 at 1.7 → 0 at FG_NEAR
/** Depth of field: sharp beyond FG_BLUR_START, full bokeh by FG_BLUR_FULL. */
const FG_BLUR_START = 5;
const FG_BLUR_FULL = 1.7;
/**
 * Lateral home is fixed in world space, laid out against this depth, so approaching pyramids glide
 * outward. Smaller = more of them are still in frame when they reach the lens.
 */
const FG_XY_REF = 2.6;
/** Scroll lift (world units over the full page): nearer pyramids sweep faster on screen than the formations. */
const FG_SCROLL = 7;
const FG_MIN_RADIUS = 0.2; // screen-normalised: only a tiny hole dead-centre; low alpha + blur keep copy legible
const BG_Z_NEAR = 3;
const BG_Z_FAR = -30;
/** Camera distance the deep field is laid out against (≥ the farthest camera key). */
const AMBIENT_REF_DIST = 15.5;

/** Organic jitter applied on top of every structured lattice sample (formation units). */
const JITTER = 0.015;

/**
 * Damped pointer tracking (desktop fine pointers, never under reduced motion): exponential follow
 * rate (1/s), k = 1 − e^(−rate·dt), frame-rate independent.
 */
const MOUSE_RATE = 6.0;
/**
 * Pointer response (the DOM copy is a camera-fixed HUD and never moves):
 * - Camera: position stays on its scroll path; only a gentle damped turn toward the cursor
 *   (radians at the viewport edge) — yaw = −CAM_YAW·mouseX, pitch = +CAM_PITCH·mouseY (y-up).
 * - Ambient pyramids: shifted opposite the cursor (world units at the viewport edge), scaled per
 *   particle by a random 0.6–1.4 factor; perspective adds the depth falloff (near bokeh sweeps far
 *   more on screen than deep stars).
 * - The five formations take no pointer translation — idle motion, scroll morph and the local
 *   cursor swirl only.
 */
const CAM_YAW = 0.075;
const CAM_PITCH = 0.05;
const MOUSE_AMB_FG = 0.5;
const MOUSE_AMB_DEEP = 0.35;
/** Cursor repulsion (world units). */
const REPEL_RADIUS = 1.4;
const REPEL_MAX = 0.35;

/** ECONOVA Obsidian hues — exact hex, written into the shader untouched (no sRGB→linear). */
const CYAN = 0x5de1d2; // rim / crown accent
const AMBER = 0xf5b942; // warm crown spark
const VIOLET = 0x9274ff; // core
const MINT = 0x6fe0a1; // mid-zone
const DEEP_TEAL = 0x15846e; // lower recesses

/**
 * progress → continuous stage index. Equal neighbouring values are holds.
 * Progress is emitted by LandingPage: chapter centres sit at 0.315 / 0.415 / 0.515 and the
 * architecture section begins at ~0.53, so each icon is fully formed while its chapter is centred.
 */
const STAGE_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0],
  [0.22, 0], // hero holds the gyroscope
  [0.3, 1], // 01 · Economics: growth chart
  [0.33, 1],
  [0.4, 2], // 02 · Mathematics: sigma
  [0.43, 2],
  [0.5, 3], // 03 · Business: briefcase
  [0.53, 3],
  [0.62, 4], // Architecture → final CTA: certificate shield
  [1.0, 4],
];

const CAM_Z_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 14],
  [0.22, 13.8],
  [0.55, 12.9], // gentle glide forward through the disciplines (kept shallow so formations stay framed)
  [0.8, 13.2],
  [1.0, 15.5], // ease back so the shield frames the final CTA
];

/* ---- Responsive monumental layout ---- */

/** Viewport tiers (CSS px, window width): mobile < 768 ≤ laptop < 1440 ≤ desktop / ultrawide. */
const DESKTOP_MIN_PX = 1440;

/**
 * Side of the copy each formation sits on (always opposite the text column):
 * Economics text left → icon right; Mathematics text right → icon left; Business left → right.
 */
const STAGE_SIDE = [1, 1, -1, 1, 0];
/** Phones: big right-edge bleed (hero ≈ 35–40% off-screen), sitting above the copy. */
const STAGE_X_MOBILE = [0.64, 0.5, 0.5, 0.5, 0];
/** Phones: a subtle drop (−0.03 of the half-height) mirrors the wider tiers' framing nudge. */
const STAGE_Y_MOBILE = [0.47, 0.29, 0.29, 0.29, 0];
/**
 * Laptop + desktop (≥ 768px) framing nudges on top of the side anchor, as fractions of the live
 * visible half-width (x, NDC: 0.07 ≈ 3.5% of the viewport width) and half-height (y, − = down).
 * Hero gyroscope: right, clear of the headline, and down to the centre of the copy + CTA block.
 * Economics / Business: right + down; Mathematics: left + down — clear of the navbar and the cards.
 * The shield (stage 4) is untouched.
 */
const STAGE_NUDGE_X = [0.07, 0.04, -0.04, 0.04, 0];
const STAGE_Y_WIDE = [-0.06, -0.05, -0.05, -0.05, 0];
/** Hero gyroscope scale boost on laptop + desktop (≥ 768px); the other stages keep 100%. */
const HERO_SCALE_WIDE = 1.075;
/** Chapter rail (LandingPage `min-[1360px]:flex`): visible from this width, inner edge ≈ 78px from the right. */
const RAIL_MIN_VW = 1360;
/** Hero rim must stay this far (CSS px) from the right edge: rail inner edge + ~24px of air. */
const RAIL_CLEAR_PX = 104;
/** Tilted rings sweep nearer the hero camera than the pivot: measured rim ≈ 1.09× its flat radius. */
const HERO_RIM_PERSPECTIVE = 1.1;
/**
 * Laptop + desktop (≥ 768px): lateral centre as a fraction of the half-width (NDC). 0.30 puts
 * right-side formations at ≈65% of the viewport width and left-side ones at ≈35%, keeping the outer
 * rim as close to the viewport (and as far from the 00–05 chapter rail) as the monumental scale
 * allows, while bridging the gap beside the copy.
 */
const SIDE_ANCHOR_NDC = 0.3;

/** Scale multipliers over the legacy per-tier base scale. */
const MOBILE_SCALE_MUL = 1.72;
const LAPTOP_SCALE_MUL = 1.5;
const DESKTOP_SCALE_MUL = 1.75;
/**
 * Height caps (× reference half-height). Formations are ≈1.75 units tall, so 0.96 ≈ 84% of the
 * viewport height on laptops; desktops may graze the top/bottom edges as the camera glides in.
 */
const MOBILE_HEIGHT_CAP = 0.9;
const LAPTOP_HEIGHT_CAP = 0.96;
const DESKTOP_HEIGHT_CAP = 1.12;
/** Desktop: largest fraction of the formation width allowed to bleed past the outer edge. */
const DESKTOP_MAX_BLEED = 0.35;
/** Max formation half-width in formation units (gyroscope outer ring 0.95; icons ≤ 0.92). */
const FORMATION_HALF_W = 0.95;
/** Camera distance the side layout is solved against (a typical chapter camera). */
const LAYOUT_CAM_Z = 12.5;
/** Mirrors LandingPage's GUTTER + hero grid: max-w-[1280px], md:px-10, gap-12, 1.15fr / 0.85fr. */
const TEXT_CONTAINER_PX = 1280;
const TEXT_PAD_PX = 40;
const TEXT_GAP_PX = 48;
const TEXT_COL_FRAC = 1.15 / 2;

/**
 * Fit trims applied to the final (post-cap) scale so every formation sits fully inside the viewport
 * with breathing room: laptop ≈ 60–68% of the viewport height, desktop clear of the chapter rail.
 */
const MOBILE_FIT = 0.8;
const LAPTOP_FIT = 0.78;
const DESKTOP_FIT = 0.76;
/** Final CTA shield trim (~18% smaller), so its whole silhouette frames the CTA card. */
const SHIELD_FIT = 0.82;
/**
 * Per-stage scale trim on top of the layout scale (all breakpoints). Economics (1) and Mathematics (2)
 * are the tallest icons: −4% keeps their top edges clear of the sticky navbar's bottom border.
 */
const STAGE_FIT = [1, 0.96, 0.96, 1, 1];

/** Final CTA shield: ~1.5× its legacy size (legacy = 0.82 × base), centred as a crest. */
const SHIELD_SCALE = 0.82 * 1.5;
/** Additive peak-alpha trim per tier so overlapping rings don't blow out to white behind copy. */
const ALPHA_MOBILE = 0.85;
const ALPHA_LAPTOP = 0.91;
const ALPHA_DESKTOP = 0.92;
/** Layout easing rate (1/s) when the viewport changes — no jump on resize. */
const LAYOUT_EASE = 4;

interface Layout {
  side: number; // world scale of stages 0–3
  shield: number; // world scale of stage 4
  x: number[]; // lateral centre per stage, fraction of the live visible half-width
  y: number[]; // vertical centre per stage, fraction of the live visible half-height
  alpha: number; // peak additive alpha multiplier
}

/** Target layout for a viewport. `halfTan` = tan(FOV / 2). */
function computeLayout(vw: number, aspect: number, halfTan: number): Layout {
  const halfHRef = halfTan * REF_CAM_Z;
  const halfWRef = halfHRef * aspect;
  // The shield is framed by the final (farthest) camera: keep it within ~90% of the height there.
  const halfHFinal = halfTan * CAM_Z_KEYS[CAM_Z_KEYS.length - 1][1];
  const shieldCap = halfHFinal * 0.95;

  if (vw < MOBILE_QUERY_PX) {
    const base = Math.min(halfWRef * 0.8, halfHRef * 0.5);
    return {
      side: Math.min(base * MOBILE_SCALE_MUL, halfHRef * MOBILE_HEIGHT_CAP) * MOBILE_FIT,
      // Shield is ≈1.44 units wide: also keep it inside ~80% of a phone's width.
      shield: Math.min(base * SHIELD_SCALE, shieldCap, halfHFinal * aspect * 1.1) * SHIELD_FIT,
      x: STAGE_X_MOBILE,
      y: STAGE_Y_MOBILE,
      alpha: ALPHA_MOBILE,
    };
  }

  const base = Math.min(halfHRef * 0.78, halfWRef * 0.42);
  const shield = Math.min(base * SHIELD_SCALE, shieldCap) * SHIELD_FIT;

  // Lateral anchor (≥ 768px): ~66.5% / ~33.5% of the viewport width, but never further out than the
  // centre of the 1280px grid's open column — so on wide monitors the formations stay aligned with
  // the content instead of drifting to the far monitor edges.
  const container = Math.min(vw, TEXT_CONTAINER_PX);
  const cols = container - 2 * TEXT_PAD_PX - TEXT_GAP_PX;
  const gridColumnPx = -container / 2 + TEXT_PAD_PX + cols * TEXT_COL_FRAC + TEXT_GAP_PX + (cols * (1 - TEXT_COL_FRAC)) / 2;
  const anchor = Math.min(SIDE_ANCHOR_NDC * (vw / 2), gridColumnPx) / (vw / 2);
  // Lateral centres with the framing nudges. While the chapter rail is visible, the hero's rightward
  // nudge gives way so the (enlarged) gyroscope's outer rim stays clear of the rail — but it never
  // pulls the hero further left than its un-nudged anchor.
  const sideX = (side: number): number[] => {
    const x = STAGE_SIDE.map((s, k) => s * anchor + STAGE_NUDGE_X[k]);
    if (vw >= RAIL_MIN_VW) {
      const railNdc = 1 - (2 * RAIL_CLEAR_PX) / vw;
      const rimNdc = (side * STAGE_FIT[0] * HERO_SCALE_WIDE * FORMATION_HALF_W * HERO_RIM_PERSPECTIVE) / halfWRef;
      x[0] = Math.max(STAGE_SIDE[0] * anchor, Math.min(x[0], railNdc - rimNdc));
    }
    return x;
  };

  if (vw < DESKTOP_MIN_PX) {
    const side = Math.min(base * LAPTOP_SCALE_MUL, halfHRef * LAPTOP_HEIGHT_CAP) * LAPTOP_FIT;
    return {
      side,
      shield,
      x: sideX(side),
      y: STAGE_Y_WIDE,
      alpha: ALPHA_LAPTOP,
    };
  }

  // Large desktop / ultrawide: grow with the monitor; the scale stays bounded by the height cap and
  // by how much of the formation could bleed past the edge beside the 1280px text column.
  const w = halfTan * LAYOUT_CAM_Z * aspect;
  const textEdge = (vw - container) / 2 + TEXT_PAD_PX + cols * TEXT_COL_FRAC;
  const breath = Math.max(56, vw * 0.035);
  const inner = Math.min(0.6, (textEdge + breath) / (vw / 2) - 1); // NDC of the inner rim
  const bleedCap = (w * (1 - inner)) / (2 * FORMATION_HALF_W * (1 - DESKTOP_MAX_BLEED));
  const side = Math.min(base * DESKTOP_SCALE_MUL, halfHRef * DESKTOP_HEIGHT_CAP, bleedCap) * DESKTOP_FIT;
  return {
    side,
    shield,
    x: sideX(side),
    y: STAGE_Y_WIDE,
    alpha: ALPHA_DESKTOP,
  };
}
/** Triangle size multiplier per formation — the gyroscope uses smaller triangles so rings read razor-sharp. */
const STAGE_TRI_SIZE = [0.82, 1, 1, 1, 1];
// The shield's brightness is set per frame (dim behind the architecture copy, a little brighter at the CTA).
// Gyroscope silhouettes stack the most; a slightly lower level keeps them jewel-toned under additive blending.
const STAGE_BRIGHTNESS_DESKTOP = [0.82, 1, 1, 1, 0.4];
const STAGE_BRIGHTNESS_MOBILE = [0.68, 0.6, 0.6, 0.6, 0.3];

/**
 * Per-formation orientation [yaw, pitch] over time. Every formation only sways (gyroscope ≤ 14° yaw, rings spin in-shader;
 * icons ±0.2 rad ≈ ±11.5° yaw, ±0.12 rad ≈ ±7° pitch) so each stays legible and faces the viewer.
 * The sway also sweeps the Fresnel rim across each shell, so silhouettes shimmer as they turn.
 */
const STAGE_ROT: ReadonlyArray<(t: number) => readonly [number, number]> = [
  // Gyroscope: whole assembly sways 2°–14° yaw / ±6° pitch; each ring spins independently in the shader.
  (t) => [0.14 + 0.1 * Math.sin(t * 0.22), 0.1 * Math.sin(t * 0.17 + 0.6)],
  (t) => [0.2 * Math.sin(t * 0.4), 0.12 * Math.sin(t * 0.3 + 1.3)],
  (t) => [0.2 * Math.sin(t * 0.36 + 2.1), 0.12 * Math.sin(t * 0.27 + 0.4)],
  (t) => [0.2 * Math.sin(t * 0.42 + 4.0), 0.12 * Math.sin(t * 0.31 + 2.2)],
  (t) => [0.2 * Math.sin(t * 0.38 + 5.3), 0.12 * Math.sin(t * 0.29 + 3.1)],
];

/**
 * Hero → Economics (stage 0 → 1) choreography. With `t` the linear scroll progress across that
 * segment, rotation and travel lead and the particle morph follows:
 *  · Phase A — the gyroscope keeps its shape, yaws its front face to the right and glides toward the
 *    Economics anchor.
 *  · Phase B — the delayed morph into the growth chart; the extra yaw/pitch unwinds as it lands.
 * Every curve is a pure function of `t`, so scrolling back up replays it in reverse.
 */
const HERO_LEAD = {
  yaw: 1.0, // ≈ 57° extra +Y yaw (front face turns right)
  pitch: -0.1, // ≈ −6° subtle forward tilt riding the same envelope
  turnIn: [0.0, 0.65], // yaw/pitch build-up
  unwind: [0.55, 1.0], // yaw/pitch return to Economics' resting orientation
  travel: [0.05, 0.72], // anchor glide (x, y) from the hero toward Economics
  morph: [0.48, 0.96], // delayed particle position + normal morph
} as const;

/* ------------------------------------------------------------------ */
/* Small math helpers                                                  */
/* ------------------------------------------------------------------ */

const GOLDEN = 0.6180339887498949;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
/** GLSL-style smoothstep over [e0, e1]. */
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const fract = (v: number): number => v - Math.floor(v);

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

/** A structured surface sample: position + approximate outward surface normal. */
interface Sample {
  p: Vec3;
  n: Vec3;
}

function norm3(x: number, y: number, z: number): Vec3 {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

const jit = (r: Rng): number => (r() * 2 - 1) * JITTER;

/* ------------------------------------------------------------------ */
/* Formations (unit space, extents ≲ 1)                                */
/* ------------------------------------------------------------------ */

interface FormationCtx {
  i: number; // index among formation particles
  n: number; // number of formation particles
  hub: boolean; // hero "star" particle pinned on a vertex
  group: number; // gyroscope group: 0 core, 1..3 rings
  gj: number; // index within the gyroscope group
  gm: number; // gyroscope group size
  r: Rng;
}

/* ---- 0 — orbital gyroscope (armillary sphere) ---- */

/**
 * Spec units are normalised so the outer ring (2.0) maps to 0.95 in formation space.
 * Ring/core targets (and normals) are stored in LOCAL coordinates; the shader applies each
 * ring's live tilt + spin matrix (uRingM) and the core's counter-rotation (uCoreM) every frame.
 */
const GYRO_UNIT = 0.95 / 2.0;
const DEG = Math.PI / 180;

interface GyroRing {
  radius: number;
  tube: number; // torus tube radius — particles sit only on this hollow shell's surface
  tiltX: number;
  tiltZ: number;
  spin: number; // rad/s around the ring's own axis (alternating directions)
  share: number; // fraction of ring particles
}

/**
 * Slims every ring's tube cross-section to 55% so the gimbals read as crisp sculptural bands
 * instead of puffy overlapping clouds (major radii, core and glow are unaffected).
 */
const GYRO_TUBE_TRIM = 0.55;
/**
 * Volumetric gimbal rings: base tube radii 0.20 / 0.18 / 0.16 spec units (tapering inward so the
 * inner ring clears the core) × GYRO_TUBE_TRIM — hollow torus shells the pyramids can breathe on.
 */
const GYRO_RINGS: ReadonlyArray<GyroRing> = [
  { radius: 2.0 * GYRO_UNIT, tube: 0.2 * GYRO_TUBE_TRIM * GYRO_UNIT, tiltX: 22 * DEG, tiltZ: 0, spin: 0.12, share: 0.43 }, // outer — Economics
  { radius: 1.55 * GYRO_UNIT, tube: 0.18 * GYRO_TUBE_TRIM * GYRO_UNIT, tiltX: 62 * DEG, tiltZ: 40 * DEG, spin: -0.17, share: 0.33 }, // middle — Mathematics
  { radius: 1.12 * GYRO_UNIT, tube: 0.16 * GYRO_TUBE_TRIM * GYRO_UNIT, tiltX: -52 * DEG, tiltZ: -35 * DEG, spin: 0.22, share: 0.24 }, // inner — Business
];
/** Core share of the formation particles — enough to anchor the centre against the thicker rings. */
const GYRO_CORE_SHARE = 0.15;
const GYRO_CORE_SPIN = -0.25;
/** Core circumradius in spec units (+20% over the original 0.45). */
const GYRO_CORE_R = 0.54;
/** Additive alpha + glow trim on the rings so cyan / violet / mint stay saturated, not white. */
const RING_GLOW_SOFTEN = 0.15;

/** Hollow icosahedron core (radius GYRO_CORE_R spec units): vertices, edges, face normals, inradius. */
const CORE_ICO: { v: Vec3[]; e: Array<[number, number]>; f: Vec3[]; inr: number } = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw: Vec3[] = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1],
  ];
  const k = (GYRO_CORE_R * GYRO_UNIT) / Math.hypot(1, phi);
  const v = raw.map((p): Vec3 => [p[0] * k, p[1] * k, p[2] * k]);
  const edge = 2 * k;
  const adj = (a: number, b: number): boolean =>
    Math.abs(Math.hypot(v[a][0] - v[b][0], v[a][1] - v[b][1], v[a][2] - v[b][2]) - edge) < 1e-4;
  const e: Array<[number, number]> = [];
  const f: Vec3[] = [];
  for (let a = 0; a < v.length; a++) {
    for (let b = a + 1; b < v.length; b++) {
      if (!adj(a, b)) continue;
      e.push([a, b]);
      for (let c = b + 1; c < v.length; c++) {
        if (adj(a, c) && adj(b, c)) {
          f.push(norm3(v[a][0] + v[b][0] + v[c][0], v[a][1] + v[b][1] + v[c][1], v[a][2] + v[b][2] + v[c][2]));
        }
      }
    }
  }
  const inr = v[0][0] * f[0][0] + v[0][1] * f[0][1] + v[0][2] * f[0][2];
  return { v, e, f, inr: Math.abs(inr) };
})();

/** Contiguous index ranges per gyroscope group: [0, core, outer, middle, inner=n]. */
function gyroBounds(n: number): number[] {
  const core = Math.round(n * GYRO_CORE_SHARE);
  const bounds = [0, core];
  let acc = core;
  for (const ring of GYRO_RINGS) {
    acc += ring.share * (n - core);
    bounds.push(Math.round(acc));
  }
  bounds[bounds.length - 1] = n;
  return bounds;
}

/**
 * Geodesic core: 40% of particles on the icosahedron edges (structured stations along each edge),
 * 60% on its faces via a Fibonacci-sphere lattice projected onto the polyhedron.
 */
function gyroCore(gj: number, gm: number, hub: boolean, r: Rng): Sample {
  if (hub) {
    const v = CORE_ICO.v[gj % CORE_ICO.v.length];
    return { p: [v[0], v[1], v[2]], n: norm3(v[0], v[1], v[2]) };
  }
  const block = Math.floor(gj / 5);
  const slot = gj % 5;
  const blocks = Math.ceil(gm / 5);
  if (slot < 2) {
    const edges = CORE_ICO.e.length;
    const k = block * 2 + slot;
    const stations = Math.max(1, Math.ceil((blocks * 2) / edges));
    const [a, b] = CORE_ICO.e[k % edges];
    const t = (Math.floor(k / edges) + 0.5) / stations;
    const va = CORE_ICO.v[a];
    const vb = CORE_ICO.v[b];
    const x = va[0] + (vb[0] - va[0]) * t;
    const y = va[1] + (vb[1] - va[1]) * t;
    const z = va[2] + (vb[2] - va[2]) * t;
    return { p: [x + jit(r) * 0.5, y + jit(r) * 0.5, z + jit(r) * 0.5], n: norm3(x, y, z) };
  }
  const k = block * 3 + (slot - 2);
  const total = blocks * 3;
  const y = 1 - (2 * (k + 0.5)) / total;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const az = k * GOLDEN_ANGLE;
  const d: Vec3 = [Math.cos(az) * rad, y, Math.sin(az) * rad];
  let best = CORE_ICO.f[0];
  let bestDot = -Infinity;
  for (const fn of CORE_ICO.f) {
    const dot = d[0] * fn[0] + d[1] * fn[1] + d[2] * fn[2];
    if (dot > bestDot) {
      bestDot = dot;
      best = fn;
    }
  }
  const dist = CORE_ICO.inr / Math.max(bestDot, 1e-3);
  return {
    p: [d[0] * dist + jit(r) * 0.5, d[1] * dist + jit(r) * 0.5, d[2] * dist + jit(r) * 0.5],
    n: norm3(best[0] * 0.6 + d[0] * 0.4, best[1] * 0.6 + d[1] * 0.4, best[2] * 0.6 + d[2] * 0.4),
  };
}

/**
 * Rings: a (u, θ) Fibonacci lattice strictly on the surface of each hollow torus tube (nothing
 * inside the tube). Local ring plane is XZ (axis = local Y). Jitter is tangential only, so every
 * sample stays on the shell and neighbouring pyramids keep their breathing room.
 * The normal blends the true tube normal (so the tube's own silhouette catches the Fresnel rim and
 * reads as a volume) with the in-plane radial direction (smooth shimmer along the ring).
 */
function gyroscope({ hub, r, group, gj, gm }: FormationCtx): Sample {
  if (group === 0) return gyroCore(gj, gm, hub, r);
  const ring = GYRO_RINGS[group - 1];
  const a = (hub ? Math.floor(r() * 4) * (Math.PI / 2) : ((gj + 0.5) / gm) * TAU) + jit(r) / ring.radius;
  const th = fract(gj * GOLDEN) * TAU + jit(r) / ring.tube;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const rad = ring.radius + ring.tube * ct;
  return {
    p: [ca * rad, ring.tube * st, sa * rad],
    n: norm3(ca * (0.7 * ct + 0.3), 0.7 * st, sa * (0.7 * ct + 0.3)),
  };
}

/* ---- 2D vector icon toolkit: particles are sampled strictly along stroke paths ---- */

type Pt = [number, number];

interface Stroke {
  pts: Pt[];
  closed?: boolean;
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  start: number;
  len: number;
}

interface PathSet {
  segs: Seg[];
  total: number;
  verts: Pt[];
}

/** Total z-extrusion half-depth of every icon. */
const EXTRUDE = 0.3;
/** Half-width of the ribbon cross-section around each stroke. */
const ICON_W = 0.004;
/** Radius of the virtual lens used for the icons' silhouette normals. */
const ICON_SHELL_R = 1.15;

function buildPathSet(strokes: Stroke[], offset: Pt = [0, 0]): PathSet {
  const segs: Seg[] = [];
  const verts: Pt[] = [];
  let total = 0;
  for (const { pts, closed } of strokes) {
    const shifted = pts.map((p): Pt => [p[0] + offset[0], p[1] + offset[1]]);
    const count = closed ? shifted.length : shifted.length - 1;
    for (let k = 0; k < count; k++) {
      const a = shifted[k];
      const b = shifted[(k + 1) % shifted.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-6) continue;
      segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], start: total, len });
      total += len;
    }
    verts.push(...shifted);
  }
  return { segs, total, verts };
}

/** Point + unit tangent at arc-length fraction `u` along a path set. */
function samplePath(set: PathSet, u: number): [number, number, number, number] {
  const target = u * set.total;
  let lo = 0;
  let hi = set.segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (set.segs[mid].start <= target) lo = mid;
    else hi = mid - 1;
  }
  const s = set.segs[lo];
  const t = Math.min(1, Math.max(0, (target - s.start) / s.len));
  const tx = (s.bx - s.ax) / s.len;
  const ty = (s.by - s.ay) / s.len;
  return [s.ax + (s.bx - s.ax) * t, s.ay + (s.by - s.ay) * t, tx, ty];
}

function arcPts(cx: number, cy: number, rad: number, a0: number, a1: number, steps = 7): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    out.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return out;
}

/** Closed rounded rectangle, counter-clockwise. */
function roundRectPts(x0: number, y0: number, x1: number, y1: number, rad: number): Pt[] {
  const h = Math.PI / 2;
  return [
    ...arcPts(x1 - rad, y0 + rad, rad, -h, 0),
    ...arcPts(x1 - rad, y1 - rad, rad, 0, h),
    ...arcPts(x0 + rad, y1 - rad, rad, h, 2 * h),
    ...arcPts(x0 + rad, y0 + rad, rad, 2 * h, 3 * h),
  ];
}

/** Open inverted-U handle with rounded shoulders, standing on `yBase`. */
function archPts(xl: number, xr: number, yBase: number, yTop: number, rad: number): Pt[] {
  const h = Math.PI / 2;
  return [
    [xl, yBase],
    ...arcPts(xl + rad, yTop - rad, rad, Math.PI, h),
    ...arcPts(xr - rad, yTop - rad, rad, h, 0),
    [xr, yBase],
  ];
}

function bezierPts(p0: Pt, c: Pt, p1: Pt, steps = 14): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const m = 1 - t;
    out.push([
      m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0],
      m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1],
    ]);
  }
  return out;
}

/** Outline polygon of a thick polyline (mitered joins, butt caps). */
function thickPolyline(points: Pt[], width: number): Pt[] {
  const h = width / 2;
  const n = points.length;
  const dirs: Pt[] = [];
  for (let k = 0; k < n - 1; k++) {
    const dx = points[k + 1][0] - points[k][0];
    const dy = points[k + 1][1] - points[k][1];
    const len = Math.hypot(dx, dy) || 1;
    dirs.push([dx / len, dy / len]);
  }
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = dirs[Math.max(0, k - 1)];
    const b = dirs[Math.min(n - 2, k)];
    const na: Pt = [-a[1], a[0]];
    const nb: Pt = [-b[1], b[0]];
    let mx = na[0] + nb[0];
    let my = na[1] + nb[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const miter = h / Math.max(0.35, mx * nb[0] + my * nb[1]);
    left.push([points[k][0] + mx * miter, points[k][1] + my * miter]);
    right.push([points[k][0] - mx * miter, points[k][1] - my * miter]);
  }
  return [...left, ...right.reverse()];
}

/** Bold arrow as two closed polygons: shaft rectangle + head triangle. */
function arrowPolys(from: Pt, to: Pt, shaftW: number, headL: number, headW: number): Stroke[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const d: Pt = [dx / len, dy / len];
  const n: Pt = [-d[1], d[0]];
  const base: Pt = [to[0] - d[0] * headL, to[1] - d[1] * headL];
  const sw = shaftW / 2;
  const hw = headW / 2;
  return [
    {
      closed: true,
      pts: [
        [from[0] + n[0] * sw, from[1] + n[1] * sw],
        [base[0] + n[0] * sw, base[1] + n[1] * sw],
        [base[0] - n[0] * sw, base[1] - n[1] * sw],
        [from[0] - n[0] * sw, from[1] - n[1] * sw],
      ],
    },
    {
      closed: true,
      pts: [
        [base[0] + n[0] * hw, base[1] + n[1] * hw],
        [to[0], to[1]],
        [base[0] - n[0] * hw, base[1] - n[1] * hw],
      ],
    },
  ];
}

/* ---- Icon definitions ---- */

/** 1 — Economics: L-shaped axes, 4 ascending bars, bold upward trend arrow floating above. */
const CHART_PATHS = buildPathSet([
  { pts: [[-0.9, 0.84], [-0.9, -0.8], [0.92, -0.8]] },
  ...[-0.45, -0.1, 0.25, 0.6].map((y): Stroke => ({ pts: [[-0.9, y], [-0.8, y]] })),
  ...[0.32, 0.62, 0.92, 1.24].map((h, k): Stroke => {
    const x0 = -0.66 + k * 0.36;
    return {
      closed: true,
      pts: [[x0, -0.8], [x0 + 0.24, -0.8], [x0 + 0.24, -0.8 + h], [x0, -0.8 + h]],
    };
  }),
  ...arrowPolys([-0.76, -0.02], [0.8, 0.84], 0.09, 0.3, 0.34),
]);

/** 2 — Mathematics: block sigma (Σ) outline, constant stroke thickness ~0.22. */
const SIGMA_PATHS = buildPathSet([
  {
    closed: true,
    pts: [
      [-0.65, 0.85], [0.65, 0.85], [0.65, 0.63], [-0.27, 0.63], [0.241, 0], [-0.27, -0.63],
      [0.65, -0.63], [0.65, -0.85], [-0.65, -0.85], [-0.65, -0.63], [-0.552, -0.63],
      [-0.042, 0], [-0.552, 0.63], [-0.65, 0.63],
    ],
  },
]);

const RING_TILT = -0.32;
const RING_RX = 0.92;
const RING_RY = 0.3;
const RING_TICKS = 12;

/** Point on the orbital ring around the sigma; `scale` pushes it radially (for ticks). */
function ringPoint(a: number, scale = 1): Vec3 {
  const x = RING_RX * scale * Math.cos(a);
  const y = RING_RY * scale * Math.sin(a);
  const c = Math.cos(RING_TILT);
  const s = Math.sin(RING_TILT);
  return [x * c - y * s, x * s + y * c, 0.32 * Math.sin(a)];
}

/** 3 — Business: rounded briefcase body, handle arch (double contour), clasp line + clasp. */
const CASE_PATHS = buildPathSet(
  [
    { closed: true, pts: roundRectPts(-0.8, -0.62, 0.8, 0.36, 0.14) },
    { pts: archPts(-0.3, 0.3, 0.36, 0.74, 0.12) },
    { pts: archPts(-0.19, 0.19, 0.36, 0.62, 0.07) },
    { pts: [[-0.8, -0.05], [0.8, -0.05]] },
    { closed: true, pts: roundRectPts(-0.12, -0.15, 0.12, 0.06, 0.03) },
  ],
  [0, -0.06],
);

/** 4 — Verified certificate shield: double contour + bold checkmark. */
const SHIELD_OUTER: Pt[] = [
  [-0.72, 0.7],
  [0, 0.9],
  [0.72, 0.7],
  [0.72, 0.02],
  ...bezierPts([0.72, 0.02], [0.7, -0.62], [0, -0.95]).slice(1),
  ...bezierPts([0, -0.95], [-0.7, -0.62], [-0.72, 0.02]).slice(1, -1),
  [-0.72, 0.02],
];
const SHIELD_PATHS = buildPathSet([
  { closed: true, pts: SHIELD_OUTER },
  { closed: true, pts: SHIELD_OUTER.map((p): Pt => [p[0] * 0.84, p[1] * 0.84]) },
  { closed: true, pts: thickPolyline([[-0.3, 0.04], [-0.08, -0.2], [0.34, 0.3]], 0.15) },
]);

/**
 * Silhouette normal of a flat icon: treat it as lying on a shallow lens so the centre faces the
 * viewer (dim, sparse) and the outer contour turns away (grazing → Fresnel rim glow).
 */
function iconShellNormal(x: number, y: number, zs: number): Vec3 {
  const rr = Math.min(1, Math.hypot(x, y) / ICON_SHELL_R);
  return norm3(x, y, zs * Math.sqrt(1 - rr * rr) * 1.1);
}

/**
 * Shell sample on an extruded icon: a 2D Fibonacci lattice over (arc length u, cross-section θ).
 * The cross-section is a squircle ribbon (half-width ICON_W, half-depth EXTRUDE); uniform θ on a
 * superellipse concentrates samples on the front/back contours, keeping the mid-wall sparse.
 */
function iconSample(set: PathSet, j: number, m: number, r: Rng, hub: boolean): Sample {
  if (hub) {
    const v = set.verts[Math.floor(r() * set.verts.length)];
    return { p: [v[0], v[1], EXTRUDE], n: iconShellNormal(v[0], v[1], 1) };
  }
  const [x, y, tx, ty] = samplePath(set, (j + 0.5) / m);
  const th = fract(j * GOLDEN + 0.25) * TAU;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const off = ICON_W * Math.sign(c) * Math.sqrt(Math.abs(c));
  const zs = Math.sign(s) * Math.sqrt(Math.abs(s));
  const nx = -ty;
  const ny = tx;
  const px = x + nx * off;
  const py = y + ny * off;
  const sh = iconShellNormal(px, py, zs);
  // Full ±JITTER along the stroke and in depth, 40% across it so outlines stay crisp.
  const jt = jit(r);
  const jn = jit(r) * 0.4;
  return {
    p: [px + tx * jt + nx * jn, py + ty * jt + ny * jn, EXTRUDE * zs + jit(r)],
    n: norm3(sh[0] + 0.5 * nx * c, sh[1] + 0.5 * ny * c, sh[2] + 0.5 * s),
  };
}

function growthChart({ i, n, r, hub }: FormationCtx): Sample {
  return iconSample(CHART_PATHS, i, n, r, hub);
}

/** Sigma: 78% glyph shell, 15% orbital ring shell, 7% ring ticks — contiguous index ranges. */
function sigma({ i, n, r, hub }: FormationCtx): Sample {
  const glyphEnd = Math.round(n * 0.78);
  const ringEnd = Math.round(n * 0.93);
  if (hub || i < glyphEnd) return iconSample(SIGMA_PATHS, i, glyphEnd, r, hub);
  if (i < ringEnd) {
    const j = i - glyphEnd;
    const a = ((j + 0.5) / (ringEnd - glyphEnd)) * TAU;
    const st = Math.sin(fract(j * GOLDEN) * TAU);
    const p = ringPoint(a);
    return {
      p: [p[0] + jit(r), p[1] + jit(r), p[2] + jit(r)],
      n: norm3(p[0], p[1], p[2] + 0.35 * st),
    };
  }
  const j = i - ringEnd;
  const k = j % RING_TICKS;
  const a = (k / RING_TICKS) * TAU;
  const long = k % 3 === 0;
  const p = ringPoint(a, 1 + (fract(j * GOLDEN) - 0.5) * (long ? 0.3 : 0.16));
  const base = ringPoint(a);
  return { p: [p[0] + jit(r) * 0.5, p[1] + jit(r) * 0.5, p[2] + jit(r) * 0.5], n: norm3(base[0], base[1], base[2]) };
}

function briefcase({ i, n, r, hub }: FormationCtx): Sample {
  return iconSample(CASE_PATHS, i, n, r, hub);
}

function shield({ i, n, r, hub }: FormationCtx): Sample {
  return iconSample(SHIELD_PATHS, i, n, r, hub);
}

const FORMATIONS: ReadonlyArray<(c: FormationCtx) => Sample> = [
  gyroscope,
  growthChart,
  sigma,
  briefcase,
  shield,
];

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

/** Triangle circumscribed diameter as a fraction of the point sprite — the rest is glow + AA margin. */
const TRI_FILL = 0.8;
/** Glyph bump so the 6 tetrahedron edges read crisply without crowding (≈ +12%). */
const GLYPH_SIZE_BUMP = 1.12;
/** Per-particle size trim for the monumental scale, so outlines stay delicate 1.2px glyphs. */
const TRI_SIZE_TRIM = 0.87 * GLYPH_SIZE_BUMP;
/** Hard ceiling on a formation glyph's circumscribed diameter (CSS px). */
const TRI_MAX_CSS = 24 * GLYPH_SIZE_BUMP;

/** Regular tetrahedron glyph: circumradius (glyph units) and perspective eye distance. */
const TETRA_R = 0.42;
const TETRA_PERSP = 2.6;
/** Normalises projected vertices so the largest possible projection has radius 1 (never clips). */
const TETRA_INV_PROJ = (TETRA_PERSP - TETRA_R) / TETRA_R;
const TETRA_C = TETRA_R / Math.sqrt(3); // per-axis component of normalize(±1, ±1, ±1) * R
/** Back edges dim to this fraction of front edges, so the volume reads at small sizes. */
const TETRA_BACK_DIM = 0.72;
/** Gaussian repulsion: peak displacement REPEL_MAX at d = σ/√2, ≈ 0 beyond REPEL_RADIUS. */
const REPEL_SIGMA = REPEL_RADIUS * 0.6;
const REPEL_K = (REPEL_MAX * Math.SQRT2 * Math.exp(0.5)) / REPEL_SIGMA;

const glslFloat = (v: number): string => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const glslColor = (hex: number): string =>
  `vec3(${(((hex >> 16) & 255) / 255).toFixed(4)}, ${(((hex >> 8) & 255) / 255).toFixed(4)}, ${((hex & 255) / 255).toFixed(4)})`;

/** 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT). */
const SIMPLEX_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const VERTEX_SHADER = /* glsl */ `
attribute vec3 aT1;
attribute vec3 aT2;
attribute vec3 aT3;
attribute vec3 aT4;
attribute vec3 aN0; // per-formation surface normals (aN0 in local gyroscope coords)
attribute vec3 aN1;
attribute vec3 aN2;
attribute vec3 aN3;
attribute vec3 aN4;
// x: group (−2 foreground ambient · −1 deep ambient · 0 gyroscope core · 1..3 rings)
// y: phase 0..1 · z: in-plane spin rad/s (signed) · w: triangle size, CSS px
attribute vec4 aMeta;

uniform float uTime;
uniform float uW[5];
uniform float uEnergy;
uniform float uScale;
uniform vec3 uOffset;
uniform vec2 uRot;
uniform float uBrightness;
uniform float uSizeMul;
uniform mat3 uRingM[3];
uniform mat3 uCoreM;
uniform float uPx; // device pixel ratio
uniform float uMaxPoint; // GPU point-size limit, device px
uniform vec2 uAmbHalf; // ambient half-extent per unit depth: (tan·aspect, tan)
uniform vec2 uMouse; // damped pointer, NDC y-down (0 on touch / reduced motion) — ambient drift only
uniform vec3 uRayO; // cursor ray (world)
uniform vec3 uRayD;
uniform float uRepel; // 0..1 cursor influence
uniform float uScroll; // smoothed page progress 0..1 (0 under reduced motion)
uniform float uFgMaxPx; // near-lens point-size ceiling for the foreground layer (CSS px)

varying vec3 vColor;
varying float vAlpha;
varying float vGlow; // exterior micro-glow strength
varying float vSprite; // sprite edge, device px
varying float vStroke; // stroke width, device px
varying vec4 vP01; // projected tetrahedron vertices 0,1 (unit radius = glyph circumradius)
varying vec4 vP23; // projected tetrahedron vertices 2,3
varying vec4 vDepth; // view-facing z of vertices 0..3 (glyph units, + = toward camera)
varying float vBlur; // foreground depth-of-field softness 0..1
varying float vRad; // glyph circumradius, device px

const float FG_FAR = ${glslFloat(FG_FAR)};
const float FG_NEAR = ${glslFloat(FG_NEAR)};
const float FG_SPEED = ${glslFloat(FG_SPEED)};
const float FG_FAR_FADE = ${glslFloat(FG_FAR_FADE)};
const float FG_NEAR_FADE_START = ${glslFloat(FG_NEAR_FADE_START)};
const float FG_BLUR_START = ${glslFloat(FG_BLUR_START)};
const float FG_BLUR_FULL = ${glslFloat(FG_BLUR_FULL)};
const float FG_XY_REF = ${glslFloat(FG_XY_REF)};
const float FG_SIZE_REF = ${glslFloat(FG_SIZE_REF)};
const float FG_SCROLL = ${glslFloat(FG_SCROLL)};

const float RING_SOFTEN = ${glslFloat(RING_GLOW_SOFTEN)};
const float TETRA_PERSP = ${glslFloat(TETRA_PERSP)};
const float TETRA_INV_PROJ = ${glslFloat(TETRA_INV_PROJ)};
const vec3 T0 = vec3(${glslFloat(TETRA_C)}, ${glslFloat(TETRA_C)}, ${glslFloat(TETRA_C)});
const vec3 T1 = vec3(${glslFloat(TETRA_C)}, ${glslFloat(-TETRA_C)}, ${glslFloat(-TETRA_C)});
const vec3 T2 = vec3(${glslFloat(-TETRA_C)}, ${glslFloat(TETRA_C)}, ${glslFloat(-TETRA_C)});
const vec3 T3 = vec3(${glslFloat(-TETRA_C)}, ${glslFloat(-TETRA_C)}, ${glslFloat(TETRA_C)});

const float REF_DIST = ${glslFloat(REF_CAM_Z)};
const float AMB_REF = ${glslFloat(AMBIENT_REF_DIST)};
const float TRI_FILL = ${glslFloat(TRI_FILL)};
const float TRI_SIZE_TRIM = ${glslFloat(TRI_SIZE_TRIM)};
const float TRI_MAX = ${glslFloat(TRI_MAX_CSS)};
const float REPEL_SIGMA2 = ${glslFloat(REPEL_SIGMA * REPEL_SIGMA)};
const float REPEL_K = ${glslFloat(REPEL_K)};

const vec3 CYAN = ${glslColor(CYAN)};
const vec3 AMBER = ${glslColor(AMBER)};
const vec3 VIOLET = ${glslColor(VIOLET)};
const vec3 MINT = ${glslColor(MINT)};
const vec3 DEEP_TEAL = ${glslColor(DEEP_TEAL)};

${SIMPLEX_GLSL}

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

/** Euler rotation Rz · Ry · Rx (column-major). */
mat3 tumble(vec3 a) {
  vec3 c = cos(a);
  vec3 s = sin(a);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, c.x, s.x, 0.0, -s.x, c.x);
  mat3 ry = mat3(c.y, 0.0, -s.y, 0.0, 1.0, 0.0, s.y, 0.0, c.y);
  mat3 rz = mat3(c.z, s.z, 0.0, -s.z, c.z, 0.0, 0.0, 0.0, 1.0);
  return rz * ry * rx;
}

/** Mild perspective projection of a glyph vertex, normalised to unit max radius. */
vec2 tetraProject(vec3 e) {
  return e.xy / (TETRA_PERSP - e.z) * TETRA_INV_PROJ;
}

/**
 * Smooth spatial colour zones: low-frequency simplex noise over formation-space position.
 * Violet ↔ mint core bands, deep-teal lower recesses, cyan rim / crown with amber sparks.
 */
vec3 zoneColor(vec3 p, float rim, float t) {
  vec3 q = p * 1.15 + vec3(0.0, t * 0.035, t * 0.05);
  float n1 = snoise(q);
  float n2 = snoise(q * 0.55 + vec3(17.3, 4.1, 9.7));
  float h = clamp(0.5 + 0.6 * n1 + 0.2 * p.x, 0.0, 1.0);
  vec3 col = mix(VIOLET, MINT, smoothstep(0.28, 0.72, h));
  float low = smoothstep(-0.15, -0.95, p.y + 0.22 * n2);
  col = mix(col, DEEP_TEAL, low * 0.85);
  float crown = smoothstep(0.35, 1.0, p.y + 0.25 * n2) * (1.0 - low);
  float spark = smoothstep(0.55, 0.75, 0.5 + 0.5 * n2) * max(crown, 0.55 * rim);
  vec3 accent = mix(CYAN, AMBER, spark);
  return mix(col, accent, clamp(rim * 0.7 + crown * 0.35, 0.0, 1.0));
}

void main() {
  float group = aMeta.x;
  float phase = aMeta.y;
  float size = aMeta.w;
  float amb = step(group, -0.5);
  float fg = step(group, -1.5);
  float tw = phase * 6.2831853;
  float r2 = fract(phase * 7.137 + 0.31);
  float t = uTime;

  // Stage 0 targets are local gyroscope coords: apply live ring tilt+spin / core counter-rotation.
  mat3 gm = mat3(1.0);
  if (group > 2.5) gm = uRingM[2];
  else if (group > 1.5) gm = uRingM[1];
  else if (group > 0.5) gm = uRingM[0];
  else if (group > -0.5) gm = uCoreM;
  vec3 p = (gm * position) * uW[0] + aT1 * uW[1] + aT2 * uW[2] + aT3 * uW[3] + aT4 * uW[4];
  vec3 n = (gm * aN0) * uW[0] + aN1 * uW[1] + aN2 * uW[2] + aN3 * uW[3] + aN4 * uW[4];
  n = normalize(n + vec3(0.0, 0.0, 1e-3));

  // Living micro-drift: two octaves of phase-shifted, position-coupled sines (cheap curl-like flow).
  vec3 drift = vec3(
    sin(t * 0.63 + tw + p.y * 2.3) + 0.5 * sin(t * 1.31 + tw * 2.3 + p.z * 3.7),
    sin(t * 0.57 + tw * 1.7 + p.z * 2.1) + 0.5 * sin(t * 1.19 + tw * 3.1 + p.x * 3.3),
    sin(t * 0.71 + tw * 0.6 + p.x * 2.6) + 0.5 * sin(t * 1.43 + tw * 1.3 + p.y * 3.9)
  ) * 0.6667;
  vec3 q = p + drift * (0.008 + 0.08 * uEnergy);
  q *= 1.0 + 0.012 * sin(t * 0.8); // whole-constellation breath

  // While morphing: radial dispersion + view-plane swirl impulse (uEnergy bell curve).
  float sw = uEnergy * (phase - 0.5) * 2.4;
  mat2 swirl = mat2(cos(sw), sin(sw), -sin(sw), cos(sw));
  q.xy = swirl * q.xy;
  n.xy = swirl * n.xy;
  q *= 1.0 + uEnergy * (0.16 + 0.5 * phase);
  q.z += uEnergy * (phase - 0.5) * 0.8;
  q = rotX(rotY(q, uRot.x), uRot.y) * uScale + uOffset;
  n = rotX(rotY(n, uRot.x), uRot.y);

  // Ambient layers: screen-normalised xy laid out at their own depth, slow independent drift.
  vec3 deep = vec3(p.xy * uAmbHalf * (AMB_REF - p.z), p.z)
    + vec3(sin(t * 0.11 + tw), cos(t * 0.09 + tw * 1.7), sin(t * 0.07 + tw * 0.6)) * 0.45;
  // Foreground corridor: continuous Z drift from FG_FAR to the lens, wrapping back to the far end
  // (frozen at a phase-seeded depth under reduced motion, where uTime stays 0).
  float span = FG_FAR - FG_NEAR;
  float fd = FG_FAR - fract(phase * 7.31 + t * FG_SPEED * mix(0.6, 1.0, r2) / span) * span;
  // Lateral home is fixed in world space, so a pyramid's screen position spreads outward as it
  // approaches — it glides past the camera with true perspective — plus a slow X/Y meander.
  vec2 fxy = p.xy * uAmbHalf * FG_XY_REF + vec2(sin(t * 0.05 + tw), cos(t * 0.043 + tw * 1.3)) * 0.35;
  // Scroll lift, wrapped in a window ~1.25× the visible height at that depth (wrap happens off-screen).
  float fh = uAmbHalf.y * fd * 1.25 + 0.5;
  fxy.y = mod(fxy.y + uScroll * FG_SCROLL + fh, 2.0 * fh) - fh;
  // Pointer drift, ambient layers only (formations stay anchored): shift away from the cursor by a
  // per-particle factor; a constant world shift reads larger on screen the nearer the pyramid is.
  vec2 mouseShift = vec2(-uMouse.x, uMouse.y) * mix(0.6, 1.4, r2); // NDC y-down → world y-up
  fxy += mouseShift * ${glslFloat(MOUSE_AMB_FG)};
  deep.xy += mouseShift * ${glslFloat(MOUSE_AMB_DEEP)};
  vec3 fore = vec3(fxy, cameraPosition.z - fd);
  vec3 w = mix(q, mix(deep, fore, fg), amb);

  // Cursor flow: push perpendicular to the mouse ray with a gaussian falloff (springiness is CPU-side).
  vec3 v = w - uRayO;
  vec3 perp = v - uRayD * dot(v, uRayD);
  w += perp * (REPEL_K * uRepel * exp(-dot(perp, perp) / REPEL_SIGMA2) * mix(1.0, 0.5, amb));

  vec4 mv = modelViewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.5);

  // View-space Fresnel (per point, so evaluating it here equals a per-fragment evaluation).
  vec3 vNormal = normalize(normalMatrix * n);
  vec3 vViewDir = normalize(-mv.xyz);
  float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.2);
  // rim drives opacity / size / glow; rimC (stricter) only tints the truly grazing silhouette.
  float rim = smoothstep(0.03, 0.55, fresnel) * (1.0 - amb);
  float rimC = smoothstep(0.3, 0.9, fresnel) * (1.0 - amb);

  // Size: formation triangles attenuate gently with depth and are slightly larger when front-facing;
  // ambient layers keep their authored CSS px size.
  float atten = clamp(pow(REF_DIST / dist, 0.85), 0.45, 1.25);
  float triF = size * uSizeMul * TRI_SIZE_TRIM * atten * mix(1.12, 0.94, rim) * (1.0 + 0.06 * sin(t * 1.3 + tw * 2.0));
  triF = min(triF, TRI_MAX);
  // Foreground pyramids scale with true perspective (size ∝ 1 / distance) under their own, much
  // higher ceiling, so they grow genuinely large near the lens; the deep field keeps its CSS size.
  float triA = mix(size, min(size * FG_SIZE_REF / dist, uFgMaxPx), fg);
  float tri = max(mix(triF, triA, amb), 3.0) * uPx;

  // Depth of field from real camera distance: sharp mid/far, ramping to full bokeh near the lens.
  vBlur = fg * (0.08 + 0.87 * smoothstep(FG_BLUR_START, FG_BLUR_FULL, dist));
  // Sprite = glyph + AA margin + room for the blur falloff, so soft edges never hit the sprite square.
  float R = tri * 0.5;
  float sprite = min(tri / TRI_FILL + 2.0 + vBlur * R * 0.75, uMaxPoint);
  gl_PointSize = sprite;
  vSprite = sprite;
  vRad = min(R, (sprite - 2.0) * TRI_FILL * 0.5); // shrinks to fit if the GPU point limit clamps
  vStroke = 1.2 * uPx;

  // Per-particle 3D tetrahedron: a distinct phase-seeded orientation plus a slow multi-axis
  // zero-gravity tumble (uTime is frozen at 0 under prefers-reduced-motion → static pose).
  float sp = aMeta.z;
  mat3 tr = tumble(vec3(tw * 1.37 + t * sp * 0.61, tw * 2.11 - t * sp * 0.43, tw * 0.73 + t * sp));
  vec3 e0 = tr * T0;
  vec3 e1 = tr * T1;
  vec3 e2 = tr * T2;
  vec3 e3 = tr * T3;
  vP01 = vec4(tetraProject(e0), tetraProject(e1));
  vP23 = vec4(tetraProject(e2), tetraProject(e3));
  vDepth = vec4(e0.z, e1.z, e2.z, e3.z);

  float nearFade = smoothstep(1.0, 3.5, dist);
  float twinkle = 0.88 + 0.12 * sin(t * 1.4 + tw * 3.0);
  if (amb > 0.5) {
    // Foreground 0.18–0.32 · deep field 0.15–0.28.
    float a = mix(mix(0.15, 0.28, r2), mix(0.18, 0.32, r2), fg);
    // Foreground: fade in at the far end of the corridor, dissolve smoothly before the near plane.
    float fgFade = smoothstep(FG_NEAR, FG_NEAR_FADE_START, dist) * smoothstep(FG_FAR, FG_FAR - FG_FAR_FADE, fd);
    vAlpha = a * twinkle * mix(nearFade, fgFade, fg);
    vGlow = mix(0.2, 0.05, fg);
    vColor = zoneColor(vec3(p.xy * 0.9, fg * 0.6), 0.25, t);
  } else {
    // Front-facing centre 0.45–0.7 → grazing rim 0.95–1.0, plus a soft fade at the bottom edge.
    float a = mix(mix(0.45, 0.7, r2), mix(0.95, 1.0, r2), rim);
    float bottom = 1.0 - 0.6 * smoothstep(-0.55, -1.0, p.y);
    // Gyroscope rings (groups 1..3) soften their additive intensity while stage 0 is showing.
    float ringSoft = 1.0 - RING_SOFTEN * step(0.5, group) * uW[0];
    vAlpha = a * uBrightness * twinkle * bottom * nearFade * ringSoft;
    vGlow = mix(0.08, 0.5, rim) * ringSoft;
    vColor = zoneColor(p, rimC, t);
  }
}
`;

const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
varying float vSprite;
varying float vStroke;
varying vec4 vP01;
varying vec4 vP23;
varying vec4 vDepth;
varying float vBlur;
varying float vRad;

const float BACK_DIM = ${glslFloat(TETRA_BACK_DIM)};

// Exact distance from p to segment ab (Inigo Quilez).
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  uv.y = -uv.y;
  vec2 p = uv * vSprite; // device px from the sprite centre
  // Projected vertices have max radius 1 → scale to the glyph circumradius, inside the AA/glow/blur margin.
  float R = vRad;
  vec2 a0 = vP01.xy * R;
  vec2 a1 = vP01.zw * R;
  vec2 a2 = vP23.xy * R;
  vec2 a3 = vP23.zw * R;

  // The 6 edges of the tetrahedron.
  float d01 = sdSegment(p, a0, a1);
  float d02 = sdSegment(p, a0, a2);
  float d03 = sdSegment(p, a0, a3);
  float d12 = sdSegment(p, a1, a2);
  float d13 = sdSegment(p, a1, a3);
  float d23 = sdSegment(p, a2, a3);
  float d = min(min(min(d01, d02), min(d03, d12)), min(d13, d23));

  // Razor 1.2px strokes; the foreground depth-of-field widens the falloff like an out-of-focus lens.
  float aa = max(fwidth(d), 1e-3) + vBlur * max(R, 1.0) * 0.3;
  float hw = 0.5 * vStroke;
  // Edges whose midpoint sits further back are dimmed so the pyramid's volume reads at a glance.
  vec4 zA = vec4(vDepth.x, vDepth.x, vDepth.x, vDepth.y);
  vec4 zB = vec4(vDepth.y, vDepth.z, vDepth.w, vDepth.z);
  vec4 shadeA = mix(vec4(BACK_DIM), vec4(1.0), smoothstep(-0.12, 0.12, (zA + zB) * 0.5));
  vec2 shadeB = mix(vec2(BACK_DIM), vec2(1.0), smoothstep(-0.12, 0.12, (vDepth.yz + vDepth.ww) * 0.5));
  vec4 lineA = clamp((hw - vec4(d01, d02, d03, d12)) / aa + 0.5, 0.0, 1.0) * shadeA;
  vec2 lineB = clamp((hw - vec2(d13, d23)) / aa + 0.5, 0.0, 1.0) * shadeB;
  float line = max(max(max(lineA.x, lineA.y), max(lineA.z, lineA.w)), max(lineB.x, lineB.y));
  // A widened falloff lowers the stroke's peak; compensate so bokeh keeps its intended opacity.
  line = min(line * (1.0 + 0.8 * vBlur), 1.0);

  // Fresnel-driven micro-glow hugging the edges; the interior stays hollow.
  float glow = exp(-d / max(R, 1.0) * 9.0) * vGlow;
  float a = max(line, glow) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

/* ------------------------------------------------------------------ */
/* Particle system construction                                        */
/* ------------------------------------------------------------------ */

interface Particles {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
}

/** Exponential size hierarchy: band by probability, then skewed toward the small end within the band. */
function pickSize(r: Rng, hero: boolean): number {
  let band = SIZE_BANDS[SIZE_BANDS.length - 1];
  if (!hero) {
    let roll = r();
    for (const b of SIZE_BANDS) {
      band = b;
      roll -= b[0];
      if (roll <= 0) break;
    }
  }
  return band[1] + (band[2] - band[1]) * Math.pow(r(), 1.6);
}

function createParticles(mobile: boolean, pixelRatio: number, maxPoint: number): Particles {
  const r = mulberry32(0x0ec0a0a);
  const count = mobile ? COUNT_MOBILE : COUNT_DESKTOP;
  const fgCount = mobile ? FG_MOBILE : FG_DESKTOP;
  const bgCount = mobile ? BG_MOBILE : BG_DESKTOP;
  const n = count - fgCount - bgCount;
  const bounds = gyroBounds(n);

  const targets = Array.from({ length: STAGES }, () => new Float32Array(count * 3));
  const normals = Array.from({ length: STAGES }, () => new Float32Array(count * 3));
  const meta = new Float32Array(count * 4);

  const write = (s: number, i: number, p: Vec3, nr: Vec3): void => {
    targets[s].set(p, i * 3);
    normals[s].set(nr, i * 3);
  };

  for (let i = 0; i < count; i++) {
    let group: number;
    let size: number;
    let spin: number;

    if (i < n) {
      const hub = i % HUB_STRIDE === 7;
      group = 0;
      while (group < bounds.length - 2 && i >= bounds[group + 1]) group++;
      const ctx: FormationCtx = {
        i,
        n,
        hub,
        group,
        gj: i - bounds[group],
        gm: bounds[group + 1] - bounds[group],
        r,
      };
      for (let s = 0; s < STAGES; s++) {
        const sample = FORMATIONS[s](ctx);
        write(s, i, sample.p, sample.n);
      }
      size = pickSize(r, hub);
      spin = (r() < 0.5 ? -1 : 1) * (0.08 + r() * 0.45);
    } else if (i < n + fgCount) {
      // Foreground corridor: screen-normalised lateral home (at FG_XY_REF depth); the shader drives z.
      group = -2;
      let hx = 0;
      let hy = 0;
      do {
        hx = r() * 2.1 - 1.05;
        hy = r() * 2.1 - 1.05;
      } while (Math.hypot(hx, hy * 1.1) < FG_MIN_RADIUS);
      for (let s = 0; s < STAGES; s++) {
        write(s, i, [hx + (r() - 0.5) * 0.06, hy + (r() - 0.5) * 0.06, 0], [0, 0, 1]);
      }
      size = FG_SIZE[0] + (FG_SIZE[1] - FG_SIZE[0]) * r();
      spin = (r() < 0.5 ? -1 : 1) * (0.03 + r() * 0.08);
    } else {
      // Deep field: screen-normalised home + world z; each stage re-scatters slightly.
      group = -1;
      const hx = r() * 2 - 1;
      const hy = r() * 2 - 1;
      const hz = BG_Z_FAR + r() * (BG_Z_NEAR - BG_Z_FAR);
      for (let s = 0; s < STAGES; s++) {
        write(s, i, [hx + (r() - 0.5) * 0.18, hy + (r() - 0.5) * 0.18, hz + (r() - 0.5) * 1.2], [0, 0, 1]);
      }
      size = BG_SIZE[0] + (BG_SIZE[1] - BG_SIZE[0]) * r();
      spin = (r() < 0.5 ? -1 : 1) * (0.08 + r() * 0.4);
    }

    meta[i * 4] = group;
    meta[i * 4 + 1] = r();
    meta[i * 4 + 2] = spin;
    meta[i * 4 + 3] = size;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(targets[0], 3));
  for (let s = 1; s < STAGES; s++) {
    geometry.setAttribute(`aT${s}`, new THREE.BufferAttribute(targets[s], 3));
  }
  for (let s = 0; s < STAGES; s++) {
    geometry.setAttribute(`aN${s}`, new THREE.BufferAttribute(normals[s], 3));
  }
  geometry.setAttribute('aMeta', new THREE.BufferAttribute(meta, 4));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uW: { value: [1, 0, 0, 0, 0] },
      uEnergy: { value: 0 },
      uScale: { value: 4 },
      uOffset: { value: new THREE.Vector3() },
      uRot: { value: new THREE.Vector2() },
      uBrightness: { value: 1 },
      uSizeMul: { value: 1 },
      uRingM: { value: [new THREE.Matrix3(), new THREE.Matrix3(), new THREE.Matrix3()] },
      uCoreM: { value: new THREE.Matrix3() },
      uPx: { value: pixelRatio },
      uMaxPoint: { value: maxPoint },
      uAmbHalf: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2() },
      uRayO: { value: new THREE.Vector3(0, 0, REF_CAM_Z) },
      uRayD: { value: new THREE.Vector3(0, 0, -1) },
      uRepel: { value: 0 },
      uScroll: { value: 0 },
      uFgMaxPx: { value: mobile ? FG_MAX_PX_MOBILE : FG_MAX_PX_DESKTOP },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry, material };
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
        alpha: true, // transparent canvas so the page's obsidian #080B14 shows through
        powerPreference: 'high-performance',
      });
    } catch {
      return; // WebGL unavailable — the landing page still works on its plain background
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
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

    // Hardware point-size ceiling (device px); sprites are clamped and the SDF shrinks to fit.
    const gl = renderer.getContext();
    const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    const maxPoint = pointRange && pointRange[1] > 1 ? pointRange[1] : 64;

    let isMobile = window.innerWidth < MOBILE_QUERY_PX;
    let particles = createParticles(isMobile, pixelRatio, maxPoint);
    scene.add(particles.points);

    let width = 1;
    let height = 1;
    let dirty = true;

    // Responsive layout: `layoutTarget` is recomputed on resize; `layout` eases toward it every frame.
    const halfRefH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let layoutTarget: Layout | null = null;
    let layout: Layout | null = null;

    const resize = () => {
      width = Math.max(1, container.clientWidth || window.innerWidth);
      height = Math.max(1, container.clientHeight || window.innerHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      layoutTarget = computeLayout(window.innerWidth, width / height, halfRefH);
      if (!layout) {
        layout = { ...layoutTarget, x: [...layoutTarget.x], y: [...layoutTarget.y] }; // first mount: no ease-in
      }

      const mobile = window.innerWidth < MOBILE_QUERY_PX;
      if (mobile !== isMobile) {
        isMobile = mobile;
        scene.remove(particles.points);
        particles.geometry.dispose();
        particles.material.dispose();
        particles = createParticles(isMobile, pixelRatio, maxPoint);
        scene.add(particles.points);
      }
      dirty = true;
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Mouse parallax + cursor repulsion — fine pointers only, never on touch.
    const pointer = { x: 0, y: 0 };
    // Camera turn + ambient drift: `target*` follows the pointer (reset to 0 when it leaves the
    // viewport), `current*` eases toward it every frame. NDC in [-1, 1], y down.
    const mouse = { targetX: 0, targetY: 0, currentX: 0, currentY: 0 };
    const cursor = { x: 0, y: 0, vx: 0, vy: 0 }; // spring-follower of `pointer` (NDC, y down)
    let pointerActive = false;
    let pointerSeen = false;
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      mouse.targetX = Math.max(-1, Math.min(1, pointer.x));
      mouse.targetY = Math.max(-1, Math.min(1, pointer.y));
      if (!pointerSeen) {
        cursor.x = pointer.x;
        cursor.y = pointer.y;
        pointerSeen = true;
      }
      pointerActive = true;
    };
    const releasePointer = () => {
      pointerActive = false;
      mouse.targetX = 0;
      mouse.targetY = 0;
    };
    const onPointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) releasePointer(); // left the window
    };
    const onBlur = releasePointer;
    if (finePointer) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerout', onPointerOut, { passive: true });
      window.addEventListener('blur', onBlur);
    }

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
    const ringRot = new THREE.Matrix4();
    const tiltX = new THREE.Matrix4();
    const spinM = new THREE.Matrix4();
    const brightnessScratch: number[] = new Array<number>(STAGES).fill(1);
    const scaleScratch: number[] = new Array<number>(STAGES).fill(1);
    const rayDir = new THREE.Vector3();
    let repel = 0;
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

      // Ease the responsive layout toward its target (snaps under reduced motion).
      if (!layout || !layoutTarget) return;
      {
        const lt = layoutTarget;
        const lc = layout;
        const k = reduced ? 1 : 1 - Math.exp(-dt * LAYOUT_EASE);
        let delta = 0;
        const step = (cur: number, tgt: number): number => {
          const next = cur + (tgt - cur) * k;
          delta = Math.max(delta, Math.abs(tgt - next));
          return Math.abs(tgt - next) < 1e-4 ? tgt : next;
        };
        lc.side = step(lc.side, lt.side);
        lc.shield = step(lc.shield, lt.shield);
        lc.alpha = step(lc.alpha, lt.alpha);
        for (let s = 0; s < STAGES; s++) {
          lc.x[s] = step(lc.x[s], lt.x[s]);
          lc.y[s] = step(lc.y[s], lt.y[s]);
        }
        if (delta >= 1e-4) dirty = true;
      }

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

      // Gyroscope: each ring counter-rotates about its own tilted axis; the core spins the other way.
      const ringMats = u.uRingM.value as THREE.Matrix3[];
      GYRO_RINGS.forEach((ring, k) => {
        ringRot
          .makeRotationZ(ring.tiltZ)
          .multiply(tiltX.makeRotationX(ring.tiltX))
          .multiply(spinM.makeRotationY(ring.spin * time));
        ringMats[k].setFromMatrix4(ringRot);
      });
      ringRot.makeRotationY(GYRO_CORE_SPIN * time).multiply(tiltX.makeRotationX(0.4 * GYRO_CORE_SPIN * time + 0.3));
      (u.uCoreM.value as THREE.Matrix3).setFromMatrix4(ringRot);

      // Stage blend weights.
      // Hero → Economics runs its own two-phase choreography off the linear segment progress `heroT`:
      // the morph is delayed (Phase B) while yaw + travel lead (Phase A). Other stages keep sampleKeys.
      const heroT = clamp01((smoothed - STAGE_KEYS[1][0]) / (STAGE_KEYS[2][0] - STAGE_KEYS[1][0]));
      const inHero = heroT > 0 && heroT < 1;
      const stage = inHero ? smoothstep(HERO_LEAD.morph[0], HERO_LEAD.morph[1], heroT) : sampleKeys(STAGE_KEYS, smoothed);
      const i0 = Math.min(Math.floor(stage), STAGES - 1);
      const f = i0 >= STAGES - 1 ? 0 : stage - i0;
      const weights = u.uW.value as number[];
      for (let k = 0; k < STAGES; k++) weights[k] = 0;
      weights[i0] = 1 - f;
      if (f > 0) weights[i0 + 1] = f;
      u.uEnergy.value = reduced ? 0 : Math.sin(Math.PI * f); // sinusoidal bell, peaks mid-transition

      const blend = (values: number[]): number => {
        let v = 0;
        for (let k = 0; k < STAGES; k++) v += values[k] * weights[k];
        return v;
      };

      // Camera path + damped mouse parallax (desktop only).
      const camZ = sampleKeys(CAM_Z_KEYS, smoothed);
      // Frame-rate-independent exponential follow (identical feel at 60 Hz and 120 Hz).
      if (finePointer && !reduced) {
        const k = 1 - Math.exp(-MOUSE_RATE * dt);
        mouse.currentX += (mouse.targetX - mouse.currentX) * k;
        mouse.currentY += (mouse.targetY - mouse.currentY) * k;
      } else {
        mouse.currentX = 0;
        mouse.currentY = 0;
      }
      (u.uMouse.value as THREE.Vector2).set(mouse.currentX, mouse.currentY);
      // Scroll parallax for the near-lens foreground (static under reduced motion).
      u.uScroll.value = reduced ? 0 : smoothed;

      // Layout: constellation scale is fixed to the reference plane, lateral offset to the live frustum.
      const aspect = width / height;
      const halfHCam = halfRefH * camZ;
      const halfWCam = halfHCam * aspect;
      for (let k = 0; k < STAGES - 1; k++) scaleScratch[k] = layout.side * STAGE_FIT[k];
      scaleScratch[STAGES - 1] = layout.shield * STAGE_FIT[STAGES - 1];
      if (!isMobile) scaleScratch[0] *= HERO_SCALE_WIDE;
      let offsetX = blend(layout.x) * halfWCam;
      let offsetY = blend(layout.y) * halfHCam;

      let rotY = 0;
      let rotX = 0;
      for (let k = 0; k < STAGES; k++) {
        if (weights[k] === 0) continue;
        const [ry, rx] = STAGE_ROT[k](time);
        rotY += ry * weights[k];
        rotX += rx * weights[k];
      }

      if (inHero) {
        // Phase A glide: the intact gyroscope travels into Economics' territory ahead of the morph.
        const travel = smoothstep(HERO_LEAD.travel[0], HERO_LEAD.travel[1], heroT);
        offsetX = lerp(layout.x[0], layout.x[1], travel) * halfWCam;
        offsetY = lerp(layout.y[0], layout.y[1], travel) * halfHCam;
        // Lead-in yaw/pitch builds through Phase A and unwinds into the chart's resting pose as the
        // morph lands. Skipped under reduced motion (no large scroll-driven spin).
        if (!reduced) {
          const lead =
            smoothstep(HERO_LEAD.turnIn[0], HERO_LEAD.turnIn[1], heroT) *
            (1 - smoothstep(HERO_LEAD.unwind[0], HERO_LEAD.unwind[1], heroT));
          rotY += HERO_LEAD.yaw * lead;
          rotX += HERO_LEAD.pitch * lead;
        }
      }
      // Camera: position stays on the scroll-driven base path (sway + dolly), aimed at the origin; the
      // pointer adds only a gentle damped turn toward the cursor (local yaw, then pitch). mouse.currentY
      // is NDC y-down, so it is flipped to y-up for the pitch.
      camera.position.set(Math.sin(smoothed * Math.PI * 2) * 0.5, 0, camZ);
      camera.lookAt(0, 0, 0);
      camera.rotateY(-CAM_YAW * mouse.currentX);
      camera.rotateX(CAM_PITCH * -mouse.currentY);
      camera.updateMatrixWorld();

      // Cursor: slightly under-damped spring toward the pointer (sub-stepped for stability), then a world ray.
      const repelOn = finePointer && !reduced && pointerActive;
      repel += ((repelOn ? 1 : 0) - repel) * (1 - Math.exp(-dt * (repelOn ? 4 : 2.5)));
      if (repel > 1e-3) {
        const stiffness = 110;
        const damping = 2 * Math.sqrt(stiffness) * 0.62;
        const steps = Math.max(1, Math.ceil(dt * 240));
        const h = dt / steps;
        for (let s = 0; s < steps; s++) {
          cursor.vx += ((pointer.x - cursor.x) * stiffness - cursor.vx * damping) * h;
          cursor.vy += ((pointer.y - cursor.y) * stiffness - cursor.vy * damping) * h;
          cursor.x += cursor.vx * h;
          cursor.y += cursor.vy * h;
        }
      } else {
        cursor.x = pointer.x;
        cursor.y = pointer.y;
        cursor.vx = 0;
        cursor.vy = 0;
      }
      rayDir.set(cursor.x, -cursor.y, 0.5).unproject(camera).sub(camera.position).normalize();
      (u.uRayO.value as THREE.Vector3).copy(camera.position);
      (u.uRayD.value as THREE.Vector3).copy(rayDir);
      u.uRepel.value = reduced ? 0 : repel;

      u.uTime.value = time;
      u.uScale.value = blend(scaleScratch);
      u.uSizeMul.value = blend(STAGE_TRI_SIZE);
      (u.uOffset.value as THREE.Vector3).set(offsetX, offsetY, 0);
      (u.uRot.value as THREE.Vector2).set(rotY, rotX);
      (u.uAmbHalf.value as THREE.Vector2).set(halfRefH * aspect * 1.08, halfRefH * 1.08);
      // Shield: dim behind the architecture copy, a touch brighter (but below its old peak) at the CTA.
      const shieldB = 0.32 + 0.14 * smootherstep(clamp01((smoothed - 0.74) / 0.14));
      const table = isMobile ? STAGE_BRIGHTNESS_MOBILE : STAGE_BRIGHTNESS_DESKTOP;
      for (let k = 0; k < STAGES; k++) brightnessScratch[k] = table[k];
      brightnessScratch[STAGES - 1] = isMobile ? shieldB * 0.8 : shieldB;
      u.uBrightness.value = blend(brightnessScratch) * layout.alpha;

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', onBlur);
      reducedQuery.removeEventListener('change', onReducedChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      scene.remove(particles.points);
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
      className="fixed inset-0 z-0 pointer-events-none bg-transparent"
    />
  );
}

export default ConstellationCanvas;
