import type { LocaleCode, UserRole } from '../shared/types';

export type AppNavTab =
  | 'landing'
  | 'overview'
  | 'catalog'
  | 'course'
  | 'achievements'
  | 'community'
  | 'certificates'
  | 'profile'
  | 'admin'
  | 'login'
  | 'register';

export interface IntendedDestination {
  tab: Exclude<AppNavTab, 'login' | 'register' | 'landing'>;
  path: string;
  courseId?: string | null;
  lessonIndex?: number | 'assessment';
  label?: string;
}

export const PROTECTED_TABS: ReadonlyArray<AppNavTab> = [
  'achievements',
  'profile',
  'admin',
];

export const PROTECTED_ROUTE_PREFIXES: ReadonlyArray<string> = [
  '/achievements',
  '/profile',
  '/admin',
  '/dashboard',
];

const TAB_TO_PATH: Record<AppNavTab, string> = {
  landing: '/',
  overview: '/overview',
  catalog: '/catalog',
  course: '/course',
  achievements: '/achievements',
  community: '/community',
  certificates: '/certificates',
  profile: '/profile',
  admin: '/admin',
  login: '/login',
  register: '/register',
};

export function isProtectedTab(tab: AppNavTab): tab is 'achievements' | 'profile' | 'admin' {
  return PROTECTED_TABS.includes(tab);
}

