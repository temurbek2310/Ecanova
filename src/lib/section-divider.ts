import type { LocaleCode, Subject } from '../shared/types';

export interface SectionDividerMeta {
  subject: Subject;
  badgeLabel: string;
  sectionCode: string;
  ariaLabel: string;
  accentTextClass: string;
  accentDotClass: string;
  accentBorderHoverClass: string;
}

const SUBJECT_DIVIDER_CONFIG: Record<
  Subject,
  {
    en: string;
    uz: string;
    defaultCode: string;
    accentTextClass: string;
    accentDotClass: string;
    accentBorderHoverClass: string;
  }
> = {
  Economics: {
    en: 'Economics',
    uz: 'Iqtisodiyot',
    defaultCode: '01',
    accentTextClass: 'text-theme-cyan',
    accentDotClass: 'bg-theme-cyan',
    accentBorderHoverClass: 'hover:border-theme-cyan',
  },
  Mathematics: {
    en: 'Mathematics',
    uz: 'Matematika',
    defaultCode: '02',
    accentTextClass: 'text-theme-accent',
    accentDotClass: 'bg-theme-accent',
    accentBorderHoverClass: 'hover:border-theme-accent',
  },
  Business: {
    en: 'Business',
    uz: 'Biznes',
    defaultCode: '03',
    accentTextClass: 'text-theme-emerald',
    accentDotClass: 'bg-theme-emerald',
    accentBorderHoverClass: 'hover:border-theme-emerald',
  },
};

export function buildSectionDividerMeta(params: {
  subject: Subject;
  locale: LocaleCode;
  indexLabel?: string;
}): SectionDividerMeta {
  const cfg = SUBJECT_DIVIDER_CONFIG[params.subject];
  const label = params.locale === 'uz' ? cfg.uz : cfg.en;
  const sectionCode = (params.indexLabel || cfg.defaultCode).trim();

  return {
    subject: params.subject,
    badgeLabel: label,
    sectionCode,
    ariaLabel:
      params.locale === 'uz'
        ? `${sectionCode}-bo‘lim ajratgichi: ${label}`
        : `Section ${sectionCode} divider: ${label}`,
    accentTextClass: cfg.accentTextClass,
    accentDotClass: cfg.accentDotClass,
    accentBorderHoverClass: cfg.accentBorderHoverClass,
  };
}
