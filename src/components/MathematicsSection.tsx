'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  CloudOff,
  Compass,
  Loader2,
  Sigma,
} from 'lucide-react';
import { MagneticCourseCard } from './MagneticCourseCard';
import { isCourseBookmarked } from '../lib/course-bookmarks';
import { formatCourseMetaSummary, t } from '../lib/i18n';
import {
  buildMathematicsChalkBlueprints,
  computeChalkStrokeDrawState,
  resolveMathGrainOverlayProps,
} from '../lib/mathematics-chalk';
import {
  resolveCourseOfflineStatus,
  type CourseOfflineStatus,
  type ServiceWorkerAvailability,
} from '../lib/offline-cache';
import {
  observeDocumentTheme,
  readActiveDocumentTheme,
  type ThemeMode,
} from '../lib/theme';
import type {
  CourseCatalogItem,
  EnrollmentRecord,
  LocaleCode,
} from '../shared/types';

gsap.registerPlugin(ScrollTrigger);

interface MathematicsSectionProps {
  locale: LocaleCode;
  courses: CourseCatalogItem[];
  enrollments: EnrollmentRecord[];
  bookmarkedCourseIds: string[];
  bookmarkBusyId: string | null;
  swStatus: ServiceWorkerAvailability;
  cachedEditionKeys: Set<string>;
  onOpenCourse: (courseId: string, locale: LocaleCode) => void;
  onToggleBookmark: (courseId: string) => void;
}

/**
 * Mathematics "Precision & The Human Touch" Section for ECONOVA.
 * Contrasts the Neobrutalist UI shell (`bg-theme-panel`, `border-theme-border`, `shadow-brutal`)
 * with a dynamic CSS grain/noise overlay (`mix-blend-screen` in dark mode, `mix-blend-multiply` in light mode)
 * and chalkboard inline SVG diagrams that dynamically inherit the active theme's stroke colors
 * while physically drawing themselves on scroll via GSAP `stroke-dashoffset` timelines.
 */
