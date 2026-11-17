'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Bookmark, Layers } from 'lucide-react';
import { useContainedArtifactPhysics } from '../hooks/useContainedArtifactPhysics';
import { isCourseBookmarked } from '../lib/course-bookmarks';
import { t } from '../lib/i18n';
import {
  buildShowcaseCardItems,
  computeShowcaseCardTiltDeg,
  type ShowcaseCardItem,
} from '../lib/scroll-sync';
import {
  BENTO_HOVER_PHYSICS,
  resolveCourseWatermarkArtifact,
} from '../lib/subject-artifacts';
import type {
  CourseCatalogItem,
  EnrollmentRecord,
  LocaleCode,
} from '../shared/types';
import { ArtifactConstellation } from './ArtifactConstellation';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface CourseShowcaseProps {
  locale: LocaleCode;
  courses: CourseCatalogItem[];
  enrollments: EnrollmentRecord[];
  bookmarkedCourseIds: string[];
  bookmarkBusyId: string | null;
  onOpenCourse: (courseId: string, locale: LocaleCode, lessonIndex?: number) => void;
  onToggleBookmark: (courseId: string) => void;
}

interface ShowcaseArtifactCardProps {
  item: ShowcaseCardItem;
  index: number;
  locale: LocaleCode;
  enr?: EnrollmentRecord;
  bookmarked: boolean;
  bookmarkBusyId: string | null;
  onOpenCourse: (courseId: string, locale: LocaleCode, lessonIndex?: number) => void;
  onToggleBookmark: (courseId: string) => void;
}

