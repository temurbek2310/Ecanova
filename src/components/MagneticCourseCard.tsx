'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useContainedArtifactPhysics } from '../hooks/useContainedArtifactPhysics';
import {
  computeMagneticCardTransform,
  DEFAULT_MAGNETIC_HOVER_SCALE,
  DEFAULT_MAGNETIC_MAX_TRANSLATE_PX,
  getRestingMagneticCardState,
  type MagneticTransformState,
} from '../lib/magnetic-card';
import {
  resolveCourseWatermarkArtifact,
  type ArtifactKind,
  type ArtifactSubject,
} from '../lib/subject-artifacts';
import { ArtifactConstellation } from './ArtifactConstellation';

export interface MagneticCourseCardProps {
  testId?: string;
  className?: string;
  maxTranslatePx?: number;
  hoverScale?: number;
  subject?: ArtifactSubject;
  artifactIndex?: number;
  artifactKind?: ArtifactKind;
  artifactAccentColor?: string;
  children: React.ReactNode;
}

export const MagneticCourseCard: React.FC<MagneticCourseCardProps> = ({
  testId,
  className = '',
  maxTranslatePx = DEFAULT_MAGNETIC_MAX_TRANSLATE_PX,
  hoverScale = DEFAULT_MAGNETIC_HOVER_SCALE,
  subject,
  artifactIndex = 0,
  artifactKind,
  artifactAccentColor,
  children,
}) => {
  const cardRef = useRef<HTMLElement | null>(null);
  const [magneticState, setMagneticState] = useState<MagneticTransformState>(() =>
    getRestingMagneticCardState()
  );

  const watermark = useMemo(() => {
    if (artifactKind && artifactAccentColor) {
      return { kind: artifactKind, accentColor: artifactAccentColor };
    }
    if (subject) {
      return resolveCourseWatermarkArtifact(subject, artifactIndex);
    }
    return null;
  }, [subject, artifactIndex, artifactKind, artifactAccentColor]);

  const physicsSubject: ArtifactSubject = subject ?? 'Business';

  const {
    profile,
    particles,
    setDriftRef,
    setSpinRef,
    isComplexPhysicsActive,
    handleArtifactPointerEnter,
    handleArtifactPointerMove,
    handleArtifactPointerLeave,
  } = useContainedArtifactPhysics({
    subjectType: physicsSubject,
    cardRef,
    seedIndex: artifactIndex,
    particleCount: 4,
    preferredKind: watermark?.kind,
    enabled: Boolean(watermark),
  });

  useEffect(() => {
    const el = cardRef.current;
    return () => {
      if (el) {
        gsap.killTweensOf(el);
      }
    };
  }, []);

  const animateCardTo = useCallback(
    (next: MagneticTransformState, duration: number, ease: string) => {
      setMagneticState(next);
      const el = cardRef.current;
      if (!el) return;
      gsap.to(el, {
        x: next.x,
        y: next.y,
        scale: next.scale,
        boxShadow: next.boxShadow,
        duration,
        ease,
        overwrite: 'auto',
      });
    },
    []
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      handleArtifactPointerEnter(e);
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = computeMagneticCardTransform({
        clientX: e.clientX,
        clientY: e.clientY,
        rect,
        maxTranslatePx,
        hoverScale,
      });
      animateCardTo(next, 0.28, 'power3.out');
    },
    [maxTranslatePx, hoverScale, animateCardTo, handleArtifactPointerEnter]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      handleArtifactPointerMove(e);
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = computeMagneticCardTransform({
        clientX: e.clientX,
        clientY: e.clientY,
        rect,
        maxTranslatePx,
        hoverScale,
      });
      animateCardTo(next, 0.24, 'power2.out');
    },
    [maxTranslatePx, hoverScale, animateCardTo, handleArtifactPointerMove]
  );

  const handleMouseLeave = useCallback(() => {
    handleArtifactPointerLeave();
    const resting = getRestingMagneticCardState();
    animateCardTo(resting, 0.42, 'elastic.out(1, 0.65)');
  }, [animateCardTo, handleArtifactPointerLeave]);

  return (
    <article
      ref={cardRef}
      data-testid={testId}
      data-magnetic-card="true"
      data-magnetic-active={magneticState.isHovered ? 'true' : 'false'}
      data-magnetic-scale={String(magneticState.scale)}
      data-magnetic-x={String(magneticState.x)}
      data-magnetic-y={String(magneticState.y)}
      data-watermark-kind={watermark?.kind}
      data-physics-subject={watermark ? profile.subject : undefined}
      data-physics-profile={watermark ? profile.profileName : undefined}
      data-physics-ease={watermark ? profile.ease : undefined}
      data-physics-active={watermark && isComplexPhysicsActive ? 'true' : 'false'}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative isolate overflow-hidden will-change-transform transition-colors ${
        magneticState.isHovered
          ? 'z-20 border-theme-accent'
          : 'border-theme-border'
      } ${className}`}
    >
      <ArtifactConstellation
        testId={testId ? `${testId}-artifact-layer` : undefined}
        particles={particles}
        setDriftRef={setDriftRef}
        setSpinRef={setSpinRef}
      />

      {/* Strictly keep all foreground copy and controls above floating particle constellation */}
      <div className="relative z-10 flex flex-1 flex-col justify-between">
        {children}
      </div>
    </article>
  );
};
