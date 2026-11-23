'use client';

import React, { useEffect, useRef } from 'react';
import type { ThemeMode } from '../../lib/theme';

export interface InteractiveDotGridProps {
  className?: string;
  testId?: string;
  spacing?: number;
  baseRadius?: number;
  cursorRadius?: number;
  intensity?: number;
  accentColor?: string;
  glow?: boolean;
  scale?: boolean;
  wave?: boolean;
  repel?: boolean;
  parallax?: boolean;
}

interface DotPoint {
  ox: number;
  oy: number;
  currentRadius: number;
  currentAlpha: number;
  accentBlend: number;
}

interface ClickRipple {
  id: number;
  clientX: number;
  clientY: number;
  startTime: number;
  maxRadius: number;
  speed: number;
}

interface CanvasEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  rect: DOMRect;
  dots: DotPoint[];
  isVisible: boolean;
  options: {
    spacing: number;
    baseRadius: number;
    cursorRadius: number;
    intensity: number;
    accentColor: string;
    glow: boolean;
    scale: boolean;
    wave: boolean;
    repel: boolean;
    parallax: boolean;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  if (clean.length === 3) {
    const r = (num >> 8) & 0xf;
    const g = (num >> 4) & 0xf;
    const b = num & 0xf;
    return [(r << 4) | r, (g << 4) | g, (b << 4) | b];
  }
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function detectIsDarkTheme(): boolean {
  if (typeof document === 'undefined') return true;
  const root = document.documentElement;
  const dataTheme = root.getAttribute('data-theme');
  if (dataTheme === 'light' || root.classList.contains('light')) {
    return false;
  }
  if (dataTheme === 'dark' || root.classList.contains('dark')) {
    return true;
  }
  return true;
}

export function resolveDotGridColors(isDark: boolean, optionsAccentColor = '#F59E0B') {
  if (isDark) {
    return {
      baseRgb: [148, 163, 184] as [number, number, number],
      baseAlpha: 0.16,
      staticColor: 'rgba(148, 163, 184, 0.16)',
      accentRgb: hexToRgb(optionsAccentColor),
      maxHoverAlpha: 0.92,
      rippleBlendFactor: 0.25,
    };
  }

  // Light Mode: Subtle Slate-600 (#475569) resting dots + Rich Amber (#C2610C) glow on hover
  const lightAccentHex =
    optionsAccentColor === '#F59E0B' || optionsAccentColor === '#FFC96B'
      ? '#C2610C'
      : optionsAccentColor;

  return {
    baseRgb: [71, 85, 105] as [number, number, number], // Slate-600 (#475569)
    baseAlpha: 0.18, // ~0.16–0.20 (resting dots unchanged)
    staticColor: 'rgba(71, 85, 105, 0.18)',
    accentRgb: hexToRgb(lightAccentHex), // Rich Amber #C2610C [194, 97, 12]
    maxHoverAlpha: 0.76, // ~0.74–0.80 (modestly boosted peak active dot opacity)
    rippleBlendFactor: 0.22, // Softened ripple blending in Light mode
  };
}

class DotGridSingletonEngine {
  private entries = new Map<HTMLCanvasElement, CanvasEntry>();
  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private animId: number | null = null;
  private activeTheme: ThemeMode = 'dark';
  private reducedMotion = false;
  private mediaQueryList: MediaQueryList | null = null;

  private globalPointer = {
    clientX: -9999,
    clientY: -9999,
    active: false,
    lastMoveTime: 0,
  };

  private ripples: ClickRipple[] = [];
  private nextRippleId = 1;
  private scrollDirty = true;
  private isPointerInsideWindow = false;

  public init() {
    if (typeof window === 'undefined') return;

    this.activeTheme = detectIsDarkTheme() ? 'dark' : 'light';

    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const root = document.documentElement;
      const themeObserver = new MutationObserver(() => {
        const isDark = detectIsDarkTheme();
        const nextTheme: ThemeMode = isDark ? 'dark' : 'light';
        if (this.activeTheme !== nextTheme) {
          this.activeTheme = nextTheme;
          const { baseAlpha } = resolveDotGridColors(isDark);
          for (const entry of this.entries.values()) {
            for (const dot of entry.dots) {
              dot.currentAlpha = baseAlpha;
            }
          }
          if (this.reducedMotion) {
            this.renderAllStatic();
          }
        }
      });
      themeObserver.observe(root, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
      this.themeObserver = themeObserver;
    }

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mediaQueryList = mql;
    this.reducedMotion = mql.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      this.reducedMotion = e.matches;
      if (this.reducedMotion) {
        this.stopLoop();
        this.renderAllStatic();
      } else {
        this.ensureLoop();
      }
    };
    mql.addEventListener('change', handleMotionChange);

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        (changes) => {
          for (const change of changes) {
            const entry = this.entries.get(change.target as HTMLCanvasElement);
            if (entry) {
              entry.isVisible = change.isIntersecting;
              if (change.isIntersecting) {
                entry.rect = change.boundingClientRect;
                if (this.reducedMotion) {
                  this.renderEntryStatic(entry);
                }
              }
            }
          }
          if (!this.reducedMotion) {
            this.evaluateLoopState();
          }
        },
        { threshold: 0.01 }
      );
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const rEntry of entries) {
          const entry = this.entries.get(rEntry.target as HTMLCanvasElement);
          if (entry) {
            this.updateCanvasBounds(entry);
            if (this.reducedMotion) {
              this.renderEntryStatic(entry);
            }
          }
        }
      });
    }

    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onWindowResize, { passive: true });
  }

  private onPointerMove = (e: PointerEvent) => {
    this.globalPointer.clientX = e.clientX;
    this.globalPointer.clientY = e.clientY;
    this.globalPointer.active = true;
    this.globalPointer.lastMoveTime = performance.now();
    this.isPointerInsideWindow = true;
  };

  private onPointerLeave = () => {
    this.isPointerInsideWindow = false;
    this.globalPointer.active = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.globalPointer.clientX = e.clientX;
    this.globalPointer.clientY = e.clientY;
    this.globalPointer.active = true;

    this.ripples.push({
      id: this.nextRippleId++,
      clientX: e.clientX,
      clientY: e.clientY,
      startTime: performance.now(),
      maxRadius: 360,
      speed: 260,
    });

    if (this.ripples.length > 6) {
      this.ripples.shift();
    }
  };

  private onScroll = () => {
    this.scrollDirty = true;
  };

  private onWindowResize = () => {
    this.scrollDirty = true;
    for (const entry of this.entries.values()) {
      this.updateCanvasBounds(entry);
      if (this.reducedMotion) {
        this.renderEntryStatic(entry);
      }
    }
  };

  public register(
    canvas: HTMLCanvasElement,
    options: CanvasEntry['options']
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.entries.size === 0) {
      this.init();
    }

    const rect = canvas.getBoundingClientRect();
    const entry: CanvasEntry = {
      canvas,
      ctx,
      width: rect.width || 300,
      height: rect.height || 200,
      dpr: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
      rect,
      dots: [],
      isVisible: true,
      options,
    };

    this.entries.set(canvas, entry);
    this.updateCanvasBounds(entry);

    if (this.intersectionObserver) {
      this.intersectionObserver.observe(canvas);
    }
    if (this.resizeObserver) {
      this.resizeObserver.observe(canvas);
    }

    if (this.reducedMotion) {
      this.renderEntryStatic(entry);
    } else {
      this.ensureLoop();
    }
  }

  public unregister(canvas: HTMLCanvasElement): void {
    if (!this.entries.has(canvas)) return;

    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(canvas);
    }
    if (this.resizeObserver) {
      this.resizeObserver.unobserve(canvas);
    }

    this.entries.delete(canvas);

    if (this.entries.size === 0) {
      this.destroy();
    } else if (!this.reducedMotion) {
      this.evaluateLoopState();
    }
  }

  private updateCanvasBounds(entry: CanvasEntry): void {
    const rect = entry.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);

    entry.width = width;
    entry.height = height;
    entry.dpr = dpr;
    entry.rect = rect;

    entry.canvas.width = Math.floor(width * dpr);
    entry.canvas.height = Math.floor(height * dpr);
    entry.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const spacing = entry.options.spacing;
    const baseRadius = entry.options.baseRadius;
    const margin = spacing * 1.5;
    const startX = -margin;
    const startY = -margin;
    const endX = width + margin;
    const endY = height + margin;

    const isDark = this.activeTheme === 'dark';
    const { baseAlpha } = resolveDotGridColors(isDark);

    const nextDots: DotPoint[] = [];
    let row = 0;
    for (let y = startY; y < endY; y += spacing) {
      // Hexagonal / staggered chalk-dust offset
      const xOffset = (row % 2) * (spacing * 0.5);
      for (let x = startX + xOffset; x < endX; x += spacing) {
        nextDots.push({
          ox: x,
          oy: y,
          currentRadius: baseRadius,
          currentAlpha: baseAlpha,
          accentBlend: 0,
        });
      }
      row++;
    }

    entry.dots = nextDots;
  }

  private renderEntryStatic(entry: CanvasEntry): void {
    const { ctx, width, height, options, dots } = entry;
    ctx.clearRect(0, 0, width, height);

    const isDark = this.activeTheme === 'dark';
    const { staticColor } = resolveDotGridColors(isDark);

    ctx.fillStyle = staticColor;
    ctx.beginPath();
    const r = options.baseRadius;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (d.ox >= -5 && d.ox <= width + 5 && d.oy >= -5 && d.oy <= height + 5) {
        ctx.moveTo(d.ox + r, d.oy);
        ctx.arc(d.ox, d.oy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  private renderAllStatic(): void {
    for (const entry of this.entries.values()) {
      if (entry.isVisible) {
        this.renderEntryStatic(entry);
      }
    }
  }

  private evaluateLoopState(): void {
    let hasVisible = false;
    for (const entry of this.entries.values()) {
      if (entry.isVisible) {
        hasVisible = true;
        break;
      }
    }
    if (hasVisible) {
      this.ensureLoop();
    } else {
      this.stopLoop();
    }
  }

  private ensureLoop(): void {
    if (this.animId === null && !this.reducedMotion && this.entries.size > 0) {
      this.animId = requestAnimationFrame(this.renderTick);
    }
  }

  private stopLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private renderTick = (now: number): void => {
    this.animId = null;

    if (this.reducedMotion || this.entries.size === 0) {
      return;
    }

    // Refresh rects once per tick if scrolled
    if (this.scrollDirty) {
      for (const entry of this.entries.values()) {
        if (entry.isVisible) {
          entry.rect = entry.canvas.getBoundingClientRect();
        }
      }
      this.scrollDirty = false;
    }

    // Filter active click ripples
    const activeRipples = this.ripples.filter((r) => {
      const elapsed = (now - r.startTime) / 1000;
      return elapsed * r.speed < r.maxRadius;
    });
    this.ripples = activeRipples;

    const isDark = this.activeTheme === 'dark';
    const pointer = this.globalPointer;
    const isGlobalPointerActive =
      pointer.active &&
      this.isPointerInsideWindow &&
      now - pointer.lastMoveTime < 4500;

    let anyVisible = false;

    for (const entry of this.entries.values()) {
      if (!entry.isVisible) continue;
      anyVisible = true;

      const { ctx, width, height, options, dots } = entry;
      const rect = entry.rect;
      ctx.clearRect(0, 0, width, height);

      const forceMultiplier = options.intensity / 100;
      const { baseRgb, baseAlpha, accentRgb, maxHoverAlpha, rippleBlendFactor } =
        resolveDotGridColors(isDark, options.accentColor);

      // Check if global pointer overlaps or is adjacent to this card
      const pad = options.cursorRadius;
      const isNearCard =
        isGlobalPointerActive &&
        pointer.clientX >= rect.left - pad &&
        pointer.clientX <= rect.right + pad &&
        pointer.clientY >= rect.top - pad &&
        pointer.clientY <= rect.bottom + pad;

      const localPointerX = pointer.clientX - rect.left;
      const localPointerY = pointer.clientY - rect.top;

      // Filter ripples relevant to this card
      const cardRipples = activeRipples.filter((r) => {
        const cx = r.clientX - rect.left;
        const cy = r.clientY - rect.top;
        const maxDist = Math.max(
          Math.hypot(cx, cy),
          Math.hypot(cx - width, cy),
          Math.hypot(cx, cy - height),
          Math.hypot(cx - width, cy - height)
        );
        const elapsed = (now - r.startTime) / 1000;
        return elapsed * r.speed <= maxDist + 60;
      });

      const dotCount = dots.length;
      const waveEnabled = options.wave;
      const glowEnabled = options.glow;
      const scaleEnabled = options.scale;
      const cursorRadius = options.cursorRadius;
      const baseRadius = options.baseRadius;

      for (let i = 0; i < dotCount; i++) {
        const dot = dots[i];

        // 1. Continuous sine wave
        let waveOffsetY = 0;
        let waveAlphaShift = 0;
        if (waveEnabled) {
          const wavePhase = (dot.ox * 0.024 + dot.oy * 0.016) - (now * 0.002);
          const waveAmp = Math.sin(wavePhase);
          waveOffsetY = waveAmp * 3.5 * forceMultiplier;
          waveAlphaShift = waveAmp * 0.08 * forceMultiplier;
        }

        // 2. Click ripple wave
        let rippleAccentFactor = 0;
        for (let rIdx = 0; rIdx < cardRipples.length; rIdx++) {
          const rip = cardRipples[rIdx];
          const elapsed = (now - rip.startTime) / 1000;
          const currentRadius = elapsed * rip.speed;
          const localRipX = rip.clientX - rect.left;
          const localRipY = rip.clientY - rect.top;
          const dx = dot.ox - localRipX;
          const dy = dot.oy - localRipY;
          const dist = Math.hypot(dx, dy);
          const distDiff = dist - currentRadius;
          if (Math.abs(distDiff) < 42) {
            const rippleAmp =
              (1 - currentRadius / rip.maxRadius) *
              Math.cos((distDiff / 42) * (Math.PI / 2));
            const rippleAlphaScale = isDark ? 1.0 : 0.65;
            waveOffsetY += rippleAmp * 4.0 * forceMultiplier;
            waveAlphaShift += rippleAmp * 0.22 * forceMultiplier * rippleAlphaScale;
            rippleAccentFactor = Math.max(
              rippleAccentFactor,
              rippleAmp * rippleBlendFactor * forceMultiplier
            );
          }
        }

        // 3. Hover target calculations
        let targetAlpha = Math.max(0.04, Math.min(1, baseAlpha + waveAlphaShift));
        let targetRadius = baseRadius;
        let targetBlend = rippleAccentFactor;

        if (isNearCard) {
          const dx = dot.ox - localPointerX;
          const dy = dot.oy - localPointerY;
          const dist = Math.hypot(dx, dy);

          if (dist < cursorRadius) {
            const falloff = Math.pow(1 - dist / cursorRadius, 1.8);
            if (glowEnabled) {
              const blendScale = isDark ? 1.0 : 0.90;
              targetAlpha = Math.min(
                maxHoverAlpha,
                targetAlpha + (maxHoverAlpha - baseAlpha) * falloff * forceMultiplier
              );
              targetBlend = Math.max(targetBlend, falloff * forceMultiplier * blendScale);
            }
            if (scaleEnabled) {
              targetRadius = baseRadius * (1 + 1.6 * falloff * forceMultiplier);
            }
          }
        }

        // 4. Smooth lerp toward target values
        dot.currentRadius += (targetRadius - dot.currentRadius) * 0.18;
        dot.currentAlpha += (targetAlpha - dot.currentAlpha) * 0.18;
        dot.accentBlend += (targetBlend - dot.accentBlend) * 0.18;

        const drawY = dot.oy + waveOffsetY;

        // 5. Render Dot if within canvas bounds
        if (
          dot.ox >= -10 &&
          dot.ox <= width + 10 &&
          drawY >= -10 &&
          drawY <= height + 10
        ) {
          const b = dot.accentBlend;
          let r = baseRgb[0];
          let g = baseRgb[1];
          let bl = baseRgb[2];

          if (b > 0.005) {
            r = Math.round(baseRgb[0] * (1 - b) + accentRgb[0] * b);
            g = Math.round(baseRgb[1] * (1 - b) + accentRgb[1] * b);
            bl = Math.round(baseRgb[2] * (1 - b) + accentRgb[2] * b);
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, ${dot.currentAlpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(dot.ox, drawY, Math.max(0.4, dot.currentRadius), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (anyVisible) {
      this.animId = requestAnimationFrame(this.renderTick);
    }
  };

  public destroy(): void {
    this.stopLoop();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerdown', this.onPointerDown);
      window.removeEventListener('pointerleave', this.onPointerLeave);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onWindowResize);
    }
  }
}

// Global Singleton Engine instance
const sharedDotGridEngine = new DotGridSingletonEngine();

export const InteractiveDotGrid: React.FC<InteractiveDotGridProps> = ({
  className = '',
  testId,
  spacing = 20,
  baseRadius = 1.4,
  cursorRadius = 115,
  intensity = 70,
  accentColor = '#F59E0B',
  glow = true,
  scale = true,
  wave = true,
  repel = false,
  parallax = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    sharedDotGridEngine.register(canvas, {
      spacing,
      baseRadius,
      cursorRadius,
      intensity,
      accentColor,
      glow,
      scale,
      wave,
      repel,
      parallax,
    });

    return () => {
      sharedDotGridEngine.unregister(canvas);
    };
  }, [
    spacing,
    baseRadius,
    cursorRadius,
    intensity,
    accentColor,
    glow,
    scale,
    wave,
    repel,
    parallax,
  ]);

  return (
    <canvas
      ref={canvasRef}
      data-testid={testId}
      data-dot-grid="true"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full print:hidden ${className}`.trim()}
    />
  );
};
