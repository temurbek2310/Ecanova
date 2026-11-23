'use client';

import React from 'react';
import { Briefcase, Sigma, TrendingUp } from 'lucide-react';
import { buildSectionDividerMeta } from '../lib/section-divider';
import type { LocaleCode, Subject } from '../shared/types';

interface NeobrutalistSectionDividerProps {
  subject: Subject;
  locale: LocaleCode;
  indexLabel?: string;
  className?: string;
}

const SubjectIcon: React.FC<{ subject: Subject; className?: string }> = ({
  subject,
  className = '',
}) => {
  switch (subject) {
    case 'Economics':
      return <TrendingUp className={`h-3.5 w-3.5 ${className}`} aria-hidden="true" />;
    case 'Mathematics':
      return <Sigma className={`h-3.5 w-3.5 ${className}`} aria-hidden="true" />;
    case 'Business':
      return <Briefcase className={`h-3.5 w-3.5 ${className}`} aria-hidden="true" />;
  }
};

/**
 * Neobrutalist Section Divider featuring a thick architectural dotted line pattern
 * matching `bg-arch-grid` geometry and a centered rectangular Neobrutalist subject badge.
 */
export const NeobrutalistSectionDivider: React.FC<NeobrutalistSectionDividerProps> = ({
  subject,
  locale,
  indexLabel,
  className = '',
}) => {
  const meta = buildSectionDividerMeta({ subject, locale, indexLabel });

  return (
    <div
      role="separator"
      aria-label={meta.ariaLabel}
      data-testid={`section-divider-${subject.toLowerCase()}`}
      className={`relative z-10 flex items-center gap-3 py-3 sm:py-4 ${className}`}
    >
      {/* Left architectural end-cap & thick dotted grid line */}
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 border-2 border-slate-500 bg-white/55 backdrop-blur-md shadow-brutal-sm dark:border-[#222B3D] dark:bg-[#080B14]/60"
      />
      <div
        aria-hidden="true"
        data-testid={`section-divider-dots-left-${subject.toLowerCase()}`}
        className="h-4 flex-1 bg-arch-dots-line"
      />

      {/* Centered Neobrutalist subject label badge */}
      <div
        className={`inline-flex shrink-0 items-center gap-2 rounded-md border-2 border-slate-500 bg-white/55 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60 ${meta.accentBorderHoverClass}`}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 ${meta.accentDotClass}`}
        />
        <span className="text-muted">{meta.sectionCode}</span>
        <span aria-hidden="true" className="text-muted">·</span>
        <SubjectIcon subject={subject} className={meta.accentTextClass} />
        <span>{meta.badgeLabel}</span>
      </div>

      {/* Right thick dotted grid line & architectural end-cap */}
      <div
        aria-hidden="true"
        data-testid={`section-divider-dots-right-${subject.toLowerCase()}`}
        className="h-4 flex-1 bg-arch-dots-line"
      />
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 border-2 border-slate-500 bg-white/55 backdrop-blur-md shadow-brutal-sm dark:border-[#222B3D] dark:bg-[#080B14]/60"
      />
    </div>
  );
};
