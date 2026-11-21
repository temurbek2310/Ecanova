import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express, { type Request, type Response } from 'express';
import type { UserRole } from '../src/shared/types.ts';
import {
  __resetAuthThrottleForTests,
  assertSessionSecretForProduction,
  buildGoogleOAuthState,
  clearAuthFailuresForEmail,
  createOAuthNonce,
  extractSessionTokenFromRequest,
  getAuthThrottleRetryAfter,
  recordAuthFailure,
  signSessionToken,
  verifyGoogleOAuthState,
  verifySessionToken,
  requireAdmin,
  requireRole,
  type AuthenticatedRequest,
} from './auth.ts';

function fakeRequest(headers: Record<string, string> = {}, ip = '203.0.113.7'): Request {
  return { headers, ip, socket: { remoteAddress: ip } } as unknown as Request;
}

test('session tokens: signed tokens verify, forged or tampered ones do not', () => {
  const token = signSessionToken({ userId: 'usr-1', exp: Date.now() + 60_000, role: 'learner' });
  assert.equal(verifySessionToken(token)?.userId, 'usr-1');

  const [payload] = token.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ userId: 'usr-1', exp: Date.now() + 60_000, role: 'admin' })
  ).toString('base64url');
  assert.equal(verifySessionToken(`${forgedPayload}.${token.split('.')[1]}`), null);
  assert.equal(verifySessionToken(`${payload}.not-a-signature`), null);
  assert.equal(verifySessionToken('econova-mvp-guest-session'), null);

  const expired = signSessionToken({ userId: 'usr-1', exp: Date.now() - 1 });
  assert.equal(verifySessionToken(expired), null);
});

test('session token extraction ignores the legacy JS-readable cookie and custom header', () => {
  assert.equal(
    extractSessionTokenFromRequest(fakeRequest({ cookie: 'econova_client_session=legacy' })),
    null
  );
  assert.equal(extractSessionTokenFromRequest(fakeRequest({ 'x-econova-session': 'legacy' })), null);
  assert.equal(
    extractSessionTokenFromRequest(fakeRequest({ cookie: 'econova_session=real; other=1' })),
    'real'
  );
  assert.equal(extractSessionTokenFromRequest(fakeRequest({ authorization: 'Bearer api' })), 'api');
});

test('OAuth state requires a valid signature, an unexpired payload and the matching browser nonce', () => {
  const nonce = createOAuthNonce();
  const state = buildGoogleOAuthState({ redirectTo: '/profile', locale: 'uz', nonce });

  assert.deepEqual(verifyGoogleOAuthState(state, nonce), { redirectTo: '/profile', locale: 'uz' });
  // Started in another browser (login CSRF) or nonce cookie missing.
  assert.equal(verifyGoogleOAuthState(state, createOAuthNonce()), null);
  assert.equal(verifyGoogleOAuthState(state, undefined), null);
  // Missing or forged state.
  assert.equal(verifyGoogleOAuthState(undefined, nonce), null);
  assert.equal(verifyGoogleOAuthState(`${state.split('.')[0]}.forged`, nonce), null);
  // Open redirects are neutralised.
  const evil = buildGoogleOAuthState({ redirectTo: '//evil.example', locale: 'en', nonce });
  assert.equal(verifyGoogleOAuthState(evil, nonce)?.redirectTo, '/overview');
});

test('login throttle blocks an email after repeated failures and clears on success', () => {
  __resetAuthThrottleForTests();
  const req = fakeRequest();
  const email = 'learner@example.com';
  for (let i = 0; i < 10; i += 1) {
    assert.equal(getAuthThrottleRetryAfter(req, 'login', email), null);
    recordAuthFailure(req, 'login', email);
  }
  const retryAfter = getAuthThrottleRetryAfter(req, 'login', email);
  assert.ok(retryAfter !== null && retryAfter > 0);
  // Another account from the same IP is unaffected (shared school networks).
  assert.equal(getAuthThrottleRetryAfter(req, 'login', 'classmate@example.com'), null);

  clearAuthFailuresForEmail('login', email);
  assert.equal(getAuthThrottleRetryAfter(req, 'login', email), null);
  __resetAuthThrottleForTests();
});

