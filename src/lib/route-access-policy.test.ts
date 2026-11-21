import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_NOTICE_PARAM,
  ADMIN_SECTION_PATHS,
  ROUTE_ACCESS_POLICIES,
  buildAdminSectionPath,
  formatDestinationLabel,
  parseAdminSection,
  buildLoginRedirect,
  evaluateMiddlewareRouteGuard,
  getRouteAccessMode,
  getRouteAccessPolicy,
  getTabAccessPolicy,
  hasPublicVerifyToken,
  isProtectedTab,
  isSessionDependentRoute,
  normalizeRoutePath,
  parseRouteFromLocation,
  readAccessNotice,
  requiresAuthentication,
  resolveGuardRedirectTarget,
  roleSatisfiesPolicy,
  sanitizeRedirectTo,
  stripAccessNotice,
  withAccessNotice,
  type MiddlewareGuardInput,
  type RouteAccessMode,
} from './auth-routing.ts';
import { ADMIN_ROLES } from '../shared/econova-rules.ts';
import { middleware } from '../middleware.ts';
import type { UserRole } from '../shared/types.ts';

const ALL_ROLES: readonly UserRole[] = ['learner', 'admin'];
/** Values the database may still hold; they must never unlock admin routes. */
const LEGACY_ROLES = ['editor', 'reviewer', 'publisher'] as unknown as UserRole[];

const PUBLIC_PATHS = ['/', '/overview', '/catalog', '/courses', '/course/econ-101', '/course/econ-101/lesson/3', '/community'];
const GUEST_ONLY_PATHS = ['/login', '/signin', '/register', '/signup'];
const AUTHENTICATED_PATHS = ['/achievements', '/xp', '/dashboard', '/profile', '/settings', '/certificates'];
const ADMIN_PATHS = ['/admin', '/admin/curriculum', '/admin/moderation', '/admin/users', '/admin/audit'];
const STUDIO_PATHS = ['/studio', '/studio/editions/42'];
// `/admin/queue` is unknown: still admin-only, rendered as the admin overview.
const ROLE_PROTECTED_PATHS = [...ADMIN_PATHS, '/admin/queue', ...STUDIO_PATHS];

function guard(input: Partial<MiddlewareGuardInput> & { pathname: string }) {
  return evaluateMiddlewareRouteGuard({ isAuthenticated: false, ...input });
}

/* ----------------------------- registry ---------------------------------- */

test('registry: every path resolves to the expected access mode', () => {
  const expectations: Array<[string[], RouteAccessMode]> = [
    [PUBLIC_PATHS, 'public'],
    [GUEST_ONLY_PATHS, 'guest_only'],
    [AUTHENTICATED_PATHS, 'authenticated'],
    [ROLE_PROTECTED_PATHS, 'role_protected'],
  ];
  for (const [paths, mode] of expectations) {
    for (const path of paths) {
      assert.equal(getRouteAccessMode(path), mode, `${path} should be ${mode}`);
    }
  }
});

test('registry: every admin route is role_protected with ADMIN_ROLES (admin only)', () => {
  const expected: Record<string, string> = {
    '/admin': 'admin_overview',
    '/admin/curriculum': 'admin_curriculum',
    '/admin/moderation': 'admin_moderation',
    '/admin/users': 'admin_users',
    '/admin/audit': 'admin_audit',
    '/studio': 'studio_alias',
  };
  for (const [path, id] of Object.entries(expected)) {
    const policy = getRouteAccessPolicy(path);
    assert.equal(policy.id, id, path);
    assert.ok(policy.mode === 'role_protected', path);
    assert.equal(policy.allowedRoles, ADMIN_ROLES, path);
    assert.deepEqual([...policy.allowedRoles], ['admin'], path);
  }
  // Sub-paths resolve to the most specific admin policy.
  assert.equal(getRouteAccessPolicy('/admin/users/usr-1').id, 'admin_users');
  assert.equal(getRouteAccessPolicy('/uz/admin/audit').id, 'admin_audit');
  assert.equal(getRouteAccessPolicy('/admin/unknown').id, 'admin_overview');
  const studio = getRouteAccessPolicy('/studio');
  assert.equal(studio.mode === 'role_protected' ? studio.canonicalPath : null, '/admin/curriculum');
});

