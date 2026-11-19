import { useEffect, useRef } from 'react';

/**
 * ECONOVA footer — interactive 3D dotted wordmark.
 *
 * A high-DPI 2D canvas (deliberately not a second WebGL context, so it never competes with the
 * ConstellationCanvas) with real 3D perspective projection:
 *  - "ECONOVA" is drawn once offscreen, sampled on a clean grid, and every sample is extruded into
 *    2–3 Z layers (−22…+22) so the letters have genuine depth.
 *  - Each dot is a spring body (vx, vy, vz): the cursor pushes dots out in X/Y and forward/back in Z
 *    with a quadratic falloff, then they spring back into crisp letters; a tiny idle drift keeps the
 *    mark breathing. The whole mark tilts toward a fine pointer (±6° yaw, ±4° pitch).
 *  - Colour runs left→right through the brand spectrum (cyan → violet → emerald) and flares toward a
 *    warm white spark while displaced.
 *  - Paused off-screen (IntersectionObserver); a single static frame under prefers-reduced-motion.
 *
 * Drawing is batched: dots are counting-sorted into (layer, heat, hue) buckets, back layer first,
 * and each bucket is filled as one path.
 */

interface FooterWordmarkCanvasProps {
  text?: string;
}

type Rgb = readonly [number, number, number];

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const MOBILE_PX = 768;

/** Brand spectrum, left → right. */
const STOPS: ReadonlyArray<Rgb> = [
  [0x5d, 0xe1, 0xd2], // cyan
  [0x92, 0x74, 0xff], // violet
  [0x6f, 0xe0, 0xa1], // emerald
];
const INK: Rgb = [0xf4, 0xf7, 0xfa];
const AMBER: Rgb = [0xf5, 0xb9, 0x42];

const HUES = 18; // gradient buckets across the wordmark
const HEATS = 3; // 0 at rest · 1 nudged · 2 displaced (spark)

/** Extrusion layers, back → front: z (px), alpha, base radius (CSS px). */
interface Layer {
  z: number;
  alpha: number;
  radius: number;
}
const LAYERS_DESKTOP: ReadonlyArray<Layer> = [
  { z: -22, alpha: 0.34, radius: 1.15 },
  { z: 0, alpha: 0.6, radius: 1.4 },
  { z: 22, alpha: 0.94, radius: 1.75 },
];
const LAYERS_MOBILE: ReadonlyArray<Layer> = [
  { z: -22, alpha: 0.38, radius: 1.1 },
  { z: 22, alpha: 0.92, radius: 1.6 },
];

/** Grid sampling: step (CSS px) and the budget of base samples before extrusion. */
const STEP_DESKTOP = 4.5;
const STEP_MOBILE = 5.5;
/** Full-bleed letters are large: the budget coarsens the grid slightly on ≥1440px (≈5–6px step). */
const MAX_SAMPLES_DESKTOP = 3800;
const MAX_SAMPLES_MOBILE = 1300;
/**
 * Letter tracking (em) and fit: the word fills ~96% of the canvas width, clamped so its cap height
 * stays within 80% of the height (headroom for tilt and Z-repulsion without clipping).
 */
const TRACKING = 0.06;
const FILL_W = 0.96;
const FILL_H = 0.8;

