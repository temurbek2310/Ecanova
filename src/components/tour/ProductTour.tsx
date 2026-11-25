'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import {
  areSameTourSteps,
  getPreferredTrack,
  getTourCopy,
  getTourStepOrder,
  isTourTargetMeasurable,
  markTourCompleted,
  resolveActiveSteps,
  resolveStepAfterRemoval,
  setPreferredTrack,
  TOUR_STEPS,
  type TourStepConfig,
  type TourStepId,
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

interface CardPlacement {
  top: number;
  left: number;
  centered: boolean;
  height: number;
}

const DESKTOP_CARD_WIDTH = 440;
const FALLBACK_CARD_HEIGHT = 320;
const MOBILE_BREAKPOINT = 768;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function queryTarget(selector: string | null): HTMLElement | null {
  if (!selector || typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  return el instanceof HTMLElement ? el : null;
}

/** A step is shown only when its target is mounted and has a real box (hidden ⇒ 0×0). */
function isStepTargetAvailable(step: TourStepConfig): boolean {
  const el = queryTarget(step.targetSelector);
  return el !== null && isTourTargetMeasurable(el.getBoundingClientRect());
}

/** Sticky / fixed targets (e.g. the header) never move when the page scrolls. */
function isPinnedToViewport(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const position = window.getComputedStyle(node).position;
    if (position === 'fixed' || position === 'sticky') return true;
    node = node.parentElement;
  }
  return false;
}

