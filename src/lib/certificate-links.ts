import { jsPDF } from 'jspdf';
import type { CertificateRecord } from '../shared/types';

export function buildCertificateVerificationUrl(origin: string, publicToken: string): string {
  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  const cleanToken = publicToken.trim();
  return `${cleanOrigin}/?verify=${encodeURIComponent(cleanToken)}`;
}

export interface CertificateJsonExportItem {
  id: string;
  courseId: string;
  editionId: string;
  editionVersion: number;
  locale: string;
  recipientDisplayName: string;
  courseTitle: string;
  subject: string;
  level: string;
  publicToken: string;
  status: 'valid' | 'revoked';
  shareEnabled: boolean;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  templateVersion: string;
  verificationUrl: string;
}

export interface CertificatesJsonExportPayload {
  platform: 'ECONOVA';
  exportedAt: string;
  totalCertificates: number;
  certificates: CertificateJsonExportItem[];
}

export function buildCertificatesJsonExportPayload(
  certificates: readonly CertificateRecord[],
  origin: string,
  exportedAt: string = new Date().toISOString()
): CertificatesJsonExportPayload {
  return {
    platform: 'ECONOVA',
    exportedAt,
    totalCertificates: certificates.length,
    certificates: certificates.map((cert) => ({
      id: cert.id,
      courseId: cert.courseId,
      editionId: cert.editionId,
      editionVersion: cert.editionVersion,
      locale: cert.locale,
      recipientDisplayName: cert.recipientDisplayName,
      courseTitle: cert.courseTitle,
      subject: cert.subject,
      level: cert.level,
      publicToken: cert.publicToken,
      status: cert.status,
      shareEnabled: cert.shareEnabled,
      issuedAt: cert.issuedAt,
      revokedAt: cert.revokedAt,
      revokeReason: cert.revokeReason,
      templateVersion: cert.templateVersion,
      verificationUrl: buildCertificateVerificationUrl(origin, cert.publicToken),
    })),
  };
}

export function triggerCertificatesJsonDownload(
  certificates: readonly CertificateRecord[],
  origin: string
): CertificatesJsonExportPayload {
  const payload = buildCertificatesJsonExportPayload(certificates, origin);
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `econova-certificates-${payload.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return payload;
}

export function exportCertificateToPdf(
  cert: CertificateRecord,
  origin: string,
  nonAccreditationNotice: string
): { fileName: string; verificationUrl: string } {
  const verificationUrl = buildCertificateVerificationUrl(origin, cert.publicToken);
  const fileName = `ECONOVA-Certificate-${cert.publicToken}.pdf`;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Formal high-contrast academic background & double Neobrutalist border
  doc.setFillColor(252, 253, 255);
  doc.rect(0, 0, width, height, 'F');

  doc.setDrawColor(16, 21, 34);
  doc.setLineWidth(3);
  doc.rect(28, 28, width - 56, height - 56, 'S');

  doc.setDrawColor(146, 116, 255);
  doc.setLineWidth(1.5);
  doc.rect(36, 36, width - 72, height - 72, 'S');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(16, 21, 34);
  doc.text('ECONOVA', 64, 84);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(85, 96, 120);
  doc.text('FORMAL CERTIFICATE OF COURSE COMPLETION', 64, 104);

  // Status badge
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(cert.status === 'valid' ? 16 : 180, cert.status === 'valid' ? 130 : 40, 80);
  doc.text(
    cert.status === 'valid' ? 'STATUS: VERIFIED & VALID' : 'STATUS: REVOKED',
    width - 64,
    84,
    { align: 'right' }
  );

  // Divider
  doc.setDrawColor(210, 216, 228);
  doc.setLineWidth(1);
  doc.line(64, 122, width - 64, 122);

  // Recipient
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(85, 96, 120);
  doc.text('Presented to', 64, 168);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(16, 21, 34);
  doc.text(cert.recipientDisplayName, 64, 206);

  // Course Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(85, 96, 120);
  doc.text('For successfully completing all required lessons and passing the final assessment in', 64, 252);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(92, 64, 214);
  const splitCourseTitle = doc.splitTextToSize(cert.courseTitle, width - 128);
  doc.text(splitCourseTitle, 64, 282);

  // Subject, Level, Edition
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(16, 21, 34);
  doc.text(
    `Subject: ${cert.subject}   |   Difficulty Level: ${cert.level}   |   Edition: ${cert.locale.toUpperCase()} v${cert.editionVersion}`,
    64,
    340
  );

  // Footer Metadata & Verification URL
  doc.setDrawColor(210, 216, 228);
  doc.line(64, height - 135, width - 64, height - 135);

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(16, 21, 34);
  doc.text(`Certificate ID: ${cert.publicToken}`, 64, height - 108);
  doc.text(`Issued Date:    ${cert.issuedAt.slice(0, 10)}`, 64, height - 90);
  doc.text(`Verify Online:  ${verificationUrl}`, 64, height - 72);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 110, 130);
  const noticeLines = doc.splitTextToSize(nonAccreditationNotice, width - 128);
  doc.text(noticeLines, 64, height - 48);

  doc.save(fileName);
  return { fileName, verificationUrl };
}

export async function copyCertificateVerificationUrl(
  origin: string,
  publicToken: string
): Promise<{ ok: boolean; url: string; error?: string }> {
  const url = buildCertificateVerificationUrl(origin, publicToken);

  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return {
      ok: false,
      url,
      error: 'Clipboard API is unavailable in this browser context.',
    };
  }

  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, url };
  } catch {
    return {
      ok: false,
      url,
      error: 'Unable to copy link to clipboard. Check browser clipboard permissions.',
    };
  }
}
