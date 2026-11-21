import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FilePlus2, Pencil, RefreshCw } from 'lucide-react';
import type {
  CourseCatalogItem,
  EditorialSignoffType,
  EditorialStatus,
  LocaleCode,
} from '../../shared/types';
import { t } from '../../lib/i18n';
import { notificationCopy } from '../../lib/notification-copy';
import { describeError, notify } from '../../lib/notifications';
import { describeEditorialTransitionOutcome } from '../../lib/editorial-notifications';
import { AiCompanionPanel } from '../AiCompanionPanel';
import { adminRequest, formatAdminDate, type AdminEdition, type EditionTransitionRequest } from './admin-api';
import { adminCopy } from './admin-copy';
import {
  AdminEmpty,
  AdminPanel,
  adminButtonClass,
  adminInputClass,
  adminPrimaryButtonClass,
} from './AdminLayout';
import { OverflowMenu, type OverflowMenuItem } from './OverflowMenu';

export interface AdminCurriculumPageProps {
  locale: LocaleCode;
  courses: CourseCatalogItem[];
  aiConfigured: boolean;
  onCatalogRefresh: () => Promise<void>;
}

const ALL_SIGNOFFS: EditorialSignoffType[] = ['subject', 'language', 'rights'];
const STATUS_FILTERS: Array<EditorialStatus | 'all'> = [
  'all',
  'draft',
  'subject_review',
  'language_review',
  'rights_accessibility_review',
  'approved',
  'published',
  'retired',
];

interface DraftEditState {
  editionId: string;
  title: string;
  subtitle: string;
  description: string;
}

