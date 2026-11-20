import React, { useEffect, useState } from 'react';
import { CheckCircle2, FilePlus2, MessageSquarePlus, ShieldAlert, ShieldCheck } from 'lucide-react';
import type {
  CourseCatalogItem,
  CourseEditionSummary,
  EditorialSignoffType,
  EditorialStatus,
  LocaleCode,
  SegmentReviewRequest,
  UserRole,
} from '../shared/types';
import {
  authorizeEditorialTransition,
  DESTRUCTIVE_ACTION_ROLES,
  getRoleDisplayLabel,
  hasAnyRole,
} from '../shared/econova-rules';
import { t } from '../lib/i18n';
import { apiFetch } from '../lib/auth-client';
import { AiCompanionPanel } from './AiCompanionPanel';

interface AdminOverviewData {
  editions: Array<CourseEditionSummary & { subject: string; level: string }>;
  reports: Array<{
    id: string;
    courseId: string | null;
    lessonId: string | null;
    segmentHeading?: string | null;
    category: string;
    description: string;
    status: string;
    resolutionNote: string | null;
    createdAt: string;
  }>;
  reviewRequests?: SegmentReviewRequest[];
  certificates: Array<{
    id: string;
    recipientDisplayName: string;
    courseTitle: string;
    locale: string;
    publicToken: string;
    status: string;
    issuedAt: string;
    revokeReason: string | null;
  }>;
  auditEvents: Array<{
    id: string;
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    createdAt: string;
  }>;
  ledgerSummary: {
    totalNonCashXpIssued: number;
    validEntriesCount: number;
  };
}

interface AdminStudioViewProps {
  locale: LocaleCode;
  courses: CourseCatalogItem[];
  aiConfigured?: boolean;
  onCatalogRefresh: () => Promise<void>;
  /** Verified session user; used only to disable actions the server would reject with 403. */
  currentUser: { id: string; role: UserRole };
}

