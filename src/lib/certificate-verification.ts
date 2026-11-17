import { NON_ACCREDITATION_NOTICE } from '../shared/econova-rules.ts';
import type {
  CertificateServerVerification,
  CourseLevel,
  LocaleCode,
  Subject,
} from '../shared/types.ts';

export function buildOwnerCertificateVerification(
  cert: {
    id: string;
    publicToken: string;
    status: 'valid' | 'revoked';
    shareEnabled: boolean;
    recipientDisplayName: string;
    courseTitle: string;
    subject: Subject;
    level: CourseLevel;
    locale: LocaleCode;
    editionVersion: number;
    issuedAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
  },
  verifiedAtIso: string
): CertificateServerVerification {
  return {
    certificateId: cert.id,
    publicToken: cert.publicToken,
    verificationStatus: cert.status === 'revoked' ? 'revoked' : 'valid',
    verifiedAt: verifiedAtIso,
    issuedAt: cert.issuedAt,
    shareEnabled: cert.shareEnabled,
    recipientDisplayName: cert.recipientDisplayName,
    courseTitle: cert.courseTitle,
    subject: cert.subject,
    level: cert.level,
    locale: cert.locale,
    editionVersion: cert.editionVersion,
    revokedAt: cert.status === 'revoked' ? cert.revokedAt : null,
    revokeReason: cert.status === 'revoked' ? cert.revokeReason : null,
    nonAccreditationNotice: NON_ACCREDITATION_NOTICE,
  };
}

export function formatVerificationStatusLabel(
  status: 'valid' | 'revoked',
  locale: LocaleCode
): string {
  if (status === 'revoked') {
    return locale === 'uz' ? 'Bekor qilingan (Revoked)' : 'Revoked';
  }
  return locale === 'uz' ? 'Tasdiqlangan · Haqiqiy' : 'Verified · Valid';
}

export function formatServerVerificationTimestamp(
  isoTimestamp: string,
  locale: LocaleCode
): { readable: string; utcIso: string } {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return {
      readable: isoTimestamp || 'Unavailable',
      utcIso: isoTimestamp || 'Unavailable',
    };
  }

  const utcIso = parsed.toISOString();
  try {
    const readable = new Intl.DateTimeFormat(locale === 'uz' ? 'uz-UZ' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }).format(parsed);
    return { readable: `${readable} UTC`, utcIso };
  } catch {
    return { readable: utcIso, utcIso };
  }
}
