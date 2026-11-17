import type { LocaleCode } from '../shared/types';
import { t } from './i18n';

export interface KineticHeroLine {
  id: string;
  primaryText: string;
  accentText?: string;
  scrollTranslateXPercent: number;
  scrollTranslateY: number;
  scrollScale: number;
}

export interface KineticHeroConfig {
  badgeLabel: string;
  lines: KineticHeroLine[];
  scrubFactor: number;
  maxScale: number;
  minScale: number;
}

/**
 * Pure decoupled builder for the ECONOVA GSAP ScrollTrigger Kinetic Typography Hero.
 * Computes localized oversized display lines and deterministic scroll transform targets
 * so the kinetic motion remains calm, academic, and bounded within safe viewport limits.
 */
export function buildKineticHeroConfig(
  locale: LocaleCode,
  prefersReducedMotion = false
): KineticHeroConfig {
  const isUz = locale === 'uz';
  const dict = t(locale).kinetic;

  if (prefersReducedMotion) {
    return {
      badgeLabel: isUz
        ? 'IQTISODIYOT · MATEMATIKA · BIZNES'
        : 'ECONOMICS · MATHEMATICS · BUSINESS',
      lines: [
        {
          id: 'line-1',
          primaryText: dict.line1,
          accentText: isUz ? 'TAFAKKUR.' : dict.line1Accent,
          scrollTranslateXPercent: 0,
          scrollTranslateY: 0,
          scrollScale: 1,
        },
        {
          id: 'line-2',
          primaryText: dict.line2Outline,
          accentText: isUz ? 'MODELLAR' : dict.line2Solid,
          scrollTranslateXPercent: 0,
          scrollTranslateY: 0,
          scrollScale: 1,
        },
      ],
      scrubFactor: 0,
      maxScale: 1,
      minScale: 1,
    };
  }

  return {
    badgeLabel: isUz
      ? 'IQTISODIYOT · MATEMATIKA · BIZNES'
      : 'ECONOMICS · MATHEMATICS · BUSINESS',
    lines: [
      {
        id: 'line-1',
        primaryText: dict.line1,
        accentText: isUz ? 'TAFAKKUR.' : dict.line1Accent,
        scrollTranslateXPercent: -4.5,
        scrollTranslateY: -14,
        scrollScale: 0.92,
      },
      {
        id: 'line-2',
        primaryText: dict.line2Outline,
        accentText: isUz ? 'MODELLAR' : dict.line2Solid,
        scrollTranslateXPercent: 4.5,
        scrollTranslateY: -22,
        scrollScale: 1.07,
      },
    ],
    scrubFactor: 0.65,
    maxScale: 1.08,
    minScale: 0.9,
  };
}

/**
 * Interpolates a single kinetic line's transform values for a normalized ScrollTrigger progress (0..1).
 */
export function interpolateKineticLineTransform(
  line: KineticHeroLine,
  progress: number
): { xPercent: number; y: number; scale: number } {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return {
    xPercent: Number((line.scrollTranslateXPercent * clamped).toFixed(3)),
    y: Number((line.scrollTranslateY * clamped).toFixed(3)),
    scale: Number((1 + (line.scrollScale - 1) * clamped).toFixed(4)),
  };
}