/** Physics (per 60fps frame). */
const SPRING = 0.065;
const DAMPING = 0.84;
const REPEL = 1.8;
const REPEL_RADIUS_DESKTOP = 110;
const REPEL_RADIUS_MOBILE = 80;
const TILT_YAW = 6 * DEG;
const TILT_PITCH = 4 * DEG;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function mixRgb(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function spectrum(t: number): Rgb {
  const u = clamp(t, 0, 1) * (STOPS.length - 1);
  const i = Math.min(Math.floor(u), STOPS.length - 2);
  const f = u - i;
  const s = f * f * (3 - 2 * f); // smooth blend between stops
  return mixRgb(STOPS[i], STOPS[i + 1], s);
}

const toCss = (c: Rgb): string => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;

/** palette[heat][hue] → CSS colour. Heat flares toward a warm white spark. */
const PALETTE: ReadonlyArray<ReadonlyArray<string>> = Array.from({ length: HEATS }, (_, heat) =>
  Array.from({ length: HUES }, (_, hue) => {
    const base = spectrum((hue + 0.5) / HUES);
    if (heat === 0) return toCss(base);
    if (heat === 1) return toCss(mixRgb(base, INK, 0.4));
    return toCss(mixRgb(mixRgb(base, INK, 0.62), AMBER, 0.28));
  }),
);

/** Cheap deterministic hash → [0, 1). */
const hash = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

interface Field {
  n: number;
  layers: ReadonlyArray<Layer>;
  hx: Float32Array;
  hy: Float32Array;
  hz: Float32Array;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  ph: Float32Array; // phase 0..1
  zs: Int8Array; // Z push direction under the cursor
  layer: Uint8Array;
  hue: Uint8Array;
  px: Float32Array; // projected screen x (CSS px)
  py: Float32Array;
  pr: Float32Array; // projected radius
  bucket: Uint16Array;
  order: Int32Array;
  counts: Int32Array;
}

export function FooterWordmarkCanvas({ text = 'ECONOVA' }: FooterWordmarkCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    let disposed = false;
    let width = 0;
    let height = 0;
    let focal = 900;
    let repelRadius = REPEL_RADIUS_DESKTOP;
    let field: Field | null = null;

    // Pointer + tilt state (canvas-local CSS px).
    const pointer = { x: 0, y: 0, active: false };
    const tilt = { yaw: 0, pitch: 0, yawT: 0, pitchT: 0 };

    let visible = false;
    let raf = 0;
    let last = 0;
    let time = 0;

    const fontFamily = (): string => {
      const v = getComputedStyle(wrap).getPropertyValue('--lp-font-display').trim();
      return v || "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif";
    };

    /* ---- Sampling: draw the word offscreen, grid-sample opaque pixels, extrude into layers ---- */
    const build = () => {
      if (disposed) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 10 || h < 10) return;
      width = w;
      height = h;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const mobile = window.innerWidth < MOBILE_PX;
      const layers = mobile ? LAYERS_MOBILE : LAYERS_DESKTOP;
      repelRadius = mobile ? REPEL_RADIUS_MOBILE : REPEL_RADIUS_DESKTOP;
      // Long enough that the ±22px layers part by a fraction of a stroke at the word's ends on any width.
      focal = Math.max(1500, w * 1.25);

      const off = document.createElement('canvas');
      off.width = Math.ceil(w);
      off.height = Math.ceil(h);
      const octx = off.getContext('2d', { willReadFrequently: true });
      if (!octx) return;

      // Fit: ~92% of the width, capped so the cap height stays inside ~80% of the height.
      const family = fontFamily();
      const chars = Array.from(text);
      octx.font = `800 100px ${family}`;
      const widths = chars.map((c) => octx.measureText(c).width);
      const sum100 = widths.reduce((a, b) => a + b, 0);
      const cap100 = octx.measureText('E').actualBoundingBoxAscent || 72;
      const fsW = (FILL_W * w) / (sum100 / 100 + TRACKING * (chars.length - 1));
      const fsH = (FILL_H * h) / (cap100 / 100);
      const fs = Math.max(8, Math.min(fsW, fsH));
      const total = (sum100 * fs) / 100 + TRACKING * fs * (chars.length - 1);
      const x0 = (w - total) / 2;
      const baseline = h / 2 + (cap100 * fs) / 200;

      octx.clearRect(0, 0, off.width, off.height);
      octx.font = `800 ${fs}px ${family}`;
      octx.fillStyle = '#fff';
      octx.textBaseline = 'alphabetic';
      let cx = x0;
      chars.forEach((c, k) => {
        octx.fillText(c, cx, baseline);
        cx += (widths[k] * fs) / 100 + TRACKING * fs;
      });
      const data = octx.getImageData(0, 0, off.width, off.height).data;

      // Clean grid, coarsened adaptively so very wide monitors stay within the dot budget.
      const maxSamples = mobile ? MAX_SAMPLES_MOBILE : MAX_SAMPLES_DESKTOP;
      // Small (width-bound) words get a finer grid so the letters stay legible.
      let step = clamp(fs / 18, 3, mobile ? STEP_MOBILE : STEP_DESKTOP);
      let pts: number[] = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        pts = [];
        for (let y = step / 2; y < off.height; y += step) {
          const row = Math.floor(y) * off.width;
          for (let x = step / 2; x < off.width; x += step) {
            if (data[(row + Math.floor(x)) * 4 + 3] > 128) pts.push(x, y);
          }
        }
        const count = pts.length / 2;
        if (count <= maxSamples * 1.05) break;
        step *= Math.sqrt(count / maxSamples);
      }

      const base = pts.length / 2;
      const n = base * layers.length;
      const f: Field = {
        n,
        layers,
        hx: new Float32Array(n),
        hy: new Float32Array(n),
        hz: new Float32Array(n),
        x: new Float32Array(n),
        y: new Float32Array(n),
        z: new Float32Array(n),
        vx: new Float32Array(n),
        vy: new Float32Array(n),
        vz: new Float32Array(n),
        ph: new Float32Array(n),
        zs: new Int8Array(n),
        layer: new Uint8Array(n),
        hue: new Uint8Array(n),
        px: new Float32Array(n),
        py: new Float32Array(n),
        pr: new Float32Array(n),
        bucket: new Uint16Array(n),
        order: new Int32Array(n),
        counts: new Int32Array(layers.length * HEATS * HUES + 1),
      };
      let i = 0;
      for (let l = 0; l < layers.length; l++) {
        for (let s = 0; s < base; s++, i++) {
          const sx = pts[s * 2];
          const sy = pts[s * 2 + 1];
          const ph = hash(s * 3.17 + l * 101.3);
          f.hx[i] = f.x[i] = sx - w / 2;
          f.hy[i] = f.y[i] = sy - h / 2;
          f.hz[i] = f.z[i] = layers[l].z;
          f.ph[i] = ph;
          // Front layer surges toward the viewer, back layer recedes, the middle splits.
          f.zs[i] = layers[l].z > 0 ? 1 : layers[l].z < 0 ? -1 : ph < 0.5 ? -1 : 1;
          f.layer[i] = l;
          f.hue[i] = Math.min(HUES - 1, Math.floor(clamp((sx - x0) / total, 0, 0.9999) * HUES));
        }
      }
      field = f;
      project(f);
      draw(f);
    };

    /* ---- Projection: yaw/pitch about the centre, then perspective focal / (focal − z) ---- */
    const project = (f: Field) => {
      const cy = Math.cos(tilt.yaw);
      const sy = Math.sin(tilt.yaw);
      const cp = Math.cos(tilt.pitch);
      const sp = Math.sin(tilt.pitch);
      const ox = width / 2;
      const oy = height / 2;
      for (let i = 0; i < f.n; i++) {
        const x = f.x[i];
        const y = f.y[i];
        const z = f.z[i];
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y1 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const s = focal / Math.max(focal - z2, 1);
        f.px[i] = ox + x1 * s;
        f.py[i] = oy + y1 * s;
        const disp = Math.abs(x - f.hx[i]) + Math.abs(y - f.hy[i]) + Math.abs(z - f.hz[i]) * 0.5;
        const heat = disp > 14 ? 2 : disp > 4 ? 1 : 0;
        f.pr[i] = clamp(f.layers[f.layer[i]].radius * s + 0.2 * heat, 1.1, 2.1);
        f.bucket[i] = (f.layer[i] * HEATS + heat) * HUES + f.hue[i];
      }
    };

    /* ---- Batched draw: counting-sort into buckets, back layer first, one path per bucket ---- */
    const draw = (f: Field) => {
      ctx.clearRect(0, 0, width, height);
      const counts = f.counts;
      counts.fill(0);
      for (let i = 0; i < f.n; i++) counts[f.bucket[i] + 1]++;
      for (let b = 1; b < counts.length; b++) counts[b] += counts[b - 1];
      // counts[b] is now the start offset of bucket b; fill the order array.
      const cursor = counts.slice(0, counts.length - 1);
      for (let i = 0; i < f.n; i++) f.order[cursor[f.bucket[i]]++] = i;

      const buckets = counts.length - 1;
      for (let b = 0; b < buckets; b++) {
        const start = counts[b];
        const end = counts[b + 1];
        if (end <= start) continue;
        const hue = b % HUES;
        const lh = Math.floor(b / HUES);
        const heat = lh % HEATS;
        const layer = Math.floor(lh / HEATS);
        ctx.fillStyle = PALETTE[heat][hue];
        ctx.globalAlpha = Math.min(1, f.layers[layer].alpha * (1 + 0.14 * heat));
        ctx.beginPath();
        for (let k = start; k < end; k++) {
          const i = f.order[k];
          const r = f.pr[i];
          ctx.moveTo(f.px[i] + r, f.py[i]);
          ctx.arc(f.px[i], f.py[i], r, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    /* ---- Physics step ---- */
    const step = (f: Field, dt: number) => {
      const k = Math.min(dt * 60, 2.5); // frame-rate normalisation
      const damp = Math.pow(DAMPING, k);
      const kt = 1 - Math.exp(-dt * 4);
      tilt.yaw += (tilt.yawT - tilt.yaw) * kt;
      tilt.pitch += (tilt.pitchT - tilt.pitch) * kt;

      const r = repelRadius;
      const r2 = r * r;
      const on = pointer.active;
      const mx = pointer.x;
      const my = pointer.y;
      for (let i = 0; i < f.n; i++) {
        const ph = f.ph[i] * TAU;
        // Idle breathing drift around the home position.
        const tx = f.hx[i] + Math.sin(time * 0.9 + ph) * 0.5;
        const ty = f.hy[i] + Math.cos(time * 0.75 + ph * 1.7) * 0.5;
        const tz = f.hz[i] + Math.sin(time * 0.6 + ph * 2.3) * 1.6;

        // Cursor repulsion wave (screen space, last frame's projection), quadratic falloff.
        if (on) {
          const dx = f.px[i] - mx;
          const dy = f.py[i] - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2) {
            const d = Math.sqrt(d2) || 1;
            const q = 1 - d / r;
            const push = q * q * REPEL * k;
            f.vx[i] += (dx / d) * push;
            f.vy[i] += (dy / d) * push;
            f.vz[i] += f.zs[i] * push * 0.9;
          }
        }

        f.vx[i] = (f.vx[i] + (tx - f.x[i]) * SPRING * k) * damp;
        f.vy[i] = (f.vy[i] + (ty - f.y[i]) * SPRING * k) * damp;
        f.vz[i] = (f.vz[i] + (tz - f.z[i]) * SPRING * k) * damp;
        f.x[i] += f.vx[i] * k;
        f.y[i] += f.vy[i] * k;
        f.z[i] += f.vz[i] * k;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed || !visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;
      if (field) {
        step(field, dt);
        project(field);
        draw(field);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (reduced || raf || disposed) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    /* ---- Pointer: repulsion for mouse + touch drag; tilt for fine pointers only ---- */
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      if (finePointer && e.pointerType === 'mouse' && rect.width > 0 && rect.height > 0) {
        tilt.yawT = clamp((pointer.x / rect.width) * 2 - 1, -1, 1) * TILT_YAW;
        tilt.pitchT = -clamp((pointer.y / rect.height) * 2 - 1, -1, 1) * TILT_PITCH;
      }
    };
    const onLeave = () => {
      pointer.active = false;
      tilt.yawT = 0;
      tilt.pitchT = 0;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') onLeave(); // finger lifted
    };
    if (!reduced) {
      canvas.addEventListener('pointermove', onMove, { passive: true });
      canvas.addEventListener('pointerdown', onMove, { passive: true });
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointercancel', onLeave); // touch scroll took over
      canvas.addEventListener('pointerup', onUp);
    }

    /* ---- Visibility: only animate while the footer is on screen ---- */
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible) start();
        else stop();
      },
      { rootMargin: '120px 0px' },
    );
    io.observe(wrap);

    /* ---- Resize (debounced re-sample) + font readiness ---- */
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 150);
    });
    ro.observe(wrap);

    build();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      fonts
        .load(`800 100px ${fontFamily()}`)
        .then(() => build())
        .catch(() => undefined);
    }

    return () => {
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [text]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block h-full w-full"
        style={{ touchAction: 'pan-y' }}
      />
    </div>
  );
}

export default FooterWordmarkCanvas;
