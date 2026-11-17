'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  buildArtifactConstellation,
  computeParticleMagneticGravity,
  getSubjectPhysicsProfile,
  shouldEnableComplexArtifactPhysics,
  type ConstellationParticleSpec,
} from '../lib/artifact-physics';
import type { ArtifactKind, ArtifactSubject } from '../lib/subject-artifacts';

gsap.registerPlugin(useGSAP);

export interface UseArtifactConstellationPhysicsOptions {
  subjectType: ArtifactSubject;
  cardRef: React.RefObject<HTMLElement | null>;
  seedIndex?: number;
  particleCount?: number;
  preferredKind?: ArtifactKind;
  enabled?: boolean;
}

export interface UseArtifactConstellationPhysicsResult {
  profile: ReturnType<typeof getSubjectPhysicsProfile>;
  particles: readonly ConstellationParticleSpec[];
  setDriftRef: (index: number) => (el: HTMLDivElement | null) => void;
  setSpinRef: (index: number) => (el: HTMLDivElement | null) => void;
  isPointerInside: boolean;
  isComplexPhysicsActive: boolean;
  handleArtifactPointerEnter: (event: React.MouseEvent<HTMLElement>) => void;
  handleArtifactPointerMove: (event: React.MouseEvent<HTMLElement>) => void;
  handleArtifactPointerLeave: () => void;
}

/**
 * Reusable GSAP Micro-Particle Constellation physics hook.
 * - Spawns 3-5 independent particle lifecycles with `repeatRefresh: true` and 3-6s energetic motion.
 * - Preserves subject-specific physics (Math = power1.inOut + 360° geometric spins,
 *   Economics = fluid sine.inOut waves, Business = strategic expo.inOut glides with holds).
 * - Uses `gsap.matchMedia()` to disable heavy loops on mobile / reduced-motion / low-core devices.
 * - On card hover, pulls the entire particle constellation toward the cursor (`power3.out`).
 * - Safely manages ref arrays & kills all GSAP tweens on cleanup to prevent memory leaks.
 */
