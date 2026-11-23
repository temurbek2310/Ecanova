process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { setMockSqlExecutor, type SqlExecutor } from './db.ts';
import { buildApp } from '../server.ts';
import {
  __resetAuthThrottleForTests,
  hashPassword,
  parseCookies,
  signSessionToken,
  verifyPassword,
} from './auth.ts';

interface MockUser {
  id: string;
  email: string;
  password_hash: string | null;
  role: string;
  created_at: string;
}

interface MockProfile {
  user_id: string;
  display_name: string;
  preferred_locale: 'en' | 'uz';
  timezone: string;
  age_band: 'school' | 'university' | 'independent';
  leaderboard_opt_in: boolean;
  leaderboard_pseudonym: string;
  consent_accepted_at: string | null;
  daily_study_goal_minutes: number;
  study_goal_notifications_enabled: boolean;
  weekly_digest_email_enabled: boolean;
  lesson_notes_json: unknown;
  bookmarked_course_ids: unknown;
}

interface MockAuditEvent {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
}

function createInMemoryDb() {
  const users = new Map<string, MockUser>();
  const profiles = new Map<string, MockProfile>();
  const auditEvents: MockAuditEvent[] = [];

  const executor: SqlExecutor = {
    async query<T>(_text: string, _params: unknown[] = []): Promise<T[]> {
      return [];
    },
    async queryOne<T>(text: string, params: unknown[] = []): Promise<T | null> {
      // 1. SELECT id, password_hash FROM users WHERE email = $1
      if (/SELECT id, password_hash FROM users WHERE email = \$1/i.test(text)) {
        const email = String(params[0]).toLowerCase();
        for (const u of users.values()) {
          if (u.email.toLowerCase() === email) {
            return { id: u.id, password_hash: u.password_hash } as unknown as T;
          }
        }
        return null;
      }

      // 2. SELECT id, password_hash FROM users WHERE id = $1
      if (/SELECT id, password_hash FROM users WHERE id = \$1/i.test(text)) {
        const id = String(params[0]);
        const u = users.get(id);
        if (!u) return null;
        return { id: u.id, password_hash: u.password_hash } as unknown as T;
      }

      // 3. User summary join query: SELECT u.id, u.email, u.role, u.password_hash, p.display_name...
      if (/FROM users u\s+JOIN learner_profiles p ON p\.user_id = u\.id/i.test(text)) {
        const userId = String(params[0]);
        const u = users.get(userId);
        if (!u) return null;
        const p = profiles.get(userId) || {
          user_id: u.id,
          display_name: 'Test Learner',
          preferred_locale: 'en',
          timezone: 'Asia/Tashkent',
          age_band: 'university',
          leaderboard_opt_in: false,
          leaderboard_pseudonym: 'Scholar-TEST',
          consent_accepted_at: new Date().toISOString(),
          daily_study_goal_minutes: 30,
          study_goal_notifications_enabled: false,
          weekly_digest_email_enabled: false,
          lesson_notes_json: '{}',
          bookmarked_course_ids: [],
        };
        return {
          id: u.id,
          email: u.email,
          role: u.role,
          password_hash: u.password_hash,
          display_name: p.display_name,
          preferred_locale: p.preferred_locale,
          timezone: p.timezone,
          age_band: p.age_band,
          leaderboard_opt_in: p.leaderboard_opt_in,
          leaderboard_pseudonym: p.leaderboard_pseudonym,
          consent_accepted_at: p.consent_accepted_at,
          daily_study_goal_minutes: p.daily_study_goal_minutes,
          study_goal_notifications_enabled: p.study_goal_notifications_enabled,
          weekly_digest_email_enabled: p.weekly_digest_email_enabled,
          lesson_notes_json: p.lesson_notes_json,
          bookmarked_course_ids: p.bookmarked_course_ids,
        } as unknown as T;
      }

      return null;
    },
    async execute(text: string, params: unknown[] = []): Promise<number> {
      // INSERT INTO users
      if (/INSERT INTO users/i.test(text)) {
        const [id, email, password_hash, role, created_at] = params as [
          string,
          string,
          string | null,
          string,
          string,
        ];
        users.set(id, {
          id,
          email: email.toLowerCase(),
          password_hash: password_hash ?? null,
          role,
          created_at,
        });
        return 1;
      }

      // INSERT INTO learner_profiles
      if (/INSERT INTO learner_profiles/i.test(text)) {
        const [user_id, display_name, preferred_locale, timezone, age_band, leaderboard_pseudonym] =
          params as [string, string, 'en' | 'uz', string, 'school' | 'university' | 'independent', string];
        profiles.set(user_id, {
          user_id,
          display_name,
          preferred_locale,
          timezone,
          age_band,
          leaderboard_opt_in: false,
          leaderboard_pseudonym,
          consent_accepted_at: new Date().toISOString(),
          daily_study_goal_minutes: 30,
          study_goal_notifications_enabled: false,
          weekly_digest_email_enabled: false,
          lesson_notes_json: '{}',
          bookmarked_course_ids: [],
        });
        return 1;
      }

      // UPDATE users SET password_hash = $1 WHERE id = $2
      if (/UPDATE users SET password_hash/i.test(text)) {
        const [password_hash, id] = params as [string, string];
        const u = users.get(id);
        if (u) {
          u.password_hash = password_hash;
          return 1;
        }
        return 0;
      }

      // INSERT INTO audit_events
      if (/INSERT INTO audit_events/i.test(text)) {
        const [id, actor_user_id, action, target_type, target_id, reason, created_at] = params as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ];
        auditEvents.push({
          id,
          actor_user_id,
          action,
          target_type,
          target_id,
          reason,
          created_at,
        });
        return 1;
      }

      return 0;
    },
  };

  return { users, profiles, auditEvents, executor };
}