const ShowcaseArtifactCard: React.FC<ShowcaseArtifactCardProps> = ({
  item,
  index,
  locale,
  enr,
  bookmarked,
  bookmarkBusyId,
  onOpenCourse,
  onToggleBookmark,
}) => {
  const strings = t(locale);
  const isUz = locale === 'uz';
  const cardRef = useRef<HTMLElement | null>(null);

  const ed = item.course.editions[locale];
  const watermark = useMemo(
    () => resolveCourseWatermarkArtifact(item.course.subject, index),
    [item.course.subject, index]
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
    subjectType: item.course.subject,
    cardRef,
    seedIndex: index,
    particleCount: 4,
    preferredKind: watermark.kind,
  });

  const pct =
    enr && enr.requiredLessonIds.length > 0
      ? Math.round(
          ((enr.completedLessonIds.length + (enr.passedAssessment ? 1 : 0)) /
            (enr.requiredLessonIds.length + 1)) *
            100
        )
      : 0;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      handleArtifactPointerEnter(e);
      const cardEl = cardRef.current;
      if (!cardEl) return;
      gsap.to(cardEl, {
        boxShadow: BENTO_HOVER_PHYSICS.hover.boxShadow,
        duration: BENTO_HOVER_PHYSICS.hover.duration,
        ease: BENTO_HOVER_PHYSICS.hover.ease,
        overwrite: 'auto',
      });
    },
    [handleArtifactPointerEnter]
  );

  const handleMouseLeave = useCallback(() => {
    handleArtifactPointerLeave();
    const cardEl = cardRef.current;
    if (!cardEl) return;
    gsap.to(cardEl, {
      boxShadow: BENTO_HOVER_PHYSICS.resting.boxShadow,
      duration: BENTO_HOVER_PHYSICS.resting.duration,
      ease: BENTO_HOVER_PHYSICS.resting.ease,
      overwrite: 'auto',
    });
  }, [handleArtifactPointerLeave]);

  return (
    <article
      ref={cardRef}
      data-showcase-card={item.id}
      data-testid={`course-showcase-card-${item.id}`}
      data-physics-subject={profile.subject}
      data-physics-profile={profile.profileName}
      data-physics-ease={profile.ease}
      data-physics-active={isComplexPhysicsActive ? 'true' : 'false'}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleArtifactPointerMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden will-change-transform flex w-[290px] sm:w-[370px] lg:w-[420px] shrink-0 flex-col justify-between rounded-xl border-2 border-slate-500 bg-white/50 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/45"
    >
      {/* Multi-particle Constellation Layer (z-0, bounded drift behind text) */}
      <ArtifactConstellation
        particles={particles}
        setDriftRef={setDriftRef}
        setSpinRef={setSpinRef}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 border-b-2 border-slate-500 dark:border-[#222B3D] pb-3">
          <div className="min-w-0">
            <div className={`font-mono text-xs font-bold ${item.accentColorClass}`}>
              {item.indexNumber} · {item.subjectLabel} · {item.levelLabel}
            </div>
            <div className="mt-1 font-mono text-[11px] tabular-nums text-muted">
              {item.metaSummary}
            </div>
          </div>

          <button
            type="button"
            disabled={bookmarkBusyId === item.course.id}
            onClick={() => onToggleBookmark(item.course.id)}
            aria-label={`${bookmarked ? strings.bookmarks.removeLabel : strings.bookmarks.addLabel}: ${item.title}`}
            aria-pressed={bookmarked}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-500 dark:border-[#222B3D] shadow-[3px_3px_0px_#000000] transition-colors disabled:opacity-50 ${
              bookmarked
                ? 'bg-theme-accent/25 text-theme-accent'
                : 'bg-white/60 dark:bg-[#080B14]/60 text-muted hover:border-theme-accent hover:text-ink'
            }`}
          >
            <Bookmark
              className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        <h3 className="mt-4 font-display text-lg font-extrabold tracking-tight text-ink">
          {item.title}
        </h3>

        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted sm:text-sm">
          {item.subtitle || strings.editionMissingNote}
        </p>
      </div>

      <div className="relative z-10 mt-5 space-y-3 border-t-2 border-theme-border pt-4">
        {enr && (
          <div>
            <div className="flex justify-between text-[11px] font-semibold">
              <span className="text-theme-cyan">
                {strings.journey[enr.journeyStatus]}
              </span>
              <span className="font-mono tabular-nums text-muted">{pct}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-theme-border bg-theme-base">
              <div
                className="h-full bg-theme-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!ed}
          onClick={() => onOpenCourse(item.course.id, locale, item.lessonIndex)}
          className="inline-flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-2 text-xs font-bold text-theme-accent-ink shadow-[3px_3px_0px_0px_var(--econova-shadow-hard)] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-accent-hover disabled:opacity-50 whitespace-nowrap"
        >
          <span>
            {ed
              ? item.isModuleSpotlight
                ? isUz
                  ? 'Darsni ochish'
                  : 'Inspect Module'
                : enr
                ? strings.continueLearning
                : isUz
                ? 'Kursni ochish'
                : 'Open Course'
              : isUz
              ? 'Nashr kutilmoqda'
              : 'Edition Unavailable'}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};

export const CourseShowcase: React.FC<CourseShowcaseProps> = ({
  locale,
  courses,
  enrollments,
  bookmarkedCourseIds,
  bookmarkBusyId,
  onOpenCourse,
  onToggleBookmark,
}) => {
  const strings = t(locale);
  const isUz = locale === 'uz';
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinWrapperRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const showcaseCards = useMemo(
    () =>
      buildShowcaseCardItems(
        courses,
        locale,
        strings.subjects,
        strings.levels
      ),
    [courses, locale, strings.subjects, strings.levels]
  );

  useGSAP(
    () => {
      if (!sectionRef.current) return;
      const pinWrapperEl = pinWrapperRef.current;
      const trackEl = trackRef.current;
      if (!pinWrapperEl || !trackEl || showcaseCards.length === 0) return;

      const cardEls = gsap.utils.toArray<HTMLElement>('[data-showcase-card]', trackEl);
      if (cardEls.length === 0) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        gsap.set(trackEl, { x: 0, xPercent: 0 });
        gsap.set(cardEls, { rotation: 0 });
        return;
      }

      let scrollStopTimer = 0;

      const snapCardsToRest = () => {
        pinWrapperEl.setAttribute('data-scroll-moving', 'false');
        gsap.to(cardEls, {
          rotation: 0,
          duration: 0.36,
          stagger: 0.025,
          ease: 'back.out(1.6)',
          overwrite: 'auto',
        });
      };

      const horizontalTween = gsap.to(trackEl, {
        xPercent: -100,
        x: () => pinWrapperEl.clientWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: pinWrapperEl,
          start: 'top top+=76',
          end: () => {
            const travel = Math.max(480, trackEl.scrollWidth - pinWrapperEl.clientWidth);
            return `+=${Math.round(travel * 1.15)}`;
          },
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressBarRef.current) {
              progressBarRef.current.style.transform = `scaleX(${Math.max(0.06, self.progress)})`;
            }

            const velocity = self.getVelocity();
            const isMoving = Math.abs(velocity) >= 25;

            if (isMoving) {
              pinWrapperEl.setAttribute('data-scroll-moving', 'true');
              gsap.to(cardEls, {
                rotation: (index: number) =>
                  computeShowcaseCardTiltDeg({
                    velocity,
                    cardIndex: index,
                    baseTiltDeg: 2.2,
                  }),
                duration: 0.16,
                stagger: 0.02,
                ease: 'power2.out',
                overwrite: 'auto',
              });

              if (scrollStopTimer) {
                window.clearTimeout(scrollStopTimer);
              }
              scrollStopTimer = window.setTimeout(snapCardsToRest, 200);
            }
          },
          onLeave: snapCardsToRest,
          onLeaveBack: snapCardsToRest,
        },
      });

      return () => {
        if (scrollStopTimer) {
          window.clearTimeout(scrollStopTimer);
        }
        horizontalTween.scrollTrigger?.kill();
        horizontalTween.kill();
      };
    },
    {
      scope: sectionRef,
      dependencies: [showcaseCards.length, locale],
      revertOnUpdate: true,
    }
  );

  if (showcaseCards.length === 0) {
    return <section ref={sectionRef} aria-hidden="true" className="hidden" />;
  }

  return (
    <section
      ref={sectionRef}
      data-testid="course-showcase-section"
      aria-labelledby="course-showcase-heading"
      className="relative z-10"
    >
      <div
        ref={pinWrapperRef}
        data-testid="course-showcase-pin-wrapper"
        data-scroll-moving="false"
        className="overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
      >
        <div className="flex flex-col gap-3 border-b-2 border-slate-500 dark:border-[#222B3D] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-theme-cyan">
              <Layers className="h-3.5 w-3.5 text-theme-accent shrink-0" aria-hidden="true" />
              <span>
                {isUz
                  ? 'GORIZONTAL KURS VITRINASI · PINNED TRACK'
                  : 'HORIZONTAL COURSE SHOWCASE'}
              </span>
            </div>
            <h2
              id="course-showcase-heading"
              className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl [text-wrap:balance]"
            >
              {isUz
                ? 'O‘quv yo‘nalishlari bo‘ylab interaktiv sayohat'
                : 'Scroll-Driven Curriculum Deck'}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-xs font-semibold tabular-nums text-muted">
              {showcaseCards.length} {isUz ? 'ta kurs' : 'tracks'}
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full border-2 border-slate-500 dark:border-[#222B3D] bg-white/50 dark:bg-[#080B14]/60">
              <div
                ref={progressBarRef}
                data-testid="course-showcase-progress-bar"
                className="h-full w-full origin-left bg-theme-accent transition-transform duration-75"
                style={{ transform: 'scaleX(0.08)' }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden px-1.5 pt-3 pb-5">
          <div
            ref={trackRef}
            data-testid="course-showcase-track"
            className="flex w-max items-stretch gap-5 pr-6 will-change-transform"
          >
            {showcaseCards.map((item, idx) => (
              <ShowcaseArtifactCard
                key={item.id}
                item={item}
                index={idx}
                locale={locale}
                enr={enrollments.find((e) => e.courseId === item.course.id)}
                bookmarked={isCourseBookmarked(bookmarkedCourseIds, item.course.id)}
                bookmarkBusyId={bookmarkBusyId}
                onOpenCourse={onOpenCourse}
                onToggleBookmark={onToggleBookmark}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
