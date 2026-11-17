'use client';

import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  CloudOff,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { EconomicsLiquidBackground } from './EconomicsLiquidBackground';
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

interface EconomicsSectionProps {
  locale: LocaleCode;
  courses: CourseCatalogItem[];
  enrollments: EnrollmentRecord[];
  bookmarkedCourseIds: string[];
  bookmarkBusyId: string | null;
  swStatus: ServiceWorkerAvailability;
  cachedEditionKeys: Set<string>;
  showFixedShaderBackground?: boolean;
  onOpenCourse: (courseId: string, locale: LocaleCode) => void;
  onToggleBookmark: (courseId: string) => void;
}

/**
 * Economics "Data & Flow" Subject Section for ECONOVA.
 * Layers a custom fixed Three.js WebGL 2D Simplex Noise liquid shader
 * beneath tactile Neobrutalist course panels using dynamic theme tokens.
 */
export const EconomicsSection: React.FC<EconomicsSectionProps> = ({
  locale,
  courses,
  enrollments,
  bookmarkedCourseIds,
  bookmarkBusyId,
  swStatus,
  cachedEditionKeys,
  showFixedShaderBackground = true,
  onOpenCourse,
  onToggleBookmark,
}) => {
  const strings = t(locale);
  const economicsCourses = courses.filter((c) => c.subject === 'Economics');

  const isUz = locale === 'uz';

  return (
    <div
      data-testid="economics-section"
      className="relative"
    >
      {/* Fixed Three.js WebGL 2D Simplex Noise Liquid Shader Background */}
      <EconomicsLiquidBackground active={showFixedShaderBackground} />

      {/* Foreground Glass-Brutalist Economics Content Overlay */}
      <section
        aria-labelledby="economics-section-heading"
        className="relative z-10 space-y-5 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
      >
        <div className="flex flex-col gap-3 border-b-2 border-slate-500 dark:border-[#222B3D] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-theme-cyan shadow-brutal-sm backdrop-blur-md">
              <Activity className="h-3.5 w-3.5 text-theme-emerald" aria-hidden="true" />
              <span>{isUz ? 'MA’LUMOTLAR VA OQIM · WEBGL SHADER' : 'DATA & FLOW · SIMPLEX NOISE FIELD'}</span>
            </div>

            <h2
              id="economics-section-heading"
              className="mt-2.5 flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl"
            >
              <TrendingUp className="h-5 w-5 text-theme-accent" aria-hidden="true" />
              <span>
                {isUz
                  ? 'Iqtisodiyot: Bozor muvozanati va makroiqtisodiy oqimlar'
                  : 'Economics: Market Equilibrium & Macroeconomic Flows'}
              </span>
            </h2>

            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted sm:text-sm">
              {isUz
                ? 'Talab va taklif egri chiziqlari, marjinal xarajatlar, iste’molchi ortiqchaligi hamda pul-kredit siyosati modellarini tizimli o‘rganing.'
                : 'Quantitative models of price discovery, marginal cost incentives, consumer and producer surplus, and monetary policy transmission.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-theme-cyan shadow-brutal-sm backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-theme-cyan" aria-hidden="true" />
              <span>{strings.economics.cyanFlowField}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-theme-emerald shadow-brutal-sm backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-theme-emerald" aria-hidden="true" />
              <span>{strings.economics.equilibriumVector}</span>
            </span>
          </div>
        </div>

        {economicsCourses.length === 0 ? (
          <div className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/45 dark:bg-[#080B14]/55 p-6 text-sm text-muted backdrop-blur-md">
            {isUz ? 'Iqtisodiyot kurslari yuklanmoqda...' : 'No Economics courses match the current filter.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {economicsCourses.map((course, idx) => {
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
                  testId={`economics-course-card-${course.id}`}
                  subject={course.subject}
                  artifactIndex={idx}
                  className="flex flex-col justify-between rounded-xl border-2 border-slate-500 bg-white/40 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold text-theme-cyan">
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
                            ? 'bg-theme-base text-theme-emerald'
                            : 'bg-theme-base text-muted'
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
                      <span className="text-xs font-medium text-theme-emerald">
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
                              : 'Open Economics Course'
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
      </section>
    </div>
  );
};
