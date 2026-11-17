import type {
  CourseCatalogItem,
  CourseLevel,
  EnrollmentRecord,
  LocaleCode,
  Subject,
} from '../shared/types';

export interface BookmarkedCourseCard {
  courseId: string;
  title: string;
  subtitle: string;
  subject: Subject;
  level: CourseLevel;
  estimatedMinutes: number;
  hasEditionInLocale: boolean;
  openLocale: LocaleCode;
  enrollment: EnrollmentRecord | null;
}

export function normalizeBookmarkedCourseIds(raw: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch {
      return [];
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function isCourseBookmarked(
  bookmarkedIds: readonly string[],
  courseId: string
): boolean {
  const clean = courseId.trim();
  if (!clean) return false;
  return bookmarkedIds.includes(clean);
}

export function toggleBookmarkedCourseId(
  bookmarkedIds: readonly string[],
  courseId: string,
  forceBookmarked?: boolean
): { nextIds: string[]; bookmarked: boolean } {
  const normalized = normalizeBookmarkedCourseIds(bookmarkedIds);
  const cleanId = courseId.trim();
  if (!cleanId) {
    return { nextIds: normalized, bookmarked: false };
  }

  const currentlyBookmarked = normalized.includes(cleanId);
  const targetBookmarked =
    typeof forceBookmarked === 'boolean' ? forceBookmarked : !currentlyBookmarked;

  if (targetBookmarked) {
    const without = normalized.filter((id) => id !== cleanId);
    return {
      nextIds: [cleanId, ...without],
      bookmarked: true,
    };
  }

  return {
    nextIds: normalized.filter((id) => id !== cleanId),
    bookmarked: false,
  };
}

export function resolveBookmarkedCourses(params: {
  bookmarkedIds: readonly string[];
  courses: readonly CourseCatalogItem[];
  locale: LocaleCode;
  enrollments?: readonly EnrollmentRecord[];
}): BookmarkedCourseCard[] {
  const normalizedIds = normalizeBookmarkedCourseIds(params.bookmarkedIds);
  const courseMap = new Map<string, CourseCatalogItem>();
  for (const course of params.courses) {
    courseMap.set(course.id, course);
  }

  const enrollmentMap = new Map<string, EnrollmentRecord>();
  for (const enr of params.enrollments || []) {
    enrollmentMap.set(enr.courseId, enr);
  }

  const resolved: BookmarkedCourseCard[] = [];
  for (const courseId of normalizedIds) {
    const course = courseMap.get(courseId);
    if (!course) continue;
    const preferredEdition = course.editions[params.locale];
    const fallbackEdition = preferredEdition || course.editions.en || course.editions.uz;
    const openLocale: LocaleCode = preferredEdition
      ? params.locale
      : course.editions.en
      ? 'en'
      : 'uz';

    resolved.push({
      courseId: course.id,
      title: fallbackEdition ? fallbackEdition.title : course.slug,
      subtitle: fallbackEdition ? fallbackEdition.subtitle : '',
      subject: course.subject,
      level: course.level,
      estimatedMinutes: fallbackEdition ? fallbackEdition.estimatedMinutes : course.estimatedMinutes,
      hasEditionInLocale: Boolean(preferredEdition),
      openLocale,
      enrollment: enrollmentMap.get(course.id) ?? null,
    });
  }

  return resolved;
}
