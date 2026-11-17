import type { CourseCatalogItem, CourseLevel, LocaleCode, Subject } from '../shared/types';

export const PUBLIC_CATALOG_CACHE_NAME = 'econova-public-catalog';

export type ServiceWorkerAvailability = 'unsupported' | 'registering' | 'active' | 'error';

export type CourseOfflineStatus =
  | 'cached_full'
  | 'not_cached'
  | 'sw_pending'
  | 'sw_unavailable';

export interface ParsedOfflineCacheSnapshot {
  hasCatalog: boolean;
  editionKeys: Set<string>;
}

export interface CachedCourseEntry {
  key: string;
  courseId: string;
  locale: LocaleCode;
  title: string;
  subject: Subject | null;
  level: CourseLevel | null;
  estimatedMinutes: number | null;
}

const COURSE_EDITION_PATH_RE = /^\/api\/courses\/([^/]+)\/editions\/(en|uz)$/i;

export function makeEditionCacheKey(courseId: string, locale: LocaleCode): string {
  return `${courseId}:${locale}`;
}

export function parseEditionCacheKey(
  key: string
): { courseId: string; locale: LocaleCode } | null {
  const sepIndex = key.lastIndexOf(':');
  if (sepIndex <= 0) return null;
  const courseId = key.slice(0, sepIndex);
  const locale = key.slice(sepIndex + 1);
  if (locale !== 'en' && locale !== 'uz') return null;
  return { courseId, locale };
}

export function resolveCachedCourseDetails(
  cachedEditionKeys: ReadonlySet<string>,
  courses: CourseCatalogItem[]
): CachedCourseEntry[] {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const items: CachedCourseEntry[] = [];

  for (const key of cachedEditionKeys) {
    const parsed = parseEditionCacheKey(key);
    if (!parsed) continue;
    const course = courseById.get(parsed.courseId);
    const edition = course?.editions[parsed.locale] ?? null;

    items.push({
      key,
      courseId: parsed.courseId,
      locale: parsed.locale,
      title: edition?.title || course?.editions.en?.title || course?.slug || parsed.courseId,
      subject: course?.subject ?? null,
      level: course?.level ?? null,
      estimatedMinutes: edition?.estimatedMinutes ?? course?.estimatedMinutes ?? null,
    });
  }

  return items.sort((a, b) => {
    const titleCmp = a.title.localeCompare(b.title);
    if (titleCmp !== 0) return titleCmp;
    return a.locale.localeCompare(b.locale);
  });
}

export function extractCachedCourseEditions(urls: string[]): ParsedOfflineCacheSnapshot {
  let hasCatalog = false;
  const editionKeys = new Set<string>();

  for (const rawUrl of urls) {
    try {
      const parsed = new URL(rawUrl, 'http://localhost');
      const pathname = parsed.pathname.replace(/\/+$/, '') || '/';

      if (pathname === '/api/catalog') {
        hasCatalog = true;
        continue;
      }

      const match = pathname.match(COURSE_EDITION_PATH_RE);
      if (match) {
        const courseId = decodeURIComponent(match[1]);
        const locale = match[2].toLowerCase() as LocaleCode;
        editionKeys.add(makeEditionCacheKey(courseId, locale));
      }
    } catch {
      // Ignore malformed cache key URLs
    }
  }

  return { hasCatalog, editionKeys };
}

export function resolveCourseOfflineStatus(params: {
  swStatus: ServiceWorkerAvailability;
  cachedEditionKeys: ReadonlySet<string>;
  courseId: string;
  locale: LocaleCode;
  hasEditionInLocale: boolean;
}): CourseOfflineStatus {
  if (params.swStatus === 'unsupported' || params.swStatus === 'error') {
    return 'sw_unavailable';
  }
  if (params.swStatus === 'registering') {
    return 'sw_pending';
  }
  if (
    params.hasEditionInLocale &&
    params.cachedEditionKeys.has(makeEditionCacheKey(params.courseId, params.locale))
  ) {
    return 'cached_full';
  }
  return 'not_cached';
}

export interface OfflineCacheInspectionResult {
  swStatus: ServiceWorkerAvailability;
  hasCatalog: boolean;
  cachedEditionKeys: Set<string>;
}

export async function clearCachedCourseEdition(
  courseId: string,
  locale: LocaleCode,
  cacheStorage?: CacheStorage
): Promise<boolean> {
  const storage =
    cacheStorage ?? (typeof window !== 'undefined' && 'caches' in window ? window.caches : null);
  if (!storage) return false;

  const targetKey = makeEditionCacheKey(courseId, locale);
  let removed = false;

  try {
    const cacheNames = await storage.keys();
    for (const cacheName of cacheNames) {
      const cache = await storage.open(cacheName);
      const requests = await cache.keys();
      for (const req of requests) {
        const parsed = extractCachedCourseEditions([req.url]);
        if (parsed.editionKeys.has(targetKey)) {
          const deleted = await cache.delete(req);
          if (deleted) removed = true;
        }
      }
    }
  } catch {
    return false;
  }

  return removed;
}

export async function inspectPwaOfflineCache(): Promise<OfflineCacheInspectionResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { swStatus: 'unsupported', hasCatalog: false, cachedEditionKeys: new Set() };
  }

  let swStatus: ServiceWorkerAvailability = 'registering';
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.active || navigator.serviceWorker.controller) {
      swStatus = 'active';
    } else if (registration?.installing || registration?.waiting) {
      swStatus = 'registering';
    }
  } catch {
    return { swStatus: 'error', hasCatalog: false, cachedEditionKeys: new Set() };
  }

  if (!('caches' in window)) {
    return { swStatus, hasCatalog: false, cachedEditionKeys: new Set() };
  }

  try {
    const cacheNames = await window.caches.keys();
    const collectedUrls: string[] = [];

    // Prioritize the configured Workbox runtime cache, and also inspect any other caches
    // in case a future cache name revision holds course responses.
    const orderedNames = cacheNames.includes(PUBLIC_CATALOG_CACHE_NAME)
      ? [PUBLIC_CATALOG_CACHE_NAME, ...cacheNames.filter((n) => n !== PUBLIC_CATALOG_CACHE_NAME)]
      : cacheNames;

    for (const cacheName of orderedNames) {
      const cache = await window.caches.open(cacheName);
      const requests = await cache.keys();
      for (const req of requests) {
        collectedUrls.push(req.url);
      }
    }

    const parsed = extractCachedCourseEditions(collectedUrls);
    return {
      swStatus,
      hasCatalog: parsed.hasCatalog,
      cachedEditionKeys: parsed.editionKeys,
    };
  } catch {
    return { swStatus, hasCatalog: false, cachedEditionKeys: new Set() };
  }
}
