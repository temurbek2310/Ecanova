import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOwnerCertificateVerification,
  formatServerVerificationTimestamp,
  formatVerificationStatusLabel,
} from './certificate-verification';

test('buildOwnerCertificateVerification builds valid and revoked server verification payloads', () => {
  const valid = buildOwnerCertificateVerification(
    {
      id: 'cert-1',
      publicToken: 'ECONOVA-ABC123',
      status: 'valid',
      shareEnabled: false,
      recipientDisplayName: 'Aziza K.',
      courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
      subject: 'Economics',
      level: 'Beginner',
      locale: 'en',
      editionVersion: 1,
      issuedAt: '2026-11-16T10:00:00.000Z',
      revokedAt: null,
      revokeReason: null,
    },
    '2026-11-16T19:12:00.000Z'
  );

  assert.equal(valid.certificateId, 'cert-1');
  assert.equal(valid.verificationStatus, 'valid');
  assert.equal(valid.verifiedAt, '2026-11-16T19:12:00.000Z');
  assert.equal(valid.shareEnabled, false);
  assert.equal(valid.revokedAt, null);
  assert.ok(valid.nonAccreditationNotice.includes('not academic credit'));

  const revoked = buildOwnerCertificateVerification(
    {
      id: 'cert-2',
      publicToken: 'ECONOVA-REV456',
      status: 'revoked',
      shareEnabled: true,
      recipientDisplayName: 'Aziza K.',
      courseTitle: 'Applied Calculus',
      subject: 'Mathematics',
      level: 'Intermediate',
      locale: 'en',
      editionVersion: 1,
      issuedAt: '2026-11-15T10:00:00.000Z',
      revokedAt: '2026-11-16T12:00:00.000Z',
      revokeReason: 'Academic integrity audit',
    },
    '2026-11-16T19:12:00.000Z'
  );

  assert.equal(revoked.verificationStatus, 'revoked');
  assert.equal(revoked.revokedAt, '2026-11-16T12:00:00.000Z');
  assert.equal(revoked.revokeReason, 'Academic integrity audit');
});

test('formatVerificationStatusLabel localizes status clearly', () => {
  assert.equal(formatVerificationStatusLabel('valid', 'en'), 'Verified · Valid');
  assert.equal(formatVerificationStatusLabel('revoked', 'en'), 'Revoked');
  assert.equal(formatVerificationStatusLabel('valid', 'uz'), 'Tasdiqlangan · Haqiqiy');
});

test('formatServerVerificationTimestamp formats valid ISO strings and guards invalid input', () => {
  const formatted = formatServerVerificationTimestamp('2026-11-16T19:12:34.000Z', 'en');
  assert.equal(formatted.utcIso, '2026-11-16T19:12:34.000Z');
  assert.ok(formatted.readable.includes('UTC'));

  const invalid = formatServerVerificationTimestamp('not-a-date', 'en');
  assert.equal(invalid.readable, 'not-a-date');
  assert.equal(invalid.utcIso, 'not-a-date');
});
