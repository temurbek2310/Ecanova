import React, { useEffect, useRef, useState } from 'react';
import { Award, CheckCircle2, Clock, Copy, Download, Eye, FileDown, Lock, Printer, RefreshCw, Search, Share2, ShieldAlert, ShieldCheck, Sparkles, X, XCircle } from 'lucide-react';
import type {
  CertificateRecord,
  CertificateServerVerification,
  CertificateVerificationResult,
  LocaleCode,
} from '../shared/types';
import {
  copyCertificateVerificationUrl,
  exportCertificateToPdf,
  triggerCertificatesJsonDownload,
} from '../lib/certificate-links';
import {
  formatServerVerificationTimestamp,
  formatVerificationStatusLabel,
} from '../lib/certificate-verification';
import {
  LESSON_MILESTONE_TARGET,
  hasReachedLessonMilestone,
} from '../lib/geometric-nova';
import { t } from '../lib/i18n';
import { apiFetch } from '../lib/auth-client';
import { notificationCopy } from '../lib/notification-copy';
import { describeError, notify } from '../lib/notifications';
import { GeometricNova } from './GeometricNova';

interface CertificatesViewProps {
  locale: LocaleCode;
  isAuthenticated: boolean;
  certificates: CertificateRecord[];
  completedLessonsCount?: number;
  initialVerifyToken?: string | null;
  onRefreshCertificates: () => Promise<void>;
  onRequireAuth: () => void;
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  locale,
  isAuthenticated,
  certificates,
  completedLessonsCount = 0,
  initialVerifyToken,
  onRefreshCertificates,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const toastCopy = notificationCopy(locale);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);
  const [sharePreviewCert, setSharePreviewCert] = useState<CertificateRecord | null>(null);
  const [statusModalCert, setStatusModalCert] = useState<CertificateRecord | null>(null);
  const [serverVerification, setServerVerification] = useState<CertificateServerVerification | null>(null);
  const [serverVerifyLoading, setServerVerifyLoading] = useState(false);
  const [verifyInput, setVerifyInput] = useState(initialVerifyToken || '');
  const [verifyResult, setVerifyResult] = useState<CertificateVerificationResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [novaBurstKey, setNovaBurstKey] = useState(0);
  const copyTimerRef = useRef<number | null>(null);
  const certificateStageRef = useRef<HTMLElement | null>(null);
  const milestoneTriggeredRef = useRef(false);

  const milestoneReached = hasReachedLessonMilestone(completedLessonsCount);

  useEffect(() => {
    if (milestoneReached && !milestoneTriggeredRef.current) {
      milestoneTriggeredRef.current = true;
      setNovaBurstKey((k) => k + 1);
    } else if (!milestoneReached) {
      milestoneTriggeredRef.current = false;
    }
  }, [milestoneReached]);

  const handleExportAllJson = () => {
    try {
      const payload = triggerCertificatesJsonDownload(certificates, window.location.origin);
      notify.success(
        toastCopy.certificate.exported,
        locale === 'uz'
          ? `${payload.totalCertificates} ta sertifikat JSON formatida eksport qilindi.`
          : `Exported ${payload.totalCertificates} certificate record(s) with verification URLs as JSON.`
      );
    } catch (err) {
      notify.error(toastCopy.certificate.exportFailed, describeError(err, toastCopy.common.genericError));
    }
  };

  const handleExportPdf = (cert: CertificateRecord) => {
    try {
      const { fileName } = exportCertificateToPdf(
        cert,
        window.location.origin,
        strings.nonAccreditationNotice
      );
      notify.success(
        toastCopy.certificate.exported,
        locale === 'uz' ? `PDF hujjat yaratildi: ${fileName}` : `Generated high-resolution PDF: ${fileName}`
      );
    } catch (err) {
      notify.error(toastCopy.certificate.exportFailed, describeError(err, toastCopy.common.genericError));
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const runVerification = async (token: string) => {
    const clean = token.trim();
    if (!clean) return;
    setVerifyLoading(true);
    try {
      const res = await apiFetch(`/api/verify/${encodeURIComponent(clean)}`);
      const data = (await res.json()) as CertificateVerificationResult;
      setVerifyResult(data);
      if (data.verificationStatus === 'valid') {
        notify.success(
          toastCopy.certificate.verified,
          data.certificate
            ? toastCopy.certificate.verifiedMessage(
                data.certificate.recipientDisplayName,
                data.certificate.courseTitle
              )
            : null
        );
      } else if (data.verificationStatus === 'revoked') {
        notify.warning(toastCopy.certificate.revokedFound, data.certificate?.courseTitle ?? null);
      } else {
        notify.warning(toastCopy.certificate.notFound, strings.certificates.notFoundNotice);
      }
    } catch (err) {
      notify.error(toastCopy.certificate.verifyFailed, describeError(err, toastCopy.common.genericError));
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
    try {
      const res = await apiFetch(`/api/me/certificates/${certId}/share`, {
        method: enable ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || toastCopy.common.genericError);
      }
      if (enable) {
        notify.success(toastCopy.certificate.shareEnabled, toastCopy.certificate.shareEnabledMessage);
      } else {
        notify.info(toastCopy.certificate.shareDisabled);
      }
      await onRefreshCertificates();
      setSharePreviewCert(null);
    } catch (err) {
      notify.error(toastCopy.certificate.shareFailed, describeError(err, toastCopy.common.genericError));
    }
  };

  const handleCopyVerificationUrl = async (cert: CertificateRecord) => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    const result = await copyCertificateVerificationUrl(
      window.location.origin,
      cert.publicToken
    );
    if (!result.ok) {
      setCopiedId(null);
      notify.error(toastCopy.share.copyFailed, result.error || null);
      return;
    }

    setCopiedId(cert.id);
    notify.success(
      toastCopy.certificate.linkCopied,
      cert.shareEnabled ? cert.courseTitle : toastCopy.certificate.linkCopiedPrivateMessage
    );
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const fetchServerVerification = async (cert: CertificateRecord) => {
    setStatusModalCert(cert);
    setServerVerifyLoading(true);
    setServerVerification(null);
    try {
      const res = await apiFetch(`/api/me/certificates/${encodeURIComponent(cert.id)}/verify`);
      const data = (await res.json()) as CertificateServerVerification & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not retrieve server verification status.');
      }
      setServerVerification(data);
    } catch (err) {
      // Close the modal and report through the HUD with a retry action.
      setStatusModalCert(null);
      notify.error(toastCopy.certificate.verifyFailed, describeError(err, toastCopy.common.genericError), {
        id: `cert-server-verify-${cert.id}`,
        action: { label: toastCopy.common.retry, onAction: () => void fetchServerVerification(cert) },
      });
    } finally {
      setServerVerifyLoading(false);
    }
  };

  useEffect(() => {
    if (!statusModalCert) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatusModalCert(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [statusModalCert]);

  return (
    <div className="space-y-8">
      <section data-print-hide="verify-lookup" data-print-hide-when-modal="true" className="no-print rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
        <div className="border-b border-line pb-4">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">
            {locale === 'uz' ? 'Kurs sertifikatlari va tekshiruv' : 'Course Certificates & Public Verification'}
          </h1>
          <p className="mt-1 text-sm text-muted">{strings.nonAccreditationNotice}</p>
        </div>

        {/* Public Verification Lookup (Available without sign-in) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runVerification(verifyInput);
          }}
          className="mt-5"
        >
          <label htmlFor="verify-token-input" className="block text-xs font-semibold text-ink">
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
              className="min-h-[44px] flex-1 rounded-lg border border-line bg-chrome px-3.5 py-2 font-mono text-sm text-ink placeholder:text-muted/60"
            />
            <button
              type="submit"
              disabled={verifyLoading}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-teal-ink hover:bg-teal-hover"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>
                {verifyLoading
                  ? strings.certificates.checking
                  : strings.certificates.verifyButton}
              </span>
            </button>
          </div>

          {verifyResult && (
            <div className="mt-5 border-t border-line pt-4">
              {verifyResult.verificationStatus === 'valid' && verifyResult.certificate && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-success">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>{strings.certificates.validCertificate}</span>
                  </div>
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">{strings.certificates.recipient}</dt>
                      <dd className="font-medium text-ink">{verifyResult.certificate.recipientDisplayName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">{strings.certificates.courseAndEdition}</dt>
                      <dd className="font-medium text-ink">
                        {verifyResult.certificate.courseTitle} ({verifyResult.certificate.locale.toUpperCase()} v{verifyResult.certificate.editionVersion})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">{strings.certificates.subjectAndLevel}</dt>
                      <dd className="text-ink">{verifyResult.certificate.subject} · {verifyResult.certificate.level}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">{strings.certificates.issuedDate}</dt>
                      <dd className="font-mono tabular-nums text-ink">{verifyResult.certificate.issuedAt.slice(0, 10)}</dd>
                    </div>
                  </dl>
                  <p className="border-t border-line/60 pt-2 text-[11px] text-muted">
                    {verifyResult.certificate.nonAccreditationNotice}
                  </p>
                </div>
              )}

              {verifyResult.verificationStatus === 'revoked' && verifyResult.certificate && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-danger">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    <span>{strings.certificates.revokedCertificate}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {verifyResult.certificate.courseTitle} — {verifyResult.certificate.recipientDisplayName}.{' '}
                    {verifyResult.certificate.revokedAt?.slice(0, 10)} ({verifyResult.certificate.revokeReason})
                  </p>
                </div>
              )}

              {verifyResult.verificationStatus === 'not_found' && (
                <div className="flex items-center gap-2 text-sm text-warning">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  <span>{strings.certificates.notFoundNotice}</span>
                </div>
              )}
            </div>
          )}
        </form>
      </section>

      {/* 50th Lesson Crystalline Shards Celebration Portal */}
      <GeometricNova
        active={novaBurstKey > 0}
        triggerKey={novaBurstKey}
        anchorRef={certificateStageRef}
        shardCount={40}
      />

      {/* Private Certificate Library */}
      <section
        ref={certificateStageRef}
        data-print-hide-when-modal="true"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {locale === 'uz' ? 'Mening shaxsiy sertifikatlarim' : 'My Private Certificate Library'}
            </h2>
            <p
              data-testid="certificate-milestone-status"
              className="mt-0.5 font-mono text-xs tabular-nums text-muted"
            >
              {Math.min(completedLessonsCount, LESSON_MILESTONE_TARGET)} / {LESSON_MILESTONE_TARGET}{' '}
              {locale === 'uz' ? 'dars yakunlandi' : 'lessons completed'}
              {milestoneReached && (
                <>
                  {' · '}
                  <span className="font-semibold text-[#0F766E] dark:text-[#5DE1D2]">
                    {locale === 'uz'
                      ? '50-dars bosqichi ochildi'
                      : '50th Lesson Milestone Unlocked'}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNovaBurstKey((k) => k + 1)}
              data-testid="trigger-geometric-nova-btn"
              className="no-print inline-flex min-h-[38px] items-center gap-2 rounded-lg border-2 border-[#0F766E] bg-white/25 px-3.5 py-1.5 font-mono text-xs font-semibold text-ink shadow-[4px_4px_0px_#090D16] backdrop-blur-2xl hover:border-[#5DE1D2] dark:border-[#222B3D] dark:bg-[#101522]/25 dark:shadow-[4px_4px_0px_#000000]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#0F766E] dark:text-[#5DE1D2]" aria-hidden="true" />
              <span>
                {milestoneReached
                  ? locale === 'uz'
                    ? 'Kristall salyutni takrorlash'
                    : 'Replay Crystalline Burst'
                  : locale === 'uz'
                  ? '50-dars kristall salyuti'
                  : '50th-Lesson Crystalline Burst'}
              </span>
            </button>

            {isAuthenticated && (
              <button
                type="button"
                onClick={handleExportAllJson}
                data-testid="export-certificates-json-btn"
                className="no-print inline-flex min-h-[38px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-panel px-3.5 py-1.5 text-xs font-semibold text-ink shadow-brutal-sm hover:border-theme-accent"
              >
                <Download className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
                <span>
                  {locale === 'uz'
                    ? 'Sertifikatlarni JSON eksport qilish'
                    : 'Export Certificates (JSON)'}
                </span>
              </button>
            )}
          </div>
        </div>


        {!isAuthenticated ? (
          <div className="rounded-xl border-2 border-slate-500 bg-white/25 p-5 text-sm text-muted shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
            <p>
              {locale === 'uz'
                ? 'Yakunlagan kurslaringiz sertifikatlarini ko‘rish va ulashishni boshqarish uchun hisobingizga kiring.'
                : 'Sign in to view your course-specific certificates, download/print them, or manage public share links.'}
            </p>
            <button
              type="button"
              onClick={onRequireAuth}
              className="mt-3 min-h-[40px] rounded-lg border-2 border-theme-border bg-accent px-4 py-2 text-xs font-semibold text-accent-ink shadow-brutal-sm hover:bg-accent-hover"
            >
              {strings.signIn}
            </button>
          </div>
        ) : certificates.length === 0 ? (
          <div className="rounded-xl border-2 border-slate-500 bg-white/25 p-6 text-center text-sm text-muted shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
            <Award className="mx-auto h-8 w-8 text-muted/60" aria-hidden="true" />
            <p className="mt-2 font-medium text-ink">
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
                data-print-card="certificate"
                className="flex flex-col justify-between rounded-xl border-2 border-slate-500 bg-white/25 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{cert.subject} · {cert.level} · {cert.locale.toUpperCase()} v{cert.editionVersion}</span>
                    <span className={cert.status === 'valid' ? 'font-medium text-success' : 'font-medium text-danger'}>
                      {cert.status === 'valid'
                        ? strings.certificates.statusValid
                        : strings.certificates.statusRevoked}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{cert.courseTitle}</h3>
                    <button
                      type="button"
                      onClick={() => void fetchServerVerification(cert)}
                      data-testid={`cert-verified-trigger-${cert.id}`}
                      aria-label={
                        cert.status === 'valid'
                          ? locale === 'uz'
                            ? `${cert.courseTitle} sertifikatining server tasdiq vaqtini ko‘rish`
                            : `View server verification timestamp and status for ${cert.courseTitle}`
                          : locale === 'uz'
                          ? `${cert.courseTitle} sertifikatining bekor qilinish holatini ko‘rish`
                          : `View server revocation status for ${cert.courseTitle}`
                      }
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                        cert.status === 'valid'
                          ? 'border-success/40 bg-success/10 text-success hover:bg-success/15'
                          : 'border-danger/40 bg-danger-surface/40 text-danger-text hover:bg-danger-surface/60'
                      }`}
                    >
                      {cert.status === 'valid' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        {cert.status === 'valid'
                          ? locale === 'uz'
                            ? 'Tasdiqlangan'
                            : 'Verified'
                          : locale === 'uz'
                          ? 'Bekor qilingan'
                          : 'Revoked'}
                      </span>
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">ID: {cert.publicToken}</p>
                  <p className="mt-1 text-xs text-muted">
                    {strings.certificates.issuedLabel} {cert.issuedAt.slice(0, 10)} ·{' '}
                    {cert.shareEnabled
                      ? strings.certificates.shareActive
                      : strings.certificates.sharePrivate}
                  </p>
                </div>

                <div data-print-hide="cert-actions" className="no-print mt-4 space-y-2 border-t border-line pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewCert(cert)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-ink hover:border-accent"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{locale === 'uz' ? 'Ko‘rish / Chop etish' : 'View / Print'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportPdf(cert)}
                      data-testid={`export-certificate-pdf-btn-${cert.id}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-1.5 text-xs font-semibold text-theme-accent shadow-brutal-sm hover:border-theme-accent"
                    >
                      <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{locale === 'uz' ? 'PDF formatda yuklash' : 'Export to PDF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopyVerificationUrl(cert)}
                      data-testid={`copy-cert-link-${cert.id}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-teal/50 bg-elevated px-3 py-1.5 text-xs font-medium text-teal hover:border-teal"
                    >
                      {copiedId === cert.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {copiedId === cert.id
                          ? locale === 'uz'
                            ? 'Nusxalandi'
                            : 'Copied!'
                          : locale === 'uz'
                          ? 'Havolani nusxalash'
                          : 'Copy Link'}
                      </span>
                    </button>

                    {cert.status === 'valid' && !cert.shareEnabled && (
                      <button
                        type="button"
                        onClick={() => setSharePreviewCert(cert)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-teal-ink hover:bg-teal-hover"
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{strings.certificates.enableShareLink}</span>
                      </button>
                    )}

                    {cert.status === 'valid' && cert.shareEnabled && (
                      <button
                        type="button"
                        onClick={() => handleToggleShare(cert.id, false)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-danger"
                      >
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{strings.certificates.revokeLink}</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Printable Certificate Preview Modal */}
      {previewCert && (
        <div role="dialog" aria-modal="true" aria-label={strings.certificates.modalTitle} className="print-certificate-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl space-y-4">
            <div className="print-certificate rounded-2xl border border-line bg-chrome p-8 text-ink">
              <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="font-display text-lg font-bold tracking-tight text-teal">ECONOVA</div>
                  <div className="mt-1 text-xs text-muted">{strings.certificates.modalTitle}</div>
                </div>
                {previewCert.qrSvg && (
                  <div
                    className="rounded-lg border border-line bg-white p-1.5"
                    aria-label="Certificate Verification QR Code"
                    dangerouslySetInnerHTML={{ __html: previewCert.qrSvg }}
                  />
                )}
              </div>

              <div className="py-6">
                <div className="text-xs text-muted">{strings.certificates.presentedTo}</div>
                <div className="mt-1 font-display text-2xl font-bold text-ink">
                  {previewCert.recipientDisplayName}
                </div>
                <div className="mt-4 text-xs text-muted">{strings.certificates.forCompleting}</div>
                <div className="mt-1 text-xl font-semibold text-accent">{previewCert.courseTitle}</div>
                <div className="mt-2 text-xs text-muted">
                  {previewCert.subject} · {previewCert.level} · {previewCert.locale === 'uz' ? 'O‘zbekcha nashr' : 'English Edition'} v{previewCert.editionVersion}
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4 text-xs text-muted">
                <div>
                  <div>{strings.certificates.issuedLabel} <span className="font-mono text-ink">{previewCert.issuedAt.slice(0, 10)}</span></div>
                  <div>{strings.certificates.certificateIdLabel} <span className="font-mono text-ink">{previewCert.publicToken}</span></div>
                </div>
                <div className="max-w-xs text-[11px] leading-snug">
                  {strings.nonAccreditationNotice}
                </div>
              </div>
            </div>

            <div className="no-print flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => handleExportPdf(previewCert)}
                data-testid="modal-export-certificate-pdf-btn"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-2 text-xs font-bold text-theme-accent-ink shadow-brutal-sm hover:bg-accent-hover"
              >
                <FileDown className="h-4 w-4" aria-hidden="true" />
                <span>{strings.certificates.exportPdf}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-teal-ink hover:bg-teal-hover"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>{strings.certificates.printSavePdf}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                className="min-h-[40px] rounded-lg border border-line bg-surface px-4 py-2 text-xs font-medium text-ink"
              >
                {strings.certificates.closeButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Consent Preview Modal (DOIT_v2.md §11.5) */}
      {sharePreviewCert && (
        <div role="dialog" aria-modal="true" aria-labelledby="share-preview-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
            <h3 id="share-preview-title" className="text-base font-semibold text-ink">
              {strings.certificates.consentModalTitle}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {strings.certificates.consentModalIntro}
            </p>
            <ul className="mt-4 space-y-1.5 rounded-lg border border-line bg-chrome p-3.5 text-xs text-ink">
              <li><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-success" /> {strings.certificates.consentFieldName}: {sharePreviewCert.recipientDisplayName}</li>
              <li><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-success" /> {strings.certificates.consentFieldCourse}: {sharePreviewCert.courseTitle} ({sharePreviewCert.locale.toUpperCase()} v{sharePreviewCert.editionVersion})</li>
              <li><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-success" /> {strings.certificates.consentFieldDate}: {sharePreviewCert.issuedAt.slice(0, 10)} · {strings.certificates.statusValid}</li>
            </ul>
            <p className="mt-3 text-[11px] text-muted">{strings.certificates.consentPrivacyNote}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSharePreviewCert(null)}
                className="min-h-[40px] rounded-lg border border-line px-4 py-2 text-xs text-muted hover:text-ink"
              >
                {strings.certificates.cancelButton}
              </button>
              <button
                type="button"
                onClick={() => handleToggleShare(sharePreviewCert.id, true)}
                className="min-h-[40px] rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-teal-ink hover:bg-teal-hover"
              >
                {strings.certificates.confirmEnableLink}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Verification Status & Timestamp Popup */}
      {statusModalCert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cert-server-verify-title"
          data-testid="cert-verification-popup"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-ink">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 id="cert-server-verify-title" className="text-base font-semibold text-ink">
                  {locale === 'uz'
                    ? 'Server tasdiq holati'
                    : 'Server Certificate Verification'}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{statusModalCert.courseTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalCert(null)}
                aria-label={locale === 'uz' ? 'Oynani yopish' : 'Close verification dialog'}
                className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {serverVerifyLoading ? (
              <div className="py-8 text-center text-xs text-muted">
                {locale === 'uz'
                  ? 'Server ma’lumotlar bazasidan tasdiq vaqti tekshirilmoqda...'
                  : 'Verifying certificate record against server database...'}
              </div>
            ) : serverVerification ? (
              <div className="mt-4 space-y-4">
                <div
                  data-testid="cert-popup-status"
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-semibold ${
                    serverVerification.verificationStatus === 'valid'
                      ? 'border-success/40 bg-success/10 text-success'
                      : 'border-danger/40 bg-danger-surface/40 text-danger-text'
                  }`}
                >
                  {serverVerification.verificationStatus === 'valid' ? (
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {formatVerificationStatusLabel(serverVerification.verificationStatus, locale)}
                  </span>
                </div>

                {(() => {
                  const verifiedTime = formatServerVerificationTimestamp(
                    serverVerification.verifiedAt,
                    locale
                  );
                  const issuedTime = formatServerVerificationTimestamp(
                    serverVerification.issuedAt,
                    locale
                  );
                  return (
                    <dl className="space-y-2.5 rounded-lg border border-line bg-chrome p-3.5 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="flex items-center gap-1.5 text-muted">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {locale === 'uz' ? 'Server tasdiq vaqti' : 'Server Verified At'}
                          </span>
                        </dt>
                        <dd data-testid="cert-popup-timestamp" className="text-right">
                          <div className="font-medium text-ink">{verifiedTime.readable}</div>
                          <div className="font-mono text-[11px] tabular-nums text-muted">
                            {verifiedTime.utcIso}
                          </div>
                        </dd>
                      </div>

                      <div className="flex items-start justify-between gap-3 border-t border-line/60 pt-2">
                        <dt className="text-muted">
                          {locale === 'uz' ? 'Berilgan vaqti' : 'Issued At'}
                        </dt>
                        <dd className="text-right font-mono tabular-nums text-ink">
                          {issuedTime.readable}
                        </dd>
                      </div>

                      <div className="flex items-start justify-between gap-3 border-t border-line/60 pt-2">
                        <dt className="text-muted">
                          {locale === 'uz' ? 'Sertifikat ID' : 'Certificate ID'}
                        </dt>
                        <dd className="font-mono text-ink">{serverVerification.publicToken}</dd>
                      </div>

                      <div className="flex items-start justify-between gap-3 border-t border-line/60 pt-2">
                        <dt className="text-muted">
                          {locale === 'uz' ? 'Ommaviy ulashish' : 'Public Visibility'}
                        </dt>
                        <dd className="font-medium text-ink">
                          {serverVerification.shareEnabled
                            ? locale === 'uz'
                              ? 'Yoqilgan'
                              : 'Public Share Active'
                            : locale === 'uz'
                            ? 'Shaxsiy (Ulashilmagan)'
                            : 'Private (Owner Only)'}
                        </dd>
                      </div>

                      {serverVerification.verificationStatus === 'revoked' && (
                        <div className="border-t border-line/60 pt-2 text-danger-text">
                          Revoked {serverVerification.revokedAt?.slice(0, 10)} —{' '}
                          {serverVerification.revokeReason}
                        </div>
                      )}
                    </dl>
                  );
                })()}

                <p className="text-[11px] leading-snug text-muted">
                  {serverVerification.nonAccreditationNotice}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={serverVerifyLoading}
                onClick={() => void fetchServerVerification(statusModalCert)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-3.5 py-2 text-xs font-medium text-ink hover:border-teal disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{locale === 'uz' ? 'Qayta tekshirish' : 'Re-verify Now'}</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusModalCert(null)}
                className="min-h-[38px] rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-teal-ink hover:bg-teal-hover"
              >
                {locale === 'uz' ? 'Yopish' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
