'use client';

import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  ARTIFACT_BORDER_STROKE,
  ARTIFACT_SURFACE_FILL,
  computeArtifactParallaxOffset,
  normalizeViewportPointer,
  resolveArtifactShadowStyle,
  SUBJECT_ARTIFACT_SPECS,
  type ArtifactKind,
} from '../lib/subject-artifacts';

function renderArtifactSvg(kind: ArtifactKind, accentColorVar: string): React.ReactNode {
  const fill = ARTIFACT_SURFACE_FILL;
  const stroke = ARTIFACT_BORDER_STROKE;

  switch (kind) {
    case 'icosahedron':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <polygon
            points="60,8 106,34 106,86 60,112 14,86 14,34"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <polygon
            points="60,26 88,74 32,74"
            fill="none"
            stroke={accentColorVar}
            strokeWidth="3"
            strokeLinejoin="miter"
          />
          <path
            d="M60 8 L60 26 M106 34 L60 26 M14 34 L60 26 M106 34 L88 74 M14 34 L32 74 M106 86 L88 74 M14 86 L32 74 M60 112 L88 74 M60 112 L32 74"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinejoin="miter"
          />
          <rect x="55" y="21" width="10" height="10" fill={accentColorVar} stroke={stroke} strokeWidth="2.5" />
          <rect x="27" y="69" width="10" height="10" fill={fill} stroke={accentColorVar} strokeWidth="2.5" />
          <rect x="83" y="69" width="10" height="10" fill={fill} stroke={accentColorVar} strokeWidth="2.5" />
        </svg>
      );

    case 'sigma-symbol':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <rect
            x="14"
            y="14"
            width="92"
            height="92"
            rx="6"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
          />
          {/* Corner architectural drafting ticks */}
          <path
            d="M24 24 H34 M24 24 V34 M96 96 H86 M96 96 V86"
            fill="none"
            stroke={accentColorVar}
            strokeWidth="3"
            strokeLinecap="square"
          />
          {/* Oversized serif geometric Sigma (∑) */}
          <path
            d="M84 36 V30 H34 L60 60 L34 90 H84 V84"
            fill="none"
            stroke={accentColorVar}
            strokeWidth="6.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <path
            d="M78 30 H86 V40 M78 90 H86 V80"
            fill="none"
            stroke={stroke}
            strokeWidth="3.5"
            strokeLinecap="square"
          />
        </svg>
      );

    case 'integral-symbol':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <polygon
            points="22,12 98,12 108,22 108,108 12,108 12,22"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          {/* Coordinate bounds & dx ticks */}
          <line x1="24" y1="60" x2="96" y2="60" stroke={stroke} strokeWidth="2.5" strokeDasharray="5 5" />
          <path
            d="M78 24 C66 24 63 33 61 52 L57 74 C55 91 51 96 42 96"
            fill="none"
            stroke={accentColorVar}
            strokeWidth="6.5"
            strokeLinecap="square"
          />
          <circle cx="79" cy="24" r="5" fill={accentColorVar} stroke={stroke} strokeWidth="2.5" />
          <circle cx="41" cy="96" r="5" fill={accentColorVar} stroke={stroke} strokeWidth="2.5" />
          <rect x="74" y="74" width="16" height="16" fill="none" stroke={stroke} strokeWidth="3" />
        </svg>
      );

    case 'drafting-compass':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          {/* Calibration measurement arc */}
          <path
            d="M24 74 A44 44 0 0 0 96 74"
            fill="none"
            stroke={accentColorVar}
            strokeWidth="3.5"
            strokeDasharray="6 4"
          />
          {/* Left & Right hinged drafting legs */}
          <polygon
            points="54,28 62,32 34,104 26,101"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <polygon
            points="66,28 58,32 86,104 94,101"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          {/* Crossbar lock */}
          <rect
            x="38"
            y="66"
            width="44"
            height="10"
            fill={fill}
            stroke={stroke}
            strokeWidth="3.5"
          />
          {/* Top pivot handle & hinge pin */}
          <rect x="55" y="10" width="10" height="14" fill={fill} stroke={stroke} strokeWidth="4" />
          <circle cx="60" cy="30" r="10" fill={fill} stroke={stroke} strokeWidth="4.5" />
          <circle cx="60" cy="30" r="3.5" fill={accentColorVar} />
        </svg>
      );

    case 'candlesticks':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <rect
            x="10"
            y="14"
            width="100"
            height="92"
            rx="4"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
          />
          {/* Baseline grid */}
          <line x1="18" y1="60" x2="102" y2="60" stroke={stroke} strokeWidth="2.5" strokeDasharray="4 4" />
          {/* Candle 1 */}
          <line x1="34" y1="26" x2="34" y2="92" stroke={accentColorVar} strokeWidth="3.5" />
          <rect x="26" y="42" width="16" height="32" fill={fill} stroke={stroke} strokeWidth="4" />
          <rect x="29" y="46" width="10" height="24" fill={accentColorVar} opacity="0.28" />
          {/* Candle 2 */}
          <line x1="60" y1="22" x2="60" y2="82" stroke={stroke} strokeWidth="3.5" />
          <rect x="52" y="34" width="16" height="28" fill={accentColorVar} stroke={stroke} strokeWidth="4" />
          {/* Candle 3 */}
          <line x1="86" y1="32" x2="86" y2="96" stroke={accentColorVar} strokeWidth="3.5" />
          <rect x="78" y="48" width="16" height="34" fill={fill} stroke={stroke} strokeWidth="4" />
        </svg>
      );

    case 'line-graph':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <rect
            x="12"
            y="14"
            width="96"
            height="92"
            rx="4"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
          />
          {/* Axes */}
          <path d="M26 26 V92 H96" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="square" />
          {/* Sharp vector trajectory */}
          <polyline
            points="28,82 48,66 64,74 88,36"
            fill="none"
            stroke={accentColorVar}
            strokeWidth="5"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
          {/* Vertex markers */}
          <rect x="43" y="61" width="10" height="10" fill={fill} stroke={stroke} strokeWidth="3" />
          <rect x="59" y="69" width="10" height="10" fill={fill} stroke={stroke} strokeWidth="3" />
          <rect x="83" y="31" width="10" height="10" fill={accentColorVar} stroke={stroke} strokeWidth="3" />
        </svg>
      );

    case 'network-nodes':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          {/* Vector graph edges */}
          <path
            d="M30 34 L88 28 L92 84 L34 90 Z M30 34 L60 60 M88 28 L60 60 M92 84 L60 60 M34 90 L60 60"
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinejoin="miter"
          />
          <line x1="60" y1="60" x2="88" y2="28" stroke={accentColorVar} strokeWidth="3.5" />
          <line x1="30" y1="34" x2="60" y2="60" stroke={accentColorVar} strokeWidth="3.5" />
          {/* Geometric nodes */}
          <rect x="18" y="22" width="22" height="22" fill={fill} stroke={stroke} strokeWidth="4" />
          <rect x="78" y="16" width="22" height="22" fill={fill} stroke={stroke} strokeWidth="4" />
          <rect x="80" y="74" width="22" height="22" fill={fill} stroke={stroke} strokeWidth="4" />
          <rect x="22" y="78" width="22" height="22" fill={fill} stroke={stroke} strokeWidth="4" />
          <polygon
            points="60,44 76,60 60,76 44,60"
            fill={fill}
            stroke={accentColorVar}
            strokeWidth="4"
          />
          <circle cx="60" cy="60" r="4.5" fill={accentColorVar} />
        </svg>
      );

    case 'chess-knight':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          {/* Stepped architectural pedestal */}
          <rect x="24" y="90" width="72" height="16" fill={fill} stroke={stroke} strokeWidth="4.5" />
          {/* Faceted geometric Knight silhouette */}
          <polygon
            points="36,90 42,58 26,48 30,30 50,16 58,10 66,20 82,22 92,38 78,48 64,46 66,64 82,90"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          {/* Internal geometric facets & eye notch */}
          <polyline
            points="58,24 52,44 64,46"
            fill="none"
            stroke={accentColorVar}
            strokeWidth="3.5"
            strokeLinejoin="miter"
          />
          <rect x="64" y="29" width="7" height="7" fill={accentColorVar} />
          <line x1="36" y1="80" x2="78" y2="80" stroke={accentColorVar} strokeWidth="3" />
        </svg>
      );

    case 'bento-grid':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          {/* Asymmetrical 7/5 & 5/7 Bento Blocks */}
          <rect x="12" y="14" width="54" height="44" fill={fill} stroke={stroke} strokeWidth="4.5" />
          <rect x="74" y="14" width="34" height="44" fill={fill} stroke={accentColorVar} strokeWidth="4" />
          <rect x="12" y="66" width="34" height="40" fill={fill} stroke={accentColorVar} strokeWidth="4" />
          <rect x="54" y="66" width="54" height="40" fill={fill} stroke={stroke} strokeWidth="4.5" />
          {/* Crisp structural dividers */}
          <line x1="22" y1="26" x2="54" y2="26" stroke={accentColorVar} strokeWidth="3.5" />
          <line x1="22" y1="36" x2="44" y2="36" stroke={stroke} strokeWidth="3" />
          <rect x="64" y="76" width="34" height="18" fill="none" stroke={accentColorVar} strokeWidth="3" />
        </svg>
      );

    case 'briefcase':
      return (
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          {/* Geometric handle */}
          <polygon
            points="44,32 48,18 72,18 76,32"
            fill="none"
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          {/* Main structured body */}
          <rect
            x="14"
            y="32"
            width="92"
            height="68"
            rx="4"
            fill={fill}
            stroke={stroke}
            strokeWidth="4.5"
          />
          {/* Horizontal latch bar */}
          <line x1="14" y1="58" x2="106" y2="58" stroke={stroke} strokeWidth="4" />
          {/* Twin Neobrutalist clasps */}
          <rect x="34" y="51" width="12" height="14" fill={fill} stroke={accentColorVar} strokeWidth="3.5" />
          <rect x="74" y="51" width="12" height="14" fill={fill} stroke={accentColorVar} strokeWidth="3.5" />
          <line x1="26" y1="84" x2="94" y2="84" stroke={accentColorVar} strokeWidth="2.5" strokeDasharray="6 4" />
        </svg>
      );
  }
}

