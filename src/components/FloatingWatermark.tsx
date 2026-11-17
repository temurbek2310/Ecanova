'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { computeParticleMagneticGravity } from '../lib/artifact-physics';
import {
  buildFloatingWatermarkParticles,
  computeResponsiveParticleCount,
  detectPrefersReducedMotion,
  FLOATING_WATERMARK_DICTIONARY,
  isCourseArtifactGlyph,
  resolveFloatingWatermarkTheme,
  resolveWatermarkParallaxConfig,
  resolveWatermarkScrollTriggerConfig,
  shouldApplyRafParallaxFrame,
  shouldEnableWatermarkMotion,
  type FloatingWatermarkTheme,
  type ParallaxPointerPoint,
  type WatermarkGlyphKind,
  type WatermarkParallaxMode,
} from '../lib/floating-watermark';
import { SubjectArtifactSvg } from './SubjectArtifactSvg';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface FloatingWatermarkProps {
  /** Context theme controlling SVG motif set and GSAP motion profile */
  theme: FloatingWatermarkTheme;
  /** Optional parent container ref so container & watermark share one single useGSAP scope */
  scopeRef?: React.RefObject<HTMLElement | null>;
  /** Optional index seed to vary particle coordinates across sibling cards */
  seedIndex?: number;
  /** Number of subtle watermark particles (clamped between 3 and 5) */
  count?: number;
  /** Enable cursor-reactive micro-parallax when hovering the parent box */
  interactiveParallax?: boolean;
  /** Throttling strategy for micro-parallax pointer updates ('raf' throttles to animation frames and suppresses work during scroll) */
  parallaxMode?: WatermarkParallaxMode;
  /** Optional test identifier for automated inspection */
  testId?: string;
  /** Optional extra classes on the absolute backdrop container */
  className?: string;
}

