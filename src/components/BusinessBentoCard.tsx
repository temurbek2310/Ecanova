'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowUpRight } from 'lucide-react';
import { useContainedArtifactPhysics } from '../hooks/useContainedArtifactPhysics';
import type { BusinessBentoModule } from '../lib/business-bento';
import {
  BENTO_HOVER_PHYSICS,
  resolveBusinessModuleWatermark,
} from '../lib/subject-artifacts';
import type { LocaleCode } from '../shared/types';
import { ArtifactConstellation } from './ArtifactConstellation';

export interface BusinessBentoCardProps {
  moduleItem: BusinessBentoModule;
  index: number;
  zClass: string;
  locale: LocaleCode;
  primaryBusinessCourseId?: string;
  onOpenCourse: (courseId: string, locale: LocaleCode) => void;
}

export const BusinessBentoCard: React.FC<BusinessBentoCardProps> = ({
  moduleItem,
  index,
  zClass,
  locale,
  primaryBusinessCourseId,
  onOpenCourse,
}) => {
  const isUz = locale === 'uz';
  const cardRef = useRef<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const watermark = useMemo(
    () => resolveBusinessModuleWatermark(moduleItem.id, index),
    [moduleItem.id, index]
  );

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
    subjectType: 'Business',
    cardRef,
    seedIndex: index,
    particleCount: 5,
    preferredKind: watermark.kind,
  });

  useEffect(() => {
    const cardEl = cardRef.current;
    return () => {
      if (cardEl) gsap.killTweensOf(cardEl);
    };
  }, []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      setIsHovered(true);
      handleArtifactPointerEnter(e);

      const cardEl = cardRef.current;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion || !cardEl) return;

      gsap.to(cardEl, {
        scale: BENTO_HOVER_PHYSICS.hover.scale,
        y: BENTO_HOVER_PHYSICS.hover.y,
        boxShadow: BENTO_HOVER_PHYSICS.hover.boxShadow,
        duration: BENTO_HOVER_PHYSICS.hover.duration,
        ease: BENTO_HOVER_PHYSICS.hover.ease,
        overwrite: 'auto',
      });
    },
    [handleArtifactPointerEnter]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      handleArtifactPointerMove(e);
    },
    [handleArtifactPointerMove]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    handleArtifactPointerLeave();

    const cardEl = cardRef.current;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !cardEl) return;

    gsap.to(cardEl, {
      scale: BENTO_HOVER_PHYSICS.resting.scale,
      y: BENTO_HOVER_PHYSICS.resting.y,
      boxShadow: BENTO_HOVER_PHYSICS.resting.boxShadow,
      duration: BENTO_HOVER_PHYSICS.resting.duration,
      ease: BENTO_HOVER_PHYSICS.resting.ease,
      overwrite: 'auto',
    });
  }, [handleArtifactPointerLeave]);

  return (
    <div
      data-bento-card={moduleItem.id}
      data-stack-order={moduleItem.stackOrder}
      className={`relative ${zClass} ${moduleItem.gridSpanClass} will-change-transform`}
    >
      <article
        ref={cardRef}
        data-testid={`business-bento-card-${moduleItem.id}`}
        data-bento-hover={isHovered ? 'true' : 'false'}
        data-watermark-kind={watermark.kind}
        data-watermark-accent={watermark.accentColor}
        data-physics-subject={profile.subject}
        data-physics-profile={profile.profileName}
        data-physics-ease={profile.ease}
        data-physics-active={isComplexPhysicsActive ? 'true' : 'false'}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative flex h-full flex-col justify-between overflow-hidden rounded-xl border-2 bg-white/65 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl will-change-transform transition-colors dark:bg-[#101522]/60 ${
          isHovered
            ? 'border-theme-accent'
            : 'border-slate-500 dark:border-[#222B3D]'
        }`}
      >
        {/* Multi-particle Business Constellation (5 independent particles at opacity-10..15) */}
        <ArtifactConstellation
          testId={`business-bento-watermark-${moduleItem.id}`}
          particles={particles}
          setDriftRef={setDriftRef}
          setSpinRef={setSpinRef}
        />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-theme-border pb-3">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider text-muted">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-xs border border-theme-border ${moduleItem.accentBgClass}`}
                aria-hidden="true"
              />
              <span>{moduleItem.code}</span>
            </span>

            <div className="inline-flex items-center gap-1.5 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-xs font-bold text-ink shadow-brutal-sm">
              <span className="text-[10px] font-medium text-muted">
                {moduleItem.metricBadge}:
              </span>
              <span className={moduleItem.accentTextClass}>
                {moduleItem.metricValue}
              </span>
            </div>
          </div>

          <h3 className="mt-3.5 font-display text-base font-extrabold tracking-tight text-ink sm:text-lg">
            {moduleItem.title}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
            {moduleItem.summary}
          </p>
        </div>

        <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-theme-border pt-3.5">
          <div className="text-[11px] text-muted">
            <span className="font-semibold text-ink">
              {isUz ? 'Amaliy natija:' : 'Deliverable:'}
            </span>{' '}
            <span>{moduleItem.deliverable}</span>
          </div>

          {primaryBusinessCourseId && (
            <button
              type="button"
              onClick={() => onOpenCourse(primaryBusinessCourseId, locale)}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-[11px] font-bold text-theme-accent shadow-brutal-sm transition-colors hover:border-theme-accent"
            >
              <span>{isUz ? 'Modulni ochish' : 'Launch Module'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </article>
    </div>
  );
};
