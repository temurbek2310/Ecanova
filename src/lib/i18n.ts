import enMessages from '../messages/en.json';
import uzMessages from '../messages/uz.json';
import type { CourseLevel, EditorialStatus, JourneyStatus, LocaleCode, Subject } from '../shared/types';

export type TranslationDictionary = typeof enMessages & {
  subjects: Record<Subject, string>;
  levels: Record<CourseLevel, string>;
  journey: Record<JourneyStatus, string>;
  editorial: Record<EditorialStatus, string>;
};

export const LOCALE_STORAGE_KEY = 'econova_locale';
export const LOCALE_COOKIE_KEY = 'NEXT_LOCALE';
export const SUPPORTED_LOCALES: readonly LocaleCode[] = ['en', 'uz'] as const;

export const UI_STRINGS: Record<LocaleCode, TranslationDictionary> = {
  en: enMessages as TranslationDictionary,
  uz: uzMessages as TranslationDictionary,
};

export function isValidLocale(value: unknown): value is LocaleCode {
  return value === 'en' || value === 'uz';
}

export function t(locale: LocaleCode): TranslationDictionary {
  return UI_STRINGS[isValidLocale(locale) ? locale : 'en'];
}

export function formatTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  );
}

export function formatCourseMetaSummary(
  lessonCount: number,
  estimatedMinutes: number,
  passingScorePercent: number,
  locale: LocaleCode
): string {
  const dict = t(locale);
  return formatTemplate(dict.economics.courseMetaFormat, {
    lessons: lessonCount,
    minutes: estimatedMinutes,
    pass: passingScorePercent,
  });
}

export function parseCookieLocale(cookieHeader: string | undefined | null): LocaleCode | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const rawPart of parts) {
    const [rawKey, ...rawVal] = rawPart.trim().split('=');
    if (rawKey === LOCALE_COOKIE_KEY || rawKey === LOCALE_STORAGE_KEY) {
      const candidate = decodeURIComponent(rawVal.join('=')).trim().toLowerCase();
      if (isValidLocale(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export function parsePathnameOrSearchLocale(
  pathname?: string | null,
  search?: string | null
): LocaleCode | null {
  if (pathname) {
    const seg = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    if (isValidLocale(seg)) {
      return seg;
    }
  }
  if (search) {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const queryLocale = (params.get('lang') || params.get('locale'))?.toLowerCase();
    if (isValidLocale(queryLocale)) {
      return queryLocale;
    }
  }
  return null;
}

export function resolveInitialLocale(options?: {
  pathname?: string | null;
  search?: string | null;
  cookieString?: string | null;
  storageValue?: string | null;
}): LocaleCode {
  const fromUrl = parsePathnameOrSearchLocale(
    options?.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    options?.search ?? (typeof window !== 'undefined' ? window.location.search : null)
  );
  if (fromUrl) return fromUrl;

  const storageCandidate =
    options?.storageValue !== undefined
      ? options.storageValue
      : typeof window !== 'undefined'
      ? (() => {
          try {
            return window.localStorage.getItem(LOCALE_STORAGE_KEY);
          } catch {
            return null;
          }
        })()
      : null;

  if (isValidLocale(storageCandidate)) {
    return storageCandidate;
  }

  const cookieCandidate = parseCookieLocale(
    options?.cookieString !== undefined
      ? options.cookieString
      : typeof document !== 'undefined'
      ? document.cookie
      : null
  );
  if (cookieCandidate) {
    return cookieCandidate;
  }

  return 'en';
}

export function persistLocalePreference(locale: LocaleCode): void {
  const safeLocale: LocaleCode = isValidLocale(locale) ? locale : 'en';

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, safeLocale);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  if (typeof document !== 'undefined') {
    try {
      document.cookie = `${LOCALE_COOKIE_KEY}=${safeLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `${LOCALE_STORAGE_KEY}=${safeLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignore cookie write errors
    }
  }

  applyDocumentLocale(safeLocale);
}

export function applyDocumentLocale(locale: LocaleCode): void {
  const safeLocale: LocaleCode = isValidLocale(locale) ? locale : 'en';
  if (typeof document === 'undefined') return;
  const dict = t(safeLocale);
  document.documentElement.lang = safeLocale;
  document.documentElement.setAttribute('data-locale', safeLocale);
  if (dict.metaTitle) {
    document.title = dict.metaTitle;
  }
}
