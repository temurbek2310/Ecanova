'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import { useNodeUnlock } from '../context/NodeUnlockContext';
import {
  computeCryptographicScrambleFrame,
  resolveNodeArtifactSpec,
  type CompetencyNodeUnlock,
  type NodeUnlockSubject,
} from '../lib/node-unlock';

const NodeGeometricArtifactSvg: React.FC<{
  subject: NodeUnlockSubject;
  primaryHex: string;
  secondaryHex: string;
}> = ({ subject, primaryHex, secondaryHex }) => {
  switch (subject) {
    case 'Economics':
      return (
        <svg viewBox="0 0 120 120" className="h-24 w-24 sm:h-28 sm:w-28" aria-hidden="true">
          <polygon
            points="60,8 112,34 112,86 60,112 8,86 8,34"
            fill="#080B14"
            stroke={primaryHex}
            strokeWidth="4"
          />
          <line x1="22" y1="90" x2="98" y2="30" stroke={primaryHex} strokeWidth="4" />
          <line x1="22" y1="30" x2="98" y2="90" stroke={secondaryHex} strokeWidth="4" />
          <rect
            x="52"
            y="52"
            width="16"
            height="16"
            fill={primaryHex}
            stroke="#000000"
            strokeWidth="2.5"
          />
        </svg>
      );
    case 'Mathematics':
      return (
        <svg viewBox="0 0 120 120" className="h-24 w-24 sm:h-28 sm:w-28" aria-hidden="true">
          <polygon
            points="60,8 112,60 60,112 8,60"
            fill="#080B14"
            stroke={primaryHex}
            strokeWidth="4"
          />
          <polygon
            points="60,26 94,60 60,94 26,60"
            fill="none"
            stroke={secondaryHex}
            strokeWidth="3"
            strokeDasharray="6 4"
          />
          <circle cx="60" cy="60" r="9" fill={primaryHex} stroke="#000000" strokeWidth="2.5" />
        </svg>
      );
    case 'Business':
      return (
        <svg viewBox="0 0 120 120" className="h-24 w-24 sm:h-28 sm:w-28" aria-hidden="true">
          <rect
            x="14"
            y="14"
            width="92"
            height="92"
            fill="#080B14"
            stroke={primaryHex}
            strokeWidth="4"
          />
          <polygon
            points="28,88 54,60 74,72 96,32"
            fill="none"
            stroke={primaryHex}
            strokeWidth="4.5"
            strokeLinejoin="miter"
          />
          <polygon
            points="84,32 98,30 96,44"
            fill={secondaryHex}
            stroke="#000000"
            strokeWidth="2"
          />
        </svg>
      );
    case 'System':
    default:
      return (
        <svg viewBox="0 0 120 120" className="h-24 w-24 sm:h-28 sm:w-28" aria-hidden="true">
          <polygon
            points="36,10 84,10 110,36 110,84 84,110 36,110 10,84 10,36"
            fill="#080B14"
            stroke={primaryHex}
            strokeWidth="4"
          />
          <polygon
            points="60,24 92,60 60,96 28,60"
            fill={secondaryHex}
            fillOpacity="0.22"
            stroke={secondaryHex}
            strokeWidth="3.5"
          />
          <rect x="53" y="53" width="14" height="14" fill={primaryHex} />
        </svg>
      );
  }
};

interface NodeUnlockStageProps {
  node: CompetencyNodeUnlock;
  onDismiss: () => void;
}

