import type { LocaleCode, UserRole } from '../shared/types';
import { ADMIN_ROLES } from '../shared/econova-rules.ts';

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

/** The five admin console pages, each with its own URL under `/admin`. */
export type AdminSection = 'overview' | 'curriculum' | 'moderation' | 'users' | 'audit';

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  'overview',
  'curriculum',
  'moderation',
  'users',
  'audit',
];

export const ADMIN_SECTION_PATHS: Readonly<Record<AdminSection, string>> = {
  overview: '/admin',
  curriculum: '/admin/curriculum',
  moderation: '/admin/moderation',
  users: '/admin/users',
  audit: '/admin/audit',
};

export interface IntendedDestination {
  tab: Exclude<AppNavTab, 'login' | 'register' | 'landing'>;
  path: string;
  courseId?: string | null;
  lessonIndex?: number | 'assessment';
  label?: string;
}

/* ------------------------------------------------------------------------- */
/* Route access policy registry                                              */
/* ------------------------------------------------------------------------- */

/**
 * - `public`: anyone, signed in or not.
 * - `guest_only`: signed-out visitors only; signed-in users bounce to their
 *   sanitized `redirectTo` (or `/overview`).
 * - `authenticated`: any signed-in user; guests go to `/login?redirectTo=…`.
 * - `role_protected`: signed-in users whose role is in `allowedRoles`; guests
 *   go to login, signed-in users without a matching role go to `/overview`.
 */
export type RouteAccessMode = 'public' | 'guest_only' | 'authenticated' | 'role_protected';

interface RouteAccessPolicyBase {
  /** Stable identifier, used in guard decisions and logs. */
  id: string;
  /**
   * Locale-stripped, lower-case path prefixes. A prefix matches the exact path
   * and every sub-path (`/admin` matches `/admin/queue`). `/` only ever matches
   * the bare root. When several policies match, the longest prefix wins, so a
   * narrower workspace (e.g. `/studio/review`) can override its parent.
   */
  paths: readonly string[];
}

export type RouteAccessPolicy =
  | (RouteAccessPolicyBase & { mode: 'public' | 'guest_only' | 'authenticated' })
  | (RouteAccessPolicyBase & {
      mode: 'role_protected';
      /** Roles allowed in. A missing or null role is always denied. */
      allowedRoles: readonly UserRole[];
      /**
       * Optional canonical path. Users who pass the role check are redirected
       * there (reason `route_alias`), keeping the locale prefix and query.
       */
      canonicalPath?: string;
    });

/**
 * The single source of truth for who may open which page. The Express HTML
 * guard (server.ts), the edge-style middleware (src/middleware.ts) and the SPA
 * (App.tsx: first load, tab clicks, back/forward, post-login redirects) all
 * decide through `evaluateMiddlewareRouteGuard`, which reads only this list.
 *
 * Adding a role-specific workspace is one entry, for example:
 *   { id: 'admin_reports', mode: 'role_protected', paths: ['/admin/reports'],
 *     allowedRoles: ADMIN_ROLES }
 */
export const ROUTE_ACCESS_POLICIES: readonly RouteAccessPolicy[] = [
  { id: 'landing', mode: 'public', paths: ['/'] },
  { id: 'overview', mode: 'public', paths: ['/overview'] },
  { id: 'catalog', mode: 'public', paths: ['/catalog', '/courses'] },
  // Course pages (lessons and assessments too) stay public: guests study with
  // local progress, and only saving to the server needs sign-in.
  { id: 'course', mode: 'public', paths: ['/course'] },
  { id: 'community', mode: 'public', paths: ['/community', '/leaderboard'] },
  { id: 'auth', mode: 'guest_only', paths: ['/login', '/signin', '/register', '/signup'] },
  {
    id: 'learner_workspace',
    mode: 'authenticated',
    paths: ['/achievements', '/xp', '/dashboard', '/profile', '/settings', '/certificates'],
  },
  // Admin console. `/admin` also covers unknown `/admin/*` sub-paths, which
  // render the admin overview.
  { id: 'admin_overview', mode: 'role_protected', paths: ['/admin'], allowedRoles: ADMIN_ROLES },
  { id: 'admin_curriculum', mode: 'role_protected', paths: ['/admin/curriculum'], allowedRoles: ADMIN_ROLES },
  { id: 'admin_moderation', mode: 'role_protected', paths: ['/admin/moderation'], allowedRoles: ADMIN_ROLES },
  { id: 'admin_users', mode: 'role_protected', paths: ['/admin/users'], allowedRoles: ADMIN_ROLES },
  { id: 'admin_audit', mode: 'role_protected', paths: ['/admin/audit'], allowedRoles: ADMIN_ROLES },
  // Legacy Editorial Studio URL: still role-checked, then sent to Curriculum.
  {
    id: 'studio_alias',
    mode: 'role_protected',
    paths: ['/studio'],
    allowedRoles: ADMIN_ROLES,
    canonicalPath: ADMIN_SECTION_PATHS.curriculum,
  },
];