test('admin sections: path <-> section mapping, /studio alias, labels', () => {
  assert.deepEqual(ADMIN_SECTION_PATHS, {
    overview: '/admin',
    curriculum: '/admin/curriculum',
    moderation: '/admin/moderation',
    users: '/admin/users',
    audit: '/admin/audit',
  });
  for (const [section, path] of Object.entries(ADMIN_SECTION_PATHS)) {
    assert.equal(parseAdminSection(path), section, path);
    assert.equal(buildAdminSectionPath(section as keyof typeof ADMIN_SECTION_PATHS), path);
    assert.equal(parseRouteFromLocation(path).tab, 'admin', path);
  }
  assert.equal(parseAdminSection('/uz/admin/users/'), 'users');
  assert.equal(parseAdminSection('/studio'), 'curriculum');
  assert.equal(parseAdminSection('/admin/whatever'), 'overview');
  assert.equal(formatDestinationLabel('/admin/users', 'en'), 'Users & Certificates');
  assert.equal(formatDestinationLabel('/admin/audit', 'uz'), 'Audit jurnali');
  assert.equal(formatDestinationLabel('/admin', 'en'), 'Admin Overview');
});

test('registry: no prefix is declared by two policies', () => {
  const seen = new Map<string, string>();
  for (const policy of ROUTE_ACCESS_POLICIES) {
    for (const prefix of policy.paths) {
      assert.equal(prefix, normalizeRoutePath(prefix), `${prefix} must be stored normalized`);
      assert.ok(!seen.has(prefix), `${prefix} declared by ${seen.get(prefix)} and ${policy.id}`);
      seen.set(prefix, policy.id);
    }
  }
});

test('registry: `/` only matches the bare root and unknown paths fall back to public', () => {
  assert.equal(getRouteAccessPolicy('/').id, 'landing');
  assert.equal(getRouteAccessPolicy('/something-unknown').id, 'fallback');
  assert.equal(getRouteAccessMode('/something-unknown'), 'public');
  // Prefix boundaries: /profiles is not /profile, /administrator is not /admin.
  assert.equal(getRouteAccessMode('/profiles'), 'public');
  assert.equal(getRouteAccessMode('/administrator'), 'public');
  assert.equal(getRouteAccessMode('/loginx'), 'public');
});

test('registry: path normalization (case, trailing slash, locale) cannot bypass a policy', () => {
  for (const variant of ['/ADMIN', '/Admin/', '/admin///', '/UZ/admin', '/en/Studio/', '/uz/studio/x']) {
    assert.equal(getRouteAccessMode(variant), 'role_protected', variant);
  }
  for (const variant of ['/PROFILE', '/profile/', '/EN/settings', '/uz/certificates/']) {
    assert.equal(getRouteAccessMode(variant), 'authenticated', variant);
  }
  for (const variant of ['/LOGIN', '/en/login/', '/uz/SignUp']) {
    assert.equal(getRouteAccessMode(variant), 'guest_only', variant);
  }
});

test('registry: tab helpers derive from the same registry', () => {
  assert.equal(getTabAccessPolicy('admin').mode, 'role_protected');
  assert.equal(getTabAccessPolicy('certificates').mode, 'authenticated');
  assert.equal(getTabAccessPolicy('login').mode, 'guest_only');
  assert.equal(getTabAccessPolicy('course').mode, 'public');
  assert.equal(isProtectedTab('certificates'), true);
  assert.equal(isProtectedTab('community'), false);
  assert.equal(requiresAuthentication('/studio'), true);
  assert.equal(requiresAuthentication('/login'), false);
  assert.equal(isSessionDependentRoute('/login'), true);
  assert.equal(isSessionDependentRoute('/catalog'), false);
});

test('roleSatisfiesPolicy never accepts a missing role for role-protected policies', () => {
  const staff = getRouteAccessPolicy('/admin');
  assert.equal(roleSatisfiesPolicy(staff, null), false);
  assert.equal(roleSatisfiesPolicy(staff, undefined), false);
  assert.equal(roleSatisfiesPolicy(staff, '' as UserRole), false);
  assert.equal(roleSatisfiesPolicy(staff, 'learner'), false);
  for (const legacy of LEGACY_ROLES) assert.equal(roleSatisfiesPolicy(staff, legacy), false, legacy);
  assert.equal(roleSatisfiesPolicy(staff, 'admin'), true);
  assert.equal(roleSatisfiesPolicy(getRouteAccessPolicy('/profile'), null), true);
});

/* ------------------------------ public ----------------------------------- */

