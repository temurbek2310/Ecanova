import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCertificateVerificationUrl,
  buildCertificatesJsonExportPayload,
} from './certificate-links';
import type { CertificateRecord } from '../shared/types';

test('buildCertificateVerificationUrl constructs clean verify query URL', () => {
  assert.equal(
    buildCertificateVerificationUrl('https://econova.example/', 'ECONOVA-123ABC'),
    'https://econova.example/?verify=ECONOVA-123ABC'
  );
  assert.equal(
    buildCertificateVerificationUrl('http://localhost:3000', ' ECONOVA-A1 B2 '),
    'http://localhost:3000/?verify=ECONOVA-A1%20B2'
  );
});

test('buildCertificatesJsonExportPayload includes all certificate metadata and verification URLs', () => {
  const sampleCerts: CertificateRecord[] = [
    {
      id: 'cert-1',
      courseId: 'course-econ-beg',
      editionId: 'ed-econ-en-1',
      editionVersion: 1,
      locale: 'en',
      recipientDisplayName: 'Dilnoza Karimova',
      courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
      subject: 'Economics',
      level: 'Beginner',
      publicToken: 'ECONOVA-ABCDEF123456',
      status: 'valid',
      shareEnabled: true,
      issuedAt: '2026-03-10T12:00:00.000Z',
      revokedAt: null,
      revokeReason: null,
      templateVersion: 'cert-template-v1',
    },
  ];

  const payload = buildCertificatesJsonExportPayload(
    sampleCerts,
    'https://econova.edu/',
    '2026-03-15T00:00:00.000Z'
  );

  assert.equal(payload.platform, 'ECONOVA');
  assert.equal(payload.totalCertificates, 1);
  assert.equal(payload.exportedAt, '2026-03-15T00:00:00.000Z');
  assert.equal(
    payload.certificates[0].verificationUrl,
    'https://econova.edu/?verify=ECONOVA-ABCDEF123456'
  );
  assert.equal(payload.certificates[0].courseTitle, 'Foundations of Supply, Demand & Market Equilibrium');
});
