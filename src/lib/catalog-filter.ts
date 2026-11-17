import type { CourseCatalogItem, CourseLevel, LocaleCode, Subject } from '../shared/types';

export interface CatalogFilterCriteria {
  subject: Subject | 'ALL';
  level: CourseLevel | 'ALL';
  searchQuery: string;
  locale: LocaleCode;
}

export interface CourseTopicLabel {
  id: string;
  label: string;
  colorVariant: 'cyan' | 'emerald' | 'violet' | 'amber';
}

export const RECENT_SEARCHES_STORAGE_KEY = 'econova_recent_catalog_searches_v1';
export const MAX_RECENT_SEARCHES = 5;

/**
 * Generates deterministic, color-coded topic labels (e.g., 'Macroeconomics', 'Linear Algebra',
 * 'Microeconomics', 'Applied Calculus', 'Unit Economics', 'Corporate Finance') for Course Catalog cards.
 */
export function getCourseTopicLabels(
  course: Pick<CourseCatalogItem, 'id' | 'slug' | 'subject' | 'level' | 'topicTags'>,
  locale: LocaleCode = 'en'
): CourseTopicLabel[] {
  if (Array.isArray(course.topicTags) && course.topicTags.length > 0) {
    return course.topicTags.slice(0, 3).map((tag, idx) => ({
      id: `${course.id}-tag-${idx}`,
      label: tag,
      colorVariant:
        course.subject === 'Economics'
          ? idx % 2 === 0
            ? 'cyan'
            : 'emerald'
          : course.subject === 'Mathematics'
          ? idx % 2 === 0
            ? 'violet'
            : 'amber'
          : idx % 2 === 0
          ? 'amber'
          : 'cyan',
    }));
  }

  const slug = (course.slug || '').toLowerCase();

  if (course.subject === 'Economics') {
    if (locale === 'uz') {
      return [
        { id: `${course.id}-micro`, label: 'Mikroiqtisodiyot', colorVariant: 'cyan' },
        { id: `${course.id}-macro`, label: 'Makroiqtisodiyot', colorVariant: 'emerald' },
      ];
    }
    return [
      { id: `${course.id}-micro`, label: 'Microeconomics', colorVariant: 'cyan' },
      { id: `${course.id}-macro`, label: 'Macroeconomics', colorVariant: 'emerald' },
    ];
  }

  if (course.subject === 'Mathematics') {
    if (locale === 'uz') {
      return [
        { id: `${course.id}-linalg`, label: 'Chiziqli algebra', colorVariant: 'violet' },
        { id: `${course.id}-calc`, label: 'Amaliy matematik analiz', colorVariant: 'amber' },
      ];
    }
    return [
      { id: `${course.id}-linalg`, label: 'Linear Algebra', colorVariant: 'violet' },
      { id: `${course.id}-calc`, label: 'Applied Calculus', colorVariant: 'amber' },
    ];
  }

  // Business
  if (slug.includes('unit') || course.subject === 'Business') {
    if (locale === 'uz') {
      return [
        { id: `${course.id}-unit`, label: 'Birlik iqtisodiyoti', colorVariant: 'amber' },
        { id: `${course.id}-corp`, label: 'Korporativ moliya', colorVariant: 'cyan' },
      ];
    }
    return [
      { id: `${course.id}-unit`, label: 'Unit Economics', colorVariant: 'amber' },
      { id: `${course.id}-corp`, label: 'Corporate Finance', colorVariant: 'cyan' },
    ];
  }

  return [];
}

/**
 * Returns specific lesson content titles within a course that match the active search query.
 */
export function getMatchingLessonTitles(
  course: CourseCatalogItem,
  searchQuery: string,
  locale: LocaleCode
): string[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const activeEdition = course.editions[locale] ?? course.editions.en;
  const lessonTitles = activeEdition?.lessonTitles ?? course.editions.en?.lessonTitles ?? [];
  return lessonTitles.filter((title) => title.toLowerCase().includes(normalizedQuery));
}

/**
 * Pure, deterministic filter for the Course Catalog.
 * Matches against course title, description, topic labels, and specific lesson content titles.
 */
export function filterCatalogCourses(
  courses: readonly CourseCatalogItem[],
  criteria: CatalogFilterCriteria
): CourseCatalogItem[] {
  const normalizedQuery = criteria.searchQuery.trim().toLowerCase();

  return courses.filter((course) => {
    if (criteria.subject !== 'ALL' && course.subject !== criteria.subject) {
      return false;
    }

    if (criteria.level !== 'ALL' && course.level !== criteria.level) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const activeEdition = course.editions[criteria.locale];
    const displayedTitle =
      activeEdition?.title ?? course.editions.en?.title ?? course.slug ?? '';
    const displayedDescription = activeEdition?.description ?? '';
    const lessonTitles =
      activeEdition?.lessonTitles ?? course.editions.en?.lessonTitles ?? [];
    const topicLabels = getCourseTopicLabels(course, criteria.locale).map((t) => t.label);

    const matchesTitle = displayedTitle.toLowerCase().includes(normalizedQuery);
    const matchesDescription = displayedDescription.toLowerCase().includes(normalizedQuery);
    const matchesLessonTitle = lessonTitles.some((lt) =>
      lt.toLowerCase().includes(normalizedQuery)
    );
    const matchesTopicLabel = topicLabels.some((lbl) =>
      lbl.toLowerCase().includes(normalizedQuery)
    );

    return matchesTitle || matchesDescription || matchesLessonTitle || matchesTopicLabel;
  });
}

export function normalizeRecentSearches(
  raw: unknown,
  max: number = MAX_RECENT_SEARCHES
): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

export function addRecentSearchQuery(
  existing: readonly string[],
  query: string,
  max: number = MAX_RECENT_SEARCHES
): string[] {
  const clean = query.trim();
  if (clean.length < 2) {
    return normalizeRecentSearches(existing, max);
  }
  return normalizeRecentSearches([clean, ...existing], max);
}

export function loadRecentSearches(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    return normalizeRecentSearches(JSON.parse(raw), MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function saveRecentSearches(queries: readonly string[]): string[] {
  const normalized = normalizeRecentSearches(queries, MAX_RECENT_SEARCHES);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
  }
  return normalized;
}