/** Any URL carrying a certificate verification token renders the public verifier. */
export const PUBLIC_CERTIFICATE_VERIFICATION_POLICY: RouteAccessPolicy = {
  id: 'certificate_verification',
  mode: 'public',
  paths: [],
};

/** Unknown paths render the public overview, so they are public too. */
export const FALLBACK_ROUTE_POLICY: RouteAccessPolicy = {
  id: 'fallback',
  mode: 'public',
  paths: [],
};

const LOCALE_PREFIX_PATTERN = /^\/(en|uz)(?=\/|$)/i;

/** Canonical path for each SPA tab; every tab's access follows from its path. */
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

export function stripLocalePrefix(pathname: string): string {
  const normalized = (pathname || '').trim() || '/';
  const match = normalized.match(/^\/(?:en|uz)(\/.*|$)/i);
  if (match) {
    return match[1] || '/';
  }
  return normalized;
}

/** Returns `/en` or `/uz` (lower-case) when the path starts with a locale segment. */
export function getLocalePrefix(pathname: string): '' | '/en' | '/uz' {
  const match = (pathname || '').trim().match(LOCALE_PREFIX_PATTERN);
  if (!match) return '';
  return match[1].toLowerCase() === 'uz' ? '/uz' : '/en';
}

/**
 * Locale-stripped, lower-cased path with trailing slashes removed. Used for
 * policy matching and tab parsing so `/UZ/Profile/` and `/profile` agree.
 */
