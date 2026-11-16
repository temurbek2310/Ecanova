import React, { useEffect, useState } from 'react';
import { CheckCircle2, FilePlus2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CourseCatalogItem, CourseEditionSummary, EditorialStatus, LocaleCode } from '../shared/types';
import { t } from '../lib/i18n';
import { AiCompanionPanel } from './AiCompanionPanel';

interface AdminOverviewData {
  editions: Array<CourseEditionSummary & { subject: string; level: string }>;
  reports: Array<{
    id: string;
    courseId: string | null;
    lessonId: string | null;
    category: string;
    description: string;
    status: string;
    resolutionNote: string | null;
    createdAt: string;
  }>;
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
}

export const AdminStudioView: React.FC<AdminStudioViewProps> = ({
  locale,
  courses,
  aiConfigured = false,
  onCatalogRefresh,
}) => {
  const strings = t(locale);
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
      const res = await fetch('/api/admin/overview');
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
    signoffType?: 'subject' | 'language' | 'rights'
  ) => {
    setActionMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/editions/${editionId}/transition`, {
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
      const res = await fetch('/api/admin/editions/draft', {
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
      const res = await fetch(`/api/admin/certificates/${certId}/revoke`, {
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
    await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolutionNote: 'Reviewed and logged by editorial operations.' }),
    });
    await loadOverview();
  };

  if (loading && !data) {
    return <div className="rounded-xl border border-[#222B3D] bg-[#101522] p-6 text-sm text-[#8994AA]">Loading Editorial Studio...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-[#F3F6FF] sm:text-2xl">
          Editorial & Content Governance Studio
        </h1>
        <p className="mt-1 text-xs text-[#8994AA]">
          No AI-generated or externally sourced material may publish automatically. Every edition requires Provenance, Subject Review, Language Review, and Rights/Accessibility sign-off.
        </p>
        {data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3">
              <div className="text-xs text-[#8994AA]">Total Editions</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#F3F6FF]">{data.editions.length}</div>
            </div>
            <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3">
              <div className="text-xs text-[#8994AA]">Pending Review</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#FFC96B]">
                {data.editions.filter((e) => e.status !== 'published' && e.status !== 'retired').length}
              </div>
            </div>
            <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3">
              <div className="text-xs text-[#8994AA]">Open Issue Reports</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#5DE1D2]">
                {data.reports.filter((r) => r.status === 'open').length}
              </div>
            </div>
            <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3">
              <div className="text-xs text-[#8994AA]">Non-Cash XP Issued</div>
              <div className="font-mono text-lg font-bold tabular-nums text-[#6FE0A1]">
                {data.ledgerSummary.totalNonCashXpIssued} XP
              </div>
            </div>
          </div>
        )}
      </header>

      {errorMsg && (
        <div role="alert" className="rounded-lg border border-rose-500/50 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}
      {actionMsg && (
        <div role="status" className="rounded-lg border border-[#6FE0A1]/40 bg-[#0B0F19] px-4 py-3 text-xs text-[#6FE0A1]">
          {actionMsg}
        </div>
      )}

      {/* Editorial Queue & Publication Gate */}
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[#F3F6FF]">Course Editions & Human Review Gate</h2>
        <div className="mt-4 space-y-3">
          {data?.editions.map((ed) => (
            <div key={ed.id} className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[#8994AA]">
                    {ed.subject} · {ed.level} · {ed.locale.toUpperCase()} v{ed.version} · Status:{' '}
                    <span className="font-semibold text-[#5DE1D2]">{strings.editorial[ed.status]}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-[#F3F6FF]">{ed.title}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-[#8994AA]">
                    <span>Provenance: {ed.provenance ? 'Verified' : 'Missing'}</span>
                    <span>Subject Review: {ed.subjectReviewerId ? 'Signed' : 'Pending'}</span>
                    <span>Language Review: {ed.languageReviewerId ? 'Signed' : 'Pending'}</span>
                    <span>Rights & Access: {ed.rightsReviewerId ? 'Signed' : 'Pending'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ed.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleTransition(ed.id, 'subject_review')}
                      className="min-h-[34px] rounded-lg border border-[#222B3D] bg-[#141B2B] px-3 py-1 text-xs font-medium text-[#F3F6FF]"
                    >
                      Send to Subject Review
                    </button>
                  )}
                  {ed.status === 'subject_review' && (
                    <button
                      type="button"
                      onClick={() => handleTransition(ed.id, 'language_review', 'subject')}
                      className="min-h-[34px] rounded-lg bg-[#9274FF] px-3 py-1 text-xs font-semibold text-[#080B14]"
                    >
                      Sign Subject Review
                    </button>
                  )}
                  {ed.status === 'language_review' && (
                    <button
                      type="button"
                      onClick={() => handleTransition(ed.id, 'rights_accessibility_review', 'language')}
                      className="min-h-[34px] rounded-lg bg-[#9274FF] px-3 py-1 text-xs font-semibold text-[#080B14]"
                    >
                      Sign Language Review
                    </button>
                  )}
                  {ed.status === 'rights_accessibility_review' && (
                    <button
                      type="button"
                      onClick={() => handleTransition(ed.id, 'approved', 'rights')}
                      className="min-h-[34px] rounded-lg bg-[#5DE1D2] px-3 py-1 text-xs font-semibold text-[#080B14]"
                    >
                      Sign Rights & Approve
                    </button>
                  )}
                  {ed.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleTransition(ed.id, 'published')}
                      className="min-h-[34px] rounded-lg bg-[#6FE0A1] px-3 py-1 text-xs font-semibold text-[#080B14]"
                    >
                      Publish Edition
                    </button>
                  )}
                  {ed.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => handleTransition(ed.id, 'retired')}
                      className="min-h-[34px] rounded-lg border border-[#222B3D] px-3 py-1 text-xs text-[#8994AA] hover:text-rose-300"
                    >
                      Retire / Unpublish
                    </button>
                  )}
                  {ed.status === 'retired' && (
                    <button
                      type="button"
                      onClick={() => handleTransition(ed.id, 'approved')}
                      className="min-h-[34px] rounded-lg border border-[#222B3D] px-3 py-1 text-xs text-[#5DE1D2]"
                    >
                      Restore to Approved
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
        <form onSubmit={handleCreateDraft} className="space-y-3 rounded-xl border border-[#222B3D] bg-[#101522] p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#F3F6FF]">
            <FilePlus2 className="h-4 w-4 text-[#9274FF]" aria-hidden="true" />
            <span>Create New Versioned Draft Edition</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="draft-course" className="block text-xs text-[#8994AA]">Target Course</label>
              <select
                id="draft-course"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-xs text-[#F3F6FF]"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} ({c.level}) — {c.slug}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="draft-locale" className="block text-xs text-[#8994AA]">Edition Locale</label>
              <select
                id="draft-locale"
                value={draftLocale}
                onChange={(e) => setDraftLocale(e.target.value as LocaleCode)}
                className="mt-1 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-xs text-[#F3F6FF]"
              >
                <option value="en">English (en)</option>
                <option value="uz">Uzbek Latin (uz)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="draft-title" className="block text-xs text-[#8994AA]">Edition Title</label>
            <input
              id="draft-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Elasticity & Consumer Welfare (v2)"
              className="mt-1 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-xs text-[#F3F6FF]"
            />
          </div>

          <div>
            <label htmlFor="draft-source" className="block text-xs text-[#8994AA]">Source Record & License Basis</label>
            <input
              id="draft-source"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="Original ECONOVA Note / OpenStax CC BY 4.0"
              className="mt-1 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-xs text-[#F3F6FF]"
            />
          </div>

          <div>
            <label htmlFor="draft-lesson-title" className="block text-xs text-[#8994AA]">Initial Lesson Title & Body</label>
            <input
              id="draft-lesson-title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Lesson 1 Title"
              className="mt-1 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-xs text-[#F3F6FF]"
            />
            <textarea
              rows={3}
              value={lessonBody}
              onChange={(e) => setLessonBody(e.target.value)}
              placeholder="Lesson body / transcript draft..."
              className="mt-2 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-xs text-[#F3F6FF]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#8994AA]">
            <input
              type="checkbox"
              checked={aiAssisted}
              onChange={(e) => setAiAssisted(e.target.checked)}
              className="accent-[#9274FF]"
            />
            <span>Mark provenance as AI-assisted draft (requires human review before publishing)</span>
          </label>

          <button
            type="submit"
            className="min-h-[40px] rounded-lg bg-[#9274FF] px-4 py-2 text-xs font-semibold text-[#080B14]"
          >
            Save New Draft Edition
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
        <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#F3F6FF]">
            <ShieldAlert className="h-4 w-4 text-[#FFC96B]" aria-hidden="true" />
            <span>Certificate Revocation Operations</span>
          </h2>
          {data?.certificates.length === 0 ? (
            <p className="mt-3 text-xs text-[#8994AA]">No certificates issued yet.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {data?.certificates.map((c) => (
                <div key={c.id} className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#F3F6FF]">{c.recipientDisplayName} · {c.courseTitle}</span>
                    <span className={c.status === 'valid' ? 'text-[#6FE0A1]' : 'text-rose-400'}>{c.status}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[#8994AA]">{c.publicToken}</div>
                  {c.status === 'valid' && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={revokeReasons[c.id] || ''}
                        onChange={(e) => setRevokeReasons((p) => ({ ...p, [c.id]: e.target.value }))}
                        placeholder="Mandatory audit reason to revoke..."
                        className="flex-1 rounded-md border border-[#222B3D] bg-[#101522] px-2.5 py-1 text-xs text-[#F3F6FF]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRevokeCertificate(c.id)}
                        className="rounded-md border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-950/30"
                      >
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#F3F6FF]">
            <ShieldCheck className="h-4 w-4 text-[#5DE1D2]" aria-hidden="true" />
            <span>Learner Reports & Audit Log</span>
          </h2>
          {data?.reports.length === 0 ? (
            <p className="mt-3 text-xs text-[#8994AA]">No learner issue reports submitted.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {data?.reports.map((r) => (
                <div key={r.id} className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#F3F6FF]">{r.category}</span>
                    <span className="text-[#5DE1D2]">{r.status}</span>
                  </div>
                  <p className="mt-1 text-[#8994AA]">{r.description}</p>
                  {r.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleResolveReport(r.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[#6FE0A1] hover:underline"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
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
