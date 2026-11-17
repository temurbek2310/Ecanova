'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import { buildGeometricShards } from '../lib/geometric-nova';

export interface GeometricNovaProps {
  /** Whether the crystalline shard burst should run. */
  active?: boolean;
  /** Changing key re-triggers the explosion cleanly. */
  triggerKey?: string | number;
  /** Optional element ref (e.g. certificate showcase container) to originate shards from. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Number of crystalline SVG shards to spawn (default 36). */
  shardCount?: number;
  /** Optional callback once the GSAP fall timeline settles. */
  onComplete?: () => void;
}

export const GeometricNova: React.FC<GeometricNovaProps> = ({
  active = true,
  triggerKey = 'milestone-50',
  anchorRef,
  shardCount = 36,
  onComplete,
}) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.body : null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shardRefs = useRef<Array<SVGSVGElement | null>>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const shards = useMemo(() => buildGeometricShards(shardCount), [shardCount]);

  useEffect(() => {
    if (typeof document !== 'undefined' && !portalTarget) {
      setPortalTarget(document.body);
    }
  }, [portalTarget]);

  useEconovaGSAP(
    containerRef,
    () => {
      if (!active) return;

      const elements = shardRefs.current.filter((el): el is SVGSVGElement => Boolean(el));
      if (elements.length === 0) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        gsap.set(elements, { opacity: 0, scale: 0 });
        return;
      }

      const anchorRect = anchorRef?.current?.getBoundingClientRect();
      const originX =
        anchorRect && anchorRect.width > 0
          ? anchorRect.left + anchorRect.width / 2
          : typeof window !== 'undefined'
          ? window.innerWidth * 0.54
          : 720;
      const originY =
        anchorRect && anchorRect.height > 0
          ? anchorRect.top + Math.min(anchorRect.height * 0.45, 240)
          : typeof window !== 'undefined'
          ? window.innerHeight * 0.42
          : 360;

      gsap.set(elements, {
        left: originX,
        top: originY,
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        scale: 0,
        opacity: 0,
        rotateX: 0,
        rotateY: 0,
        rotation: 0,
        transformPerspective: 900,
        transformOrigin: '50% 50%',
      });

      const master = gsap.timeline({
        onComplete: () => {
          onCompleteRef.current?.();
        },
      });

      elements.forEach((el, idx) => {
        const spec = shards[idx];
        if (!spec) return;

        const shardTl = gsap.timeline();

        // Phase 1: Explosive outward crystalline burst from certificate center
        shardTl.to(el, {
          x: spec.explodeX,
          y: spec.explodeY,
          scale: spec.scale,
          opacity: spec.opacity,
          rotation: spec.rotZ * 0.35,
          duration: 0.72,
          ease: 'expo.out',
        });

        // Phase 2: Slow floating gravity drift with 3D rotations behind UI panels
        shardTl.to(el, {
          x: spec.explodeX + spec.driftX,
          y: spec.explodeY + spec.fallY,
          rotateX: spec.rotX,
          rotateY: spec.rotY,
          rotation: spec.rotZ,
          opacity: 0,
          duration: spec.fallDurationSec,
          ease: 'power1.inOut',
        });

        master.add(shardTl, spec.delaySec);
      });
    },
    {
      dependencies: [active, triggerKey, Boolean(portalTarget), shards.length],
      revertOnUpdate: true,
    }
  );

  const layerContent = (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid={active ? 'geometric-nova-portal' : 'geometric-nova-idle'}
      data-trigger-key={String(triggerKey)}
      style={{ perspective: '900px' }}
      className={
        active
          ? 'no-print pointer-events-none fixed inset-0 z-0 overflow-hidden'
          : 'no-print pointer-events-none fixed inset-0 z-0 hidden overflow-hidden'
      }
    >
      {active &&
        shards.map((shard, index) => (
          <svg
            key={shard.id}
            ref={(el) => {
              shardRefs.current[index] = el;
            }}
            data-testid="geometric-nova-shard"
            data-shape={shard.shapeKind}
            width={shard.sizePx}
            height={shard.sizePx}
            viewBox="0 0 32 32"
            fill="none"
            className="absolute will-change-transform"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <polygon
              points={shard.points}
              fill={shard.filled ? shard.color : 'none'}
              fillOpacity={shard.filled ? 0.24 : 0}
              stroke={shard.color}
              strokeWidth={shard.strokeWidth}
              strokeLinejoin="miter"
            />
            {shard.shapeKind === 'wireframe-diamond' && (
              <line
                x1="16"
                y1="2"
                x2="16"
                y2="30"
                stroke={shard.color}
                strokeWidth={1.5}
              />
            )}
          </svg>
        ))}
    </div>
  );

  if (portalTarget) {
    return createPortal(layerContent, portalTarget);
  }

  return layerContent;
};
