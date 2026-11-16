import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Copy, Eye, Lock, Printer, Search, Share2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import type { CertificateRecord, CertificateVerificationResult, LocaleCode } from '../shared/types';
import { t } from '../lib/i18n';

interface CertificatesViewProps {
  locale: LocaleCode;
  isAuthenticated: boolean;
  certificates: CertificateRecord[];
  initialVerifyToken?: string | null;
  onRefreshCertificates: () => Promise<void>;
  onRequireAuth: () => void;
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  locale,
  isAuthenticated,
  certificates,
  initialVerifyToken,
  onRefreshCertificates,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);
  const [sharePreviewCert, setSharePreviewCert] = useState<CertificateRecord | null>(null);
  const [verifyInput, setVerifyInput] = useState(initialVerifyToken || '');
  const [verifyResult, setVerifyResult] = useState<CertificateVerificationResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const runVerification = async (token: string) => {
    const clean = token.trim();
    if (!clean) return;
    setVerifyLoading(true);
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(clean)}`);
      const data = (await res.json()) as CertificateVerificationResult;
      setVerifyResult(data);
    } finally {
      setVerifyLoading(false);
    }
  };

  useEffect(() => {
    if (initialVerifyToken) {
      setVerifyInput(initialVerifyToken);
      runVerification(initialVerifyToken);
    }
  }, [initialVerifyToken]);

  const handleToggleShare = async (certId: string, enable: boolean) => {
    await fetch(`/api/me/certificates/${certId}/share`, {
      method: enable ? 'POST' : 'DELETE',
    });
    await onRefreshCertificates();
    setSharePreviewCert(null);
  };

  const copyShareUrl = (token: string, certId: string) => {
    const url = `${window.location.origin}/?verify=${encodeURIComponent(token)}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(certId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <div className="border-b border-[#222B3D] pb-4">
          <h1 className="text-xl font-semibold text-[#F3F6FF] sm:text-2xl">
            {locale === 'uz' ? 'Kurs sertifikatlari va tekshiruv' : 'Course Certificates & Public Verification'}
          </h1>
          <p className="mt-1 text-sm text-[#8994AA]">{strings.nonAccreditationNotice}</p>
        </div>

        {/* Public Verification Lookup (Available without sign-in) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runVerification(verifyInput);
          }}
          className="mt-5"
        >
          <label htmlFor="verify-token-input" className="block text-xs font-semibold text-[#F3F6FF]">
            {locale === 'uz'
              ? 'Sertifikat haqiqiyligini tekshirish (Token / ID)'
              : 'Verify a Certificate by Public Token'}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="verify-token-input"
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="e.g. ECONOVA-A1B2C3D4E5F6"
              className="min-h-[44px] flex-1 rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3.5 py-2 font-mono text-sm text-[#F3F6FF] placeholder:text-[#8994AA]/60"
            />
            <button
              type="submit"
              disabled={verifyLoading}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#5DE1D2] px-5 py-2 text-sm font-semibold text-[#080B14] hover:bg-[#7cebe0]"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>{verifyLoading ? 'Checking...' : locale === 'uz' ? 'Tekshirish' : 'Verify Token'}</span>
            </button>
          </div>

          {verifyResult && (
            <div className="mt-5 border-t border-[#222B3D] pt-4">
              {verifyResult.verificationStatus === 'valid' && verifyResult.certificate && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#6FE0A1]">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>VALID CERTIFICATE</span>
                  </div>
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[#8994AA]">Recipient</dt>
                      <dd className="font-medium text-[#F3F6FF]">{verifyResult.certificate.recipientDisplayName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#8994AA]">Course & Edition</dt>
                      <dd className="font-medium text-[#F3F6FF]">
                        {verifyResult.certificate.courseTitle} ({verifyResult.certificate.locale.toUpperCase()} v{verifyResult.certificate.editionVersion})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#8994AA]">Subject & Level</dt>
                      <dd className="text-[#F3F6FF]">{verifyResult.certificate.subject} · {verifyResult.certificate.level}</dd>
                    </div>
                    <div>
                      <dt className="text-[#8994AA]">Issued Date</dt>
                      <dd className="font-mono tabular-nums text-[#F3F6FF]">{verifyResult.certificate.issuedAt.slice(0, 10)}</dd>
                    </div>
                  </dl>
                  <p className="border-t border-[#222B3D]/60 pt-2 text-[11px] text-[#8994AA]">
                    {verifyResult.certificate.nonAccreditationNotice}
                  </p>
                </div>
              )}

              {verifyResult.verificationStatus === 'revoked' && verifyResult.certificate && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-400">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    <span>REVOKED CERTIFICATE</span>
                  </div>
                  <p className="text-xs text-[#8994AA]">
                    Issued for {verifyResult.certificate.courseTitle} to {verifyResult.certificate.recipientDisplayName}.
                    Revoked on {verifyResult.certificate.revokedAt?.slice(0, 10)} — Reason: {verifyResult.certificate.revokeReason}
                  </p>
                </div>
              )}

              {verifyResult.verificationStatus === 'not_found' && (
                <div className="flex items-center gap-2 text-sm text-[#FFC96B]">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Certificate not found or public sharing is currently disabled by the learner.
                  </span>
                </div>
              )}
            </div>
          )}
        </form>
      </section>

      {/* Private Certificate Library */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#F3F6FF]">
          {locale === 'uz' ? 'Mening shaxsiy sertifikatlarim' : 'My Private Certificate Library'}
        </h2>

        {!isAuthenticated ? (
          <div className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 text-sm text-[#8994AA]">
            <p>
              {locale === 'uz'
                ? 'Yakunlagan kurslaringiz sertifikatlarini ko‘rish va ulashishni boshqarish uchun hisobingizga kiring.'
                : 'Sign in to view your course-specific certificates, download/print them, or manage public share links.'}
            </p>
            <button
              type="button"
              onClick={onRequireAuth}
              className="mt-3 min-h-[40px] rounded-lg bg-[#9274FF] px-4 py-2 text-xs font-semibold text-[#080B14]"
            >
              {strings.signIn}
            </button>
          </div>
        ) : certificates.length === 0 ? (
          <div className="rounded-xl border border-[#222B3D] bg-[#101522] p-6 text-center text-sm text-[#8994AA]">
            <Award className="mx-auto h-8 w-8 text-[#8994AA]/60" aria-hidden="true" />
            <p className="mt-2 font-medium text-[#F3F6FF]">
              {locale === 'uz' ? 'Hali sertifikatlar berilmagan' : 'No certificates issued yet'}
            </p>
            <p className="mt-1 text-xs">
              {locale === 'uz'
                ? 'Har bir kursning majburiy darslarini tugating va yakuniy testdan 70%+ oling.'
                : 'Complete all required lessons and pass the course assessment (70%+) in any course to earn its dedicated certificate.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex flex-col justify-between rounded-xl border border-[#222B3D] bg-[#101522] p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#8994AA]">
                    <span>{cert.subject} · {cert.level} · {cert.locale.toUpperCase()} v{cert.editionVersion}</span>
                    <span className={cert.status === 'valid' ? 'font-medium text-[#6FE0A1]' : 'font-medium text-rose-400'}>
                      {cert.status === 'valid' ? 'Valid' : 'Revoked'}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-[#F3F6FF]">{cert.courseTitle}</h3>
                  <p className="mt-1 font-mono text-xs text-[#8994AA]">ID: {cert.publicToken}</p>
                  <p className="mt-1 text-xs text-[#8994AA]">
                    Issued {cert.issuedAt.slice(0, 10)} · {cert.shareEnabled ? 'Public Share Active' : 'Private (Not Shared)'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#222B3D] pt-3">
                  <button
                    type="button"
                    onClick={() => setPreviewCert(cert)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#222B3D] bg-[#141B2B] px-3 py-1.5 text-xs font-medium text-[#F3F6FF] hover:border-[#9274FF]"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>View / Print</span>
                  </button>

                  {cert.status === 'valid' && !cert.shareEnabled && (
                    <button
                      type="button"
                      onClick={() => setSharePreviewCert(cert)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#5DE1D2] px-3 py-1.5 text-xs font-semibold text-[#080B14]"
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Enable Share Link</span>
                    </button>
                  )}

                  {cert.status === 'valid' && cert.shareEnabled && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyShareUrl(cert.publicToken, cert.id)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#5DE1D2]/50 bg-[#141B2B] px-3 py-1.5 text-xs font-medium text-[#5DE1D2]"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{copiedId === cert.id ? 'Copied Link' : 'Copy Share Link'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleShare(cert.id, false)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#222B3D] px-3 py-1.5 text-xs text-[#8994AA] hover:text-rose-300"
                      >
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Revoke Link</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Printable Certificate Preview Modal */}
      {previewCert && (
        <div role="dialog" aria-modal="true" aria-label="Certificate Preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl space-y-4">
            <div className="print-certificate rounded-2xl border border-[#222B3D] bg-[#0B0F19] p-8 text-[#F3F6FF]">
              <div className="flex items-start justify-between gap-4 border-b border-[#222B3D] pb-4">
                <div>
                  <div className="font-display text-lg font-bold tracking-tight text-[#5DE1D2]">ECONOVA</div>
                  <div className="mt-1 text-xs text-[#8994AA]">Certificate of Course Completion</div>
                </div>
                {previewCert.qrSvg && (
                  <div
                    className="rounded-lg bg-[#F3F6FF] p-1.5"
                    aria-label="Certificate Verification QR Code"
                    dangerouslySetInnerHTML={{ __html: previewCert.qrSvg }}
                  />
                )}
              </div>

              <div className="py-6">
                <div className="text-xs text-[#8994AA]">Presented to</div>
                <div className="mt-1 font-display text-2xl font-bold text-[#F3F6FF]">
                  {previewCert.recipientDisplayName}
                </div>
                <div className="mt-4 text-xs text-[#8994AA]">For successfully completing</div>
                <div className="mt-1 text-xl font-semibold text-[#9274FF]">{previewCert.courseTitle}</div>
                <div className="mt-2 text-xs text-[#8994AA]">
                  {previewCert.subject} · {previewCert.level} · {previewCert.locale === 'uz' ? 'O‘zbekcha nashr' : 'English Edition'} v{previewCert.editionVersion}
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#222B3D] pt-4 text-xs text-[#8994AA]">
                <div>
                  <div>Issued: <span className="font-mono text-[#F3F6FF]">{previewCert.issuedAt.slice(0, 10)}</span></div>
                  <div>Certificate ID: <span className="font-mono text-[#F3F6FF]">{previewCert.publicToken}</span></div>
                </div>
                <div className="max-w-xs text-[11px] leading-snug">
                  {strings.nonAccreditationNotice}
                </div>
              </div>
            </div>

            <div className="no-print flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#5DE1D2] px-4 py-2 text-xs font-semibold text-[#080B14]"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                className="min-h-[40px] rounded-lg border border-[#222B3D] bg-[#101522] px-4 py-2 text-xs font-medium text-[#F3F6FF]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Consent Preview Modal (DOIT_v2.md §11.5) */}
      {sharePreviewCert && (
        <div role="dialog" aria-modal="true" aria-labelledby="share-preview-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#222B3D] bg-[#101522] p-6">
            <h3 id="share-preview-title" className="text-base font-semibold text-[#F3F6FF]">
              Preview Public Verification Fields
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#8994AA]">
              Anyone with your verification link will see only the minimal fields below. Your email, XP, and other courses remain private. You can revoke sharing anytime.
            </p>
            <ul className="mt-4 space-y-1.5 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3.5 text-xs text-[#F3F6FF]">
              <li><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-[#6FE0A1]" /> Display Name: {sharePreviewCert.recipientDisplayName}</li>
              <li><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-[#6FE0A1]" /> Course: {sharePreviewCert.courseTitle} ({sharePreviewCert.locale.toUpperCase()} v{sharePreviewCert.editionVersion})</li>
              <li><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-[#6FE0A1]" /> Issued Date & Status: {sharePreviewCert.issuedAt.slice(0, 10)} · Valid</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSharePreviewCert(null)}
                className="min-h-[40px] rounded-lg border border-[#222B3D] px-4 py-2 text-xs text-[#8994AA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggleShare(sharePreviewCert.id, true)}
                className="min-h-[40px] rounded-lg bg-[#5DE1D2] px-4 py-2 text-xs font-semibold text-[#080B14]"
              >
                Confirm & Enable Share Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
