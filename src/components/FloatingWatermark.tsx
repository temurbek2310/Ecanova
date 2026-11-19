'use client';

import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import {
  buildFloatingWatermarkParticles,
  computeResponsiveParticleCount,
  detectPrefersReducedMotion,
  isCourseArtifactGlyph,
  resolveFloatingWatermarkTheme,
  shouldEnableWatermarkMotion,
  type FloatingWatermarkLayout,
  type FloatingWatermarkTheme,
  type WatermarkGlyphKind,
  type WatermarkParallaxMode,
} from '../lib/floating-watermark';
import { SubjectArtifactSvg } from './SubjectArtifactSvg';

export interface FloatingWatermarkProps {
  /** Context theme controlling SVG motif set and autonomous zero-gravity motion */
  theme: FloatingWatermarkTheme;
  /** Optional parent container ref for ResizeObserver sizing */
  scopeRef?: React.RefObject<HTMLElement | null>;
  /** Optional index seed to vary particle coordinates across sibling cards */
  seedIndex?: number;
  /** Number of subtle watermark particles (clamped between 2 and 5) */
  count?: number;
  /** Optional spatial layout profile ('hero-right' concentrates particles in the hero right-side negative space) */
  layout?: FloatingWatermarkLayout;
  /** @deprecated Cursor parallax is permanently disabled; watermarks are 100% autonomous */
  interactiveParallax?: boolean;
  /** @deprecated Cursor parallax is permanently disabled; watermarks are 100% autonomous */
  parallaxMode?: WatermarkParallaxMode;
  /** Optional test identifier for automated inspection */
  testId?: string;
  /** Optional extra classes on the absolute backdrop container */
  className?: string;
}

const WatermarkGlyphSvg = forwardRef<
  SVGSVGElement,
  {
    glyph: WatermarkGlyphKind;
    accentColor: string;
    svgClassName?: string;
  }