const NodeUnlockStage: React.FC<NodeUnlockStageProps> = ({ node, onDismiss }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const artifactRef = useRef<HTMLDivElement | null>(null);
  const titleContainerRef = useRef<HTMLHeadingElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);
  const promptRef = useRef<HTMLButtonElement | null>(null);
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const spec = resolveNodeArtifactSpec(node.subject);
  const canonicalTitle = node.title.toUpperCase();
  const [scrambledTitle, setScrambledTitle] = useState<string>(() =>
    computeCryptographicScrambleFrame(canonicalTitle, 0, 1)
  );

  const handleDismiss = useCallback(() => {
    if (masterTimelineRef.current) {
      masterTimelineRef.current.kill();
      masterTimelineRef.current = null;
    }
    onDismiss();
  }, [onDismiss]);

  // Step 3: Bind global keydown listener (Enter / Escape) to kill timeline and unmount overlay
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [handleDismiss]);

  useEconovaGSAP(
    containerRef,
    () => {
      const containerEl = containerRef.current;
      const artifactEl = artifactRef.current;
      const titleEl = titleContainerRef.current;
      const subtitleEl = subtitleRef.current;
      const promptEl = promptRef.current;
      if (!containerEl || !artifactEl || !titleEl) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const charSpans = gsap.utils.toArray<HTMLElement>('[data-scramble-char]', titleEl);

      if (prefersReducedMotion) {
        setScrambledTitle(canonicalTitle);
        gsap.set(artifactEl, { scale: 1, opacity: 1, rotate: 0 });
        if (charSpans.length > 0) gsap.set(charSpans, { opacity: 1, y: 0 });
        if (subtitleEl) gsap.set(subtitleEl, { opacity: 1, y: 0 });
        if (promptEl) gsap.set(promptEl, { opacity: 1, y: 0 });
        return;
      }

      gsap.set(artifactEl, { scale: 0, opacity: 0, rotate: -12 });
      if (charSpans.length > 0) gsap.set(charSpans, { opacity: 0, y: 12 });
      if (subtitleEl) gsap.set(subtitleEl, { opacity: 0, y: 10 });
      if (promptEl) gsap.set(promptEl, { opacity: 0, y: 8 });

      const scrambleState = { progress: 0, tick: 0 };
      const tl = gsap.timeline();
      masterTimelineRef.current = tl;

      // Step 1 (Impact): Heavy elastic geometric artifact slam with hard violet shadow
      tl.to(artifactEl, {
        scale: 1,
        opacity: 1,
        rotate: 0,
        duration: 0.72,
        ease: 'elastic.out(1, 0.5)',
      });

      // Step 2 (Cryptographic Scramble): Rapid stagger + glyph cipher reveal across monospace characters
      if (charSpans.length > 0) {
        tl.to(
          charSpans,
          {
            opacity: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.012,
            ease: 'power3.out',
          },
          0.16
        );
      }

      tl.to(
        scrambleState,
        {
          progress: 1,
          duration: 0.56,
          ease: 'none',
          onUpdate: () => {
            scrambleState.tick += 1;
            setScrambledTitle(
              computeCryptographicScrambleFrame(
                canonicalTitle,
                scrambleState.progress,
                scrambleState.tick
              )
            );
          },
          onComplete: () => {
            setScrambledTitle(canonicalTitle);
          },
        },
        0.16
      );

      if (subtitleEl) {
        tl.to(
          subtitleEl,
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            ease: 'power3.out',
          },
          0.42
        );
      }

      // Step 3 (Dismiss Prompt): Reveal & pulse bottom prompt
      if (promptEl) {
        tl.to(
          promptEl,
          {
            opacity: 1,
            y: 0,
            duration: 0.25,
            ease: 'power2.out',
          },
          0.5
        );
      }

      return () => {
        tl.kill();
        if (masterTimelineRef.current === tl) {
          masterTimelineRef.current = null;
        }
      };
    },
    { dependencies: [node.id, canonicalTitle], revertOnUpdate: true }
  );

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="node-unlock-title"
      data-testid="node-unlock-overlay"
      data-node-subject={node.subject}
      onClick={handleDismiss}
      className="no-print fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#080B14]/80 p-6 backdrop-blur-3xl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col items-center text-center"
      >
        {/* Terminal Protocol Header Pill */}
        <div className="mb-6 inline-flex items-center gap-2 border-2 border-[#222B3D] bg-[#101522] px-3.5 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#5DE1D2] shadow-[6px_6px_0px_#000000]">
          <span className="inline-block h-2 w-2 bg-[#5DE1D2]" aria-hidden="true" />
          <span>{spec.accentLabel}</span>
          <span className="text-[#9274FF]">//</span>
          <span className="text-white">{node.nodeCode}</span>
        </div>

        {/* Step 1: High-Impact Geometric Artifact Slab */}
        <div
          ref={artifactRef}
          data-testid="node-unlock-artifact"
          className="flex h-44 w-44 items-center justify-center border-2 border-[#222B3D] bg-[#101522] shadow-[20px_20px_0px_#9274FF] will-change-transform sm:h-52 sm:w-52"
        >
          <NodeGeometricArtifactSvg
            subject={node.subject}
            primaryHex={spec.primaryHex}
            secondaryHex={spec.secondaryHex}
          />
        </div>

        {/* Step 2: Cryptographic Scramble Milestone Title */}
        <h2
          id="node-unlock-title"
          ref={titleContainerRef}
          data-testid="node-unlock-title"
          className="mt-10 font-mono text-xl font-extrabold tracking-wider text-white sm:text-3xl"
        >
          {scrambledTitle.split('').map((char, idx) => (
            <span
              key={idx}
              data-scramble-char="true"
              className="inline-block whitespace-pre"
            >
              {char}
            </span>
          ))}
        </h2>

        <p
          ref={subtitleRef}
          className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300"
        >
          {node.subtitle}
        </p>

        {node.metricBadge && (
          <div className="mt-4 border-2 border-[#222B3D] bg-[#101522] px-3 py-1 font-mono text-xs font-bold tracking-wider text-[#6FE0A1] shadow-[4px_4px_0px_#000000]">
            {node.metricBadge}
          </div>
        )}

        {/* Step 3: Pulsing Dismiss Prompt */}
        <button
          ref={promptRef}
          type="button"
          onClick={handleDismiss}
          data-testid="node-unlock-continue-btn"
          className="mt-12 border-2 border-[#5DE1D2] bg-[#101522] px-6 py-2.5 font-mono text-xs font-bold tracking-[0.22em] text-[#5DE1D2] shadow-[6px_6px_0px_#000000] transition-transform hover:-translate-y-0.5 focus:outline-none animate-pulse"
        >
          PRESS ENTER TO CONTINUE
        </button>
      </div>
    </div>
  );
};

export const NodeUnlockOverlay: React.FC = () => {
  const { activeNode, dismissActiveNode } = useNodeUnlock();

  if (!activeNode) {
    return null;
  }

  return <NodeUnlockStage key={activeNode.id} node={activeNode} onDismiss={dismissActiveNode} />;
};

export default NodeUnlockOverlay;