export function useContainedArtifactPhysics({
  subjectType,
  cardRef,
  seedIndex = 0,
  particleCount = 4,
  preferredKind,
  enabled = true,
}: UseArtifactConstellationPhysicsOptions): UseArtifactConstellationPhysicsResult {
  const profile = getSubjectPhysicsProfile(subjectType);

  const particles = useMemo(
    () =>
      enabled
        ? buildArtifactConstellation({
            subject: subjectType,
            seedIndex,
            count: particleCount,
            preferredKind,
          })
        : [],
    [enabled, subjectType, seedIndex, particleCount, preferredKind]
  );

  const driftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const spinRefs = useRef<(HTMLDivElement | null)[]>([]);
  driftRefs.current.length = particles.length;
  spinRefs.current.length = particles.length;

  const driftTweensRef = useRef<gsap.core.Tween[]>([]);
  const spinTweensRef = useRef<gsap.core.Tween[]>([]);
  const isComplexActiveRef = useRef(false);
  const isHoveredRef = useRef(false);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isComplexPhysicsActive, setIsComplexPhysicsActive] = useState(false);

  const setDriftRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      driftRefs.current[index] = el;
    },
    []
  );

  const setSpinRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      spinRefs.current[index] = el;
    },
    []
  );

  useGSAP(
    () => {
      // Kill any prior tweens cleanly
      driftTweensRef.current.forEach((tw) => tw.kill());
      spinTweensRef.current.forEach((tw) => tw.kill());
      driftTweensRef.current = [];
      spinTweensRef.current = [];
      isComplexActiveRef.current = false;

      if (!cardRef.current) return;
      const cardEl = cardRef.current;

      if (!enabled || !cardEl || particles.length === 0) {
        setIsComplexPhysicsActive(false);
        return;
      }

      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktopMotion: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const hwConcurrency =
            typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
          const allowed = shouldEnableComplexArtifactPhysics({
            isDesktopViewport: Boolean(context.conditions?.isDesktopMotion),
            prefersReducedMotion: !context.conditions?.isDesktopMotion,
            hardwareConcurrency: hwConcurrency,
          });

          if (!allowed) {
            isComplexActiveRef.current = false;
            setIsComplexPhysicsActive(false);
            particles.forEach((p, idx) => {
              const driftEl = driftRefs.current[idx];
              const spinEl = spinRefs.current[idx];
              if (driftEl) gsap.set(driftEl, { x: 0, y: 0, scale: p.baseScale });
              if (spinEl) gsap.set(spinEl, { rotation: 0 });
            });
            return;
          }

          isComplexActiveRef.current = true;
          setIsComplexPhysicsActive(true);

          const nextDriftTweens: gsap.core.Tween[] = [];
          const nextSpinTweens: gsap.core.Tween[] = [];

          particles.forEach((p, idx) => {
            const driftEl = driftRefs.current[idx];
            const spinEl = spinRefs.current[idx];
            if (!driftEl) return;

            gsap.set(driftEl, { x: 0, y: 0, scale: p.baseScale });

            const driftTween = gsap.to(driftEl, {
              x: () => gsap.utils.random(p.xRange[0], p.xRange[1]),
              y: () => gsap.utils.random(p.yRange[0], p.yRange[1]),
              scale: Number((p.baseScale * (idx % 2 === 0 ? 1.1 : 0.9)).toFixed(2)),
              duration: p.durationSec,
              delay: p.delaySec,
              repeat: -1,
              yoyo: true,
              repeatDelay: p.repeatDelaySec,
              repeatRefresh: true,
              ease: profile.ease,
            });
            nextDriftTweens.push(driftTween);

            if (spinEl) {
              if (p.continuousSpin360) {
                const spinTween = gsap.to(spinEl, {
                  rotation: p.spinDirection > 0 ? '+=360' : '-=360',
                  duration: p.spinDurationSec,
                  repeat: -1,
                  ease: 'none',
                });
                nextSpinTweens.push(spinTween);
              } else {
                const tiltTween = gsap.to(spinEl, {
                  rotation: p.spinDirection > 0 ? 16 : -16,
                  duration: Math.max(2.6, p.durationSec * 0.85),
                  delay: p.delaySec * 0.5,
                  repeat: -1,
                  yoyo: true,
                  repeatRefresh: true,
                  ease: profile.ease,
                });
                nextSpinTweens.push(tiltTween);
              }
            }
          });

          driftTweensRef.current = nextDriftTweens;
          spinTweensRef.current = nextSpinTweens;

          if (isHoveredRef.current) {
            driftTweensRef.current.forEach((tw) => tw.pause());
          }

          return () => {
            nextDriftTweens.forEach((tw) => tw.kill());
            nextSpinTweens.forEach((tw) => tw.kill());
            driftTweensRef.current = [];
            spinTweensRef.current = [];
            isComplexActiveRef.current = false;
            setIsComplexPhysicsActive(false);
          };
        }
      );

      return () => {
        mm.revert();
        driftTweensRef.current.forEach((tw) => tw.kill());
        spinTweensRef.current.forEach((tw) => tw.kill());
        driftTweensRef.current = [];
        spinTweensRef.current = [];
        isComplexActiveRef.current = false;
      };
    },
    { scope: cardRef, dependencies: [subjectType, seedIndex, particleCount, enabled], revertOnUpdate: true }
  );

  const applyConstellationGravity = useCallback(
    (clientX: number, clientY: number) => {
      if (!isComplexActiveRef.current) return;
      const cardEl = cardRef.current;
      if (!cardEl) return;

      const cardRect = cardEl.getBoundingClientRect();
      driftTweensRef.current.forEach((tw) => tw.pause());

      particles.forEach((p, idx) => {
        const driftEl = driftRefs.current[idx];
        if (!driftEl) return;

        const pull = computeParticleMagneticGravity({
          clientX,
          clientY,
          cardRect,
          leftPercent: p.leftPercent,
          topPercent: p.topPercent,
          gravityWeight: p.gravityWeight,
          maxPullPx: profile.cursorPullMaxPx,
        });

        gsap.to(driftEl, {
          x: pull.x,
          y: pull.y,
          scale: Number((p.baseScale * 1.12).toFixed(2)),
          duration: profile.cursorPullDurationSec,
          ease: profile.cursorPullEase,
          overwrite: 'auto',
        });
      });
    },
    [cardRef, particles, profile]
  );

  const handleArtifactPointerEnter = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      isHoveredRef.current = true;
      setIsPointerInside(true);
      applyConstellationGravity(event.clientX, event.clientY);
    },
    [applyConstellationGravity]
  );

  const handleArtifactPointerMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!isHoveredRef.current) return;
      applyConstellationGravity(event.clientX, event.clientY);
    },
    [applyConstellationGravity]
  );

  const handleArtifactPointerLeave = useCallback(() => {
    isHoveredRef.current = false;
    setIsPointerInside(false);

    if (!isComplexActiveRef.current) return;

    particles.forEach((p, idx) => {
      const driftEl = driftRefs.current[idx];
      if (!driftEl) return;

      gsap.to(driftEl, {
        x: 0,
        y: 0,
        scale: p.baseScale,
        duration: 0.42,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => {
          if (!isHoveredRef.current) {
            driftTweensRef.current[idx]?.invalidate().restart(true);
          }
        },
      });
    });
  }, [particles]);

  return {
    profile,
    particles,
    setDriftRef,
    setSpinRef,
    isPointerInside,
    isComplexPhysicsActive,
    handleArtifactPointerEnter,
    handleArtifactPointerMove,
    handleArtifactPointerLeave,
  };
}
