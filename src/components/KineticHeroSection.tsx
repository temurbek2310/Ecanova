import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Share2, Sparkles } from 'lucide-react';
import { buildKineticHeroConfig } from '../lib/kinetic-hero';
import { t } from '../lib/i18n';
import type { LocaleCode } from '../shared/types';
import { FloatingWatermark } from './FloatingWatermark';

gsap.registerPlugin(ScrollTrigger);

interface KineticHeroSectionProps {
  locale: LocaleCode;
  isAuthenticated: boolean;
  sharingProgress: boolean;
  shareFeedback: string | null;
  activeCoursesCount: number;
  currentStreak: number;
  totalXp: number;
  certificatesCount: number;
  streakPopActive?: boolean;
  onExploreCatalog: () => void;
  onSignIn: () => void;
  onShareProgress: () => void;
}

export const KineticHeroSection: React.FC<KineticHeroSectionProps> = ({
  locale,
  isAuthenticated,
  sharingProgress,
  shareFeedback,
  activeCoursesCount,
  currentStreak,
  totalXp,
  certificatesCount,
  streakPopActive = false,
  onExploreCatalog,
  onSignIn,
  onShareProgress,
}) => {
  const strings = t(locale);
  const heroRef = useRef<HTMLElement | null>(null);
  const line1Ref = useRef<HTMLDivElement | null>(null);
  const line2Ref = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const kineticConfig = buildKineticHeroConfig(locale, prefersReducedMotion);

  useLayoutEffect(() => {
    const heroEl = heroRef.current;
    const line1El = line1Ref.current;
    const line2El = line2Ref.current;
    const subtitleEl = subtitleRef.current;
    if (!heroEl || !line1El || !line2El) return;

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cfg = buildKineticHeroConfig(locale, reduced);

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set([line1El, line2El], { xPercent: 0, y: 0, scale: 1 });
        return;
      }

      const first = cfg.lines[0]!;
      const second = cfg.lines[1]!;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroEl,
          start: 'top top+=72',
          end: 'bottom top+=60',
          scrub: cfg.scrubFactor,
          invalidateOnRefresh: true,
        },
      });

      tl.to(
        line1El,
        {
          xPercent: first.scrollTranslateXPercent,
          y: first.scrollTranslateY,
          scale: first.scrollScale,
          transformOrigin: 'left center',
          ease: 'none',
        },
        0
      ).to(
        line2El,
        {
          xPercent: second.scrollTranslateXPercent,
          y: second.scrollTranslateY,
          scale: second.scrollScale,
          transformOrigin: 'left center',
          ease: 'none',
        },
        0
      );

      if (subtitleEl) {
        tl.to(
          subtitleEl,
          {
            y: -10,
            opacity: 0.88,
            ease: 'none',
          },
          0
        );
      }
    }, heroEl);

    return () => ctx.revert();
  }, [locale]);

  const line1 = kineticConfig.lines[0]!;
  const line2 = kineticConfig.lines[1]!;

  return (
    <section
      ref={heroRef}
      data-testid="kinetic-hero-section"
      className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 p-6 shadow-[8px_8px_0px_#9274FF] backdrop-blur-2xl sm:p-8 lg:p-10 dark:border-[#222B3D] dark:bg-[#101522]/40"
    >
      {/* Subtle Architectural Grid Accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20 bg-arch-grid"
      />

      <FloatingWatermark
        theme="analytics"
        seedIndex={3}
        count={4}
        testId="hero-floating-watermark"
      />

      <div className="relative z-10 max-w-4xl">
        {/* Academic Discipline Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-md border-2 border-slate-500 bg-white/55 px-3 py-1 font-mono text-[11px] font-semibold tracking-wider text-teal shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
          <Sparkles className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
          <span>{kineticConfig.badgeLabel}</span>
        </div>

        {/* Kinetic Typography Display Stack */}
        <div
          aria-label={strings.heroTitle}
          className="mt-5 space-y-1 overflow-hidden py-1 select-none"
        >
          <div
            ref={line1Ref}
            data-testid="kinetic-hero-line-1"
            className="will-change-transform font-display text-3xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl leading-[1.04]"
          >
            <span>{line1.primaryText}</span>{' '}
            <span className="inline-block rounded-md border-2 border-slate-500 bg-white/60 px-2.5 py-0.5 text-theme-accent shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/65">
              {line1.accentText}
            </span>
          </div>

          <div
            ref={line2Ref}
            data-testid="kinetic-hero-line-2"
            className="will-change-transform font-display text-3xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl leading-[1.04]"
          >
            <span className="text-muted">{line2.primaryText}</span>{' '}
            <span className="underline decoration-theme-accent decoration-4 underline-offset-8">
              {line2.accentText}
            </span>
          </div>
        </div>

        {/* Semantic H1 + Editorial Lead Copy */}
        <h1 className="mt-4 font-display text-lg font-bold tracking-tight text-ink sm:text-xl [text-wrap:balance]">
          {strings.heroTitle}
        </h1>

        <p
          ref={subtitleRef}
          className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base"
        >
          {strings.heroSubtitle}
        </p>

        {/* Tactile Neobrutalist Action Row */}
        <div className="mt-7 flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={onExploreCatalog}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-accent px-5 py-2.5 text-sm font-bold text-theme-accent-ink shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-accent-hover"
          >
            <span>{strings.browseCatalog}</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>

          {!isAuthenticated && (
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[44px] rounded-lg border-2 border-theme-border bg-theme-base px-5 py-2.5 text-sm font-semibold text-ink shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:border-theme-accent"
            >
              {strings.signIn}
            </button>
          )}

          <button
            type="button"
            disabled={sharingProgress}
            onClick={onShareProgress}
            data-testid="share-progress-button"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-base px-4 py-2.5 text-sm font-semibold text-ink shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:border-teal disabled:opacity-60"
          >
            <Share2 className="h-4 w-4 text-teal" aria-hidden="true" />
            <span>
              {sharingProgress
                ? strings.shareProgress.sharing
                : strings.shareProgress.buttonLabel}
            </span>
          </button>
        </div>

        {shareFeedback && (
          <p
            role="status"
            aria-live="polite"
            data-testid="share-progress-feedback"
            className="mt-3 text-xs font-medium text-teal"
          >
            {shareFeedback}
          </p>
        )}
      </div>

      {/* Learner Telemetry Strip (when authenticated) */}
      {isAuthenticated && (
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 border-t-2 border-theme-border pt-6 sm:grid-cols-4">
          <div className="rounded-lg border-2 border-slate-500 bg-white/55 p-3.5 shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
            <div className="text-xs font-medium text-muted">
              {strings.kinetic.telemetry.activeCourses}
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-ink">
              {activeCoursesCount}
            </div>
          </div>
          <div
            className={`rounded-lg border-2 border-slate-500 bg-white/55 p-3.5 shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60 ${
              streakPopActive ? 'animate-milestone-pop ring-2 ring-teal' : ''
            }`}
          >
            <div className="text-xs font-medium text-muted">
              {strings.kinetic.telemetry.studyStreak}
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-teal">
              {currentStreak}
              {strings.kinetic.telemetry.daysUnit}
            </div>
          </div>
          <div className="rounded-lg border-2 border-slate-500 bg-white/55 p-3.5 shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
            <div className="text-xs font-medium text-muted">
              {strings.kinetic.telemetry.nonCashXp}
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-warning">
              {totalXp} XP
            </div>
          </div>
          <div className="rounded-lg border-2 border-slate-500 bg-white/55 p-3.5 shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
            <div className="text-xs font-medium text-muted">
              {strings.kinetic.telemetry.certificates}
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-success">
              {certificatesCount}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