>(function WatermarkGlyphSvg({ glyph, accentColor, svgClassName = '' }, ref) {
  const baseSvgClass = `h-full w-full overflow-visible will-change-transform ${svgClassName}`.trim();

  if (isCourseArtifactGlyph(glyph)) {
    return (
      <SubjectArtifactSvg
        ref={ref}
        kind={glyph}
        accentColor={accentColor}
        variant="watermark"
        className={`h-full w-full will-change-transform ${svgClassName}`.trim()}
      />
    );
  }

  switch (glyph) {
    /* -------------------- SIDEBAR THEME -------------------- */
    case 'compass':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="44"
            fill={accentColor}
            fillOpacity={0.12}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx="60"
            cy="60"
            r="32"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="6 5"
          />
          <polygon
            points="60,14 71,49 106,60 71,71 60,106 49,71 14,60 49,49"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <polygon
            points="60,26 67,56 60,60 53,56"
            fill={accentColor}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="60" cy="60" r="5" fill={accentColor} />
        </svg>
      );

    case 'cursor-pointer':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <rect
            x="16"
            y="16"
            width="88"
            height="88"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="6 6"
          />
          <polygon
            points="28,22 96,52 64,62 54,96"
            fill={accentColor}
            fillOpacity={0.22}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <line
            x1="64"
            y1="62"
            x2="90"
            y2="88"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="square"
          />
          <rect x="86" y="84" width="10" height="10" fill={accentColor} />
        </svg>
      );

    case 'command-key':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <rect
            x="10"
            y="10"
            width="100"
            height="100"
            rx="8"
            fill={accentColor}
            fillOpacity={0.1}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x="44"
            y="44"
            width="32"
            height="32"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M44 44 L44 32 A12 12 0 1 0 32 44 Z"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <path
            d="M76 44 L88 44 A12 12 0 1 0 76 32 Z"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <path
            d="M76 76 L76 88 A12 12 0 1 0 88 76 Z"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <path
            d="M44 76 L32 76 A12 12 0 1 0 44 88 Z"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
        </svg>
      );

    case 'nav-nodes':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <path
            d="M28 32 H62 V88 H90 M62 60 H90"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="square"
          />
          <rect
            x="16"
            y="20"
            width="24"
            height="24"
            fill={accentColor}
            fillOpacity={0.22}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x="80"
            y="48"
            width="24"
            height="24"
            fill={accentColor}
            fillOpacity={0.18}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points="92,76 104,88 92,100 80,88"
            fill={accentColor}
            fillOpacity={0.24}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="62" cy="60" r="6" fill={accentColor} />
        </svg>
      );

    /* -------------------- GAMIFICATION THEME -------------------- */
    case 'wireframe-star':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <polygon
            points="60,8 73,41 108,41 80,63 90,98 60,77 30,98 40,63 12,41 47,41"
            fill={accentColor}
            fillOpacity={0.16}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <polygon
            points="60,26 67,46 88,46 71,59 77,80 60,67 43,80 49,59 32,46 53,46"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <line x1="60" y1="8" x2="60" y2="77" stroke={accentColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
          <circle cx="60" cy="56" r="5" fill={accentColor} />
        </svg>
      );

    case 'lightning-bolt':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <rect
            x="16"
            y="14"
            width="88"
            height="92"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="6 5"
          />
          <polygon
            points="68,12 28,64 56,64 46,108 92,50 62,50"
            fill={accentColor}
            fillOpacity={0.22}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <polyline
            points="63,24 44,56 62,56"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      );

    case 'isometric-cube':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <polygon
            points="60,12 104,36 104,84 60,108 16,84 16,36"
            fill={accentColor}
            fillOpacity={0.16}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <path
            d="M16 36 L60 60 L104 36 M60 60 V108"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <path
            d="M60 12 V60 M16 84 L60 60 L104 84"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="4 4"
          />
          <rect x="55" y="55" width="10" height="10" fill={accentColor} />
        </svg>
      );

    case 'milestone-crest':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <polygon
            points="22,16 98,16 98,66 60,106 22,66"
            fill={accentColor}
            fillOpacity={0.18}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
          <polyline
            points="38,52 60,34 82,52"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <polyline
            points="38,70 60,52 82,70"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      );

    /* -------------------- ANALYTICS THEME -------------------- */
    case 'trendline-spark':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <path
            d="M18 22 V96 H102"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="square"
          />
          <line
            x1="18"
            y1="62"
            x2="102"
            y2="62"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="5 5"
          />
          <polyline
            points="22,84 44,68 60,76 80,44 98,28"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
          <rect x="39" y="63" width="10" height="10" fill={accentColor} fillOpacity={0.3} stroke={accentColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <rect x="75" y="39" width="10" height="10" fill={accentColor} fillOpacity={0.3} stroke={accentColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <rect x="92" y="22" width="11" height="11" fill={accentColor} stroke={accentColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
      );

    case 'radar-grid':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <polygon
            points="60,12 106,45 88,100 32,100 14,45"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points="60,28 89,50 78,86 42,86 31,50"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="4 4"
          />
          <polygon
            points="60,22 92,48 76,82 38,76 34,44"
            fill={accentColor}
            fillOpacity={0.22}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M60 12 V60 M106 45 L60 60 M88 100 L60 60 M32 100 L60 60 M14 45 L60 60"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="60" cy="60" r="4" fill={accentColor} />
        </svg>
      );

    case 'target-crosshair':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="42"
            fill={accentColor}
            fillOpacity={0.14}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="16 8"
          />
          <circle
            cx="60"
            cy="60"
            r="24"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M60 8 V28 M60 92 V112 M8 60 H28 M92 60 H112"
            fill="none"
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="square"
          />
          <rect x="55" y="55" width="10" height="10" fill={accentColor} />
        </svg>
      );

    case 'bar-metrics':
      return (
        <svg ref={ref} viewBox="0 0 120 120" className={baseSvgClass} aria-hidden="true">
          <rect
            x="14"
            y="14"
            width="92"
            height="92"
            rx="4"
            fill={accentColor}
            fillOpacity={0.12}
            stroke={accentColor}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <rect x="26" y="66" width="16" height="28" fill={accentColor} fillOpacity={0.28} stroke={accentColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <rect x="52" y="48" width="16" height="46" fill={accentColor} fillOpacity={0.28} stroke={accentColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <rect x="78" y="30" width="16" height="64" fill={accentColor} fillOpacity={0.36} stroke={accentColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
      );
  }
});