const WatermarkGlyphSvg: React.FC<{
  glyph: WatermarkGlyphKind;
  accentColor: string;
}> = ({ glyph, accentColor }) => {
  if (isCourseArtifactGlyph(glyph)) {
    return (
      <SubjectArtifactSvg
        kind={glyph}
        accentColor={accentColor}
        variant="watermark"
        className="h-full w-full"
      />
    );
  }

  switch (glyph) {
    /* -------------------- SIDEBAR THEME -------------------- */
    case 'compass':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="44"
            fill={accentColor}
            fillOpacity={0.1}
            stroke={accentColor}
            strokeWidth="4"
          />
          <circle
            cx="60"
            cy="60"
            r="32"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeDasharray="6 5"
          />
          <polygon
            points="60,14 71,49 106,60 71,71 60,106 49,71 14,60 49,49"
            fill={accentColor}
            fillOpacity={0.18}
            stroke={accentColor}
            strokeWidth="3.5"
            strokeLinejoin="miter"
          />
          <polygon
            points="60,26 67,56 60,60 53,56"
            fill={accentColor}
            stroke={accentColor}
            strokeWidth="2"
          />
          <circle cx="60" cy="60" r="5" fill={accentColor} />
        </svg>
      );

    case 'cursor-pointer':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <rect
            x="16"
            y="16"
            width="88"
            height="88"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeDasharray="6 6"
          />
          <polygon
            points="28,22 96,52 64,62 54,96"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <line
            x1="64"
            y1="62"
            x2="90"
            y2="88"
            stroke={accentColor}
            strokeWidth="5"
            strokeLinecap="square"
          />
          <rect x="86" y="84" width="10" height="10" fill={accentColor} />
        </svg>
      );

    case 'command-key':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <rect
            x="10"
            y="10"
            width="100"
            height="100"
            rx="8"
            fill={accentColor}
            fillOpacity={0.08}
            stroke={accentColor}
            strokeWidth="3"
          />
          <rect
            x="44"
            y="44"
            width="32"
            height="32"
            fill="none"
            stroke={accentColor}
            strokeWidth="5"
          />
          <path
            d="M44 44 L44 32 A12 12 0 1 0 32 44 Z"
            fill={accentColor}
            fillOpacity={0.18}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <path
            d="M76 44 L88 44 A12 12 0 1 0 76 32 Z"
            fill={accentColor}
            fillOpacity={0.18}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <path
            d="M76 76 L76 88 A12 12 0 1 0 88 76 Z"
            fill={accentColor}
            fillOpacity={0.18}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <path
            d="M44 76 L32 76 A12 12 0 1 0 44 88 Z"
            fill={accentColor}
            fillOpacity={0.18}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
        </svg>
      );

    case 'nav-nodes':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <path
            d="M28 32 H62 V88 H90 M62 60 H90"
            fill="none"
            stroke={accentColor}
            strokeWidth="4"
            strokeLinecap="square"
          />
          <rect
            x="16"
            y="20"
            width="24"
            height="24"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth="4"
          />
          <rect
            x="80"
            y="48"
            width="24"
            height="24"
            fill={accentColor}
            fillOpacity={0.16}
            stroke={accentColor}
            strokeWidth="4"
          />
          <polygon
            points="92,76 104,88 92,100 80,88"
            fill={accentColor}
            fillOpacity={0.22}
            stroke={accentColor}
            strokeWidth="3.5"
          />
          <circle cx="62" cy="60" r="6" fill={accentColor} />
        </svg>
      );

    /* -------------------- GAMIFICATION THEME -------------------- */
    case 'wireframe-star':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <polygon
            points="60,8 73,41 108,41 80,63 90,98 60,77 30,98 40,63 12,41 47,41"
            fill={accentColor}
            fillOpacity={0.14}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <polygon
            points="60,26 67,46 88,46 71,59 77,80 60,67 43,80 49,59 32,46 53,46"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeLinejoin="miter"
          />
          <line x1="60" y1="8" x2="60" y2="77" stroke={accentColor} strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="60" cy="56" r="5" fill={accentColor} />
        </svg>
      );

    case 'lightning-bolt':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <rect
            x="16"
            y="14"
            width="88"
            height="92"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeDasharray="6 5"
          />
          <polygon
            points="68,12 28,64 56,64 46,108 92,50 62,50"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <polyline
            points="63,24 44,56 62,56"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
          />
        </svg>
      );

    case 'isometric-cube':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <polygon
            points="60,12 104,36 104,84 60,108 16,84 16,36"
            fill={accentColor}
            fillOpacity={0.14}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <path
            d="M16 36 L60 60 L104 36 M60 60 V108"
            fill="none"
            stroke={accentColor}
            strokeWidth="4"
            strokeLinejoin="miter"
          />
          <path
            d="M60 12 V60 M16 84 L60 60 L104 84"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.2"
            strokeDasharray="4 4"
          />
          <rect x="55" y="55" width="10" height="10" fill={accentColor} />
        </svg>
      );

    case 'milestone-crest':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <polygon
            points="22,16 98,16 98,66 60,106 22,66"
            fill={accentColor}
            fillOpacity={0.15}
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <polyline
            points="38,52 60,34 82,52"
            fill="none"
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <polyline
            points="38,70 60,52 82,70"
            fill="none"
            stroke={accentColor}
            strokeWidth="3.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      );

    /* -------------------- ANALYTICS THEME -------------------- */
    case 'trendline-spark':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <path
            d="M18 22 V96 H102"
            fill="none"
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinecap="square"
          />
          <line
            x1="18"
            y1="62"
            x2="102"
            y2="62"
            stroke={accentColor}
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <polyline
            points="22,84 44,68 60,76 80,44 98,28"
            fill="none"
            stroke={accentColor}
            strokeWidth="5"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
          <rect x="39" y="63" width="10" height="10" fill={accentColor} fillOpacity={0.3} stroke={accentColor} strokeWidth="2.5" />
          <rect x="75" y="39" width="10" height="10" fill={accentColor} fillOpacity={0.3} stroke={accentColor} strokeWidth="2.5" />
          <rect x="92" y="22" width="11" height="11" fill={accentColor} stroke={accentColor} strokeWidth="2.5" />
        </svg>
      );

    case 'radar-grid':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <polygon
            points="60,12 106,45 88,100 32,100 14,45"
            fill="none"
            stroke={accentColor}
            strokeWidth="3.5"
          />
          <polygon
            points="60,28 89,50 78,86 42,86 31,50"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />
          <polygon
            points="60,22 92,48 76,82 38,76 34,44"
            fill={accentColor}
            fillOpacity={0.2}
            stroke={accentColor}
            strokeWidth="3.5"
          />
          <path
            d="M60 12 V60 M106 45 L60 60 M88 100 L60 60 M32 100 L60 60 M14 45 L60 60"
            fill="none"
            stroke={accentColor}
            strokeWidth="2"
          />
          <circle cx="60" cy="60" r="4" fill={accentColor} />
        </svg>
      );

    case 'target-crosshair':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="42"
            fill={accentColor}
            fillOpacity={0.1}
            stroke={accentColor}
            strokeWidth="4"
            strokeDasharray="16 8"
          />
          <circle
            cx="60"
            cy="60"
            r="24"
            fill="none"
            stroke={accentColor}
            strokeWidth="3.5"
          />
          <path
            d="M60 8 V28 M60 92 V112 M8 60 H28 M92 60 H112"
            fill="none"
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinecap="square"
          />
          <rect x="55" y="55" width="10" height="10" fill={accentColor} />
        </svg>
      );

    case 'bar-metrics':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <rect
            x="14"
            y="14"
            width="92"
            height="92"
            rx="4"
            fill={accentColor}
            fillOpacity={0.08}
            stroke={accentColor}
            strokeWidth="3.5"
          />
          <rect x="26" y="66" width="16" height="28" fill={accentColor} fillOpacity={0.25} stroke={accentColor} strokeWidth="3.5" />
          <rect x="52" y="48" width="16" height="46" fill={accentColor} fillOpacity={0.25} stroke={accentColor} strokeWidth="3.5" />
          <rect x="78" y="30" width="16" height="64" fill={accentColor} fillOpacity={0.35} stroke={accentColor} strokeWidth="3.5" />
        </svg>
      );
  }
};