test('login throttle caps total failures per IP across many emails', () => {
  __resetAuthThrottleForTests();
  const req = fakeRequest({}, '198.51.100.9');
  for (let i = 0; i < 100; i += 1) {
    recordAuthFailure(req, 'login', `user${i}@example.com`);
  }
  assert.ok(getAuthThrottleRetryAfter(req, 'login', 'fresh@example.com') !== null);
  assert.equal(getAuthThrottleRetryAfter(fakeRequest({}, '198.51.100.10'), 'login'), null);
  __resetAuthThrottleForTests();
});

test('production refuses to start without a real SESSION_SECRET', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSecret = process.env.SESSION_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    assert.throws(() => assertSessionSecretForProduction(), /SESSION_SECRET/);
    process.env.SESSION_SECRET = 'CHANGE_ME_FOR_PRODUCTION';
    assert.throws(() => assertSessionSecretForProduction(), /SESSION_SECRET/);
    process.env.SESSION_SECRET = 'a'.repeat(32);
    assert.doesNotThrow(() => assertSessionSecretForProduction());
  } finally {
    process.env.NODE_ENV = previousEnv;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});

// --- RBAC guards: requireRole / requireAdmin over a real Express server ---

async function withGuardServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  // Test-only stand-in for attachOptionalAuth: the role comes from a header.
  app.use((req, _res, next) => {
    const role = req.header('x-test-role');
    if (role) {
      (req as AuthenticatedRequest).authUser = {
        id: `usr-${role}`,
        role: role as UserRole,
      } as AuthenticatedRequest['authUser'];
    }
    next();
  });
  const ok = (_req: Request, res: Response) => {
    res.json({ ok: true });
  };
  app.get('/learner-or-admin', requireRole('learner', 'admin'), ok);
  app.get('/system', requireAdmin, ok);
  // Mirrors server.ts: one prefix gate in front of every /api/admin/* route,
  // so even a route registered without its own guard is admin-only.
  app.use('/api/admin', requireAdmin);
  app.get('/api/admin/unguarded-example', ok);
  app.patch('/api/admin/users/:userId/role', requireAdmin, ok);

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function statusFor(url: string, role?: string): Promise<number> {
  const res = await fetch(url, { headers: role ? { 'x-test-role': role } : {} });
  await res.arrayBuffer();
  return res.status;
}

test('requireRole: 401 unauthenticated, 403 wrong role, 200 allowed role', async () => {
  await withGuardServer(async (base) => {
    assert.equal(await statusFor(`${base}/learner-or-admin`), 401);
    assert.equal(await statusFor(`${base}/learner-or-admin`, 'learner'), 200);
    assert.equal(await statusFor(`${base}/learner-or-admin`, 'admin'), 200);
    assert.equal(await statusFor(`${base}/learner-or-admin`, 'superuser'), 403);
  });
});

test('requireAdmin allows only an exact admin role (legacy staff roles are refused)', async () => {
  await withGuardServer(async (base) => {
    assert.equal(await statusFor(`${base}/system`), 401);
    for (const role of ['learner', 'editor', 'reviewer', 'publisher', 'Admin', 'ADMIN']) {
      assert.equal(await statusFor(`${base}/system`, role), 403, role);
    }
    assert.equal(await statusFor(`${base}/system`, 'admin'), 200);
  });
});

test('the /api/admin prefix gate covers routes that forgot their own guard', async () => {
  await withGuardServer(async (base) => {
    assert.equal(await statusFor(`${base}/api/admin/unguarded-example`), 401);
    assert.equal(await statusFor(`${base}/api/admin/unguarded-example`, 'learner'), 403);
    assert.equal(await statusFor(`${base}/api/admin/unguarded-example`, 'editor'), 403);
    assert.equal(await statusFor(`${base}/api/admin/unguarded-example`, 'admin'), 200);

    const patchStatus = async (role?: string) => {
      const res = await fetch(`${base}/api/admin/users/usr-x/role`, {
        method: 'PATCH',
        headers: role ? { 'x-test-role': role } : {},
      });
      await res.arrayBuffer();
      return res.status;
    };
    assert.equal(await patchStatus(), 401);
    assert.equal(await patchStatus('learner'), 403);
    assert.equal(await patchStatus('admin'), 200);
  });
});

test('requireRole refuses to be built with no roles', () => {
  assert.throws(() => requireRole());
});