async function withTestServer(run: (baseUrl: string, memDb: ReturnType<typeof createInMemoryDb>) => Promise<void>) {
  __resetAuthThrottleForTests();
  const memDb = createInMemoryDb();
  setMockSqlExecutor(memDb.executor);

  const app = buildApp();
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`, memDb);
  } finally {
    setMockSqlExecutor(null);
    __resetAuthThrottleForTests();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('1. Google-only user trying email+password login receives GOOGLE_ONLY_ACCOUNT and is not logged in', async () => {
  await withTestServer(async (baseUrl, memDb) => {
    // Seed a Google-only user with password_hash: null
    memDb.users.set('usr-google-1', {
      id: 'usr-google-1',
      email: 'scholar@gmail.com',
      password_hash: null,
      role: 'learner',
      created_at: new Date().toISOString(),
    });

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'scholar@gmail.com',
        password: 'AttemptPassword123!',
      }),
    });

    assert.equal(res.status, 409);
    const data = (await res.json()) as { error?: string; code?: string; user?: unknown };
    assert.equal(data.code, 'GOOGLE_ONLY_ACCOUNT');
    assert.ok(data.error && data.error.includes('Google'));
    assert.equal(data.user, undefined, 'No user object is returned');

    // Verify session cookie was NOT set
    const cookies = res.headers.get('set-cookie');
    assert.ok(!cookies || !cookies.includes('econova_session='));
  });
});

test('2. Account takeover attempt via /api/auth/register on an existing Google-only email returns 409 and leaves row untouched', async () => {
  await withTestServer(async (baseUrl, memDb) => {
    // Existing Google-only account
    memDb.users.set('usr-google-victim', {
      id: 'usr-google-victim',
      email: 'victim@gmail.com',
      password_hash: null,
      role: 'learner',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'victim@gmail.com',
        password: 'AttackerNewPassword123!',
        displayName: 'Attacker Impersonator',
      }),
    });

    assert.equal(res.status, 409);
    const data = (await res.json()) as { error?: string; code?: string };
    assert.equal(data.code, 'GOOGLE_ONLY_ACCOUNT');

    // Crucial: database row remains completely untouched
    const userInDb = memDb.users.get('usr-google-victim');
    assert.ok(userInDb);
    assert.equal(userInDb.password_hash, null, 'password_hash must remain null');
    assert.equal(userInDb.created_at, '2026-01-01T00:00:00.000Z');
  });
});

test('3. Unauthenticated request to POST /api/auth/password returns 401', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: 'NewPassword123!' }),
    });

    assert.equal(res.status, 401);
    const data = (await res.json()) as { error?: string };
    assert.ok(data.error && data.error.toLowerCase().includes('auth'));
  });
});

test('4. Authenticated Google-only user can set a password (hasPassword becomes true) and subsequently sign in with email+password', async () => {
  await withTestServer(async (baseUrl, memDb) => {
    // Google-only user
    memDb.users.set('usr-google-link', {
      id: 'usr-google-link',
      email: 'linker@gmail.com',
      password_hash: null,
      role: 'learner',
      created_at: new Date().toISOString(),
    });

    // Create a valid session token for this user
    const token = signSessionToken({
      userId: 'usr-google-link',
      exp: Date.now() + 60_000,
      role: 'learner',
    });

    // Verify /api/auth/me shows hasPassword: false initially
    const meResBefore = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `econova_session=${token}` },
    });
    assert.equal(meResBefore.status, 200);
    const meBefore = (await meResBefore.json()) as { user?: { hasPassword?: boolean } };
    assert.equal(meBefore.user?.hasPassword, false);

    // Call POST /api/auth/password (Case A: Google-only, no currentPassword needed)
    const setRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `econova_session=${token}`,
      },
      body: JSON.stringify({
        newPassword: 'SecureCreatedPassword123!',
      }),
    });

    assert.equal(setRes.status, 200);
    const setData = (await setRes.json()) as { ok: boolean; hasPassword: boolean };
    assert.equal(setData.ok, true);
    assert.equal(setData.hasPassword, true);

    // Verify DB updated
    const userInDb = memDb.users.get('usr-google-link');
    assert.ok(userInDb?.password_hash, 'Password hash should be populated');
    assert.ok(verifyPassword('SecureCreatedPassword123!', userInDb!.password_hash!));

    // Verify audit event was logged
    const audit = memDb.auditEvents.find(
      (a) => a.actor_user_id === 'usr-google-link' && a.action === 'auth.password_set'
    );
    assert.ok(audit, 'Security audit event must be recorded for password set');

    // Verify /api/auth/me now returns hasPassword: true
    const meResAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `econova_session=${token}` },
    });
    const meAfter = (await meResAfter.json()) as { user?: { hasPassword?: boolean } };
    assert.equal(meAfter.user?.hasPassword, true);

    // Now test email + password login works!
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'linker@gmail.com',
        password: 'SecureCreatedPassword123!',
      }),
    });

    assert.equal(loginRes.status, 200);
    const loginData = (await loginRes.json()) as { user: { hasPassword?: boolean; id: string } };
    assert.equal(loginData.user.id, 'usr-google-link');
    assert.equal(loginData.user.hasPassword, true);
  });
});

test('5. Authenticated user with an existing password cannot change it without correct currentPassword', async () => {
  await withTestServer(async (baseUrl, memDb) => {
    const existingHash = hashPassword('OldSecretPassword123!');
    memDb.users.set('usr-with-password', {
      id: 'usr-with-password',
      email: 'pwduser@econova.uz',
      password_hash: existingHash,
      role: 'learner',
      created_at: new Date().toISOString(),
    });

    const token = signSessionToken({
      userId: 'usr-with-password',
      exp: Date.now() + 60_000,
      role: 'learner',
    });

    // 5a. Missing currentPassword
    const missingRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `econova_session=${token}`,
      },
      body: JSON.stringify({
        newPassword: 'BrandNewPassword123!',
      }),
    });
    assert.equal(missingRes.status, 400);

    // 5b. Incorrect currentPassword
    const wrongRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `econova_session=${token}`,
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword!',
        newPassword: 'BrandNewPassword123!',
      }),
    });
    assert.equal(wrongRes.status, 403);
    const wrongData = (await wrongRes.json()) as { error?: string };
    assert.ok(wrongData.error && wrongData.error.toLowerCase().includes('match'));

    // DB remains unchanged
    assert.equal(memDb.users.get('usr-with-password')?.password_hash, existingHash);

    // 5c. Correct currentPassword successfully updates
    const correctRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `econova_session=${token}`,
      },
      body: JSON.stringify({
        currentPassword: 'OldSecretPassword123!',
        newPassword: 'BrandNewPassword123!',
      }),
    });
    assert.equal(correctRes.status, 200);

    const updatedUser = memDb.users.get('usr-with-password');
    assert.ok(verifyPassword('BrandNewPassword123!', updatedUser!.password_hash!));

    // Audit event for password change recorded
    const audit = memDb.auditEvents.find(
      (a) => a.actor_user_id === 'usr-with-password' && a.action === 'auth.password_changed'
    );
    assert.ok(audit, 'Security audit event must be recorded for password change');
  });
});

test('6. Security & edge cases: password validation (<8 chars), cross-origin blocks, and zero password_hash leaks', async () => {
  await withTestServer(async (baseUrl, memDb) => {
    memDb.users.set('usr-sec-edge', {
      id: 'usr-sec-edge',
      email: 'security@econova.uz',
      password_hash: null,
      role: 'learner',
      created_at: new Date().toISOString(),
    });

    const token = signSessionToken({
      userId: 'usr-sec-edge',
      exp: Date.now() + 60_000,
      role: 'learner',
    });

    // 6a. Password too short (<8 chars)
    const shortRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `econova_session=${token}`,
      },
      body: JSON.stringify({ newPassword: 'short' }),
    });
    assert.equal(shortRes.status, 400);

    // 6b. Cross-origin request rejected (mismatched origin)
    const csrfRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `econova_session=${token}`,
        Origin: 'https://attacker.evil.com',
      },
      body: JSON.stringify({ newPassword: 'ValidLengthPassword123!' }),
    });
    assert.equal(csrfRes.status, 403);

    // 6c. Zero password_hash leaks on /api/auth/me or password update response
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `econova_session=${token}` },
    });
    const meRaw = await meRes.text();
    assert.ok(!meRaw.includes('password_hash'), 'password_hash must never appear in /api/auth/me');

    const updateRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `econova_session=${token}`,
      },
      body: JSON.stringify({ newPassword: 'ValidLengthPassword123!' }),
    });
    const updateRaw = await updateRes.text();
    assert.ok(!updateRaw.includes('password_hash'), 'password_hash must never appear in /api/auth/password response');
  });
});
