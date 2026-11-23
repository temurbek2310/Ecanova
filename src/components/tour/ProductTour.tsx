'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Compass, Sparkles, X } from 'lucide-react';
import {
  clampTourStep,
  getPreferredTrack,
  getTourCopy,
  markTourCompleted,
  setPreferredTrack,
  TOTAL_TOUR_STEPS,
  TOUR_STEPS,
  type TourTrack,
} from '../../lib/product-tour';
import { InteractiveDotGrid } from '../ui/InteractiveDotGrid';

export interface ProductTourProps {
  isOpen: boolean;
  locale: string;
  userId?: string | null;
  onClose: () => void;
  onComplete?: (preferredTrack: TourTrack | null) => void;
  onNavigateToCatalog?: () => void;
  onScrollToTrack?: (track: TourTrack) => void;
}

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rawCenterX: number;
  rawCenterY: number;
}

export const ProductTour: React.FC<ProductTourProps> = ({
  isOpen,
  locale,
  userId,
  onClose,
  onComplete,
  onNavigateToCatalog,
  onScrollToTrack,
}) => {
  const [stepIndex, setStepIndex] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<TourTrack | null>(() => getPreferredTrack());
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; centered: boolean }>({
    top: 0,
    left: 0,
    centered: true,
  });

  const copy = useMemo(() => getTourCopy(locale), [locale]);
  const currentConfig = TOUR_STEPS[stepIndex - 1] ?? TOUR_STEPS[0];
  const currentStepCopy = copy.steps[currentConfig.id];

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  // Reset to Step 1 on open
  useEffect(() => {
    if (isOpen) {
      setStepIndex(1);
      const saved = getPreferredTrack();
      if (saved) setSelectedTrack(saved);
    }
  }, [isOpen]);

  // Track target element location on step change, resize, and scroll
  const updatePositions = useCallback(() => {
    if (typeof window === 'undefined') return;
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);

    const selector = currentConfig.targetSelector;
    if (!selector) {
      setTargetRect(null);
      setCardPos({ top: 0, left: 0, centered: true });
      return;
    }

    const el = document.querySelector(selector);
    if (!el || !(el instanceof HTMLElement)) {
      setTargetRect(null);
      setCardPos({ top: 0, left: 0, centered: true });
      return;
    }

    const b = el.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) {
      setTargetRect(null);
      setCardPos({ top: 0, left: 0, centered: true });
      return;
    }

    const padding = 8;
    const tRect: TargetRect = {
      x: Math.max(0, b.left - padding),
      y: Math.max(0, b.top - padding),
      width: Math.min(window.innerWidth, b.width + padding * 2),
      height: Math.min(window.innerHeight, b.height + padding * 2),
      rawCenterX: b.left + b.width / 2,
      rawCenterY: b.top + b.height / 2,
    };
    setTargetRect(tRect);

    if (mobile) {
      setCardPos({ top: 0, left: 0, centered: false });
      return;
    }

    // Desktop positioning: calculate best placement near target
    const cardW = 440;
    const cardH = 320;
    const gap = 16;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    const spaceBelow = viewH - (tRect.y + tRect.height);
    const spaceAbove = tRect.y;
    const spaceRight = viewW - (tRect.x + tRect.width);
    const spaceLeft = tRect.x;

    let computedTop = 0;
    let computedLeft = 0;
    let centered = false;

    if (spaceBelow >= cardH + gap) {
      computedTop = tRect.y + tRect.height + gap;
      computedLeft = Math.max(gap, Math.min(viewW - cardW - gap, tRect.rawCenterX - cardW / 2));
    } else if (spaceAbove >= cardH + gap) {
      computedTop = tRect.y - cardH - gap;
      computedLeft = Math.max(gap, Math.min(viewW - cardW - gap, tRect.rawCenterX - cardW / 2));
    } else if (spaceRight >= cardW + gap) {
      computedLeft = tRect.x + tRect.width + gap;
      computedTop = Math.max(gap, Math.min(viewH - cardH - gap, tRect.rawCenterY - cardH / 2));
    } else if (spaceLeft >= cardW + gap) {
      computedLeft = tRect.x - cardW - gap;
      computedTop = Math.max(gap, Math.min(viewH - cardH - gap, tRect.rawCenterY - cardH / 2));
    } else {
      centered = true;
    }

    setCardPos({ top: computedTop, left: computedLeft, centered });
  }, [currentConfig]);

  // Scroll target element smoothly into view on step change
  useEffect(() => {
    if (!isOpen) return;
    const selector = currentConfig.targetSelector;
    if (selector) {
      const el = document.querySelector(selector);
      if (el && el instanceof HTMLElement) {
        el.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }
    const timer = window.setTimeout(() => updatePositions(), prefersReducedMotion ? 20 : 180);
    return () => window.clearTimeout(timer);
  }, [isOpen, currentConfig, prefersReducedMotion, updatePositions]);

  // Event listeners for window resize & scroll
  useEffect(() => {
    if (!isOpen) return;
    let rafId: number | null = null;
    const handleScrollOrResize = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(updatePositions);
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    updatePositions();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePositions]);

  // Step navigation
  const handleNext = () => {
    if (stepIndex < TOTAL_TOUR_STEPS) {
      setStepIndex((s) => clampTourStep(s + 1));
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (stepIndex > 1) {
      setStepIndex((s) => clampTourStep(s - 1));
    }
  };

  const handleDismiss = () => {
    markTourCompleted(userId);
    onClose();
  };

  const handleComplete = () => {
    markTourCompleted(userId);
    onClose();
    if (onComplete) {
      onComplete(selectedTrack);
    }
    if (selectedTrack && onScrollToTrack) {
      onScrollToTrack(selectedTrack);
    } else if (onNavigateToCatalog) {
      onNavigateToCatalog();
    }
  };

  const handleSelectTrack = (track: TourTrack) => {
    setSelectedTrack(track);
    setPreferredTrack(track);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stepIndex, selectedTrack]);

  if (!isOpen) return null;

  // Calculate SVG connector endpoints on Desktop when target is found
  let connectorStart: { x: number; y: number } | null = null;
  let connectorEnd: { x: number; y: number } | null = null;
  if (!isMobile && targetRect && !cardPos.centered) {
    const cardW = 440;
    const cardH = 320;
    const cardCenter = { x: cardPos.left + cardW / 2, y: cardPos.top + cardH / 2 };

    // Start anchor at target border closest to card
    if (cardCenter.y > targetRect.y + targetRect.height) {
      connectorStart = { x: targetRect.rawCenterX, y: targetRect.y + targetRect.height };
      connectorEnd = { x: cardCenter.x, y: cardPos.top };
    } else if (cardCenter.y < targetRect.y) {
      connectorStart = { x: targetRect.rawCenterX, y: targetRect.y };
      connectorEnd = { x: cardCenter.x, y: cardPos.top + cardH };
    } else if (cardCenter.x > targetRect.x + targetRect.width) {
      connectorStart = { x: targetRect.x + targetRect.width, y: targetRect.rawCenterY };
      connectorEnd = { x: cardPos.left, y: cardCenter.y };
    } else {
      connectorStart = { x: targetRect.x, y: targetRect.rawCenterY };
      connectorEnd = { x: cardPos.left + cardW, y: cardCenter.y };
    }
  }

  const badgeText = copy.badgeTemplate
    .replace('{current}', String(stepIndex).padStart(2, '0'))
    .replace('{total}', String(TOTAL_TOUR_STEPS).padStart(2, '0'));

  const tourPortalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Product Tour HUD"
      className="fixed inset-0 z-[90] pointer-events-auto select-none"
    >
      {/* 1. Backdrop Layer */}
      {targetRect ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <mask id="econova-tour-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.x}
                y={targetRect.y}
                width={targetRect.width}
                height={targetRect.height}
                rx="14"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            mask="url(#econova-tour-spotlight-mask)"
            className="fill-slate-950/45 dark:fill-slate-950/65 backdrop-blur-[2px] transition-colors duration-200"
          />
        </svg>
      ) : (
        <div
          className="absolute inset-0 bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-[2px] transition-opacity duration-200"
          onClick={handleDismiss}
        />
      )}

      {/* 2. Blueprint Corner Reticle & Telemetry Tag around spotlight cutout */}
      {targetRect && (
        <div
          className="pointer-events-none absolute transition-all duration-200"
          style={{
            top: targetRect.y,
            left: targetRect.x,
            width: targetRect.width,
            height: targetRect.height,
          }}
          aria-hidden="true"
        >
          {/* Corner Brackets */}
          <span className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 border-t-2 border-l-2 border-amber-400" />
          <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 border-t-2 border-r-2 border-amber-400" />
          <span className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 border-b-2 border-l-2 border-[#9274FF]" />
          <span className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 border-b-2 border-r-2 border-[#9274FF]" />

          {/* Telemetry Coordinate Pill */}
          <div className="absolute -top-7 left-0 inline-flex items-center gap-1.5 rounded-sm border border-amber-500/70 bg-slate-950/90 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest text-amber-300 shadow-sm backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{copy.targetActive}</span>
          </div>
        </div>
      )}

      {/* 3. SVG Blueprint Dashed Connector Line (Desktop only) */}
      {connectorStart && connectorEnd && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full hidden md:block"
          aria-hidden="true"
        >
          <line
            x1={connectorStart.x}
            y1={connectorStart.y}
            x2={connectorEnd.x}
            y2={connectorEnd.y}
            stroke="#9274FF"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.85"
          />
          <circle cx={connectorStart.x} cy={connectorStart.y} r="4" fill="#F59E0B" />
          <circle cx={connectorEnd.x} cy={connectorEnd.y} r="3.5" fill="#9274FF" />
        </svg>
      )}

      {/* 4. Glass-Brutalist Architectural HUD Tour Card */}
      <div
        ref={cardRef}
        data-testid="product-tour-hud-card"
        className={`pointer-events-auto transition-all duration-200 ${
          isMobile
            ? 'fixed inset-x-3 bottom-3 max-w-lg mx-auto z-10'
            : cardPos.centered
            ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[460px] z-10'
            : 'fixed w-[440px] z-10'
        }`}
        style={!isMobile && !cardPos.centered ? { top: cardPos.top, left: cardPos.left } : undefined}
      >
        <div className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/30 p-5 shadow-[8px_8px_0px_#9274FF] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/35">
          {/* Inner Interactive Dot Grid Background */}
          <InteractiveDotGrid testId="tour-hud-dot-grid" />

          {/* Foreground HUD Content */}
          <div className="relative z-10 space-y-4 text-ink">
            {/* Telemetry Header */}
            <div className="flex items-center justify-between gap-3 border-b-2 border-theme-border pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-500 bg-white/55 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-theme-cyan backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/70">
                  <Sparkles className="h-3 w-3 text-amber-400" aria-hidden="true" />
                  <span>{badgeText}</span>
                </span>
              </div>

              {/* Segmented Neobrutalist 5-Bar Progress */}
              <div className="flex items-center gap-1" aria-hidden="true">
                {TOUR_STEPS.map((s) => (
                  <div
                    key={s.id}
                    className={`h-1.5 w-4 sm:w-5 rounded-xs transition-all duration-200 ${
                      s.stepNumber <= stepIndex
                        ? 'bg-[#9274FF] shadow-[0_0_6px_#9274FF]'
                        : 'bg-slate-400/40 dark:bg-slate-700/50'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                data-testid="tour-hud-close-btn"
                aria-label="Close tour"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 border-slate-500 bg-white/55 text-muted shadow-brutal-sm backdrop-blur-md transition-all hover:bg-slate-900/10 hover:border-slate-900 hover:text-slate-950 hover:shadow-[2px_2px_0px_#090D16] dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Step Body */}
            <div className="space-y-1.5">
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#9274FF] dark:text-[#5DE1D2]">
                {currentStepCopy.telemetryTag}
              </div>
              <h2 className="font-display text-base sm:text-lg font-black tracking-tight text-ink">
                {currentStepCopy.title}
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed text-muted font-normal">
                {currentStepCopy.description}
              </p>
            </div>

            {/* Step 1 Interactive Track Selection */}
            {stepIndex === 1 && (
              <div className="space-y-2 pt-1" data-testid="tour-track-selection-panel">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
                  {copy.trackSelectionPrompt}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(['Economics', 'Mathematics', 'Business'] as const).map((track) => {
                    const isSelected = selectedTrack === track;
                    const trackMeta = copy.tracks[track];
                    return (
                      <button
                        key={track}
                        type="button"
                        data-testid={`tour-track-select-${track.toLowerCase()}`}
                        onClick={() => handleSelectTrack(track)}
                        className={`group relative flex flex-col justify-between rounded-lg border-2 p-2.5 text-left transition-all backdrop-blur-md ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/15 text-ink shadow-[3px_3px_0px_#F59E0B] dark:border-[#5DE1D2] dark:bg-[#5DE1D2]/15 dark:shadow-[3px_3px_0px_#5DE1D2]'
                            : 'border-slate-500 bg-white/55 text-muted hover:border-slate-900 hover:text-slate-950 hover:bg-slate-900/10 hover:shadow-[2px_2px_0px_#090D16] dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-slate-600 dark:hover:text-ink'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-display text-xs font-black text-ink">
                            {trackMeta.label}
                          </span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-amber-500 dark:text-[#5DE1D2]" />
                          )}
                        </div>
                        <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted">
                          {trackMeta.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Navigation Controls */}
            <div className="flex items-center justify-between gap-2 border-t-2 border-theme-border pt-3">
              <button
                type="button"
                onClick={handleDismiss}
                data-testid="tour-hud-skip-btn"
                className="text-xs font-semibold text-muted hover:text-slate-950 dark:hover:text-ink transition-colors px-1 py-1"
              >
                {copy.skip}
              </button>

              <div className="flex items-center gap-2">
                {stepIndex > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    data-testid="tour-hud-back-btn"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 border-slate-500 bg-white/55 px-3 py-1.5 text-xs font-bold text-ink shadow-brutal-sm backdrop-blur-md transition-all hover:bg-slate-900/10 hover:border-slate-900 hover:text-slate-950 hover:shadow-[3px_3px_0px_#090D16] dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:text-ink"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.back}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  data-testid="tour-hud-next-btn"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-1.5 text-xs font-black text-theme-accent-ink shadow-[3px_3px_0px_#9274FF] transition-all hover:bg-accent-hover hover:border-slate-900 hover:shadow-[4px_4px_0px_#9274FF] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap"
                >
                  <span>{stepIndex === TOTAL_TOUR_STEPS ? copy.finish : copy.next}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Desktop Keyboard Hints Pill */}
            {!isMobile && (
              <div className="flex items-center justify-end gap-2 text-[10px] font-mono text-muted pt-0.5">
                <span>[← / →]</span>
                <span>[ESC {copy.skip}]</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(tourPortalContent, document.body);
};
