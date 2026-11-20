import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPathForTab,
  evaluateMiddlewareRouteGuard,
  formatDestinationLabel,
  isProtectedPathname,
  isProtectedTab,
  parseRouteFromLocation,
  resolveDestinationFromPath,
  sanitizeRedirectTo,
} from './auth-routing.ts';
import {
  decodeUnverifiedSessionPayload,
  middleware,
} from '../middleware.ts';

test('isProtectedTab and isProtectedPathname identify protected areas accurately', () => {
  assert.equal(isProtectedTab('profile'), true);
  assert.equal(isProtectedTab('achievements'), true);
  assert.equal(isProtectedTab('admin'), true);
  assert.equal(isProtectedTab('overview'), false);
  assert.equal(isProtectedTab('catalog'), false);

  assert.equal(isProtectedPathname('/profile'), true);
  assert.equal(isProtectedPathname('/uz/profile'), true);
  assert.equal(isProtectedPathname('/achievements'), true);
  assert.equal(isProtectedPathname('/dashboard'), true);
  assert.equal(isProtectedPathname('/admin'), true);
  assert.equal(isProtectedPathname('/course/econ-101/assessment'), false);
  assert.equal(isProtectedPathname('/course/econ-101'), false);
  assert.equal(isProtectedPathname('/catalog'), false);
  assert.equal(isProtectedPathname('/overview'), false);
});

test('sanitizeRedirectTo prevents open redirects and login loops', () => {
  assert.equal(sanitizeRedirectTo('/achievements'), '/achievements');
  assert.equal(sanitizeRedirectTo('/course/econ-101'), '/course/econ-101');
  assert.equal(sanitizeRedirectTo('https://evil.example.com'), '/overview');
  assert.equal(sanitizeRedirectTo('//evil.example.com'), '/overview');
  assert.equal(sanitizeRedirectTo('/login'), '/overview');
  assert.equal(sanitizeRedirectTo('/register?redirectTo=/profile'), '/overview');
});

test('evaluateMiddlewareRouteGuard redirects unauthenticated users from protected routes to /login with redirectTo', () => {
  const unauthProfile = evaluateMiddlewareRouteGuard({
    pathname: '/profile',
    isAuthenticated: false,
  });
  assert.equal(unauthProfile.action, 'redirect');
  assert.equal(unauthProfile.destination, '/login?redirectTo=%2Fprofile');
  assert.equal(unauthProfile.reason, 'unauthenticated_protected');

  const unauthDashboard = evaluateMiddlewareRouteGuard({
    pathname: '/achievements',
    search: '?view=ledger',
    isAuthenticated: false,
  });
  assert.equal(unauthDashboard.action, 'redirect');
  assert.equal(
    unauthDashboard.destination,
    '/login?redirectTo=%2Fachievements%3Fview%3Dledger'
  );

  const authedProfile = evaluateMiddlewareRouteGuard({
    pathname: '/profile',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(authedProfile.action, 'allow');
  assert.equal(authedProfile.destination, null);
});

test('evaluateMiddlewareRouteGuard redirects authenticated users away from /login back to intended destination', () => {
  const authedLogin = evaluateMiddlewareRouteGuard({
    pathname: '/login',
    search: '?redirectTo=%2Fachievements',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(authedLogin.action, 'redirect');
  assert.equal(authedLogin.destination, '/achievements');
  assert.equal(authedLogin.reason, 'already_authenticated');

  const learnerAdmin = evaluateMiddlewareRouteGuard({
    pathname: '/admin',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(learnerAdmin.action, 'redirect');
  assert.equal(learnerAdmin.destination, '/overview');
  assert.equal(learnerAdmin.reason, 'insufficient_role');
});

test('middleware enforces route protection and extracts session tokens from cookies and headers', () => {
  const unauthResult = middleware({
    url: 'http://localhost:3000/profile',
    headers: {
      get() {
        return null;
      },
    },
  });
  assert.equal(unauthResult.status, 307);
  assert.equal(
    unauthResult.redirectUrl,
    'http://localhost:3000/login?redirectTo=%2Fprofile'
  );
  assert.equal(unauthResult.headers['x-econova-auth-status'], 'anonymous');

  const validPayload = Buffer.from(
    JSON.stringify({
      userId: 'usr-123',
      exp: Date.now() + 3600_000,
      role: 'learner',
    }),
    'utf8'
  ).toString('base64url');
  const fakeSignedToken = `${validPayload}.sig123`;

  assert.equal(decodeUnverifiedSessionPayload(fakeSignedToken)?.userId, 'usr-123');

  const authedResult = middleware({
    url: 'http://localhost:3000/profile',
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'cookie') {
          return `econova_session=${fakeSignedToken}`;
        }
        return null;
      },
    },
  });
  assert.equal(authedResult.status, 200);
  assert.equal(authedResult.redirectUrl, null);
  assert.equal(authedResult.headers['x-econova-auth-status'], 'authenticated');
  assert.equal(authedResult.headers['x-econova-user-id'], 'usr-123');
});

test('parseRouteFromLocation, buildPathForTab, and formatDestinationLabel handle EN and UZ destinations', () => {
  const parsedLogin = parseRouteFromLocation('/login', '?redirectTo=%2Fcourse%2Fecon-supply-demand');
  assert.equal(parsedLogin.tab, 'login');
  assert.equal(parsedLogin.redirectTo, '/course/econ-supply-demand');

  const dest = resolveDestinationFromPath(parsedLogin.redirectTo);
  assert.equal(dest.tab, 'course');
  assert.equal(dest.courseId, 'econ-supply-demand');

  assert.equal(
    buildPathForTab('login', { redirectTo: '/achievements' }),
    '/login?redirectTo=%2Fachievements'
  );
  assert.equal(formatDestinationLabel('/achievements', 'en'), 'XP & Study Streak');
  assert.equal(formatDestinationLabel('/achievements', 'uz'), 'XP va davomiylik');
});

test('installAuthFetchInterceptor never throws when window.fetch is a getter-only property', async () => {
  const { installAuthFetchInterceptor } = await import('./auth-client.ts');
  assert.doesNotThrow(() => {
    installAuthFetchInterceptor();
  });
});

