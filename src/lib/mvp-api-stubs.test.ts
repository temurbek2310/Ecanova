import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalogPayload,
  buildHealthPayload,
  buildLeaderboardsPayload,
  resolveMvpApiFallbackPayload,
} from './mvp-api-stubs';

test('buildHealthPayload reports an offline server with every capability off', () => {
  const fixedDate = new Date('2026-03-26T12:00:00.000Z');
  const payload = buildHealthPayload(fixedDate);
  assert.equal(payload.status, 'offline');
  assert.equal(payload.ok, false);
  assert.equal(payload.offline, true);
  assert.equal(payload.timestamp, '2026-03-26T12:00:00.000Z');
  assert.equal(payload.databaseConfigured, false);
  assert.equal(payload.sandboxEnabled, false);
  assert.equal(payload.googleOAuthConfigured, false);
});

test('buildCatalogPayload returns Math, Economics, and Business courses with bilingual editions', () => {
  const payload = buildCatalogPayload();
  assert.ok(payload.courses.length >= 6);
  const subjects = new Set(payload.courses.map((c) => c.subject));
  assert.ok(subjects.has('Mathematics'));
  assert.ok(subjects.has('Economics'));
  assert.ok(subjects.has('Business'));
  for (const course of payload.courses) {
    assert.ok(course.editions.en);
    assert.ok(course.editions.uz);
  }
});

test('buildLeaderboardsPayload returns quizLeaderboard and filters by courseId', () => {
  const allPayload = buildLeaderboardsPayload('all');
  assert.ok(allPayload.quizLeaderboard.length >= 6);
  assert.ok(allPayload.entries.length >= 5);

  const filtered = buildLeaderboardsPayload('course-quant-calculus');
  assert.equal(filtered.quizLeaderboard.length, 1);
  assert.equal(filtered.quizLeaderboard[0]?.courseId, 'course-quant-calculus');
  assert.equal(filtered.quizLeaderboard[0]?.rank, 1);
});

test('resolveMvpApiFallbackPayload serves public endpoints only, never identity or learner data', () => {
  assert.ok(resolveMvpApiFallbackPayload('/api/health'));
  assert.equal(resolveMvpApiFallbackPayload('/api/auth/me'), null);
  assert.equal(resolveMvpApiFallbackPayload('/api/me/overview'), null);
  assert.equal(resolveMvpApiFallbackPayload('/api/me/certificates'), null);
  assert.equal(resolveMvpApiFallbackPayload('/api/me/referrals'), null);
  assert.ok(resolveMvpApiFallbackPayload('/api/catalog'));
  assert.ok(resolveMvpApiFallbackPayload('/api/leaderboards'));
  assert.equal(resolveMvpApiFallbackPayload('/api/unknown-endpoint'), null);
});