test('public routes are allowed for guests and every role', () => {
  for (const pathname of PUBLIC_PATHS) {
    const anon = guard({ pathname });
    assert.equal(anon.action, 'allow', pathname);
    assert.equal(anon.reason, 'public_route');
    assert.equal(anon.mode, 'public');
    for (const role of ALL_ROLES) {
      const authed = guard({ pathname, isAuthenticated: true, userRole: role });
      assert.equal(authed.action, 'allow', `${pathname} as ${role}`);
    }
  }
});

test('?verify= makes any route the public certificate verifier', () => {
  assert.equal(hasPublicVerifyToken('?verify=abc'), true);
  assert.equal(hasPublicVerifyToken('?verify='), false);
  assert.equal(hasPublicVerifyToken('?verify=%20%20'), false);

  const anonVerify = guard({ pathname: '/certificates', search: '?verify=CERT-123' });
  assert.equal(anonVerify.action, 'allow');
  assert.equal(anonVerify.policyId, 'certificate_verification');
  assert.equal(parseRouteFromLocation('/certificates', '?verify=CERT-123').tab, 'certificates');

  // Search without the leading '?' is accepted too.
  assert.equal(guard({ pathname: '/certificates', search: 'verify=CERT-123' }).action, 'allow');
  // Locale-prefixed verification links stay public.
  assert.equal(guard({ pathname: '/uz/certificates', search: '?verify=CERT-123' }).action, 'allow');

  // Without a token (or with an empty one) /certificates needs sign-in.
  const anonList = guard({ pathname: '/certificates' });
  assert.equal(anonList.action, 'redirect');
  assert.equal(anonList.destination, '/login?redirectTo=%2Fcertificates');
  assert.equal(guard({ pathname: '/certificates', search: '?verify=' }).action, 'redirect');
});

/* ---------------------------- guest_only --------------------------------- */

test('guest_only routes are open to guests', () => {
  for (const pathname of GUEST_ONLY_PATHS) {
    const decision = guard({ pathname, search: '?redirectTo=%2Fprofile' });
    assert.equal(decision.action, 'allow', pathname);
    assert.equal(decision.mode, 'guest_only');
  }
});

test('guest_only routes send signed-in users (any role) to the sanitized redirectTo or /overview', () => {
  for (const pathname of GUEST_ONLY_PATHS) {
    for (const role of ALL_ROLES) {
      const noRedirect = guard({ pathname, isAuthenticated: true, userRole: role });
      assert.equal(noRedirect.action, 'redirect');
      assert.equal(noRedirect.reason, 'already_authenticated');
      assert.equal(noRedirect.destination, '/overview');

      const withRedirect = guard({
        pathname,
        search: '?redirectTo=%2Fachievements%3Fview%3Dledger',
        isAuthenticated: true,
        userRole: role,
      });
      assert.equal(withRedirect.destination, '/achievements?view=ledger');
    }
  }
  // Legacy parameter names still work.
  assert.equal(
    guard({ pathname: '/login', search: '?callbackUrl=%2Fprofile', isAuthenticated: true, userRole: 'learner' }).destination,
    '/profile'
  );
  assert.equal(
    guard({ pathname: '/login', search: '?next=%2Fxp', isAuthenticated: true, userRole: 'learner' }).destination,
    '/xp'
  );
});

test('guest_only redirectTo attacks fall back to /overview', () => {
  const attacks = [
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    '/login',
    '/register?redirectTo=%2Fprofile',
    'javascript:alert(1)',
  ];
  for (const attack of attacks) {
    const decision = guard({
      pathname: '/login',
      search: `?redirectTo=${encodeURIComponent(attack)}`,
      isAuthenticated: true,
      userRole: 'admin',
    });
    assert.equal(decision.destination, '/overview', attack);
  }
});

/* --------------------------- authenticated ------------------------------- */

test('authenticated routes redirect guests to /login?redirectTo=<encoded full path>', () => {
  for (const pathname of AUTHENTICATED_PATHS) {
    const decision = guard({ pathname });
    assert.equal(decision.action, 'redirect', pathname);
    assert.equal(decision.reason, 'unauthenticated_protected');
    assert.equal(decision.destination, `/login?redirectTo=${encodeURIComponent(pathname)}`);
  }
  const withQuery = guard({ pathname: '/achievements', search: '?view=ledger&range=7d' });
  assert.equal(withQuery.destination, '/login?redirectTo=%2Fachievements%3Fview%3Dledger%26range%3D7d');
});

test('authenticated routes allow every signed-in role, including a missing role', () => {
  for (const pathname of AUTHENTICATED_PATHS) {
    for (const role of [...ALL_ROLES, null, undefined]) {
      const decision = guard({ pathname, isAuthenticated: true, userRole: role });
      assert.equal(decision.action, 'allow', `${pathname} as ${String(role)}`);
      assert.equal(decision.reason, 'authenticated');
    }
  }
});

