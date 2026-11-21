import React from 'react';
import type { LocaleCode } from '../../shared/types';

/* ==========================================================================
   Lightweight Atomic Shimmer Primitives
   ========================================================================== */

export interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
  admin?: boolean;
}

export const SkeletonLine: React.FC<SkeletonProps> = ({
  className = '',
  style,
  width,
  height,
  admin = false,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md ${admin ? 'animate-shimmer-admin' : 'animate-shimmer'} ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '1rem',
        ...style,
      }}
    />
  );
};

export const SkeletonBlock: React.FC<SkeletonProps> = ({
  className = '',
  style,
  width,
  height,
  admin = false,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg ${admin ? 'animate-shimmer-admin' : 'animate-shimmer'} ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '3rem',
        ...style,
      }}
    />
  );
};

/* ==========================================================================
   Smooth Content Reveal Wrapper
   ========================================================================== */

export interface ContentRevealProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ContentReveal: React.FC<ContentRevealProps> = ({
  children,
  className = '',
  style,
}) => {
  return (
    <div className={`animate-content-reveal ${className}`} style={style}>
      {children}
    </div>
  );
};

/* ==========================================================================
   Neobrutalist Learner Card Skeleton (Matches MagneticCourseCard / Showcase)
   ========================================================================== */

export interface BrutalCardSkeletonProps {
  locale?: LocaleCode;
  className?: string;
  ariaLabel?: string;
  showcaseVariant?: boolean;
}

export const BrutalCardSkeleton: React.FC<BrutalCardSkeletonProps> = ({
  locale = 'en',
  className = '',
  ariaLabel,
  showcaseVariant = false,
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Kurs kartochkasi yuklanmoqda...' : 'Loading course card...';

  return (
    <div
      aria-busy="true"
      aria-label={ariaLabel || defaultLabel}
      className={`${
        showcaseVariant
          ? 'w-[290px] sm:w-[370px] lg:w-[420px] shrink-0'
          : 'w-full'
      } flex flex-col justify-between rounded-xl border-2 border-slate-500 bg-white/25 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25 ${className}`}
    >
      {/* Top Header Row: taxonomy / sequence metadata + bookmark button */}
      <div>
        <div className="flex items-start justify-between gap-3 border-b-2 border-slate-500 pb-3 dark:border-[#222B3D]">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonLine width="60%" height="12px" />
            <SkeletonLine width="40%" height="10px" />
          </div>
          <div className="h-10 w-10 shrink-0 rounded-lg border-2 border-slate-500 bg-white/40 p-2 shadow-[3px_3px_0px_#000000] dark:border-[#222B3D] dark:bg-[#080B14]/40">
            <SkeletonBlock className="h-full w-full rounded" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="mt-4 space-y-2.5">
          <SkeletonLine width="85%" height="22px" className="rounded" />
          <SkeletonLine width="100%" height="14px" />
          <SkeletonLine width="75%" height="14px" />
        </div>
      </div>

      {/* Footer Area: progress or metadata + CTA */}
      <div className="mt-6 space-y-3 border-t-2 border-slate-500 pt-4 dark:border-[#222B3D]">
        <div className="flex items-center justify-between">
          <SkeletonLine width="35%" height="12px" />
          <SkeletonLine width="20%" height="12px" />
        </div>
        <SkeletonBlock height="38px" className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D]" />
      </div>
    </div>
  );
};

/* ==========================================================================
   Neobrutalist Panel Skeleton (Generic Section / View Card)
   ========================================================================== */