function sameRect(a: TargetRect | null, b: TargetRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rawCenterX === b.rawCenterX &&
    a.rawCenterY === b.rawCenterY
  );
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
  const titleId = useId();
  const descriptionId = useId();

  const [activeSteps, setActiveSteps] = useState<TourStepConfig[]>(() => [...TOUR_STEPS]);
  const [currentId, setCurrentId] = useState<TourStepId>('welcome');
  const [selectedTrack, setSelectedTrack] = useState<TourTrack | null>(() =>
    getPreferredTrack(userId)
  );
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardPos, setCardPos] = useState<CardPlacement>({
    top: 0,
    left: 0,
    centered: true,
    height: FALLBACK_CARD_HEIGHT,
  });

  const copy = useMemo(() => getTourCopy(locale), [locale]);
  const currentConfig = TOUR_STEPS[getTourStepOrder(currentId)] ?? TOUR_STEPS[0];
  const currentStepCopy = copy.steps[currentConfig.id];
  const stepPosition = Math.max(0, activeSteps.findIndex((s) => s.id === currentId));
  const stepIndex = stepPosition + 1;
  const totalSteps = Math.max(1, activeSteps.length);
  const isLastStep = stepPosition >= activeSteps.length - 1;

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  // Latest props/state for stable event handlers (no stale closures).
  const latest = useRef({
    userId,
    onClose,
    onComplete,
    onNavigateToCatalog,
    onScrollToTrack,
    selectedTrack,
    activeSteps,
    currentId,
  });
  latest.current = {
    userId,
    onClose,
    onComplete,
    onNavigateToCatalog,
    onScrollToTrack,
    selectedTrack,
    activeSteps,
    currentId,
  };

  /** Re-checks which steps have a visible target and returns the fresh list. */
  const refreshActiveSteps = useCallback((): TourStepConfig[] => {
    const next = resolveActiveSteps(isStepTargetAvailable);
    setActiveSteps((prev) => (areSameTourSteps(prev, next) ? prev : next));
    return next;
  }, []);

  // Reset on open: back to step 1, restore the saved track, measure which steps can be shown.
  useLayoutEffect(() => {
    if (!isOpen) return;
    setCurrentId('welcome');
    setSelectedTrack(getPreferredTrack(userId));
    refreshActiveSteps();
    // Targets may mount slightly later when the tour is replayed from another tab.
    const timers = [250, 600].map((delay) => window.setTimeout(refreshActiveSteps, delay));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [isOpen, userId, refreshActiveSteps]);

  // If the step on screen loses its target (e.g. catalog finished loading empty), move on.
  useEffect(() => {
    if (!isOpen) return;
    const resolved = resolveStepAfterRemoval(activeSteps, currentId);
    if (resolved !== currentId) setCurrentId(resolved);
  }, [isOpen, activeSteps, currentId]);

  // Focus management: move focus into the card, restore it on close.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => cardRef.current?.focus({ preventScroll: true }), 0);
    return () => {
      window.clearTimeout(timer);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  // Track target element location and place the card.
  const updatePositions = useCallback(() => {
    if (typeof window === 'undefined') return;
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    refreshActiveSteps();

    const cardH = cardRef.current?.offsetHeight || FALLBACK_CARD_HEIGHT;
    const centerCard = () => {
      setTargetRect((prev) => (prev === null ? prev : null));
      setCardPos({ top: 0, left: 0, centered: true, height: cardH });
    };

    const step = TOUR_STEPS[getTourStepOrder(latest.current.currentId)] ?? TOUR_STEPS[0];
    const el = queryTarget(step.targetSelector);
    if (!el) {
      centerCard();
      return;
    }

    const b = el.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    // No box, or a target that fills the screen: a spotlight would be meaningless.
    if (!isTourTargetMeasurable(b) || b.height > viewH * 0.85) {
      centerCard();
      return;
    }

    const padding = 8;
    const tRect: TargetRect = {
      x: Math.max(0, b.left - padding),
      y: Math.max(0, b.top - padding),
      width: Math.min(viewW, b.width + padding * 2),
      height: Math.min(viewH, b.height + padding * 2),
      rawCenterX: b.left + b.width / 2,
      rawCenterY: b.top + b.height / 2,
    };
    setTargetRect((prev) => (sameRect(prev, tRect) ? prev : tRect));

    if (mobile) {
      setCardPos({ top: 0, left: 0, centered: false, height: cardH });
      return;
    }

    // Desktop: place the card beside the target using its real measured height.
    const cardW = DESKTOP_CARD_WIDTH;
    const gap = 16;
    const spaceBelow = viewH - (tRect.y + tRect.height);
    const spaceAbove = tRect.y;
    const spaceRight = viewW - (tRect.x + tRect.width);
    const spaceLeft = tRect.x;

    let top = 0;
    let left = 0;
    let centered = false;

    if (spaceBelow >= cardH + gap) {
      top = tRect.y + tRect.height + gap;
      left = Math.max(gap, Math.min(viewW - cardW - gap, tRect.rawCenterX - cardW / 2));
    } else if (spaceAbove >= cardH + gap) {
      top = tRect.y - cardH - gap;
      left = Math.max(gap, Math.min(viewW - cardW - gap, tRect.rawCenterX - cardW / 2));
    } else if (spaceRight >= cardW + gap) {
      left = tRect.x + tRect.width + gap;
      top = Math.max(gap, Math.min(viewH - cardH - gap, tRect.rawCenterY - cardH / 2));
    } else if (spaceLeft >= cardW + gap) {
      left = tRect.x - cardW - gap;
      top = Math.max(gap, Math.min(viewH - cardH - gap, tRect.rawCenterY - cardH / 2));
    } else if (cardH + gap * 2 <= viewH) {
      // Nothing fits beside a large target: dock to the roomier edge rather than covering its centre.
      top = spaceBelow >= spaceAbove ? viewH - cardH - gap : gap;
      left = Math.max(gap, Math.min(viewW - cardW - gap, tRect.rawCenterX - cardW / 2));
    } else {
      centered = true;
    }

    setCardPos({ top, left, centered, height: cardH });
  }, [refreshActiveSteps]);

  // Bring the target into view on step change (above the bottom card on mobile).
  useEffect(() => {
    if (!isOpen) return;
    const el = queryTarget(currentConfig.targetSelector);
    if (el && !isPinnedToViewport(el)) {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      const viewH = window.innerHeight;
      const rect = el.getBoundingClientRect();
      const cardH = cardRef.current?.offsetHeight || FALLBACK_CARD_HEIGHT;
      const visibleBottom = mobile ? viewH - cardH - 20 : viewH - 24;
      const fitsOnScreen = rect.top >= 72 && rect.bottom <= visibleBottom;
      if (!fitsOnScreen && rect.height <= viewH * 0.85) {
        const desiredTop = mobile ? 84 : Math.max(88, (viewH - rect.height) / 2);
        window.scrollBy({
          top: rect.top - desiredTop,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }
    }
    const timer = window.setTimeout(updatePositions, prefersReducedMotion ? 20 : 180);
    return () => window.clearTimeout(timer);
  }, [isOpen, currentConfig, prefersReducedMotion, updatePositions]);

  // Window resize & scroll keep the spotlight attached to its target.
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

  // Step navigation (stable callbacks; read fresh values from `latest`).
  const dismiss = useCallback(() => {
    markTourCompleted(latest.current.userId);
    latest.current.onClose();
  }, []);

  const finish = useCallback(() => {
    const { userId: uid, selectedTrack: track } = latest.current;
    markTourCompleted(uid);
    latest.current.onClose();
    latest.current.onComplete?.(track);
    if (track && latest.current.onScrollToTrack) {
      latest.current.onScrollToTrack(track);
    } else if (latest.current.onNavigateToCatalog) {
      latest.current.onNavigateToCatalog();
    }
  }, []);

  const goNext = useCallback(() => {
    const fresh = refreshActiveSteps();
    const index = fresh.findIndex((s) => s.id === latest.current.currentId);
    // If the current step is gone, `index` is -1 and we land on the first remaining step.
    const next = fresh[index + 1];
    if (next) {
      setCurrentId(next.id);
    } else {
      finish();
    }
  }, [finish, refreshActiveSteps]);

  const goBack = useCallback(() => {
    const fresh = refreshActiveSteps();
    const index = fresh.findIndex((s) => s.id === latest.current.currentId);
    const previous = index > 0 ? fresh[index - 1] : undefined;
    if (previous) setCurrentId(previous.id);
  }, [refreshActiveSteps]);

  const handleSelectTrack = (track: TourTrack) => {
    setSelectedTrack(track);
    setPreferredTrack(track, userId);
  };

  // Keyboard: arrows navigate, Enter advances unless a control has focus, Esc skips, Tab is trapped.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
        return;
      }

      const card = cardRef.current;
      if (e.key === 'Tab' && card) {
        const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!card.contains(active) || active === card) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'Enter') {
        // Enter on a focused button/link activates that control natively.
        const active = document.activeElement;
        const onControl =
          active instanceof HTMLElement &&
          Boolean(card?.contains(active)) &&
          active !== card &&
          active.matches(FOCUSABLE_SELECTOR);
        if (!onControl) {
          e.preventDefault();
          goNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, dismiss, goNext, goBack]);

  if (!isOpen) return null;

  // Calculate SVG connector endpoints on desktop when the target is found
  let connectorStart: { x: number; y: number } | null = null;
  let connectorEnd: { x: number; y: number } | null = null;
  if (!isMobile && targetRect && !cardPos.centered) {
    const cardW = DESKTOP_CARD_WIDTH;
    const cardH = cardPos.height;
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
    .replace('{total}', String(totalSteps).padStart(2, '0'));

  const stepDescription =
    isMobile && currentStepCopy.mobileDescription
      ? currentStepCopy.mobileDescription
      : currentStepCopy.description;

  const tourPortalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-[90] pointer-events-auto select-none"
    >
      {/* 1. Backdrop Layer: a crisp dim (no blur, so the spotlighted target stays sharp). */}
      {targetRect ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
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
            className="fill-slate-950/45 dark:fill-slate-950/65"
          />
        </svg>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 bg-slate-950/45 dark:bg-slate-950/65"
          aria-hidden="true"
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

          {/* Telemetry Coordinate Pill (flips below the target when it hugs the top edge) */}
          <div
            className={`absolute left-0 inline-flex items-center gap-1.5 rounded-sm border border-amber-500/70 bg-slate-950/90 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest text-amber-300 shadow-sm backdrop-blur-md ${
              targetRect.y < 36 ? 'top-full mt-1.5' : '-top-7'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{copy.targetActive}</span>
          </div>
        </div>
      )}

      {/* 3. SVG Blueprint Dashed Connector Line (Desktop only) */}
      {connectorStart && connectorEnd && (
        <svg
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
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
        tabIndex={-1}
        data-testid="product-tour-hud-card"
        className={`pointer-events-auto outline-none transition-[top,left] duration-200 ${
          isMobile
            ? 'fixed inset-x-3 bottom-3 z-10 mx-auto max-w-lg'
            : cardPos.centered
            ? 'fixed top-1/2 left-1/2 z-10 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2'
            : 'fixed z-10 w-[440px]'
        }`}
        style={!isMobile && !cardPos.centered ? { top: cardPos.top, left: cardPos.left } : undefined}
      >
        <div className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/75 p-5 shadow-[8px_8px_0px_#9274FF] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/35">
          {/* Inner Interactive Dot Grid Background */}
          <InteractiveDotGrid testId="tour-hud-dot-grid" />

          {/* Foreground HUD Content (scrolls on short screens; the dot grid stays put) */}
          <div className="relative z-10 max-h-[calc(100dvh-4.5rem)] space-y-4 overflow-y-auto text-ink">
            {/* Telemetry Header */}
            <div className="flex items-center justify-between gap-3 border-b-2 border-theme-border pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-500 bg-white/55 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-theme-cyan backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/70">
                  <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                  <span data-testid="tour-hud-badge">{badgeText}</span>
                </span>
              </div>

              {/* Segmented Neobrutalist Progress (one bar per visible step) */}
              <div className="flex items-center gap-1" aria-hidden="true">
                {activeSteps.map((s, i) => (
                  <div
                    key={s.id}
                    className={`h-1.5 w-4 rounded-xs transition-all duration-200 sm:w-5 ${
                      i <= stepPosition
                        ? 'bg-[#9274FF] shadow-[0_0_6px_#9274FF]'
                        : 'bg-slate-400/50 dark:bg-slate-700/50'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={dismiss}
                data-testid="tour-hud-close-btn"
                aria-label={copy.closeLabel}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 border-slate-500 bg-white/55 text-slate-700 shadow-brutal-sm backdrop-blur-md transition-all hover:bg-slate-900/10 hover:border-slate-900 hover:text-slate-950 hover:shadow-[2px_2px_0px_#090D16] dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:text-muted dark:hover:border-theme-accent dark:hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Step Body (polite live region so screen readers hear the new step) */}
            <div className="space-y-1.5" aria-live="polite">
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] dark:text-[#5DE1D2]">
                {currentStepCopy.telemetryTag}
              </div>
              <h2 id={titleId} className="font-display text-base font-black tracking-tight text-ink sm:text-lg">
                {currentStepCopy.title}
              </h2>
              <p
                id={descriptionId}
                className="text-xs font-normal leading-relaxed text-slate-700 sm:text-sm dark:text-muted"
              >
                {stepDescription}
              </p>
            </div>

            {/* Step 1 Interactive Track Selection (compact 3-up on every width) */}
            {currentId === 'welcome' && (
              <div className="space-y-2 pt-1" data-testid="tour-track-selection-panel">
                <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-muted">
                  {copy.trackSelectionPrompt}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['Economics', 'Mathematics', 'Business'] as const).map((track) => {
                    const isSelected = selectedTrack === track;
                    const trackMeta = copy.tracks[track];
                    return (
                      <button
                        key={track}
                        type="button"
                        aria-pressed={isSelected}
                        data-testid={`tour-track-select-${track.toLowerCase()}`}
                        onClick={() => handleSelectTrack(track)}
                        className={`group relative flex flex-col justify-between rounded-lg border-2 p-2.5 text-left backdrop-blur-md transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-400/20 text-ink shadow-[3px_3px_0px_#F59E0B] dark:border-[#5DE1D2] dark:bg-[#5DE1D2]/15 dark:shadow-[3px_3px_0px_#5DE1D2]'
                            : 'border-slate-500 bg-white/55 text-slate-700 hover:border-slate-900 hover:bg-slate-900/10 hover:text-slate-950 hover:shadow-[2px_2px_0px_#090D16] dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:text-muted dark:hover:border-slate-600 dark:hover:text-ink'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <span className="font-display text-xs font-black text-ink">{trackMeta.label}</span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-[#5DE1D2]" aria-hidden="true" />
                          )}
                        </div>
                        <span className="mt-1 hidden text-[10px] leading-tight text-slate-700 sm:line-clamp-2 sm:block dark:text-muted">
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
                onClick={dismiss}
                data-testid="tour-hud-skip-btn"
                className="px-1 py-1 text-xs font-semibold text-slate-700 transition-colors hover:text-slate-950 dark:text-muted dark:hover:text-ink"
              >
                {copy.skip}
              </button>

              <div className="flex items-center gap-2">
                {stepPosition > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    data-testid="tour-hud-back-btn"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 border-slate-500 bg-white/55 px-3 py-1.5 text-xs font-bold text-ink shadow-brutal-sm backdrop-blur-md transition-all hover:bg-slate-900/10 hover:border-slate-900 hover:text-slate-950 hover:shadow-[3px_3px_0px_#090D16] dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:text-ink"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.back}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={goNext}
                  data-testid="tour-hud-next-btn"
                  className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-1.5 text-xs font-black text-theme-accent-ink shadow-[3px_3px_0px_#9274FF] transition-all hover:bg-accent-hover hover:border-slate-900 hover:shadow-[4px_4px_0px_#9274FF] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <span>{isLastStep ? copy.finish : copy.next}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Desktop Keyboard Hints */}
            {!isMobile && (
              <div className="flex items-center justify-end pt-0.5 font-mono text-[10px] text-slate-700 dark:text-muted">
                <span>{copy.keyHints}</span>
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