export const MathematicsSection: React.FC<MathematicsSectionProps> = ({
  locale,
  courses,
  enrollments,
  bookmarkedCourseIds,
  bookmarkBusyId,
  swStatus,
  cachedEditionKeys,
  onOpenCourse,
  onToggleBookmark,
}) => {
  const strings = t(locale);
  const isUz = locale === 'uz';
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeTheme, setActiveTheme] = useState<ThemeMode>(() => readActiveDocumentTheme());

  useEffect(() => {
    setActiveTheme(readActiveDocumentTheme());
    return observeDocumentTheme((nextTheme) => {
      setActiveTheme(nextTheme);
    });
  }, []);

  const grainOverlay = useMemo(
    () => resolveMathGrainOverlayProps(activeTheme),
    [activeTheme]
  );

  const mathCourses = useMemo(
    () => courses.filter((c) => c.subject === 'Mathematics'),
    [courses]
  );

  const chalkBlueprints = useMemo(
    () => buildMathematicsChalkBlueprints(locale),
    [locale]
  );

  useLayoutEffect(() => {
    const rootEl = sectionRef.current;
    if (!rootEl || typeof window === 'undefined') return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const pathEls = gsap.utils.toArray<SVGPathElement>('path.math-chalk-stroke', rootEl);
      if (pathEls.length === 0) return;

      // Measure exact SVG path lengths (or fallback) and prime initial strokeDasharray/strokeDashoffset
      for (const pathEl of pathEls) {
        const fallbackLen = Number(pathEl.getAttribute('data-fallback-length') || 240);
        let measuredLen = fallbackLen;
        try {
          const total = pathEl.getTotalLength();
          if (Number.isFinite(total) && total > 0) {
            measuredLen = total;
          }
        } catch {
          measuredLen = fallbackLen;
        }

        const initial = computeChalkStrokeDrawState(
          measuredLen,
          prefersReducedMotion ? 1 : 0
        );
        pathEl.style.strokeDasharray = initial.strokeDasharray;
        pathEl.style.strokeDashoffset = String(initial.strokeDashoffset);
      }

      if (prefersReducedMotion) return;

      const cards = gsap.utils.toArray<HTMLElement>('[data-chalk-card]', rootEl);
      for (const card of cards) {
        const strokes = card.querySelectorAll<SVGPathElement>('path.math-chalk-stroke');
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: card,
            start: 'top 86%',
            end: 'bottom 35%',
            toggleActions: 'play none none reverse',
          },
        });

        strokes.forEach((strokeEl) => {
          const duration = Number(strokeEl.getAttribute('data-duration') || 0.65);
          const delay = Number(strokeEl.getAttribute('data-delay') || 0);
          tl.to(
            strokeEl,
            {
              strokeDashoffset: 0,
              duration,
              ease: 'power2.out',
            },
            delay
          );
        });
      }

      // Header underline scribble draw
      const headerUnderline = rootEl.querySelector<SVGPathElement>(
        'path[data-testid="math-header-scribble-path"]'
      );
      if (headerUnderline) {
        let len = 260;
        try {
          const raw = headerUnderline.getTotalLength();
          if (Number.isFinite(raw) && raw > 0) len = raw;
        } catch {
          len = 260;
        }
        const init = computeChalkStrokeDrawState(len, 0);
        headerUnderline.style.strokeDasharray = init.strokeDasharray;
        headerUnderline.style.strokeDashoffset = String(init.strokeDashoffset);

        gsap.to(headerUnderline, {
          strokeDashoffset: 0,
          duration: 0.9,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: rootEl,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        });
      }
    }, rootEl);

    return () => ctx.revert();
  }, [locale, chalkBlueprints]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="mathematics-section-heading"
      data-testid="mathematics-section"
      data-active-theme={activeTheme}
      className="relative z-10 overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
    >
      {/* Tactile CSS Grain / Chalk Dust Overlay (programmatically switches mix-blend-screen vs mix-blend-multiply) */}
      <div
        aria-hidden="true"
        data-testid="mathematics-grain-overlay"
        data-blend-mode={grainOverlay.blendMode}
        className={`pointer-events-none absolute inset-0 z-0 bg-chalk-dust ${grainOverlay.opacityClass} ${grainOverlay.mixBlendClass}`}
      />

      {/* Chalkboard SVG Filter Definition for Organic Hand-Drawn Edge Texture */}
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
        <defs>
          <filter id="econova-chalk-roughen" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="2"
              result="chalkNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="chalkNoise"
              scale="1.15"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className="relative z-10 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col gap-3 border-b-2 border-theme-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-theme-amber shadow-brutal-sm">
              <Compass className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
              <span>
                {isUz
                  ? 'ANIQLIK VA INSONIY YONDASHUV · CHALK DRAW-SVG'
                  : 'PRECISION & THE HUMAN TOUCH · CHALKBOARD SVG'}
              </span>
            </div>

            <h2
              id="mathematics-section-heading"
              className="mt-2.5 flex flex-wrap items-center gap-2.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl"
            >
              <Sigma className="h-5 w-5 text-theme-accent shrink-0" aria-hidden="true" />
              <span className="relative inline-block">
                {isUz
                  ? 'Matematika: Analitik hosila, integral va optimallashtirish'
                  : 'Mathematics: Calculus, Linear Systems & Constrained Optima'}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 260 12"
                  className="mt-1 h-2.5 w-full max-w-[260px] overflow-visible text-theme-accent"
                >
                  <path
                    data-testid="math-header-scribble-path"
                    d="M 2 8 Q 78 2, 152 7 T 256 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="stroke-current"
                  />
                </svg>
              </span>
            </h2>

            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted sm:text-sm">
              {isUz
                ? 'Qora doskadagi jonli chizmalar orqali hosila urinmasi, Riman yig‘indilari va Lagranj ko‘paytuvchilari mantiqini his eting.'
                : 'Hand-drawn chalkboard proofs and geometric sketches that physically draw onto the slate as you scroll through each quantitative concept.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-[11px] font-semibold text-theme-amber shadow-brutal-sm">
              <span className="h-2 w-2 rounded-full bg-theme-amber" aria-hidden="true" />
              <span>{strings.mathematics.badgeChalkSvg}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-[11px] font-semibold text-theme-accent shadow-brutal-sm">
              <span className="h-2 w-2 rounded-full bg-theme-accent" aria-hidden="true" />
              <span>{strings.mathematics.badgeDrawSvg}</span>
            </span>
          </div>
        </div>

        {/* Chalkboard Sketch Diagrams Grid (GSAP stroke-dashoffset Draw-On-Scroll) */}
        <div
          data-testid="mathematics-chalkboard-grid"
          className="grid gap-4 md:grid-cols-3"
        >
          {chalkBlueprints.map((bp) => (
            <div
              key={bp.id}
              data-chalk-card={bp.id}
              data-testid={`math-chalk-card-${bp.id}`}
              className="relative flex flex-col justify-between overflow-hidden rounded-xl border-2 border-slate-500 bg-white/50 p-4 shadow-brutal-sm backdrop-blur-xl dark:border-[#222B3D] dark:bg-[#080B14]/55"
            >
              {/* Subtle Chalkboard Grid & Grain */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 bg-arch-grid-sm ${grainOverlay.opacityClass} ${grainOverlay.mixBlendClass}`}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xs font-bold text-ink">
                    {bp.title}
                  </span>
                  <span className="rounded border border-slate-500 dark:border-[#222B3D] bg-white/30 dark:bg-[#101522]/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-theme-cyan">
                    {bp.formulaLatex}
                  </span>
                </div>

                {/* Inline Chalkboard SVG Canvas */}
                <div className="mt-3 overflow-hidden rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-theme-chrome/70 p-2">
                  <svg
                    viewBox={bp.viewBox}
                    role="img"
                    aria-label={`${bp.title}: ${bp.formulaLatex}`}
                    className="h-36 w-full text-theme-ink"
                    style={{ filter: 'url(#econova-chalk-roughen)' }}
                  >
                    {bp.strokes.map((stroke) => (
                      <path
                        key={stroke.id}
                        data-testid={`chalk-stroke-${stroke.id}`}
                        data-fallback-length={stroke.fallbackLength}
                        data-duration={stroke.duration}
                        data-delay={stroke.delay}
                        d={stroke.d}
                        fill="none"
                        stroke={stroke.color}
                        strokeWidth={stroke.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`math-chalk-stroke ${stroke.strokeClassName}`}
                      />
                    ))}
                  </svg>
                </div>
              </div>

              <p className="relative z-10 mt-2.5 text-[11px] leading-relaxed text-muted">
                {bp.caption}
              </p>
            </div>
          ))}
        </div>

        {/* Mathematics Curriculum Cards */}
        {mathCourses.length === 0 ? (
          <div className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/45 dark:bg-[#080B14]/55 p-6 text-sm text-muted backdrop-blur-md">
            {isUz ? 'Matematika kurslari topilmadi.' : 'No Mathematics courses match the current filter.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mathCourses.map((course, idx) => {
              const ed = course.editions[locale];
              const hasEn = Boolean(course.editions.en);
              const hasUz = Boolean(course.editions.uz);
              const enr = enrollments.find((e) => e.courseId === course.id);
              const courseTitle = ed ? ed.title : course.editions.en?.title || course.slug;
              const bookmarked = isCourseBookmarked(bookmarkedCourseIds, course.id);

              const offlineStatus: CourseOfflineStatus = resolveCourseOfflineStatus({
                swStatus,
                cachedEditionKeys,
                courseId: course.id,
                locale,
                hasEditionInLocale: Boolean(ed),
              });

              const pct =
                enr && enr.requiredLessonIds.length > 0
                  ? Math.round(
                      ((enr.completedLessonIds.length + (enr.passedAssessment ? 1 : 0)) /
                        (enr.requiredLessonIds.length + 1)) *
                        100
                    )
                  : 0;

              return (
                <MagneticCourseCard
                  key={course.id}
                  testId={`mathematics-course-card-${course.id}`}
                  subject={course.subject}
                  artifactIndex={idx}
                  className="relative flex flex-col justify-between overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -inset-5 -z-10 bg-chalk-dust ${grainOverlay.opacityClass} ${grainOverlay.mixBlendClass}`}
                  />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold text-theme-amber">
                          <span>
                            {strings.subjects[course.subject]} · {strings.levels[course.level]}
                          </span>
                          <span aria-hidden="true" className="text-muted">·</span>
                          <span className="text-muted">
                            {hasEn ? 'EN' : ''}{hasEn && hasUz ? ' / ' : ''}{hasUz ? 'O‘Z' : ''}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-lg font-bold text-ink">
                          {courseTitle}
                        </h3>
                      </div>

                      <button
                        type="button"
                        disabled={bookmarkBusyId === course.id}
                        onClick={() => onToggleBookmark(course.id)}
                        aria-label={`${bookmarked ? strings.bookmarks.removeLabel : strings.bookmarks.addLabel}: ${courseTitle}`}
                        aria-pressed={bookmarked}
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-slate-500 dark:border-[#222B3D] transition-colors shadow-brutal-sm disabled:opacity-50 ${
                          bookmarked
                            ? 'bg-theme-accent/25 text-theme-accent'
                            : 'bg-white/55 dark:bg-[#080B14]/55 text-muted hover:border-theme-accent hover:text-ink'
                        }`}
                      >
                        <Bookmark
                          className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
                      {ed ? ed.description : strings.editionMissingNote}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      {ed ? (
                        <span className="font-mono text-[11px]">
                          {formatCourseMetaSummary(
                            ed.lessonCount,
                            ed.estimatedMinutes,
                            ed.passingScorePercent,
                            locale
                          )}
                        </span>
                      ) : (
                        <span />
                      )}

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border-2 border-theme-border px-2 py-0.5 text-[11px] font-semibold ${
                          offlineStatus === 'cached_full'
                            ? 'bg-theme-panel text-theme-emerald'
                            : 'bg-theme-panel text-muted'
                        }`}
                      >
                        {offlineStatus === 'cached_full' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-theme-emerald" aria-hidden="true" />
                            <span>{strings.catalog.offlineCached}</span>
                          </>
                        ) : offlineStatus === 'sw_pending' ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                            <span>{strings.catalog.offlineChecking}</span>
                          </>
                        ) : (
                          <>
                            <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{strings.catalog.offlineNotCached}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 mt-5 space-y-3 border-t-2 border-theme-border pt-4">
                    {enr && (
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-theme-cyan">{strings.journey[enr.journeyStatus]}</span>
                          <span className="font-mono tabular-nums text-muted">{pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-theme-border bg-theme-panel">
                          <div className="h-full bg-theme-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-theme-amber">
                        {enr ? strings.journey[enr.journeyStatus] : isUz ? 'Ochiq ko‘rib chiqish' : 'Verified Course Edition'}
                      </span>

                      <button
                        type="button"
                        disabled={!ed}
                        onClick={() => onOpenCourse(course.id, locale)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-2 text-xs font-bold text-theme-accent-ink shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-accent-hover disabled:opacity-50"
                      >
                        <span>
                          {ed
                            ? enr
                              ? strings.continueLearning
                              : isUz
                              ? 'Kursni ochish'
                              : 'Open Mathematics Course'
                            : isUz
                            ? 'Nashr kutilmoqda'
                            : 'Unavailable'}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </MagneticCourseCard>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