export interface BrutalPanelSkeletonProps {
  locale?: LocaleCode;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const BrutalPanelSkeleton: React.FC<BrutalPanelSkeletonProps> = ({
  locale = 'en',
  className = '',
  ariaLabel,
  children,
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Ma’lumotlar yuklanmoqda...' : 'Loading data panel...';

  return (
    <div
      aria-busy="true"
      aria-label={ariaLabel || defaultLabel}
      className={`rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25 ${className}`}
    >
      {children || (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-500 pb-4 dark:border-[#222B3D]">
            <div className="space-y-2">
              <SkeletonLine width="180px" height="20px" />
              <SkeletonLine width="260px" height="12px" />
            </div>
            <SkeletonBlock width="80px" height="32px" className="rounded-lg" />
          </div>
          <div className="space-y-3 pt-2">
            <SkeletonLine width="100%" height="16px" />
            <SkeletonLine width="90%" height="16px" />
            <SkeletonLine width="70%" height="16px" />
          </div>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   Course Detail Full Page Skeleton (Metadata + 12-col Syllabus & Reader)
   ========================================================================== */

export interface BrutalCourseDetailSkeletonProps {
  locale?: LocaleCode;
  className?: string;
}

export const BrutalCourseDetailSkeleton: React.FC<BrutalCourseDetailSkeletonProps> = ({
  locale = 'en',
  className = '',
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Kurs dasturi va dars yuklanmoqda...' : 'Loading course and lesson details...';

  return (
    <div
      aria-busy="true"
      aria-label={defaultLabel}
      className={`relative z-10 space-y-6 ${className}`}
    >
      {/* Top Metadata & Bookmark Card */}
      <section className="rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2.5">
            <SkeletonLine width="240px" height="13px" />
            <SkeletonLine width="65%" height="28px" className="rounded" />
            <div className="flex flex-wrap gap-2 pt-1">
              <SkeletonBlock width="84px" height="26px" className="rounded-md" />
              <SkeletonBlock width="96px" height="26px" className="rounded-md" />
              <SkeletonBlock width="110px" height="26px" className="rounded-md" />
            </div>
          </div>
          <SkeletonBlock width="110px" height="38px" className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D]" />
        </div>
      </section>

      {/* 12-Column Grid: Syllabus on left (4 cols), Lesson reader on right (8 cols) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Syllabus Card */}
        <aside className="space-y-5 lg:col-span-4">
          <div className="rounded-xl border-2 border-slate-500 bg-white/25 p-4 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <SkeletonLine width="110px" height="14px" />
              <SkeletonBlock width="70px" height="28px" className="rounded-md" />
            </div>
            {/* 5 Lesson item buttons */}
            <div className="mt-4 space-y-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border-2 border-slate-500 bg-white/40 p-3 dark:border-[#222B3D] dark:bg-[#080B14]/40"
                >
                  <SkeletonBlock width="24px" height="24px" className="shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <SkeletonLine width="75%" height="13px" />
                    <SkeletonLine width="45%" height="10px" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Focus Timer placeholder card */}
          <div className="rounded-xl border-2 border-slate-500 bg-white/25 p-4 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
            <SkeletonLine width="120px" height="14px" className="mb-2" />
            <SkeletonBlock height="48px" className="rounded-lg" />
          </div>
        </aside>

        {/* Right Column: Active Lesson Reader Card */}
        <div className="min-w-0 lg:col-span-8">
          <BrutalLessonContentSkeleton locale={locale} />
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   Lesson Content Reader Skeleton (Used on lesson switches)
   ========================================================================== */

export interface BrutalLessonContentSkeletonProps {
  locale?: LocaleCode;
  className?: string;
}

export const BrutalLessonContentSkeleton: React.FC<BrutalLessonContentSkeletonProps> = ({
  locale = 'en',
  className = '',
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Dars mazmuni yuklanmoqda...' : 'Loading lesson content...';

  return (
    <article
      aria-busy="true"
      aria-label={defaultLabel}
      className={`space-y-6 rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25 ${className}`}
    >
      {/* Lesson Header */}
      <header className="border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SkeletonLine width="180px" height="12px" />
          <div className="flex items-center gap-2">
            <SkeletonBlock width="95px" height="34px" className="rounded-lg" />
            <SkeletonBlock width="95px" height="34px" className="rounded-lg" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <SkeletonLine width="70%" height="24px" className="rounded" />
          <SkeletonLine width="45%" height="14px" />
        </div>
      </header>

      {/* Lesson Body Blocks */}
      <div className="space-y-4">
        <SkeletonLine width="100%" height="16px" />
        <SkeletonLine width="96%" height="16px" />
        <SkeletonLine width="92%" height="16px" />
        <SkeletonLine width="60%" height="16px" />
      </div>

      {/* Interactive Simulation or Formula Box Placeholder */}
      <div className="rounded-lg border-2 border-slate-500 bg-white/40 p-6 dark:border-[#222B3D] dark:bg-[#080B14]/40">
        <SkeletonLine width="140px" height="14px" className="mb-3" />
        <SkeletonBlock height="120px" className="rounded-lg" />
      </div>

      <div className="space-y-3">
        <SkeletonLine width="98%" height="16px" />
        <SkeletonLine width="88%" height="16px" />
      </div>

      {/* Action Footer */}
      <footer className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock width="130px" height="42px" className="rounded-lg" />
          <SkeletonBlock width="150px" height="42px" className="rounded-lg" />
        </div>
      </footer>
    </article>
  );
};

/* ==========================================================================
   Leaderboard Rows Skeleton (CommunityView)
   ========================================================================== */

export interface BrutalLeaderboardSkeletonProps {
  rows?: number;
  locale?: LocaleCode;
}

export const BrutalLeaderboardSkeleton: React.FC<BrutalLeaderboardSkeletonProps> = ({
  rows = 5,
  locale = 'en',
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Reyting jadvali yuklanmoqda...' : 'Loading leaderboard...';

  return (
    <tbody aria-busy="true" aria-label={defaultLabel} className="divide-y divide-line/60">
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx}>
          <td className="py-3 pr-4">
            <SkeletonLine width="28px" height="16px" />
          </td>
          <td className="py-3 pr-4">
            <div className="flex items-center gap-2">
              <SkeletonBlock width="24px" height="24px" className="rounded-full" />
              <SkeletonLine width="120px" height="15px" />
            </div>
          </td>
          <td className="py-3 pr-4 text-right">
            <SkeletonLine width="32px" height="16px" className="ml-auto" />
          </td>
          <td className="py-3 text-right">
            <SkeletonLine width="64px" height="16px" className="ml-auto" />
          </td>
        </tr>
      ))}
    </tbody>
  );
};

/* ==========================================================================
   Bookmarks List Skeleton (ProfilePoliciesView)
   ========================================================================== */

export interface BrutalBookmarkSkeletonProps {
  count?: number;
  locale?: LocaleCode;
}

export const BrutalBookmarkSkeleton: React.FC<BrutalBookmarkSkeletonProps> = ({
  count = 3,
  locale = 'en',
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Saqlangan kurslar yuklanmoqda...' : 'Loading bookmarked courses...';

  return (
    <div
      aria-busy="true"
      aria-label={defaultLabel}
      className="space-y-2.5"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-3 rounded-lg border border-line bg-chrome p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonLine width="50%" height="16px" />
            <SkeletonLine width="30%" height="12px" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SkeletonBlock width="76px" height="34px" className="rounded-md" />
            <SkeletonBlock width="34px" height="34px" className="rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ==========================================================================
   Frosted Admin UI Skeletons (.admin-card, .admin-metric, .admin-table)
   ========================================================================== */

export interface AdminMetricSkeletonProps {
  locale?: LocaleCode;
  className?: string;
}

export const AdminMetricSkeleton: React.FC<AdminMetricSkeletonProps> = ({
  locale = 'en',
  className = '',
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Ko‘rsatkich yuklanmoqda...' : 'Loading metric...';

  return (
    <div
      aria-busy="true"
      aria-label={defaultLabel}
      className={`admin-metric ${className}`}
    >
      <SkeletonLine admin width="80px" height="11px" className="uppercase" />
      <SkeletonLine admin width="100px" height="28px" className="mt-2" />
      <SkeletonLine admin width="140px" height="12px" className="mt-2" />
    </div>
  );
};

export interface AdminCardSkeletonProps {
  locale?: LocaleCode;
  className?: string;
  lines?: number;
  ariaLabel?: string;
}

export const AdminCardSkeleton: React.FC<AdminCardSkeletonProps> = ({
  locale = 'en',
  className = '',
  lines = 2,
  ariaLabel,
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Admin ma’lumotlari yuklanmoqda...' : 'Loading admin card...';

  return (
    <div
      aria-busy="true"
      aria-label={ariaLabel || defaultLabel}
      className={`admin-card p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine admin width="60%" height="16px" />
          {Array.from({ length: lines }).map((_, idx) => (
            <SkeletonLine
              key={idx}
              admin
              width={idx === lines - 1 ? '40%' : '80%'}
              height="12px"
            />
          ))}
        </div>
        <SkeletonBlock admin width="32px" height="32px" className="shrink-0 rounded-md" />
      </div>
    </div>
  );
};

export interface AdminTableSkeletonProps {
  rows?: number;
  cols?: number;
  locale?: LocaleCode;
}

export const AdminTableSkeleton: React.FC<AdminTableSkeletonProps> = ({
  rows = 4,
  cols = 4,
  locale = 'en',
}) => {
  const defaultLabel =
    locale === 'uz' ? 'Admin jadvali yuklanmoqda...' : 'Loading admin table...';

  return (
    <tbody aria-busy="true" aria-label={defaultLabel} className="divide-y divide-line/40">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx}>
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-3">
              <SkeletonLine
                admin
                width={cIdx === 0 ? '70%' : cIdx === cols - 1 ? '40%' : '60%'}
                height="14px"
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
};
