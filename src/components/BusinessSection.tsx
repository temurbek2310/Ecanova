'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowUpRight,
  Bookmark,
  Briefcase,
  CheckCircle2,
  CloudOff,
  Layers,
  Loader2,
} from 'lucide-react';
import {
  buildBusinessBentoModules,
  BUSINESS_RESIZE_DEBOUNCE_MS,
  computeBoundedPinTravelPx,
  computeBusinessCardStackTransform,
  shouldRefreshBusinessLayoutOnResize,
  type ViewportDimensions,
} from '../lib/business-bento';
import { BusinessBentoCard } from './BusinessBentoCard';
import { InteractiveDotGrid } from './ui/InteractiveDotGrid';
import { MagneticCourseCard } from './MagneticCourseCard';
import { isCourseBookmarked } from '../lib/course-bookmarks';
import { formatCourseMetaSummary, t } from '../lib/i18n';
import {
  resolveCourseOfflineStatus,
  type CourseOfflineStatus,
  type ServiceWorkerAvailability,
} from '../lib/offline-cache';
import type {
  CourseCatalogItem,
  EnrollmentRecord,
  LocaleCode,
} from '../shared/types';

gsap.registerPlugin(ScrollTrigger);

interface BusinessSectionProps {
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

const BENTO_Z_CLASSES = ['z-20', 'z-30', 'z-40', 'z-50'] as const;

/**
 * Business "Structure & High-Impact" Section for ECONOVA.
 * Features an asymmetrical 12-column Tailwind CSS bento-box grid (`7/5` and `5/7` spans)
 * inside a strictly contained `overflow-hidden` Glass-Brutalist section (`z-10 isolate`)
 * with an internal GSAP ScrollTrigger pin track bounded cleanly before the bottom border.
 */
export const BusinessSection: React.FC<BusinessSectionProps> = ({
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
  const bentoTrackRef = useRef<HTMLDivElement | null>(null);
  const bentoStageRef = useRef<HTMLDivElement | null>(null);

  const businessCourses = useMemo(
    () => courses.filter((c) => c.subject === 'Business'),
    [courses]
  );

  const bentoModules = useMemo(
    () => buildBusinessBentoModules(locale),
    [locale]
  );

  useLayoutEffect(() => {
    const rootEl = sectionRef.current;
    const trackEl = bentoTrackRef.current;
    const stageEl = bentoStageRef.current;
    if (!rootEl || !trackEl || !stageEl || typeof window === 'undefined') return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const cardEls = gsap.utils.toArray<HTMLElement>('[data-bento-card]', stageEl);
      if (cardEls.length === 0) return;

      if (prefersReducedMotion) {
        gsap.set(cardEls, { y: 0, scale: 1, clearProps: 'zIndex' });
        return;
      }

      const mm = gsap.matchMedia();

      // Desktop (>= 1024px): Pin internal bento stage inside bounded track using transform pinning
      // so backdrop-blur on the parent never breaks fixed positioning and cards stop stacking
      // safely before reaching the bottom border.
      mm.add('(min-width: 1024px)', () => {
        cardEls.forEach((cardEl, idx) => {
          const mod = bentoModules[idx];
          if (!mod) return;
          const initial = computeBusinessCardStackTransform(mod, 0, bentoModules.length);
          gsap.set(cardEl, {
            y: initial.y,
            scale: initial.scale,
            zIndex: 20 + idx * 10,
          });
        });

        const getTravelDistance = () =>
          computeBoundedPinTravelPx(trackEl.clientHeight, stageEl.offsetHeight, 16);

        const tl = gsap.timeline({
          scrollTrigger: {
            id: 'business-bento-pin',
            trigger: trackEl,
            endTrigger: trackEl,
            start: 'top top+=88',
            end: () => `+=${Math.max(1, getTravelDistance())}`,
            pin: stageEl,
            pinType: 'transform',
            pinSpacing: false,
            scrub: 0.55,
            invalidateOnRefresh: true,
          },
        });

        // Row 1 gently compresses in place while Row 2 stacks upward inside the stage bounds
        if (cardEls[0] && cardEls[1]) {
          tl.to(
            [cardEls[0], cardEls[1]],
            {
              y: 0,
              scale: 0.975,
              ease: 'power2.inOut',
              duration: 0.5,
            },
            0
          );
        }

        if (cardEls[2] && cardEls[3]) {
          tl.to(
            cardEls[2],
            {
              y: -86,
              scale: 1,
              ease: 'power3.out',
              duration: 0.75,
            },
            0.12
          ).to(
            cardEls[3],
            {
              y: -74,
              scale: 1,
              ease: 'power3.out',
              duration: 0.75,
            },
            0.24
          );
        }

        return () => {
          gsap.set(stageEl, { clearProps: 'transform' });
        };
      });

      // Mobile & Tablet (< 1024px): Strictly contained vertical settle without sticky overflow
      mm.add('(max-width: 1023px)', () => {
        gsap.set(stageEl, { clearProps: 'transform' });
        cardEls.forEach((cardEl, idx) => {
          gsap.set(cardEl, {
            y: idx === 0 ? 0 : 12,
            scale: 1,
            zIndex: 20 + idx * 10,
          });

          gsap.to(cardEl, {
            y: 0,
            scale: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: cardEl,
              start: 'top 90%',
              end: 'top 52%',
              scrub: 0.45,
            },
          });
        });
      });

      return () => mm.revert();
    }, rootEl);

    // Recalculate BusinessSection ScrollTrigger bounds on initial settle, parent resize, and window resize
    let refreshRaf = 0;
    let resizeTimer: number | null = null;
    let lastViewport: ViewportDimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const scheduleRefresh = () => {
      if (refreshRaf) window.cancelAnimationFrame(refreshRaf);
      refreshRaf = window.requestAnimationFrame(() => {
        refreshRaf = 0;
        ScrollTrigger.refresh();
      });
    };
    scheduleRefresh();

    const handleWindowResize = () => {
      const nextViewport: ViewportDimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      if (!shouldRefreshBusinessLayoutOnResize(lastViewport, nextViewport)) {
        return;
      }
      lastViewport = nextViewport;
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        scheduleRefresh();
      }, BUSINESS_RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleWindowResize, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && rootEl.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        scheduleRefresh();
      });
      resizeObserver.observe(rootEl.parentElement);
    }

    return () => {
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
        resizeTimer = null;
      }
      if (refreshRaf) {
        window.cancelAnimationFrame(refreshRaf);
        refreshRaf = 0;
      }
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver?.disconnect();
      ctx.revert();
    };
  }, [locale, bentoModules, courses.length]);

  const primaryBusinessCourseId = businessCourses[0]?.id;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="business-section-heading"
      data-testid="business-section"
      className="relative z-10 overflow-hidden min-h-[760px] lg:min-h-[980px] rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
    >
      <InteractiveDotGrid testId="business-section-dot-grid" />
      <div className="relative z-10 space-y-6">
        {/* Section Header */}
        <div className="relative z-20 flex flex-col gap-3 border-b-2 border-theme-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border-2 border-slate-500 bg-white/55 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-theme-accent shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
              <Layers className="h-3.5 w-3.5 text-theme-cyan" aria-hidden="true" />
              <span>
                {isUz
                  ? 'TUZILMA VA YUQORI SAMARA · BENTO STACK'
                  : 'STRUCTURE & HIGH-IMPACT · ASYMMETRICAL BENTO'}
              </span>
            </div>

            <h2
              id="business-section-heading"
              className="mt-2.5 flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl"
            >
              <Briefcase className="h-5 w-5 text-theme-accent shrink-0" aria-hidden="true" />
              <span>
                {isUz
                  ? 'Biznes: Unit-iqtisodiyot, pul oqimi va kapital taqsimoti'
                  : 'Business: Unit Economics, Cash Flow & Capital Allocation'}
              </span>
            </h2>

            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted sm:text-sm">
              {isUz
                ? 'Asimmetrik bento-modul kartochkalari sahifani aylantirganda ustma-ust taxlanib, biznesning to‘rtta tayanch ustunini namoyish etadi.'
                : 'An asymmetrical bento-box architecture pinned with GSAP ScrollTrigger where strategic modules stack into a high-impact decision deck as you scroll.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-500 bg-white/55 px-2.5 py-1 font-mono text-[11px] font-semibold text-theme-accent shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
              <span className="h-2 w-2 rounded-full bg-theme-accent" aria-hidden="true" />
              <span>{strings.business.badgeBentoGrid}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-500 bg-white/55 px-2.5 py-1 font-mono text-[11px] font-semibold text-theme-emerald shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
              <span className="h-2 w-2 rounded-full bg-theme-emerald" aria-hidden="true" />
              <span>{strings.business.badgePinStack}</span>
            </span>
          </div>
        </div>

        {/* Bounded Internal Scroll Track & Pin Target for Asymmetrical Bento Cards */}
        <div
          ref={bentoTrackRef}
          data-testid="business-bento-track"
          className="relative z-10 overflow-hidden -mx-2 px-2 pt-2.5 pb-8 lg:min-h-[840px]"
        >
          <div
            ref={bentoStageRef}
            data-testid="business-bento-stage"
            className="relative grid grid-cols-1 gap-4 lg:grid-cols-12"
          >
            {bentoModules.map((mod, idx) => {
              const cardZClass = BENTO_Z_CLASSES[idx] ?? 'z-50';
              return (
                <BusinessBentoCard
                  key={mod.id}
                  moduleItem={mod}
                  index={idx}
                  zClass={cardZClass}
                  locale={locale}
                  primaryBusinessCourseId={primaryBusinessCourseId}
                  onOpenCourse={onOpenCourse}
                />
              );
            })}
          </div>
        </div>

        {/* Published Business Course Edition Cards (Safely isolated below pin track) */}
        {businessCourses.length > 0 && (
          <div
            data-testid="business-courses-subsection"
            className="relative z-10 mt-6 grid gap-4 border-t-2 border-theme-border pt-6 md:grid-cols-2"
          >
            {businessCourses.map((course, idx) => {
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
                  testId={`business-course-card-${course.id}`}
                  subject={course.subject}
                  artifactIndex={idx}
                  className="flex flex-col justify-between rounded-xl border-2 border-slate-500 bg-white/25 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold text-theme-accent">
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
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-theme-border transition-colors shadow-brutal-sm disabled:opacity-50 ${
                          bookmarked
                            ? 'bg-theme-accent/20 text-theme-accent'
                            : 'bg-theme-base text-muted hover:border-theme-accent hover:text-ink'
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
                        className={`inline-flex items-center gap-1.5 rounded-md border-2 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md ${
                          offlineStatus === 'cached_full'
                            ? 'border-theme-emerald/60 bg-white/55 text-theme-emerald dark:border-theme-emerald/50 dark:bg-[#080B14]/60'
                            : 'border-slate-500 bg-white/55 text-muted dark:border-[#222B3D] dark:bg-[#080B14]/60'
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

                  <div className="mt-5 space-y-3 border-t-2 border-theme-border pt-4">
                    {enr && (
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-theme-cyan">{strings.journey[enr.journeyStatus]}</span>
                          <span className="font-mono tabular-nums text-muted">{pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-theme-border bg-theme-base">
                          <div className="h-full bg-theme-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-theme-accent">
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
                              : 'Open Business Course'
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
