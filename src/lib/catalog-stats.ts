import type { CourseCatalogItem, LocaleCode } from '../shared/types';

export interface CatalogStats {
  courseCount: number;
  lessonCount: number;
}

/**
 * Live platform stats from the published catalog (replaces hardcoded
 * marketing numbers). Lessons are counted from the edition in the active
 * locale, falling back to the other published edition.
 */
export function computeCatalogStats(
  courses: readonly CourseCatalogItem[],
  locale: LocaleCode = 'en'
): CatalogStats {
  let lessonCount = 0;
  for (const course of courses) {
    const edition = course.editions[locale] ?? course.editions.en ?? course.editions.uz ?? null;
    lessonCount += Math.max(0, Number(edition?.lessonCount ?? 0) || 0);
  }
  return { courseCount: courses.length, lessonCount };
}

/** Display value for a stat tile: placeholder while loading or when the catalog is unavailable. */
export function formatCatalogStat(
  value: number,
  state: { loading: boolean; unavailable: boolean },
  placeholder = '—'
): string {
  if (state.loading || state.unavailable) return placeholder;
  return String(value);
}
