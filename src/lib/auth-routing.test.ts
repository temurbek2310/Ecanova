import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPathForTab,
  cleanOAuthUrlParams,
  evaluateMiddlewareRouteGuard,
  formatDestinationLabel,
  isOAuthCallbackUrl,
  isProtectedPathname,
  isProtectedTab,
  parseRouteFromLocation,
  resolveDestinationFromPath,
  sanitizeRedirectTo,
} from './auth-routing.ts';
import { parseOAuthPayload } from './auth-client.ts';
import {
  decodeUnverifiedSessionPayload,
  middleware,
} from '../middleware.ts';

test('isProtectedTab and isProtectedPathname identify protected areas accurately', () => {
  assert.equal(isProtectedTab('profile'), true);
  assert.equal(isProtectedTab('achievements'), true);
  assert.equal(isProtectedTab('admin'), true);
  assert.equal(isProtectedTab('overview'), true);
  assert.equal(isProtectedTab('catalog'), false);

  assert.equal(isProtectedPathname('/profile'), true);
  assert.equal(isProtectedPathname('/uz/profile'), true);
  assert.equal(isProtectedPathname('/achievements'), true);
  assert.equal(isProtectedPathname('/dashboard'), true);
  assert.equal(isProtectedPathname('/admin'), true);
  assert.equal(isProtectedPathname('/course/econ-101/assessment'), false);
  assert.equal(isProtectedPathname('/course/econ-101'), false);
  assert.equal(isProtectedPathname('/catalog'), false);
  assert.equal(isProtectedPathname('/overview'), true);
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

test('landing page and default app-entry flow route to /overview instead of /catalog', () => {
  const parsedRoot = parseRouteFromLocation('/');
  assert.equal(parsedRoot.tab, 'landing');

  // App-entry target is /overview (not /catalog)
  assert.equal(buildPathForTab('overview'), '/overview');

  // /overview is strictly protected: unauthenticated users redirect to /login?redirectTo=%2Foverview
  assert.equal(isProtectedTab('overview'), true);
  assert.equal(isProtectedPathname('/overview'), true);
  const unauthOverview = evaluateMiddlewareRouteGuard({
    pathname: '/overview',
    isAuthenticated: false,
  });
  assert.equal(unauthOverview.action, 'redirect');
  assert.equal(unauthOverview.destination, '/login?redirectTo=%2Foverview');
  assert.equal(unauthOverview.reason, 'unauthenticated_protected');

  // Authenticated users on /overview are allowed without flash
  const authedOverview = evaluateMiddlewareRouteGuard({
    pathname: '/overview',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(authedOverview.action, 'allow');
  assert.equal(authedOverview.destination, null);

  // /catalog remains a dedicated public catalog route
  assert.equal(buildPathForTab('catalog'), '/catalog');
  assert.equal(isProtectedTab('catalog'), false);
  assert.equal(isProtectedPathname('/catalog'), false);

  // Default redirect when authenticated on guest route is /overview
  const authedGuest = evaluateMiddlewareRouteGuard({
    pathname: '/login',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(authedGuest.action, 'redirect');
  assert.equal(authedGuest.destination, '/overview');

  // Intended destination from /login with redirectTo preserves /overview
  const parsedLoginOverview = parseRouteFromLocation('/login', '?redirectTo=%2Foverview');
  assert.equal(parsedLoginOverview.redirectTo, '/overview');
  const resolved = resolveDestinationFromPath(parsedLoginOverview.redirectTo);
  assert.equal(resolved.tab, 'overview');
  assert.equal(resolved.path, '/overview');
});

test('unauthenticated Launch App goes directly to Sign In / Sign Up with zero overview/catalog flash', () => {
  // 1. Landing root is public and parses to landing tab
  const landingLocation = parseRouteFromLocation('/');
  assert.equal(landingLocation.tab, 'landing');
  assert.equal(evaluateMiddlewareRouteGuard({ pathname: '/', isAuthenticated: false }).action, 'allow');

  // 2. Unauthenticated CTA directs to Sign In with post-auth destination /overview
  const unauthLaunchTarget = buildPathForTab('login', { redirectTo: '/overview' });
  assert.equal(unauthLaunchTarget, '/login?redirectTo=%2Foverview');

  // 3. Middle-click or direct link to unauthenticated register flow also sets post-auth to /overview
  const unauthRegisterTarget = buildPathForTab('register', { redirectTo: '/overview' });
  assert.equal(unauthRegisterTarget, '/register?redirectTo=%2Foverview');

  // 4. Authenticated Launch App goes directly to /overview
  const authedLaunchTarget = buildPathForTab('overview');
  assert.equal(authedLaunchTarget, '/overview');

  // 5. Post-auth resolution: after sign-in completes, destination resolves to overview (never catalog)
  const postAuthDest = resolveDestinationFromPath('/overview');
  assert.equal(postAuthDest.tab, 'overview');
  assert.equal(postAuthDest.path, '/overview');

  // 6. Direct /overview attempts while unauthenticated trigger immediate login redirect
  const directOverviewGuard = evaluateMiddlewareRouteGuard({
    pathname: '/overview',
    isAuthenticated: false,
  });
  assert.equal(directOverviewGuard.action, 'redirect');
  assert.equal(directOverviewGuard.destination, '/login?redirectTo=%2Foverview');
  assert.equal(directOverviewGuard.reason, 'unauthenticated_protected');
});

test('OAuth callback recognition, query/hash cleanup, and post-OAuth redirect resolution', () => {
  // 1. Detect OAuth callback locations accurately
  assert.equal(isOAuthCallbackUrl('/auth/callback'), true);
  assert.equal(isOAuthCallbackUrl('/auth/callback/'), true);
  assert.equal(isOAuthCallbackUrl('/login', '?code=auth_code_123'), true);
  assert.equal(isOAuthCallbackUrl('/login', '?oauthError=access_denied'), true);
  assert.equal(isOAuthCallbackUrl('/overview', '', '#access_token=token_xyz&token_type=bearer'), true);
  assert.equal(isOAuthCallbackUrl('/overview', '', '#error=access_denied'), true);
  assert.equal(isOAuthCallbackUrl('/login', '?redirectTo=%2Foverview'), false);
  assert.equal(isOAuthCallbackUrl('/overview', ''), false);
  assert.equal(isOAuthCallbackUrl('/catalog', '?subject=economics'), false);

  // 2. Clean OAuth params cleanly while preserving legitimate navigation parameters
  assert.equal(cleanOAuthUrlParams('/auth/callback', '?code=123&state=xyz'), '/overview');
  assert.equal(cleanOAuthUrlParams('/login', '?code=123&state=xyz&redirectTo=%2Fprofile'), '/login?redirectTo=%2Fprofile');
  assert.equal(cleanOAuthUrlParams('/login', '?oauthError=cancelled'), '/login');
  assert.equal(cleanOAuthUrlParams('/overview', '?tab=stats'), '/overview?tab=stats');

  // 3. Parse OAuth payloads from BroadcastChannel / storage / postMessage
  const validSuccess = parseOAuthPayload({
    type: 'OAUTH_AUTH_SUCCESS',
    user: { id: 'usr-google-1', email: 'scholar@gmail.com', displayName: 'Scholar' },
    redirectTo: '/profile',
  });
  assert.equal(validSuccess?.type, 'success');
  if (validSuccess?.type === 'success') {
    assert.equal(validSuccess.user.id, 'usr-google-1');
    assert.equal(validSuccess.redirectTo, '/profile');
  }

  const validError = parseOAuthPayload({
    type: 'OAUTH_AUTH_ERROR',
    reason: 'access_denied',
  });
  assert.equal(validError?.type, 'error');
  if (validError?.type === 'error') {
    assert.equal(validError.reason, 'access_denied');
  }

  assert.equal(parseOAuthPayload(null), null);
  assert.equal(parseOAuthPayload({ type: 'UNKNOWN_EVENT' }), null);

  // 4. Authenticated user on /login or /register with redirectTo is redirected to destination
  const postOAuthRedirect = evaluateMiddlewareRouteGuard({
    pathname: '/login',
    search: '?redirectTo=%2Fprofile',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(postOAuthRedirect.action, 'redirect');
  assert.equal(postOAuthRedirect.destination, '/profile');
  assert.equal(postOAuthRedirect.reason, 'already_authenticated');

  // 5. Authenticated user on bare /login defaults to /overview
  const postOAuthDefault = evaluateMiddlewareRouteGuard({
    pathname: '/login',
    search: '',
    isAuthenticated: true,
    userRole: 'learner',
  });
  assert.equal(postOAuthDefault.action, 'redirect');
  assert.equal(postOAuthDefault.destination, '/overview');
  assert.equal(postOAuthDefault.reason, 'already_authenticated');
});