/** `/admin/curriculum`: edition lifecycle (draft → review → approve → publish → retire → restore). */
export const AdminCurriculumPage: React.FC<AdminCurriculumPageProps> = ({
  locale,
  courses,
  aiConfigured,
  onCatalogRefresh,
}) => {
  const strings = t(locale);
  const copy = adminCopy(locale);
  const toastCopy = notificationCopy(locale);
  const statusLabel = (status: EditorialStatus) => strings.editorial[status] ?? status;

  const [editions, setEditions] = useState<AdminEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EditorialStatus | 'all'>('all');
  const [editing, setEditing] = useState<DraftEditState | null>(null);

  // Create-draft form
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [draftLocale, setDraftLocale] = useState<LocaleCode>('en');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [aiAssisted, setAiAssisted] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonBody, setLessonBody] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!courseId && courses[0]) setCourseId(courses[0].id);
  }, [courseId, courses]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const out = await adminRequest<{ editions: AdminEdition[] }>('/api/admin/editions');
      setEditions(out.editions);
      notify.dismiss('admin-curriculum-error');
    } catch (err) {
      notify.error(toastCopy.editorial.loadFailed, describeError(err, toastCopy.common.genericError), {
        id: 'admin-curriculum-error',
        action: { label: toastCopy.common.retry, onAction: () => void load() },
      });
    } finally {
      setLoading(false);
    }
  }, [toastCopy]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (statusFilter === 'all' ? editions : editions.filter((ed) => ed.status === statusFilter)),
    [editions, statusFilter]
  );

  const runTransition = async (edition: AdminEdition, request: EditionTransitionRequest) => {
    setBusyId(edition.id);
    try {
      await adminRequest(`/api/admin/editions/${edition.id}/transition`, { method: 'POST', body: request });
      if (request.signoffs && request.signoffs.length > 1) {
        notify.success(toastCopy.admin.approvedAll, toastCopy.admin.approvedAllMessage);
      } else {
        const outcome = describeEditorialTransitionOutcome({
          copy: toastCopy,
          statusLabel: statusLabel(request.nextStatus),
          previousStatus: edition.status,
          nextStatus: request.nextStatus,
          signoffType: request.signoffType ?? null,
        });
        notify.success(outcome.title, outcome.message);
      }
      await load();
      await onCatalogRefresh();
    } catch (err) {
      notify.error(toastCopy.editorial.blocked, describeError(err, toastCopy.common.genericError));
    } finally {
      setBusyId(null);
    }
  };

  const saveDraftEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusyId(editing.editionId);
    try {
      await adminRequest(`/api/admin/editions/${editing.editionId}/draft`, {
        method: 'PATCH',
        body: { title: editing.title, subtitle: editing.subtitle, description: editing.description },
      });
      notify.success(toastCopy.admin.draftUpdated, editing.title);
      setEditing(null);
      await load();
    } catch (err) {
      notify.error(toastCopy.admin.draftUpdateFailed, describeError(err, toastCopy.common.genericError));
    } finally {
      setBusyId(null);
    }
  };

  const createDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const out = await adminRequest<{ version?: number }>('/api/admin/editions/draft', {
        method: 'POST',
        body: { courseId, locale: draftLocale, title, subtitle, sourceTitle, aiAssisted, lessonTitle, lessonBody },
      });
      setTitle('');
      setSubtitle('');
      setSourceTitle('');
      setLessonTitle('');
      setLessonBody('');
      notify.success(
        toastCopy.editorial.draftCreated(out.version ?? '?', draftLocale.toUpperCase()),
        toastCopy.editorial.draftCreatedMessage
      );
      await load();
    } catch (err) {
      notify.error(toastCopy.editorial.draftFailed, describeError(err, toastCopy.common.genericError));
    } finally {
      setCreating(false);
    }
  };

  /** Build primary action + overflow secondary actions for each edition row. */
  const actionsFor = (ed: AdminEdition): {
    primary: { label: string; request: EditionTransitionRequest; title?: string } | null;
    overflow: OverflowMenuItem[];
  } => {
    const approveAllReq = { nextStatus: 'approved' as const, signoffs: ALL_SIGNOFFS };
    const backToDraftReq = { nextStatus: 'draft' as const };

    switch (ed.status) {
      case 'draft':
        return {
          primary: { label: copy.curriculum.approveAll, request: approveAllReq, title: copy.curriculum.approveAllHint },
          overflow: [
            { label: copy.curriculum.sendToReview, onClick: () => void runTransition(ed, { nextStatus: 'subject_review' }), disabled: busyId === ed.id },
            { label: copy.curriculum.editDraft, icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => setEditing({ editionId: ed.id, title: ed.title, subtitle: ed.subtitle, description: ed.description }), disabled: busyId === ed.id },
          ],
        };
      case 'subject_review':
        return {
          primary: { label: copy.curriculum.signSubject, request: { nextStatus: 'language_review', signoffType: 'subject' } },
          overflow: [
            { label: copy.curriculum.approveAll, onClick: () => void runTransition(ed, approveAllReq), disabled: busyId === ed.id },
            { label: copy.curriculum.backToDraft, onClick: () => void runTransition(ed, backToDraftReq), disabled: busyId === ed.id },
          ],
        };
      case 'language_review':
        return {
          primary: { label: copy.curriculum.signLanguage, request: { nextStatus: 'rights_accessibility_review', signoffType: 'language' } },
          overflow: [
            { label: copy.curriculum.approveAll, onClick: () => void runTransition(ed, approveAllReq), disabled: busyId === ed.id },
            { label: copy.curriculum.backToDraft, onClick: () => void runTransition(ed, backToDraftReq), disabled: busyId === ed.id },
          ],
        };
      case 'rights_accessibility_review':
        return {
          primary: { label: copy.curriculum.signRights, request: { nextStatus: 'approved', signoffType: 'rights' } },
          overflow: [
            { label: copy.curriculum.backToDraft, onClick: () => void runTransition(ed, backToDraftReq), disabled: busyId === ed.id },
          ],
        };
      case 'approved':
        return {
          primary: { label: copy.curriculum.publish, request: { nextStatus: 'published' } },
          overflow: [
            { label: copy.curriculum.backToDraft, onClick: () => void runTransition(ed, backToDraftReq), disabled: busyId === ed.id },
          ],
        };
      case 'published':
        return {
          primary: { label: copy.curriculum.retire, request: { nextStatus: 'retired' } },
          overflow: [],
        };
      case 'retired':
        return {
          primary: { label: copy.curriculum.restoreApproved, request: { nextStatus: 'approved' } },
          overflow: [
            { label: copy.curriculum.backToDraft, onClick: () => void runTransition(ed, backToDraftReq), disabled: busyId === ed.id },
          ],
        };
      default:
        return { primary: null, overflow: [] };
    }
  };

  const signoffBadge = (label: string, signed: boolean) => (
    <span className={`admin-badge ${signed ? '!text-success' : ''}`}>
      {label}: {signed ? copy.curriculum.signed : copy.curriculum.pending}
    </span>
  );

  return (
    <div className="space-y-6">
      <AdminPanel
        title={copy.curriculum.title}
        subtitle={copy.curriculum.subtitle}
        testId="admin-curriculum-editions"
        actions={
          <>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              {copy.curriculum.filterStatus}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as EditorialStatus | 'all')}
                className="admin-select"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? copy.all : statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void load()} disabled={loading} className={adminButtonClass}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.refresh}
            </button>
          </>
        }
      >
        {visible.length === 0 ? (
          <AdminEmpty>{loading ? copy.loading : copy.curriculum.noEditions}</AdminEmpty>
        ) : (
          <ul className="space-y-3">
            {visible.map((ed) => {
              const { primary, overflow } = actionsFor(ed);
              return (
                <li key={ed.id} className="admin-card p-5" data-edition-status={ed.status}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                        <span>{ed.subject} · {ed.level} · {ed.locale.toUpperCase()} v{ed.version}</span>
                        <span className="admin-badge !text-teal">{statusLabel(ed.status)}</span>
                        <span>{formatAdminDate(ed.updatedAt, locale)}</span>
                      </div>
                      <h3 className="mt-2 text-[14px] font-semibold text-ink">{ed.title}</h3>
                      {ed.subtitle ? <p className="mt-0.5 text-[13px] text-muted">{ed.subtitle}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`admin-badge ${ed.provenance ? '!text-success' : '!text-danger-text'}`}>
                          {copy.curriculum.provenance}: {ed.provenance ? copy.curriculum.verified : copy.curriculum.missing}
                        </span>
                        {signoffBadge(copy.curriculum.subjectReview, Boolean(ed.subjectReviewerId))}
                        {signoffBadge(copy.curriculum.languageReview, Boolean(ed.languageReviewerId))}
                        {signoffBadge(copy.curriculum.rightsReview, Boolean(ed.rightsReviewerId))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {primary && (
                        <button
                          type="button"
                          title={primary.title}
                          disabled={busyId === ed.id}
                          onClick={() => void runTransition(ed, primary.request)}
                          className={adminPrimaryButtonClass}
                        >
                          {primary.label}
                        </button>
                      )}
                      <OverflowMenu
                        items={overflow}
                        testId={`edition-overflow-${ed.id}`}
                      />
                    </div>
                  </div>

                  {editing?.editionId === ed.id && (
                    <form onSubmit={saveDraftEdit} className="mt-5 space-y-4 border-t pt-5" style={{ borderColor: 'var(--admin-card-border)' }}>
                      <h4 className="text-[13px] font-semibold text-ink">{copy.curriculum.editDraftTitle}</h4>
                      <div>
                        <label htmlFor={`edit-title-${ed.id}`} className="block text-[13px] text-muted">
                          {copy.curriculum.titleLabel}
                        </label>
                        <input
                          id={`edit-title-${ed.id}`}
                          required
                          minLength={3}
                          maxLength={200}
                          value={editing.title}
                          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                          className={adminInputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-subtitle-${ed.id}`} className="block text-[13px] text-muted">
                          {copy.curriculum.subtitleLabel}
                        </label>
                        <input
                          id={`edit-subtitle-${ed.id}`}
                          maxLength={300}
                          value={editing.subtitle}
                          onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                          className={adminInputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-description-${ed.id}`} className="block text-[13px] text-muted">
                          {copy.curriculum.descriptionLabel}
                        </label>
                        <textarea
                          id={`edit-description-${ed.id}`}
                          rows={4}
                          maxLength={4000}
                          value={editing.description}
                          onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                          className={adminInputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={busyId === ed.id} className={adminPrimaryButtonClass}>
                          {copy.save}
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className={adminButtonClass}>
                          {copy.cancel}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </AdminPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel title={copy.curriculum.createTitle}>
          <form onSubmit={createDraft} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="draft-course" className="block text-[13px] text-muted">{copy.curriculum.targetCourse}</label>
                <select
                  id="draft-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="admin-select mt-1 w-full"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject} ({c.level}) — {c.slug}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="draft-locale" className="block text-[13px] text-muted">{copy.curriculum.editionLocale}</label>
                <select
                  id="draft-locale"
                  value={draftLocale}
                  onChange={(e) => setDraftLocale(e.target.value as LocaleCode)}
                  className="admin-select mt-1 w-full"
                >
                  <option value="en">English (en)</option>
                  <option value="uz">O'zbekcha (uz)</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="draft-title" className="block text-[13px] text-muted">{copy.curriculum.titleLabel}</label>
              <input
                id="draft-title"
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={copy.curriculum.editionTitlePlaceholder}
                className={adminInputClass}
              />
            </div>
            <div>
              <label htmlFor="draft-subtitle" className="block text-[13px] text-muted">{copy.curriculum.subtitleLabel}</label>
              <input
                id="draft-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className={adminInputClass}
              />
            </div>
            <div>
              <label htmlFor="draft-source" className="block text-[13px] text-muted">{copy.curriculum.sourceLicense}</label>
              <input
                id="draft-source"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                placeholder={copy.curriculum.sourceLicensePlaceholder}
                className={adminInputClass}
              />
            </div>
            <div>
              <label htmlFor="draft-lesson-title" className="block text-[13px] text-muted">{copy.curriculum.initialLesson}</label>
              <input
                id="draft-lesson-title"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder={copy.curriculum.lessonTitlePlaceholder}
                className={adminInputClass}
              />
              <textarea
                rows={3}
                aria-label={copy.curriculum.lessonBodyPlaceholder}
                value={lessonBody}
                onChange={(e) => setLessonBody(e.target.value)}
                placeholder={copy.curriculum.lessonBodyPlaceholder}
                className="admin-input mt-2"
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={aiAssisted}
                onChange={(e) => setAiAssisted(e.target.checked)}
                className="admin-checkbox"
              />
              <span>{copy.curriculum.aiAssisted}</span>
            </label>
            <button type="submit" disabled={creating || !courseId} className={adminPrimaryButtonClass}>
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.curriculum.createDraft}
            </button>
          </form>
        </AdminPanel>

        <AiCompanionPanel
          locale={locale}
          isStaff={true}
          aiConfigured={aiConfigured}
          defaultMode="editorial_draft"
          embedded={true}
        />
      </div>
    </div>
  );
};
