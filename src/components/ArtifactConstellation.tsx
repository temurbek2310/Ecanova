'use client';

import React from 'react';
import type { ConstellationParticleSpec } from '../lib/artifact-physics';
import { SubjectArtifactSvg } from './SubjectArtifactSvg';

export interface ArtifactConstellationProps {
  testId?: string;
  particles: readonly ConstellationParticleSpec[];
  setDriftRef: (index: number) => (el: HTMLDivElement | null) => void;
  setSpinRef: (index: number) => (el: HTMLDivElement | null) => void;
  isHovered?: boolean;
}

/**
 * Renders the 3..5-particle Micro-Particle Constellation strictly behind card copy
 * (`absolute inset-0 z-0 overflow-hidden pointer-events-none`) with high-contrast light
 * mode visibility and zero glass blur regression.
 */
export const ArtifactConstellation: React.FC<ArtifactConstellationProps> = ({
  testId,
  particles,
  setDriftRef,
  setSpinRef,
  isHovered = false,
}) => {
  if (particles.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      data-constellation-count={particles.length}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      {particles.map((p, idx) => {
        const restingOpacityClass =
          p.opacityClass === 'opacity-15'
            ? 'opacity-30 dark:opacity-15'
            : 'opacity-25 dark:opacity-10';

        const hoverOpacityClass = isHovered
          ? '!opacity-70 dark:!opacity-35 transition-opacity duration-300'
          : 'transition-opacity duration-300';

        return (
          <div
            key={p.id}
            ref={setDriftRef(idx)}
            data-floating-artifact="true"
            data-particle-index={idx}
            data-particle-kind={p.kind}
            data-particle-spin360={p.continuousSpin360 ? 'true' : 'false'}
            style={{
              left: `${p.leftPercent}%`,
              top: `${p.topPercent}%`,
            }}
            className={`pointer-events-none absolute h-14 w-14 sm:h-16 sm:w-16 -translate-x-1/2 -translate-y-1/2 will-change-transform ${restingOpacityClass} ${hoverOpacityClass}`}
          >
            <div
              ref={setSpinRef(idx)}
              data-particle-spin-layer="true"
              className="h-full w-full will-change-transform"
            >
              <SubjectArtifactSvg
                kind={p.kind}
                accentColor={p.accentColor}
                variant="watermark"
                className="h-full w-full"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