export const AdminStudioView: React.FC<AdminStudioViewProps> = ({
  locale,
  courses,
  aiConfigured = false,
  onCatalogRefresh,
  currentUser,
}) => {
  const strings = t(locale);
  const canRevokeCertificates = hasAnyRole(currentUser.role, DESTRUCTIVE_ACTION_ROLES);
  const transitionGate = (
    ed: CourseEditionSummary,
    targetStatus: EditorialStatus,
    signoffType?: EditorialSignoffType
  ) => {
    const verdict = authorizeEditorialTransition({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      currentStatus: ed.status,
      targetStatus,
      signoffType: signoffType ?? null,
      reviewers: {
        subject: ed.subjectReviewerId ?? null,
        language: ed.languageReviewerId ?? null,
        rights: ed.rightsReviewerId ?? null,
      },
    });
    return verdict.allowed
      ? { disabled: false, title: undefined }
      : { disabled: true, title: verdict.reason };
  };
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Create Draft Edition form
  const [courseId, setCourseId] = useState(courses[0]?.id || 'course-econ-beg');
  const [draftLocale, setDraftLocale] = useState<LocaleCode>('en');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [licenseBasis, setLicenseBasis] = useState('CC BY 4.0 / ECONOVA Original');
  const [aiAssisted, setAiAssisted] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonBody, setLessonBody] = useState('');

  // Revoke reason state
  const [revokeReasons, setRevokeReasons] = useState<Record<string, string>>({});

  const loadOverview = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/admin/overview');
      const json = (await res.json()) as AdminOverviewData & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load staff overview.');
      setData(json);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load editorial data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleTransition = async (
    editionId: string,
    nextStatus: EditorialStatus,
    signoffType?: EditorialSignoffType
  ) => {
    setActionMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/api/admin/editions/${editionId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextStatus, signoffType }),
      });
      const out = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(out.error || 'Transition blocked.');
      setActionMsg(`Edition updated to ${nextStatus}.`);
      await loadOverview();
      await onCatalogRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionMsg(null);
    try {
      const res = await apiFetch('/api/admin/editions/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          locale: draftLocale,
          title,
          subtitle,
          sourceTitle,
          licenseBasis,
          aiAssisted,
          lessonTitle,
          lessonBody,
        }),
      });
      const out = (await res.json()) as { editionId?: string; version?: number; error?: string };
      if (!res.ok) throw new Error(out.error || 'Could not create draft.');
      setTitle('');
      setSubtitle('');
      setSourceTitle('');
      setLessonTitle('');
      setLessonBody('');
      setActionMsg(`Created Draft v${out.version} (${draftLocale.toUpperCase()}). Requires Subject, Language, and Rights reviews before publishing.`);
      await loadOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Draft creation failed.');
    }
  };

  const handleRevokeCertificate = async (certId: string) => {
    const reason = revokeReasons[certId] || '';
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/api/admin/certificates/${certId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const out = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(out.error || 'Revocation failed.');
      setActionMsg('Certificate revoked and logged to audit trail.');
      await loadOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Revocation failed.');
    }
  };

  const handleResolveReport = async (reportId: string) => {
    await apiFetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolutionNote: 'Reviewed and logged by editorial operations.' }),
    });
    await loadOverview();
  };

  const handleResolveReviewRequest = async (reviewId: string) => {
    await apiFetch(`/api/admin/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'resolved',
        reviewerNote: 'Reviewed and clarified by human subject reviewer.',
      }),
    });
    await loadOverview();
  };

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
        {strings.admin.loadingStudio}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          {strings.admin.title}
        </h1>
        <p className="mt-1 text-xs text-muted">
          {strings.admin.subtitle}
        </p>
        <p className="mt-2 text-xs text-muted">
          {strings.admin.yourRoleLabel}{' '}
          <span className="font-semibold text-teal" data-role={currentUser.role}>
            {getRoleDisplayLabel(currentUser.role, locale)}
          </span>
        </p>
        {data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-line bg-chrome p-3">
              <div className="text-xs text-muted">{strings.admin.totalEditions}</div>
              <div className="font-mono text-lg font-bold tabular-nums text-ink">{data.editions.length}</div>
            </div>
            <div className="rounded-lg border border-line bg-chrome p-3">
              <div className="text-xs text-muted">{strings.admin.pendingReview}</div>
              <div className="font-mono text-lg font-bold tabular-nums text-warning">
                {data.editions.filter((e) => e.status !== 'published' && e.status !== 'retired').length}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-chrome p-3">
              <div className="text-xs text-muted">{strings.admin.openIssueReports}</div>
              <div className="font-mono text-lg font-bold tabular-nums text-teal">
                {data.reports.filter((r) => r.status === 'open').length}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-chrome p-3">
              <div className="text-xs text-muted">{strings.admin.nonCashXpIssued}</div>
              <div className="font-mono text-lg font-bold tabular-nums text-success">
                {data.ledgerSummary.totalNonCashXpIssued} XP
              </div>
            </div>
          </div>
        )}
      </header>

      {errorMsg && (
        <div role="alert" className="rounded-lg border border-danger/50 bg-danger-surface/40 px-4 py-3 text-xs text-danger-text">
          {errorMsg}
        </div>
      )}
      {actionMsg && (
        <div role="status" className="rounded-lg border border-success/40 bg-chrome px-4 py-3 text-xs text-success">
          {actionMsg}
        </div>
      )}

      {/* Editorial Queue & Publication Gate */}
      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">{strings.admin.editionsGateTitle}</h2>
        <div className="mt-4 space-y-3">
          {data?.editions.map((ed) => (
            <div key={ed.id} className="rounded-lg border border-line bg-chrome p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted">
                    {ed.subject} · {ed.level} · {ed.locale.toUpperCase()} v{ed.version} · {strings.admin.statusLabel}{' '}
                    <span className="font-semibold text-teal">{strings.editorial[ed.status]}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-ink">{ed.title}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted">
                    <span>
                      {strings.admin.provenanceLabel} {ed.provenance ? strings.admin.verified : strings.admin.missing}
                    </span>
                    <span>
                      {strings.admin.subjectReviewLabel} {ed.subjectReviewerId ? strings.admin.signed : strings.admin.pending}
                    </span>
                    <span>
                      {strings.admin.languageReviewLabel} {ed.languageReviewerId ? strings.admin.signed : strings.admin.pending}
                    </span>
                    <span>
                      {strings.admin.rightsAccessLabel} {ed.rightsReviewerId ? strings.admin.signed : strings.admin.pending}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ed.status === 'draft' && (
                    <button
                      type="button"
                      {...transitionGate(ed, 'subject_review')}
                      onClick={() => handleTransition(ed.id, 'subject_review')}
                      className="min-h-[34px] rounded-lg disabled:cursor-not-allowed disabled:opacity-50 border border-line bg-elevated px-3 py-1 text-xs font-medium text-ink"
                    >
                      {strings.admin.sendToSubjectReview}
                    </button>
                  )}
                  {ed.status === 'subject_review' && (
                    <button
                      type="button"
                      {...transitionGate(ed, 'language_review', 'subject')}
                      onClick={() => handleTransition(ed.id, 'language_review', 'subject')}
                      className="min-h-[34px] rounded-lg disabled:cursor-not-allowed disabled:opacity-50 bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                    >
                      {strings.admin.signSubjectReview}
                    </button>
                  )}
                  {ed.status === 'language_review' && (
                    <button
                      type="button"
                      {...transitionGate(ed, 'rights_accessibility_review', 'language')}
                      onClick={() => handleTransition(ed.id, 'rights_accessibility_review', 'language')}
                      className="min-h-[34px] rounded-lg disabled:cursor-not-allowed disabled:opacity-50 bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                    >
                      {strings.admin.signLanguageReview}
                    </button>
                  )}
                  {ed.status === 'rights_accessibility_review' && (
                    <button
                      type="button"
                      {...transitionGate(ed, 'approved', 'rights')}
                      onClick={() => handleTransition(ed.id, 'approved', 'rights')}
                      className="min-h-[34px] rounded-lg disabled:cursor-not-allowed disabled:opacity-50 bg-teal px-3 py-1 text-xs font-semibold text-teal-ink hover:bg-teal-hover"
                    >
                      {strings.admin.signRightsApprove}
                    </button>
                  )}
                  {ed.status === 'approved' && (
                    <button
                      type="button"
                      {...transitionGate(ed, 'published')}
                      onClick={() => handleTransition(ed.id, 'published')}
                      className="min-h-[34px] rounded-lg disabled:cursor-not-allowed disabled:opacity-50 bg-success px-3 py-1 text-xs font-semibold text-accent-ink"
                    >
                      {strings.admin.publishEdition}
                    </button>
                  )}
                  {ed.status === 'published' && (
                    <button
                      type="button"
                      {...transitionGate(ed, 'retired')}
                      onClick={() => handleTransition(ed.id, 'retired')}
                      className="min-h-[34px] rounded-lg disabled:cursor-not-allowed disabled:opacity-50 border border-line px-3 py-1 text-xs text-muted hover:text-danger"
                    >
                      {strings.admin.retireUnpublish}
                    </button>
                  )}
                  {ed.status === 'retired' && (
                    <button
                      type="button"
                      {...transitionGate(ed, 'approved')}
                      onClick={() => handleTransition(ed.id, 'approved')}
                      className="min-h-[34px] rounded-lg disabled:cursor-not-allowed disabled:opacity-50 border border-line px-3 py-1 text-xs text-teal"
                    >
                      {strings.admin.restoreToApproved}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create Draft + AI Draft Studio */}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleCreateDraft} className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <FilePlus2 className="h-4 w-4 text-accent" aria-hidden="true" />
            <span>{strings.admin.createDraftTitle}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="draft-course" className="block text-xs text-muted">{strings.admin.targetCourse}</label>
              <select
                id="draft-course"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} ({c.level}) — {c.slug}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="draft-locale" className="block text-xs text-muted">{strings.admin.editionLocale}</label>
              <select
                id="draft-locale"
                value={draftLocale}
                onChange={(e) => setDraftLocale(e.target.value as LocaleCode)}
                className="mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink"
              >
                <option value="en">English (en)</option>
                <option value="uz">O‘zbekcha (uz)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="draft-title" className="block text-xs text-muted">{strings.admin.editionTitle}</label>
            <input
              id="draft-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={strings.admin.editionTitlePlaceholder}
              className="mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink"
            />
          </div>

          <div>
            <label htmlFor="draft-source" className="block text-xs text-muted">{strings.admin.sourceLicense}</label>
            <input
              id="draft-source"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder={strings.admin.sourceLicensePlaceholder}
              className="mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink"
            />
          </div>

          <div>
            <label htmlFor="draft-lesson-title" className="block text-xs text-muted">{strings.admin.initialLessonLabel}</label>
            <input
              id="draft-lesson-title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder={strings.admin.lessonTitlePlaceholder}
              className="mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink"
            />
            <textarea
              rows={3}
              value={lessonBody}
              onChange={(e) => setLessonBody(e.target.value)}
              placeholder={strings.admin.lessonBodyPlaceholder}
              className="mt-2 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={aiAssisted}
              onChange={(e) => setAiAssisted(e.target.checked)}
              className="accent-accent"
            />
            <span>{strings.admin.aiAssistedCheckbox}</span>
          </label>

          <button
            type="submit"
            className="min-h-[40px] rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
          >
            {strings.admin.saveDraftBtn}
          </button>
        </form>

        <AiCompanionPanel
          locale={locale}
          isStaff={true}
          aiConfigured={aiConfigured}
          defaultMode="editorial_draft"
          embedded={true}
        />
      </div>

      {/* Certificate Operations & Issue Reports */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
            <span>{strings.admin.revocationTitle}</span>
          </h2>
          {data?.certificates.length === 0 ? (
            <p className="mt-3 text-xs text-muted">{strings.admin.noCertificatesIssued}</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {data?.certificates.map((c) => (
                <div key={c.id} className="rounded-lg border border-line bg-chrome p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-ink">{c.recipientDisplayName} · {c.courseTitle}</span>
                    <span className={c.status === 'valid' ? 'text-success' : 'text-danger'}>{c.status}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted">{c.publicToken}</div>
                  {c.status === 'valid' && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={revokeReasons[c.id] || ''}
                        onChange={(e) => setRevokeReasons((p) => ({ ...p, [c.id]: e.target.value }))}
                        placeholder={strings.admin.revokeReasonPlaceholder}
                        className="flex-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-ink"
                      />
                      <button
                        type="button"
                        disabled={!canRevokeCertificates}
                        title={canRevokeCertificates ? undefined : strings.admin.revokeRequiresRole}
                        onClick={() => handleRevokeCertificate(c.id)}
                        className="rounded-md border border-danger/50 bg-danger-surface/30 px-2.5 disabled:cursor-not-allowed disabled:opacity-50 py-1 text-xs text-danger-text hover:bg-danger-surface/60"
                      >
                        {strings.admin.revokeBtn}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          data-testid="admin-segment-review-queue"
          className="rounded-xl border border-line bg-surface p-5"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <MessageSquarePlus className="h-4 w-4 text-theme-accent" aria-hidden="true" />
            <span>{strings.admin.reviewQueueTitle}</span>
          </h2>

          {data?.reviewRequests && data.reviewRequests.length > 0 && (
            <div className="mt-3 space-y-2.5 border-b border-line pb-4">
              <div className="text-xs font-semibold text-theme-cyan">
                {strings.admin.segmentNotificationsHeader.replace('{count}', String(data.reviewRequests.length))}
              </div>
              {data.reviewRequests.map((rv) => (
                <div
                  key={rv.id}
                  data-testid={`admin-review-request-${rv.id}`}
                  className="rounded-lg border-2 border-theme-border bg-theme-base p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {rv.lessonTitle} · <span className="text-theme-accent">{rv.segmentHeading}</span>
                    </span>
                    <span className="font-mono text-[11px] text-theme-cyan">{rv.status}</span>
                  </div>
                  <p className="mt-1 text-muted">
                    <span className="font-medium text-ink">{rv.studentDisplayName}:</span> {rv.comment}
                  </p>
                  {rv.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => void handleResolveReviewRequest(rv.id)}
                      data-testid={`resolve-review-request-${rv.id}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-success hover:underline"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {strings.admin.markSegmentReviewed}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {data?.reports.length === 0 ? (
            <p className="mt-3 text-xs text-muted">{strings.admin.noIssueReports}</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {data?.reports.map((r) => (
                <div key={r.id} className="rounded-lg border border-line bg-chrome p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-ink">
                      {r.category}
                      {r.segmentHeading ? ` · ${r.segmentHeading}` : ''}
                    </span>
                    <span className="text-teal">{r.status}</span>
                  </div>
                  <p className="mt-1 text-muted">{r.description}</p>
                  {r.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleResolveReport(r.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-success hover:underline"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {strings.admin.markResolved}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