/**
 * Universal context-aware FloatingWatermark Client Component.
 * - Renders 2..5 subtle inline SVG artifacts strictly relevant to the active container theme.
 * - 100% immune to cursor/mouse movement (no mousemove/pointermove/mouseenter/mouseleave/quickTo).
 * - Runs decoupled, unsynchronized zero-gravity GSAP choreography unconditionally across ALL
 *   screen sizes (including 320px–480px mobile), respecting only `prefers-reduced-motion: reduce`.
 */
export const FloatingWatermark: React.FC<FloatingWatermarkProps> = ({
  theme,
  scopeRef,
  seedIndex = 0,
  count,
  layout = 'standard',
  testId,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const [motionActive, setMotionActive] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    detectPrefersReducedMotion()
  );

  const canonicalTheme = useMemo(
    () => resolveFloatingWatermarkTheme(theme),
    [theme]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(mq.matches);
    syncPreference();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', syncPreference);
      return () => mq.removeEventListener('change', syncPreference);
    }
    mq.addListener(syncPreference);
    return () => mq.removeListener(syncPreference);
  }, []);

  useEffect(() => {
    const observedTarget =
      scopeRef?.current ?? containerRef.current?.parentElement ?? containerRef.current;
    if (!observedTarget) return;

    let lastRecordedWidth = 0;
    let lastParticleCount = -1;

    const applyMeasuredWidth = (rawWidth: number) => {
      if (!Number.isFinite(rawWidth) || rawWidth <= 0) return;
      const roundedWidth = Math.round(rawWidth);
      const nextCount = computeResponsiveParticleCount({
        containerWidth: roundedWidth,
        theme: canonicalTheme,
        explicitCount: count,
      });
      if (
        lastParticleCount !== nextCount ||
        Math.abs(roundedWidth - lastRecordedWidth) >= 16
      ) {
        lastRecordedWidth = roundedWidth;
        lastParticleCount = nextCount;
        setContainerWidth(roundedWidth);
      }
    };

    applyMeasuredWidth(observedTarget.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const measured =
          entry.contentRect?.width > 0
            ? entry.contentRect.width
            : observedTarget.getBoundingClientRect().width;
        applyMeasuredWidth(measured);
      }
    });
    resizeObserver.observe(observedTarget);

    return () => {
      resizeObserver.disconnect();
    };
  }, [scopeRef, canonicalTheme, count]);

  const particles = useMemo(
    () =>
      buildFloatingWatermarkParticles({
        theme: canonicalTheme,
        seedIndex,
        count,
        containerWidth: containerWidth ?? undefined,
        layout,
      }),
    [canonicalTheme, seedIndex, count, containerWidth, layout]
  );

  // Trim unused ref slots when particle count shrinks
  svgRefs.current.length = particles.length;

  useEconovaGSAP(
    containerRef,
    () => {
      const containerEl = containerRef.current;
      if (!containerEl || particles.length === 0) {
        setMotionActive(false);
        return;
      }

      const activeSvgs = svgRefs.current
        .slice(0, particles.length)
        .filter((el): el is SVGSVGElement => el !== null);

      if (activeSvgs.length === 0) {
        setMotionActive(false);
        return;
      }

      const viewportWidth =
        typeof window !== 'undefined' ? window.innerWidth : 375;
      const reducedMotion =
        prefersReducedMotion || detectPrefersReducedMotion();

      if (
        !shouldEnableWatermarkMotion({
          viewportWidth,
          prefersReducedMotion: reducedMotion,
        })
      ) {
        setMotionActive(false);
        activeSvgs.forEach((svgEl, idx) => {
          const spec = particles[idx];
          gsap.set(svgEl, {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: spec?.opacityClass === 'opacity-25' ? 0.24 : 0.2,
          });
        });
        return;
      }

      setMotionActive(true);

      // Autonomous zero-gravity ambient choreography across all viewports (no cursor tracking)
      const tweens: gsap.core.Tween[] = [];

      svgRefs.current.slice(0, particles.length).forEach((el) => {
        if (!el) return;

        const startX = gsap.utils.random(-14, 14);
        const startY = gsap.utils.random(-12, 12);
        const startRotation = gsap.utils.random(-9, 9);
        const startScale = gsap.utils.random(0.95, 1.04);
        const startOpacity = gsap.utils.random(0.16, 0.24);

        gsap.set(el, {
          x: startX,
          y: startY,
          rotation: startRotation,
          scale: startScale,
          opacity: startOpacity,
          force3D: true,
          transformOrigin: '50% 50%',
        });

        // 1. Independent X Drift
        tweens.push(
          gsap.to(el, {
            x: gsap.utils.random(-28, 28),
            duration: gsap.utils.random(3.5, 6),
            delay: -gsap.utils.random(0, 5),
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            force3D: true,
          })
        );

        // 2. Independent Y Drift (asymmetric duration for organic orbital curves)
        tweens.push(
          gsap.to(el, {
            y: gsap.utils.random(-24, 24),
            duration: gsap.utils.random(4.2, 7.5),
            delay: -gsap.utils.random(0, 5),
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            force3D: true,
          })
        );

        // 3. Slow Orbital Tilt
        tweens.push(
          gsap.to(el, {
            rotation: gsap.utils.random(-18, 18),
            duration: gsap.utils.random(5, 8.5),
            delay: -gsap.utils.random(0, 5),
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            force3D: true,
          })
        );

        // 4. Subtle Crystalline Breathing
        tweens.push(
          gsap.to(el, {
            scale: gsap.utils.random(0.92, 1.08),
            opacity: gsap.utils.random(0.14, 0.28),
            duration: gsap.utils.random(3, 5.5),
            delay: -gsap.utils.random(0, 5),
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            force3D: true,
          })
        );
      });

      return () => {
        tweens.forEach((tw) => tw.kill());
        setMotionActive(false);
      };
    },
    {
      dependencies: [
        canonicalTheme,
        seedIndex,
        particles.length,
        layout,
        prefersReducedMotion,
      ],
      revertOnUpdate: true,
    }
  );

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid={testId}
      data-floating-watermark="true"
      data-fw-theme={canonicalTheme}
      data-fw-count={particles.length}
      data-fw-container-width={containerWidth ?? undefined}
      data-fw-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      data-fw-motion={
        prefersReducedMotion
          ? 'disabled'
          : motionActive
          ? 'active'
          : 'minimal'
      }
      data-fw-parallax-mode="autonomous"
      data-fw-scoped={scopeRef ? 'parent' : 'self'}
      className={`absolute inset-0 z-0 overflow-hidden pointer-events-none select-none ${className}`.trim()}
    >
      {particles.map((p, idx) => (
        <div
          key={p.id}
          style={{
            left: `${p.leftPercent}%`,
            top: `${p.topPercent}%`,
            transform: `translate(-50%, -50%) scale(${p.baseScale})`,
          }}
          data-fw-particle={p.id}
          data-fw-glyph={p.glyph}
          className="pointer-events-none absolute h-12 w-12 sm:h-14 sm:w-14"
        >
          <WatermarkGlyphSvg
            ref={(el) => {
              svgRefs.current[idx] = el;
            }}
            glyph={p.glyph}
            accentColor={p.accentColor}
          />
        </div>
      ))}
    </div>
  );
};