export const SubjectArtifactBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const parallaxRefs = useRef<Array<HTMLDivElement | null>>([]);
  const spinRefs = useRef<Array<HTMLDivElement | null>>([]);

  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl || typeof window === 'undefined') return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      containerEl.setAttribute('data-parallax-ready', 'reduced-motion');
      return;
    }

    const pointerTarget = { x: 0, y: 0 };
    const pointerCurrent = { x: 0, y: 0 };

    // Pre-resolve setters outside the ticker loop so zero layout reads/queries run per frame
    const setters = SUBJECT_ARTIFACT_SPECS.map((spec, index) => {
      const el = parallaxRefs.current[index];
      if (!el) return null;
      return {
        spec,
        setX: gsap.quickSetter(el, 'x', 'px'),
        setY: gsap.quickSetter(el, 'y', 'px'),
      };
    });

    const handlePointerMove = (event: MouseEvent | PointerEvent) => {
      const next = normalizeViewportPointer(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight
      );
      pointerTarget.x = next.x;
      pointerTarget.y = next.y;
    };

    const handlePointerLeave = () => {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
    };

    let lastAppliedX = Number.NaN;
    let lastAppliedY = Number.NaN;

    const onTick = () => {
      // Smooth exponential damping tuned to 60fps GSAP ticker
      const ratio = gsap.ticker.deltaRatio(60);
      const ease = Math.min(1, 0.08 * ratio);
      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * ease;
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * ease;

      // Skip DOM transform writes when settled to avoid unnecessary compositor work
      if (
        Math.abs(pointerCurrent.x - lastAppliedX) < 0.0004 &&
        Math.abs(pointerCurrent.y - lastAppliedY) < 0.0004
      ) {
        return;
      }

      lastAppliedX = pointerCurrent.x;
      lastAppliedY = pointerCurrent.y;

      for (let i = 0; i < setters.length; i += 1) {
        const entry = setters[i];
        if (!entry) continue;
        const offset = computeArtifactParallaxOffset({
          normalizedPointerX: pointerCurrent.x,
          normalizedPointerY: pointerCurrent.y,
          depth: entry.spec.depth,
        });
        entry.setX(offset.x);
        entry.setY(offset.y);
      }
    };

    const ctx = gsap.context(() => {
      SUBJECT_ARTIFACT_SPECS.forEach((spec, index) => {
        const parallaxEl = parallaxRefs.current[index];
        if (parallaxEl) {
          gsap.set(parallaxEl, { x: 0, y: 0, force3D: true });
        }
        const spinEl = spinRefs.current[index];
        if (!spinEl) return;
        gsap.set(spinEl, {
          rotation: spec.initialRotationDeg,
          scale: spec.scale,
          force3D: true,
        });
        gsap.to(spinEl, {
          rotation: spec.initialRotationDeg + 360 * spec.passiveRotationDir,
          duration: spec.passiveRotationDurationSec,
          repeat: -1,
          ease: 'none',
          force3D: true,
        });
      });
    }, containerEl);

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('blur', handlePointerLeave);
    document.addEventListener('mouseleave', handlePointerLeave);
    gsap.ticker.add(onTick);
    containerEl.setAttribute('data-parallax-ready', 'true');

    return () => {
      gsap.ticker.remove(onTick);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('blur', handlePointerLeave);
      document.removeEventListener('mouseleave', handlePointerLeave);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="subject-artifact-background"
      className="no-print pointer-events-none fixed inset-0 z-[1] overflow-hidden select-none"
    >
      {SUBJECT_ARTIFACT_SPECS.map((spec, index) => {
        const shadow = resolveArtifactShadowStyle(spec);
        return (
          <div
            key={spec.id}
            data-testid={`subject-artifact-${spec.id}`}
            data-subject={spec.subject}
            data-kind={spec.kind}
            data-depth={spec.depth.toFixed(2)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${spec.xPercent}%`,
              top: `${spec.yPercent}%`,
              opacity: spec.opacity,
            }}
          >
            <div
              ref={(el) => {
                parallaxRefs.current[index] = el;
              }}
              className="will-change-transform"
            >
              <div
                ref={(el) => {
                  spinRefs.current[index] = el;
                }}
                className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 will-change-transform"
                style={{
                  filter: shadow.dropShadowFilter,
                  transform: `rotate(${spec.initialRotationDeg}deg) scale(${spec.scale})`,
                }}
              >
                {renderArtifactSvg(spec.kind, shadow.accentColorVar)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