/**
 * Universal context-aware FloatingWatermark Client Component.
 * - Renders 3..5 subtle (`opacity-10`..`opacity-15`) inline SVG particles strictly relevant to the active container theme.
 * - Uses GSAP `useGSAP` with scoped selector queries (`[data-fw-particle]`, `[data-fw-spin]`), staggered energetic 3–6s drift loops,
 *   continuous 360-degree micro-rotations, `gsap.matchMedia()` disabling/minimizing on mobile (`<= 768px`) & `prefers-reduced-motion`,
 *   and zero-boilerplate magnetic cursor parallax via parent container hover tracking.
 */
export const FloatingWatermark: React.FC<FloatingWatermarkProps> = ({
  theme,
  scopeRef,
  seedIndex = 0,
  count,
  interactiveParallax = true,
  parallaxMode,
  testId,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedScopeRef = scopeRef ?? containerRef;
  const [motionActive, setMotionActive] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    detectPrefersReducedMotion()
  );

  const canonicalTheme = useMemo(
    () => resolveFloatingWatermarkTheme(theme),
    [theme]
  );

  const parallaxConfig = useMemo(
    () =>
      resolveWatermarkParallaxConfig({
        theme: canonicalTheme,
        parallaxMode,
      }),
    [canonicalTheme, parallaxMode]
  );

  const themeConfig = FLOATING_WATERMARK_DICTIONARY[canonicalTheme];

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
      }),
    [canonicalTheme, seedIndex, count, containerWidth]
  );

  useGSAP(
    () => {
      const containerEl = containerRef.current;
      const scopeEl = resolvedScopeRef.current ?? containerEl;
      if (!containerEl || !scopeEl || particles.length === 0) {
        setMotionActive(false);
        return;
      }

      const driftEls = gsap.utils.toArray<HTMLElement>('[data-fw-particle]', containerEl);
      const spinEls = gsap.utils.toArray<HTMLElement>('[data-fw-spin]', containerEl);
      if (driftEls.length === 0) {
        setMotionActive(false);
        return;
      }

      // Hard short-circuit: disable all GSAP timelines, ScrollTriggers, and parallax listeners
      // immediately when OS "Reduce Motion" (`prefers-reduced-motion: reduce`) is active.
      if (prefersReducedMotion) {
        setMotionActive(false);
        driftEls.forEach((el, idx) => {
          const spec = particles[idx];
          gsap.set(el, { x: 0, y: 0, scale: spec?.baseScale ?? 1 });
        });
        spinEls.forEach((el) => gsap.set(el, { rotation: 0 }));
        return;
      }

      const mm = gsap.matchMedia();

      mm.add(
        {
          desktopAnimated: '(min-width: 769px) and (prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const hwConcurrency =
            typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
          const viewportWidth =
            typeof window !== 'undefined' ? window.innerWidth : 1280;
          const allowed = shouldEnableWatermarkMotion({
            viewportWidth: context.conditions?.desktopAnimated ? viewportWidth : 0,
            prefersReducedMotion: !context.conditions?.desktopAnimated,
            hardwareConcurrency: hwConcurrency,
          });

          if (!allowed) {
            setMotionActive(false);
            driftEls.forEach((el, idx) => {
              const spec = particles[idx];
              gsap.set(el, { x: 0, y: 0, scale: spec?.baseScale ?? 1 });
            });
            spinEls.forEach((el) => gsap.set(el, { rotation: 0 }));
            return;
          }

          setMotionActive(true);

          const isStickyContainer =
            typeof window !== 'undefined' &&
            window.getComputedStyle(scopeEl).position === 'sticky';
          const stConfig = resolveWatermarkScrollTriggerConfig({
            isSticky: isStickyContainer,
          });

          let cachedRect: DOMRect | null = null;
          let isHoveringParent = false;
          let resumeDelayedCall: gsap.core.Tween | null = null;

          // Single ScrollTrigger-backed master timeline with `invalidateOnRefresh: true`
          // so browser resizes cleanly recalculate function-based bounds and invalidate cached geometry
          // without forcing synchronous reflows or recreating GSAP contexts.
          const masterTimeline = gsap.timeline({
            scrollTrigger: {
              trigger: scopeEl,
              start: stConfig.start,
              end: stConfig.end,
              toggleActions: stConfig.toggleActions,
              invalidateOnRefresh: stConfig.invalidateOnRefresh,
              onRefresh: () => {
                cachedRect = null;
              },
            },
          });

          const driftTweens: gsap.core.Tween[] = [];

          driftEls.forEach((el, idx) => {
            const spec = particles[idx];
            if (!spec) return;

            gsap.set(el, { x: 0, y: 0, scale: spec.baseScale });

            const driftTween = gsap.to(el, {
              x: () => gsap.utils.random(spec.xRange[0], spec.xRange[1]),
              y: () => gsap.utils.random(spec.yRange[0], spec.yRange[1]),
              scale: () => Number((spec.baseScale * (idx % 2 === 0 ? 1.12 : 0.88)).toFixed(2)),
              duration: spec.durationSec,
              delay: spec.delaySec,
              repeat: -1,
              yoyo: true,
              repeatRefresh: true,
              ease: themeConfig.ease,
            });
            driftTweens.push(driftTween);
            masterTimeline.add(driftTween, 0);
          });

          spinEls.forEach((spinEl, idx) => {
            const spec = particles[idx];
            if (!spec) return;

            if (spec.continuousSpin360) {
              masterTimeline.add(
                gsap.to(spinEl, {
                  rotation: spec.spinDirection > 0 ? '+=360' : '-=360',
                  duration: spec.spinDurationSec,
                  repeat: -1,
                  ease: 'none',
                }),
                0
              );
            } else {
              masterTimeline.add(
                gsap.to(spinEl, {
                  rotation: () => (spec.spinDirection > 0 ? 14 : -14),
                  duration: Math.max(2.6, spec.durationSec * 0.9),
                  delay: spec.delaySec * 0.5,
                  repeat: -1,
                  yoyo: true,
                  repeatRefresh: true,
                  ease: themeConfig.ease,
                }),
                0
              );
            }
          });

          // Pre-allocate zero-churn GSAP quickTo controllers inside this single useGSAP scope
          const quickControllers = driftEls.map((el) => ({
            xTo: gsap.quickTo(el, 'x', { duration: 0.34, ease: 'power3.out' }),
            yTo: gsap.quickTo(el, 'y', { duration: 0.34, ease: 'power3.out' }),
            scaleXTo: gsap.quickTo(el, 'scaleX', { duration: 0.34, ease: 'power3.out' }),
            scaleYTo: gsap.quickTo(el, 'scaleY', { duration: 0.34, ease: 'power3.out' }),
          }));

          const hoverTarget = scopeRef?.current ?? containerEl.parentElement;

          let parallaxRafId = 0;
          let pendingPoint: ParallaxPointerPoint | null = null;
          let lastAppliedPoint: ParallaxPointerPoint | null = null;
          let lastScrollTimestamp = -Infinity;

          const getCachedParentRect = (): DOMRect | null => {
            if (!hoverTarget) return null;
            if (!cachedRect) {
              cachedRect = hoverTarget.getBoundingClientRect();
            }
            return cachedRect;
          };

          const applyHoverPull = (clientX: number, clientY: number) => {
            const rect = getCachedParentRect();
            if (!rect) return;

            resumeDelayedCall?.kill();
            resumeDelayedCall = null;
            masterTimeline.pause();

            particles.forEach((spec, idx) => {
              const ctrl = quickControllers[idx];
              if (!ctrl) return;
              const pull = computeParticleMagneticGravity({
                clientX,
                clientY,
                cardRect: rect,
                leftPercent: spec.leftPercent,
                topPercent: spec.topPercent,
                gravityWeight: spec.gravityWeight,
                maxPullPx: themeConfig.maxCursorPullPx,
              });

              const hoverScale = Number((spec.baseScale * 1.12).toFixed(2));
              ctrl.xTo(pull.x);
              ctrl.yTo(pull.y);
              ctrl.scaleXTo(hoverScale);
              ctrl.scaleYTo(hoverScale);
            });
          };

          const isScrollSuppressingParallax = (): boolean => {
            if (!parallaxConfig.pauseDuringScroll) return false;
            if (ScrollTrigger.isScrolling()) return true;
            return performance.now() - lastScrollTimestamp < parallaxConfig.scrollCooldownMs;
          };

          const runParallaxFrame = () => {
            parallaxRafId = 0;
            const scrolling = isScrollSuppressingParallax();
            if (
              !shouldApplyRafParallaxFrame({
                isHovering: isHoveringParent,
                isScrolling: scrolling,
                pendingPoint,
                lastAppliedPoint,
                minDeltaPx: parallaxConfig.minPointerDeltaPx,
              }) ||
              !pendingPoint
            ) {
              return;
            }

            lastAppliedPoint = { x: pendingPoint.x, y: pendingPoint.y };
            applyHoverPull(pendingPoint.x, pendingPoint.y);
          };

          const scheduleParallaxFrame = () => {
            if (parallaxRafId !== 0 || isScrollSuppressingParallax()) return;
            parallaxRafId = window.requestAnimationFrame(runParallaxFrame);
          };

          const onScrollPause = () => {
            lastScrollTimestamp = performance.now();
            if (parallaxRafId !== 0) {
              window.cancelAnimationFrame(parallaxRafId);
              parallaxRafId = 0;
            }
          };

          const onPointerEnter = (e: MouseEvent) => {
            isHoveringParent = true;
            // Read rect once on entry so hover movement causes zero synchronous layout reads
            cachedRect = hoverTarget ? hoverTarget.getBoundingClientRect() : null;
            pendingPoint = { x: e.clientX, y: e.clientY };
            if (parallaxConfig.mode === 'raf') {
              scheduleParallaxFrame();
            } else {
              applyHoverPull(e.clientX, e.clientY);
            }
          };

          const onPointerMove = (e: MouseEvent) => {
            if (!isHoveringParent) return;
            pendingPoint = { x: e.clientX, y: e.clientY };
            if (parallaxConfig.mode === 'raf') {
              scheduleParallaxFrame();
            } else {
              applyHoverPull(e.clientX, e.clientY);
            }
          };

          const onPointerLeave = () => {
            isHoveringParent = false;
            pendingPoint = null;
            lastAppliedPoint = null;
            if (parallaxRafId !== 0) {
              window.cancelAnimationFrame(parallaxRafId);
              parallaxRafId = 0;
            }
            cachedRect = null;
            resumeDelayedCall?.kill();

            particles.forEach((spec, idx) => {
              const ctrl = quickControllers[idx];
              if (!ctrl) return;
              ctrl.xTo(0);
              ctrl.yTo(0);
              ctrl.scaleXTo(spec.baseScale);
              ctrl.scaleYTo(spec.baseScale);
            });

            resumeDelayedCall = gsap.delayedCall(0.36, () => {
              if (!isHoveringParent) {
                driftTweens.forEach((tw) => tw.invalidate().restart(true));
                masterTimeline.resume();
              }
            });
          };

          if (interactiveParallax && hoverTarget) {
            hoverTarget.addEventListener('mouseenter', onPointerEnter, { passive: true });
            hoverTarget.addEventListener('mousemove', onPointerMove, { passive: true });
            hoverTarget.addEventListener('mouseleave', onPointerLeave, { passive: true });
            if (parallaxConfig.mode === 'raf' && parallaxConfig.pauseDuringScroll) {
              window.addEventListener('scroll', onScrollPause, { passive: true });
              hoverTarget.addEventListener('scroll', onScrollPause, { passive: true });
            }
          }

          return () => {
            if (parallaxRafId !== 0) {
              window.cancelAnimationFrame(parallaxRafId);
              parallaxRafId = 0;
            }
            if (interactiveParallax && hoverTarget) {
              hoverTarget.removeEventListener('mouseenter', onPointerEnter);
              hoverTarget.removeEventListener('mousemove', onPointerMove);
              hoverTarget.removeEventListener('mouseleave', onPointerLeave);
              if (parallaxConfig.mode === 'raf' && parallaxConfig.pauseDuringScroll) {
                window.removeEventListener('scroll', onScrollPause);
                hoverTarget.removeEventListener('scroll', onScrollPause);
              }
            }
            resumeDelayedCall?.kill();
            masterTimeline.scrollTrigger?.kill();
            masterTimeline.kill();
            cachedRect = null;
            setMotionActive(false);
          };
        }
      );

      return () => {
        mm.revert();
        setMotionActive(false);
      };
    },
    {
      scope: resolvedScopeRef,
      dependencies: [
        canonicalTheme,
        seedIndex,
        particles.length,
        interactiveParallax,
        parallaxConfig.mode,
        prefersReducedMotion,
      ],
      revertOnUpdate: true,
    }
  );

  const particleMotionClass =
    !prefersReducedMotion && motionActive ? 'will-change-transform' : '';

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
        prefersReducedMotion ? 'disabled' : motionActive ? 'active' : 'minimal'
      }
      data-fw-parallax-mode={prefersReducedMotion ? 'disabled' : parallaxConfig.mode}
      data-fw-invalidate-refresh="true"
      data-fw-scoped={scopeRef ? 'parent' : 'self'}
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden select-none ${className}`}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            left: `${p.leftPercent}%`,
            top: `${p.topPercent}%`,
          }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        >
          <div
            data-fw-particle={p.id}
            data-fw-glyph={p.glyph}
            data-fw-spin360={p.continuousSpin360 ? 'true' : 'false'}
            className={`h-12 w-12 sm:h-14 sm:w-14 ${particleMotionClass} ${p.opacityClass}`}
          >
            <div
              data-fw-spin={p.continuousSpin360 ? 'true' : 'false'}
              className={`h-full w-full ${particleMotionClass}`}
            >
              <WatermarkGlyphSvg glyph={p.glyph} accentColor={p.accentColor} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