/* --------------------------- role_protected ------------------------------ */

test('role_protected routes redirect guests to login with redirectTo', () => {
  for (const pathname of ROLE_PROTECTED_PATHS) {
    const decision = guard({ pathname });
    assert.equal(decision.action, 'redirect', pathname);
    assert.equal(decision.reason, 'unauthenticated_protected');
    assert.equal(decision.destination, `/login?redirectTo=${encodeURIComponent(pathname)}`);
  }
});

test('admin routes: admin allowed; learner and legacy staff roles denied with insufficient_role', () => {
  for (const pathname of [...ADMIN_PATHS, '/admin/queue']) {
    const admin = guard({ pathname, isAuthenticated: true, userRole: 'admin' });
    assert.equal(admin.action, 'allow', `${pathname} as admin`);
    assert.equal(admin.reason, 'authenticated');
    for (const role of ['learner' as UserRole, ...LEGACY_ROLES]) {
      const decision = guard({ pathname, isAuthenticated: true, userRole: role });
      assert.equal(decision.action, 'redirect', `${pathname} as ${role}`);
      assert.equal(decision.reason, 'insufficient_role');
      assert.equal(decision.destination, '/overview');
    }
  }
});

test('/studio is a protected alias: admins go to /admin/curriculum, learners are blocked', () => {
  for (const pathname of STUDIO_PATHS) {
    const admin = guard({ pathname, isAuthenticated: true, userRole: 'admin' });
    assert.equal(admin.action, 'redirect', pathname);
    assert.equal(admin.reason, 'route_alias');
    assert.equal(admin.destination, '/admin/curriculum');

    const learner = guard({ pathname, isAuthenticated: true, userRole: 'learner' });
    assert.equal(learner.reason, 'insufficient_role');
    assert.equal(learner.destination, '/overview');

    const anon = guard({ pathname });
    assert.equal(anon.reason, 'unauthenticated_protected');
    assert.equal(anon.destination, `/login?redirectTo=${encodeURIComponent(pathname)}`);
  }
  // Locale prefix and query survive the alias redirect.
  const uz = guard({ pathname: '/uz/studio', search: '?edition=ed-1', isAuthenticated: true, userRole: 'admin' });
  assert.equal(uz.destination, '/uz/admin/curriculum?edition=ed-1');
  // After sign-in, a /login?redirectTo=/studio bounce ends on the alias, which the SPA follows.
  const afterLogin = guard({ pathname: '/login', search: '?redirectTo=%2Fstudio', isAuthenticated: true, userRole: 'admin' });
  assert.equal(afterLogin.destination, '/studio');
});

test('role_protected routes deny signed-in users with a null, missing or unknown role', () => {
  const variants: Array<UserRole | null | undefined> = [null, undefined, '' as UserRole, 'superuser' as UserRole];
  for (const pathname of ROLE_PROTECTED_PATHS) {
    for (const role of variants) {
      const decision = guard({ pathname, isAuthenticated: true, userRole: role });
      assert.equal(decision.action, 'redirect', `${pathname} as ${String(role)}`);
      assert.equal(decision.reason, 'insufficient_role');
      assert.equal(decision.destination, '/overview');
    }
    // userRole omitted entirely
    const omitted = evaluateMiddlewareRouteGuard({ pathname, isAuthenticated: true });
    assert.equal(omitted.reason, 'insufficient_role');
  }
});

/* ------------------------------ locales ---------------------------------- */

