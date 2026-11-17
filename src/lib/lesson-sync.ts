import type { LocaleCode } from '../shared/types';

export const COMPLETED_LESSONS_STORAGE_KEY = 'econova_completed_lessons_v1';

interface StoredCompletedLessonsMap {
  [scopeKey: string]: {
    [courseId: string]: string[];
  };
}

export interface LessonSyncReconciliationResult {
  mergedIds: string[];
  missingOnServer: string[];
  missingLocally: string[];
  inSync: boolean;
}

function getScopeKey(userId?: string | null): string {
  const trimmed = typeof userId === 'string' ? userId.trim() : '';
  return trimmed.length > 0 ? `user:${trimmed}` : 'guest';
}

/**
 * Deduplicates and filters lesson IDs, preserving canonical course lesson order
 * when `validCourseLessonIds` is supplied.
 */
export function normalizeLessonIdList(
  ids: readonly string[],
  validCourseLessonIds?: readonly string[]
): string[] {
  const unique = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const clean = raw.trim();
    if (clean.length > 0) {
      unique.add(clean);
    }
  }

  if (!validCourseLessonIds || validCourseLessonIds.length === 0) {
    return Array.from(unique);
  }

  const ordered: string[] = [];
  for (const courseLessonId of validCourseLessonIds) {
    if (unique.has(courseLessonId)) {
      ordered.push(courseLessonId);
    }
  }
  return ordered;
}

/**
 * Pure bidirectional reconciliation between localStorage completed lesson IDs
 * and authoritative server completed lesson IDs for a course.
 */
export function reconcileCompletedLessonIds(params: {
  localIds: readonly string[];
  serverIds: readonly string[];
  validCourseLessonIds?: readonly string[];
}): LessonSyncReconciliationResult {
  const localNorm = normalizeLessonIdList(params.localIds, params.validCourseLessonIds);
  const serverNorm = normalizeLessonIdList(params.serverIds, params.validCourseLessonIds);

  const localSet = new Set(localNorm);
  const serverSet = new Set(serverNorm);

  const missingOnServer = localNorm.filter((id) => !serverSet.has(id));
  const missingLocally = serverNorm.filter((id) => !localSet.has(id));
  const mergedIds = normalizeLessonIdList(
    [...serverNorm, ...localNorm],
    params.validCourseLessonIds
  );

  return {
    mergedIds,
    missingOnServer,
    missingLocally,
    inSync: missingOnServer.length === 0 && missingLocally.length === 0,
  };
}

function readRawStorageMap(): StoredCompletedLessonsMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(COMPLETED_LESSONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredCompletedLessonsMap;
  } catch {
    return {};
  }
}

function writeRawStorageMap(map: StoredCompletedLessonsMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(COMPLETED_LESSONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Non-blocking storage quota fallback
  }
}

export function loadLocalCompletedLessonIds(
  courseId: string,
  userId?: string | null
): string[] {
  if (!courseId) return [];
  const map = readRawStorageMap();
  const userScope = getScopeKey(userId);
  const scopedIds = Array.isArray(map[userScope]?.[courseId]) ? map[userScope][courseId] : [];
  if (userScope === 'guest') {
    return normalizeLessonIdList(scopedIds);
  }
  const guestIds = Array.isArray(map.guest?.[courseId]) ? map.guest[courseId] : [];
  return normalizeLessonIdList([...scopedIds, ...guestIds]);
}

export function saveLocalCompletedLessonIds(
  courseId: string,
  lessonIds: readonly string[],
  userId?: string | null
): string[] {
  if (!courseId) return [];
  const normalized = normalizeLessonIdList(lessonIds);
  const map = readRawStorageMap();
  const scope = getScopeKey(userId);
  const nextScopeMap = { ...(map[scope] || {}), [courseId]: normalized };
  writeRawStorageMap({ ...map, [scope]: nextScopeMap });
  return normalized;
}

export function recordLocalLessonCompletion(
  courseId: string,
  lessonId: string,
  userId?: string | null
): string[] {
  const existing = loadLocalCompletedLessonIds(courseId, userId);
  return saveLocalCompletedLessonIds(courseId, [...existing, lessonId], userId);
}

export function clearGuestCompletedLessonIdsForCourse(courseId: string): void {
  if (!courseId) return;
  const map = readRawStorageMap();
  if (!map.guest || !(courseId in map.guest)) return;
  const nextGuest = { ...map.guest };
  delete nextGuest[courseId];
  writeRawStorageMap({ ...map, guest: nextGuest });
}

export function formatLessonSyncStatusMessage(params: {
  locale: LocaleCode;
  pushedCount: number;
  pulledCount: number;
  totalSynced: number;
  unauthenticated?: boolean;
  error?: string | null;
}): string {
  const isUz = params.locale === 'uz';

  if (params.error) {
    return isUz
      ? `Sinxronlash xatosi: ${params.error}`
      : `Sync failed: ${params.error}`;
  }

  if (params.unauthenticated) {
    return isUz
      ? 'Qurilmalararo sinxronlash uchun hisobga kiring.'
      : 'Sign in to sync completed lessons across devices.';
  }

  if (params.pushedCount === 0 && params.pulledCount === 0) {
    return isUz
      ? `To‘liq sinxronlangan · ${params.totalSynced} ta dars tasdiqlangan`
      : `Up to date · ${params.totalSynced} completed lessons synced`;
  }

  if (isUz) {
    return `Sinxronlandi: ${params.pushedCount} ta yuklandi, ${params.pulledCount} ta serverdan olindi`;
  }

  return `Synced: ${params.pushedCount} uploaded, ${params.pulledCount} pulled from server`;
}