export function normalizeRoutePath(pathname: string): string {
  const withoutQuery = (pathname || '').split(/[?#]/)[0] ?? '';
  const stripped = stripLocalePrefix(withoutQuery).toLowerCase();
  const trimmed = stripped.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function toSearchParams(search: string | null | undefined): URLSearchParams {
  const raw = search ?? '';
  return new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
}

/** True when the query carries a non-empty `verify` certificate token. */
export function hasPublicVerifyToken(search: string | null | undefined): boolean {
  return Boolean(toSearchParams(search).get('verify')?.trim());
}

function pathMatchesPrefix(cleanPath: string, prefix: string): boolean {
  if (prefix === '/') return cleanPath === '/';
  return cleanPath === prefix || cleanPath.startsWith(`${prefix}/`);
}

/** Resolves the policy for a pathname (+ optional query) by longest prefix. */
export function getRouteAccessPolicy(pathname: string, search = ''): RouteAccessPolicy {
  if (hasPublicVerifyToken(search)) {
    return PUBLIC_CERTIFICATE_VERIFICATION_POLICY;
  }
  const cleanPath = normalizeRoutePath(pathname);
  let best: RouteAccessPolicy | null = null;
  let bestLength = -1;
  for (const policy of ROUTE_ACCESS_POLICIES) {
    for (const prefix of policy.paths) {
      if (prefix.length > bestLength && pathMatchesPrefix(cleanPath, prefix)) {
        best = policy;
        bestLength = prefix.length;
      }
    }
  }
  return best ?? FALLBACK_ROUTE_POLICY;
}

export function getRouteAccessMode(pathname: string, search = ''): RouteAccessMode {
  return getRouteAccessPolicy(pathname, search).mode;
}

/** Policy for an SPA tab (via its canonical path; no verify token). */
export function getTabAccessPolicy(tab: AppNavTab): RouteAccessPolicy {
  return getRouteAccessPolicy(TAB_TO_PATH[tab] ?? '/overview');
}

/** True when a route needs a signed-in user (authenticated or role_protected). */
export function requiresAuthentication(pathname: string, search = ''): boolean {
  const mode = getRouteAccessMode(pathname, search);
  return mode === 'authenticated' || mode === 'role_protected';
}

/** True when the route's outcome depends on the session (anything but public). */
export function isSessionDependentRoute(pathname: string, search = ''): boolean {
  return getRouteAccessMode(pathname, search) !== 'public';
}

export function isProtectedTab(tab: AppNavTab): boolean {
  const mode = getTabAccessPolicy(tab).mode;
  return mode === 'authenticated' || mode === 'role_protected';
}

export function isProtectedPathname(pathname: string): boolean {
  return requiresAuthentication(pathname);
}

/** Whether `role` satisfies a policy. Missing roles never satisfy a role-protected policy. */
export function roleSatisfiesPolicy(
  policy: RouteAccessPolicy,
  role: UserRole | null | undefined
): boolean {
  if (policy.mode !== 'role_protected') return true;
  return Boolean(role) && policy.allowedRoles.includes(role as UserRole);
}

/* ------------------------------------------------------------------------- */
/* Redirect sanitizing                                                       */
/* ------------------------------------------------------------------------- */

const MAX_REDIRECT_LENGTH = 2048;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
const SANITIZE_BASE_ORIGIN = 'http://econova.invalid';

/** Paths that are never page destinations (API and OAuth endpoints). */
function isNonPageEndpoint(cleanPath: string): boolean {
  return (
    cleanPath === '/api' ||
    cleanPath.startsWith('/api/') ||
    cleanPath === '/auth' ||
    cleanPath.startsWith('/auth/')
  );
}

function isUnsafeRedirectShape(value: string): boolean {
  return (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHAR_PATTERN.test(value)
  );
}

/**
 * Returns a same-origin, in-app path or `fallback`. Rejects absolute and
 * protocol-relative URLs (`https://…`, `//…`, `/\…`), backslashes, control
 * characters (raw or percent-encoded), API/OAuth endpoints and guest-only
 * pages such as `/login` (which would loop). Locale prefixes are kept.
 */
export function sanitizeRedirectTo(
  rawRedirectTo: string | null | undefined,
  fallback = '/overview'
): string {
  if (!rawRedirectTo || typeof rawRedirectTo !== 'string') {
    return fallback;
  }
  if (CONTROL_CHAR_PATTERN.test(rawRedirectTo)) {
    return fallback;
  }
  const trimmed = rawRedirectTo.trim();
  if (!trimmed || trimmed.length > MAX_REDIRECT_LENGTH || isUnsafeRedirectShape(trimmed)) {
    return fallback;
  }

  // Re-check after one round of percent-decoding: `/%2F/evil`, `/%5Cevil`
  // and `/%0A/evil` are refused even though browsers treat them as paths.
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return fallback;
  }
  if (isUnsafeRedirectShape(decoded)) {
    return fallback;
  }

  // Belt and braces: the browser's own URL parser must keep it same-origin.
  try {
    const resolved = new URL(trimmed, SANITIZE_BASE_ORIGIN);
    if (resolved.origin !== SANITIZE_BASE_ORIGIN) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  const cleanPath = normalizeRoutePath(decoded);
  if (isNonPageEndpoint(cleanPath)) {
    return fallback;
  }
  // `/login?redirectTo=/login…` style loops: never send anyone back to a guest-only page.
  if (getRouteAccessMode(cleanPath) === 'guest_only') {
    return fallback;
  }
  return trimmed;
}

/* ------------------------------------------------------------------------- */
/* Tab / path helpers                                                        */
/* ------------------------------------------------------------------------- */

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

/** Reads `redirectTo` (or the legacy `callbackUrl` / `next`) from a query string. */
export function readRedirectParam(search: string | null | undefined): string | null {
  const params = toSearchParams(search);
  return params.get('redirectTo') || params.get('callbackUrl') || params.get('next');
}

export function parseRouteFromLocation(
  pathname: string,
  search = ''
): {
  tab: AppNavTab;
  courseId: string | null;
  redirectTo: string | null;
} {
  const clean = normalizeRoutePath(pathname);
  const redirectToParam = readRedirectParam(search);
  const redirectTo = redirectToParam ? sanitizeRedirectTo(redirectToParam, '/overview') : null;

  if (hasPublicVerifyToken(search)) {
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
  if (clean === '/admin' || clean === '/studio' || clean.startsWith('/admin/') || clean.startsWith('/studio/')) {
    return { tab: 'admin', courseId: null, redirectTo };
  }

  // Course ids keep their original case, so match against the un-lowered path.
  const originalClean = stripLocalePrefix((pathname || '').split(/[?#]/)[0] ?? '');
  const courseMatch = originalClean.match(/^\/course\/([^/]+)/i);
  if (courseMatch && courseMatch[1]) {
    let courseId: string;
    try {
      courseId = decodeURIComponent(courseMatch[1]);
    } catch {
      courseId = courseMatch[1];
    }
    return { tab: 'course', courseId, redirectTo };
  }

  return { tab: 'overview', courseId: null, redirectTo };
}

export function resolveDestinationFromPath(
  rawPath: string | null | undefined,
  fallbackCourseId?: string | null
): IntendedDestination {
  const safePath = sanitizeRedirectTo(rawPath, '/overview');
  const queryIndex = safePath.indexOf('?');
  const pathnamePart = queryIndex >= 0 ? safePath.slice(0, queryIndex) : safePath;
  const searchPart = queryIndex >= 0 ? safePath.slice(queryIndex) : '';
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

  if (resolved.tab === 'admin') {
    const queryIndex = resolved.path.indexOf('?');
    const section = parseAdminSection(queryIndex >= 0 ? resolved.path.slice(0, queryIndex) : resolved.path);
    return ADMIN_SECTION_LABELS[locale === 'uz' ? 'uz' : 'en'][section];
  }
  return locale === 'uz' ? labelsUz[resolved.tab] : labelsEn[resolved.tab];
}

const ADMIN_SECTION_LABELS: Readonly<Record<LocaleCode, Record<AdminSection, string>>> = {
  en: {
    overview: 'Admin Overview',
    curriculum: 'Curriculum & Editorial',
    moderation: 'Moderation',
    users: 'Users & Certificates',
    audit: 'Audit Log',
  },
  uz: {
    overview: 'Admin paneli',
    curriculum: 'O‘quv dasturi va tahririyat',
    moderation: 'Moderatsiya',
    users: 'Foydalanuvchilar va sertifikatlar',
    audit: 'Audit jurnali',
  },
};

export function getAdminSectionLabel(section: AdminSection, locale: LocaleCode): string {
  return ADMIN_SECTION_LABELS[locale === 'uz' ? 'uz' : 'en'][section];
}

/**
 * Admin page for a pathname. `/studio` (legacy alias) maps to Curriculum and
 * unknown `/admin/*` sub-paths to the admin Overview.
 */
export function parseAdminSection(pathname: string): AdminSection {
  const clean = normalizeRoutePath(pathname);
  if (clean === '/studio' || clean.startsWith('/studio/')) return 'curriculum';
  for (const section of ADMIN_SECTIONS) {
    if (section === 'overview') continue;
    const path = ADMIN_SECTION_PATHS[section];
    if (clean === path || clean.startsWith(`${path}/`)) return section;
  }
  return 'overview';
}

export function buildAdminSectionPath(section: AdminSection): string {
  return ADMIN_SECTION_PATHS[section] ?? ADMIN_SECTION_PATHS.overview;
}

/* ------------------------------------------------------------------------- */
/* Guard                                                                     */
/* ------------------------------------------------------------------------- */

export interface MiddlewareGuardInput {
  pathname: string;
  search?: string;
  isAuthenticated: boolean;
  userRole?: UserRole | null;
}

export type MiddlewareGuardReason =
  | 'public_route'
  | 'authenticated'
  | 'unauthenticated_protected'
  | 'already_authenticated'
  | 'insufficient_role'
  | 'route_alias';

export interface MiddlewareGuardDecision {
  action: 'allow' | 'redirect';
  /** Same-origin, sanitized path to send the user to when `action` is `redirect`. */
  destination: string | null;
  reason: MiddlewareGuardReason;
  /** Access mode of the requested route. */
  mode: RouteAccessMode;
  /** `id` of the policy that decided. */
  policyId: string;
}

/** `/login?redirectTo=<encoded full path>`, keeping a `/en` or `/uz` prefix. */
export function buildLoginRedirect(pathname: string, search = ''): string {
  const rawPath = ((pathname || '/').split(/[?#]/)[0] || '/').trim() || '/';
  const query = search ? (search.startsWith('?') ? search : `?${search}`) : '';
  const requested = sanitizeRedirectTo(`${rawPath}${query}`, '/overview');
  return `${getLocalePrefix(rawPath)}/login?redirectTo=${encodeURIComponent(requested)}`;
}

/**
 * The one access decision used by the server HTML guard, the edge middleware
 * and the SPA. Pure and synchronous: same input, same answer everywhere.
 */
export function evaluateMiddlewareRouteGuard(
  input: MiddlewareGuardInput
): MiddlewareGuardDecision {
  const pathname = input.pathname || '/';
  const search = input.search
    ? input.search.startsWith('?')
      ? input.search
      : `?${input.search}`
    : '';
  const policy = getRouteAccessPolicy(pathname, search);
  const localePrefix = getLocalePrefix(pathname);
  const homePath = `${localePrefix}/overview`;
  const base = { mode: policy.mode, policyId: policy.id };

  switch (policy.mode) {
    case 'public':
      return { ...base, action: 'allow', destination: null, reason: 'public_route' };

    case 'guest_only': {
      if (!input.isAuthenticated) {
        return { ...base, action: 'allow', destination: null, reason: 'public_route' };
      }
      return {
        ...base,
        action: 'redirect',
        destination: sanitizeRedirectTo(readRedirectParam(search), homePath),
        reason: 'already_authenticated',
      };
    }

    case 'authenticated':
    case 'role_protected': {
      if (!input.isAuthenticated) {
        return {
          ...base,
          action: 'redirect',
          destination: buildLoginRedirect(pathname, search),
          reason: 'unauthenticated_protected',
        };
      }
      if (policy.mode === 'role_protected' && !roleSatisfiesPolicy(policy, input.userRole)) {
        return { ...base, action: 'redirect', destination: homePath, reason: 'insufficient_role' };
      }
      if (policy.mode === 'role_protected' && policy.canonicalPath) {
        return {
          ...base,
          action: 'redirect',
          destination: sanitizeRedirectTo(`${localePrefix}${policy.canonicalPath}${search}`, homePath),
          reason: 'route_alias',
        };
      }
      return { ...base, action: 'allow', destination: null, reason: 'authenticated' };
    }
  }
}

/**
 * Final check before a guard decision becomes a `Location` header. Guard
 * destinations are built from sanitized parts, so this only refuses anything
 * that is not a same-origin absolute path (never expected in practice).
 */
export function resolveGuardRedirectTarget(destination: string | null | undefined): string {
  if (
    !destination ||
    !destination.startsWith('/') ||
    destination.startsWith('//') ||
    destination.includes('\\') ||
    CONTROL_CHAR_PATTERN.test(destination)
  ) {
    return '/overview';
  }
  return destination;
}

/** Query flag a server-side redirect uses to tell the SPA why it landed somewhere. */
export const ACCESS_NOTICE_PARAM = 'accessNotice';
export type AccessNotice = Extract<MiddlewareGuardReason, 'insufficient_role'>;

/**
 * Adds `?accessNotice=insufficient_role` to a server redirect so the SPA can
 * show the bilingual "no access" toast after a full page load.
 */
export function withAccessNotice(destination: string, reason: MiddlewareGuardReason): string {
  if (reason !== 'insufficient_role') return destination;
  const separator = destination.includes('?') ? '&' : '?';
  return `${destination}${separator}${ACCESS_NOTICE_PARAM}=${reason}`;
}

/** Reads the access notice flag from a query string, if present and known. */
export function readAccessNotice(search: string | null | undefined): AccessNotice | null {
  return toSearchParams(search).get(ACCESS_NOTICE_PARAM) === 'insufficient_role'
    ? 'insufficient_role'
    : null;
}

/** Removes the access notice flag from a query string (returns '' or '?…'). */
export function stripAccessNotice(search: string | null | undefined): string {
  const params = toSearchParams(search);
  params.delete(ACCESS_NOTICE_PARAM);
  const next = params.toString();
  return next ? `?${next}` : '';
}