export function isProtectedPathname(pathname: string): boolean {
  const clean = stripLocalePrefix(pathname);
  if (PROTECTED_ROUTE_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`))) {
    return true;
  }
  if (/^\/course\/[^/]+\/(lesson|assessment)/.test(clean)) {
    return true;
  }
  return false;
}

export function stripLocalePrefix(pathname: string): string {
  const normalized = pathname.trim() || '/';
  const match = normalized.match(/^\/(?:en|uz)(\/.*|$)/i);
  if (match) {
    return match[1] || '/';
  }
  return normalized;
}

export function sanitizeRedirectTo(
  rawRedirectTo: string | null | undefined,
  fallback = '/overview'
): string {
  if (!rawRedirectTo || typeof rawRedirectTo !== 'string') {
    return fallback;
  }
  const trimmed = rawRedirectTo.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  const cleanPath = stripLocalePrefix(trimmed.split('?')[0] || '/');
  if (cleanPath === '/login' || cleanPath === '/register') {
    return fallback;
  }
  return trimmed;
}

export function buildPathForTab(
  tab: AppNavTab,
  options?: {
    courseId?: string | null;
    redirectTo?: string | null;
  }
): string {
  if (tab === 'course' && options?.courseId) {
    return `/course/${encodeURIComponent(options.courseId)}`;
  }
  const basePath = TAB_TO_PATH[tab] || '/overview';
  if ((tab === 'login' || tab === 'register') && options?.redirectTo) {
    const safeRedirect = sanitizeRedirectTo(options.redirectTo, '/overview');
    return `${basePath}?redirectTo=${encodeURIComponent(safeRedirect)}`;
  }
  return basePath;
}

export function parseRouteFromLocation(
  pathname: string,
  search = ''
): {
  tab: AppNavTab;
  courseId: string | null;
  redirectTo: string | null;
} {
  const clean = stripLocalePrefix(pathname);
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const redirectToParam = params.get('redirectTo') || params.get('callbackUrl') || params.get('next');
  const redirectTo = redirectToParam ? sanitizeRedirectTo(redirectToParam, '/overview') : null;

  if (params.get('verify')) {
    return { tab: 'certificates', courseId: null, redirectTo };
  }

  // Public marketing landing lives at the bare root; every app surface has its own path.
  if (clean === '/') {
    return { tab: 'landing', courseId: null, redirectTo };
  }
  if (clean === '/login' || clean === '/signin') {
    return { tab: 'login', courseId: null, redirectTo };
  }
  if (clean === '/register' || clean === '/signup') {
    return { tab: 'register', courseId: null, redirectTo };
  }
  if (clean === '/catalog' || clean === '/courses') {
    return { tab: 'catalog', courseId: null, redirectTo };
  }
  if (clean === '/achievements' || clean === '/xp' || clean === '/dashboard') {
    return { tab: 'achievements', courseId: null, redirectTo };
  }
  if (clean === '/community' || clean === '/leaderboard') {
    return { tab: 'community', courseId: null, redirectTo };
  }
  if (clean === '/certificates') {
    return { tab: 'certificates', courseId: null, redirectTo };
  }
  if (clean === '/profile' || clean === '/settings') {
    return { tab: 'profile', courseId: null, redirectTo };
  }
  if (clean === '/admin' || clean === '/studio') {
    return { tab: 'admin', courseId: null, redirectTo };
  }

  const courseMatch = clean.match(/^\/course\/([^/]+)/);
  if (courseMatch && courseMatch[1]) {
    return {
      tab: 'course',
      courseId: decodeURIComponent(courseMatch[1]),
      redirectTo,
    };
  }

  return { tab: 'overview', courseId: null, redirectTo };
}

export function resolveDestinationFromPath(
  rawPath: string | null | undefined,
  fallbackCourseId?: string | null
): IntendedDestination {
  const safePath = sanitizeRedirectTo(rawPath, '/overview');
  const [pathnamePart, searchPart = ''] = safePath.split('?');
  const parsed = parseRouteFromLocation(pathnamePart, searchPart);
  const targetTab =
    parsed.tab === 'login' || parsed.tab === 'register' || parsed.tab === 'landing'
      ? 'overview'
      : parsed.tab;

  return {
    tab: targetTab,
    path: safePath,
    courseId: parsed.courseId ?? fallbackCourseId ?? null,
  };
}

export function formatDestinationLabel(
  destination: IntendedDestination | string | null | undefined,
  locale: LocaleCode
): string {
  const resolved =
    typeof destination === 'string'
      ? resolveDestinationFromPath(destination)
      : destination ?? { tab: 'overview', path: '/overview' };

  const labelsEn: Record<Exclude<AppNavTab, 'login' | 'register' | 'landing'>, string> = {
    overview: 'Overview Dashboard',
    catalog: 'Course Catalog',
    course: resolved.courseId ? `Course (${resolved.courseId})` : 'Course Workspace',
    achievements: 'XP & Study Streak',
    community: 'Cohort Leaderboard',
    certificates: 'Certificates & Verification',
    profile: 'Profile & Privacy Settings',
    admin: 'Editorial Studio',
  };

  const labelsUz: Record<Exclude<AppNavTab, 'login' | 'register' | 'landing'>, string> = {
    overview: 'Bosh sahifa',
    catalog: 'Kurslar katalogi',
    course: resolved.courseId ? `Kurs (${resolved.courseId})` : 'Kurs oynasi',
    achievements: 'XP va davomiylik',
    community: 'Haftalik reyting',
    certificates: 'Sertifikatlar',
    profile: 'Profil va maxfiylik',
    admin: 'Tahririyat studiyasi',
  };

  return locale === 'uz' ? labelsUz[resolved.tab] : labelsEn[resolved.tab];
}

export interface MiddlewareGuardInput {
  pathname: string;
  search?: string;
  isAuthenticated: boolean;
  userRole?: UserRole | null;
}

export interface MiddlewareGuardDecision {
  action: 'allow' | 'redirect';
  destination: string | null;
  reason: 'public_route' | 'authenticated' | 'unauthenticated_protected' | 'already_authenticated' | 'insufficient_role';
}

export function evaluateMiddlewareRouteGuard(
  input: MiddlewareGuardInput
): MiddlewareGuardDecision {
  const cleanPath = stripLocalePrefix(input.pathname || '/');
  const searchStr = input.search
    ? input.search.startsWith('?')
      ? input.search
      : `?${input.search}`
    : '';
  const fullRequestedPath = `${cleanPath}${searchStr}`;

  if (cleanPath === '/login' || cleanPath === '/register') {
    if (input.isAuthenticated) {
      const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr);
      const target = sanitizeRedirectTo(
        params.get('redirectTo') || params.get('callbackUrl') || '/overview',
        '/overview'
      );
      return {
        action: 'redirect',
        destination: target,
        reason: 'already_authenticated',
      };
    }
    return {
      action: 'allow',
      destination: null,
      reason: 'public_route',
    };
  }

  if (isProtectedPathname(cleanPath)) {
    if (!input.isAuthenticated) {
      return {
        action: 'redirect',
        destination: `/login?redirectTo=${encodeURIComponent(fullRequestedPath)}`,
        reason: 'unauthenticated_protected',
      };
    }
    if (
      (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) &&
      input.userRole &&
      !['editor', 'reviewer', 'publisher', 'admin'].includes(input.userRole)
    ) {
      return {
        action: 'redirect',
        destination: '/overview',
        reason: 'insufficient_role',
      };
    }
    return {
      action: 'allow',
      destination: null,
      reason: 'authenticated',
    };
  }

  return {
    action: 'allow',
    destination: null,
    reason: input.isAuthenticated ? 'authenticated' : 'public_route',
  };
}