test('locale prefixes: policies apply and redirects keep the prefix', () => {
  const uzProfile = guard({ pathname: '/uz/profile', search: '?tab=privacy' });
  assert.equal(uzProfile.destination, '/uz/login?redirectTo=%2Fuz%2Fprofile%3Ftab%3Dprivacy');

  const enAdmin = guard({ pathname: '/en/admin' });
  assert.equal(enAdmin.destination, '/en/login?redirectTo=%2Fen%2Fadmin');

  const uzLearnerAdmin = guard({ pathname: '/uz/admin', isAuthenticated: true, userRole: 'learner' });
  assert.equal(uzLearnerAdmin.reason, 'insufficient_role');
  assert.equal(uzLearnerAdmin.destination, '/uz/overview');

  const uzLoginAuthed = guard({ pathname: '/uz/login', isAuthenticated: true, userRole: 'learner' });
  assert.equal(uzLoginAuthed.destination, '/uz/overview');

  const uzLoginWithTarget = guard({
    pathname: '/uz/login',
    search: '?redirectTo=%2Fuz%2Fachievements',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(uzLoginWithTarget.destination, '/uz/achievements');

  assert.equal(guard({ pathname: '/en/catalog' }).action, 'allow');
  assert.equal(guard({ pathname: '/uz' }).policyId, 'landing');
  assert.equal(parseRouteFromLocation('/uz/login').tab, 'login');
  assert.equal(parseRouteFromLocation('/EN/Profile/').tab, 'profile');
  assert.equal(parseRouteFromLocation('/uz/course/Econ-ABC').courseId, 'Econ-ABC');
});

test('buildLoginRedirect encodes the requested path and never nests a guest-only page', () => {
  assert.equal(buildLoginRedirect('/profile'), '/login?redirectTo=%2Fprofile');
  assert.equal(buildLoginRedirect('/profile', 'a=1'), '/login?redirectTo=%2Fprofile%3Fa%3D1');
  assert.equal(buildLoginRedirect('/uz/xp'), '/uz/login?redirectTo=%2Fuz%2Fxp');
  assert.equal(buildLoginRedirect('/login'), '/login?redirectTo=%2Foverview');
});

/* --------------------------- open redirects ------------------------------ */

test('sanitizeRedirectTo accepts same-origin app paths and keeps locale prefixes', () => {
  assert.equal(sanitizeRedirectTo('/achievements'), '/achievements');
  assert.equal(sanitizeRedirectTo('  /profile  '), '/profile');
  assert.equal(sanitizeRedirectTo('/course/econ-101?lesson=2#notes'), '/course/econ-101?lesson=2#notes');
  assert.equal(sanitizeRedirectTo('/uz/profile'), '/uz/profile');
  assert.equal(sanitizeRedirectTo('/en/certificates?verify=abc'), '/en/certificates?verify=abc');
  assert.equal(sanitizeRedirectTo('/admin'), '/admin');
});

test('sanitizeRedirectTo rejects open-redirect shapes', () => {
  const attacks = [
    'https://evil.example.com',
    'http://evil.example.com/profile',
    'HTTPS://evil.example.com',
    '//evil.example.com',
    '///evil.example.com',
    '/\\evil.example.com',
    '\\\\evil.example.com',
    '/profile\\..\\evil',
    'javascript:alert(1)',
    'data:text/html,hi',
    'evil.example.com',
    'profile',
    '/%2F/evil.example.com',
    '/%2f%2fevil.example.com',
    '/%5Cevil.example.com',
    '/%5cevil.example.com',
    '%2F%2Fevil.example.com',
    '/\t/evil.example.com',
    '/\n/evil.example.com',
    '/\r\n/evil.example.com',
    '/profile\u0000',
    '/%09/evil.example.com',
    '/%0A/evil.example.com',
    '/%00',
    '/%E0%A4%A', // malformed escape
    `/${'a'.repeat(3000)}`,
    '',
    '   ',
  ];
  for (const attack of attacks) {
    assert.equal(sanitizeRedirectTo(attack), '/overview', JSON.stringify(attack));
  }
  assert.equal(sanitizeRedirectTo(null), '/overview');
  assert.equal(sanitizeRedirectTo(undefined), '/overview');
  assert.equal(sanitizeRedirectTo(42 as unknown as string), '/overview');
});

test('sanitizeRedirectTo blocks login/register loops, including locale and case variants', () => {
  const loops = [
    '/login',
    '/login?redirectTo=%2Fprofile',
    '/register',
    '/signin',
    '/signup',
    '/LOGIN',
    '/login/',
    '/uz/login',
    '/en/register?redirectTo=/profile',
    '/%6Cogin', // percent-encoded "l"
  ];
  for (const loop of loops) {
    assert.equal(sanitizeRedirectTo(loop), '/overview', loop);
  }
});

test('sanitizeRedirectTo refuses API and OAuth endpoints and honours the fallback', () => {
  assert.equal(sanitizeRedirectTo('/api/auth/logout'), '/overview');
  assert.equal(sanitizeRedirectTo('/auth/callback?code=x'), '/overview');
  assert.equal(sanitizeRedirectTo('/uz/api/users'), '/overview');
  assert.equal(sanitizeRedirectTo('//evil', '/uz/overview'), '/uz/overview');
});

test('resolveGuardRedirectTarget only lets same-origin paths become Location headers', () => {
  assert.equal(resolveGuardRedirectTarget('/uz/login?redirectTo=%2Fuz%2Fprofile'), '/uz/login?redirectTo=%2Fuz%2Fprofile');
  assert.equal(resolveGuardRedirectTarget('//evil.example.com'), '/overview');
  assert.equal(resolveGuardRedirectTarget('https://evil.example.com'), '/overview');
  assert.equal(resolveGuardRedirectTarget(null), '/overview');
});

test('guard destinations are always safe redirect targets', () => {
  const searches = ['', '?redirectTo=%2F%2Fevil.com', '?redirectTo=https%3A%2F%2Fevil.com', '?x=%0A'];
  const paths = [...PUBLIC_PATHS, ...GUEST_ONLY_PATHS, ...AUTHENTICATED_PATHS, ...ROLE_PROTECTED_PATHS];
  for (const pathname of paths) {
    for (const search of searches) {
      for (const isAuthenticated of [false, true]) {
        for (const role of [...ALL_ROLES, null]) {
          const d = guard({ pathname, search, isAuthenticated, userRole: role });
          if (d.action === 'redirect') {
            assert.ok(d.destination, `${pathname}${search}`);
            assert.equal(resolveGuardRedirectTarget(d.destination), d.destination);
            assert.ok(!d.destination.startsWith('//'));
          } else {
            assert.equal(d.destination, null);
          }
        }
      }
    }
  }
});

/* --------------------------- access notice ------------------------------- */

test('access notice flag round-trips only for insufficient_role', () => {
  assert.equal(withAccessNotice('/overview', 'insufficient_role'), `/overview?${ACCESS_NOTICE_PARAM}=insufficient_role`);
  assert.equal(withAccessNotice('/overview?a=1', 'insufficient_role'), `/overview?a=1&${ACCESS_NOTICE_PARAM}=insufficient_role`);
  assert.equal(withAccessNotice('/login?redirectTo=%2Fprofile', 'unauthenticated_protected'), '/login?redirectTo=%2Fprofile');
  assert.equal(readAccessNotice('?accessNotice=insufficient_role'), 'insufficient_role');
  assert.equal(readAccessNotice('?accessNotice=other'), null);
  assert.equal(stripAccessNotice('?accessNotice=insufficient_role'), '');
  assert.equal(stripAccessNotice('?a=1&accessNotice=insufficient_role'), '?a=1');
});

/* ------------------------- edge middleware parity ------------------------- */

function fakeToken(role: UserRole | null): string {
  const payload = Buffer.from(
    JSON.stringify({ userId: 'usr-1', exp: Date.now() + 60_000, ...(role ? { role } : {}) }),
    'utf8'
  ).toString('base64url');
  return `${payload}.sig`;
}

function runMiddleware(url: string, role: UserRole | null | 'anon') {
  const cookie = role === 'anon' ? null : `econova_session=${fakeToken(role)}`;
  return middleware({
    url,
    headers: { get: (name: string) => (name.toLowerCase() === 'cookie' ? cookie : null) },
  });
}

test('edge middleware mirrors the guard: locale login redirect, role notice, no-store', () => {
  const anon = runMiddleware('http://localhost:3000/uz/studio', 'anon');
  assert.equal(anon.status, 307);
  assert.equal(anon.redirectUrl, 'http://localhost:3000/uz/login?redirectTo=%2Fuz%2Fstudio');
  assert.equal(anon.headers['Cache-Control'], 'no-store');

  const learner = runMiddleware('http://localhost:3000/admin', 'learner');
  assert.equal(learner.status, 307);
  assert.equal(learner.redirectUrl, 'http://localhost:3000/overview?accessNotice=insufficient_role');

  const roleless = runMiddleware('http://localhost:3000/admin', null);
  assert.equal(roleless.decision.reason, 'insufficient_role');

  const admin = runMiddleware('http://localhost:3000/admin/users', 'admin');
  assert.equal(admin.status, 200);

  const studio = runMiddleware('http://localhost:3000/studio', 'admin');
  assert.equal(studio.status, 307);
  assert.equal(studio.redirectUrl, 'http://localhost:3000/admin/curriculum');

  // A token minted before the role model changed (legacy 'editor') is refused.
  const legacy = runMiddleware('http://localhost:3000/admin', 'editor' as UserRole);
  assert.equal(legacy.decision.reason, 'insufficient_role');

  const verify = runMiddleware('http://localhost:3000/certificates?verify=abc', 'anon');
  assert.equal(verify.status, 200);
});
