import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { LocaleCode } from '../../shared/types';
import { notificationCopy } from '../../lib/notification-copy';
import { describeError, notify } from '../../lib/notifications';
import {
  adminRequest,
  buildQuery,
  formatAdminDate,
  type AdminModerationResponse,
  type ModerationStatus,
} from './admin-api';
import { adminCopy } from './admin-copy';
import {
  AdminEmpty,
  AdminPanel,
  adminButtonClass,
  adminInputClass,
  adminPrimaryButtonClass,
} from './AdminLayout';

export interface AdminModerationPageProps {
  locale: LocaleCode;
}

type ItemKind = 'review' | 'report';
const FILTERS: Array<ModerationStatus | 'all'> = ['open', 'investigating', 'resolved', 'all'];

const statusTone: Record<ModerationStatus, string> = {
  open: 'text-warning',
  investigating: 'text-teal',
  resolved: 'text-success',
};

/** `/admin/moderation`: segment review requests and issue reports, filtered by status, with notes. */
export const AdminModerationPage: React.FC<AdminModerationPageProps> = ({ locale }) => {
  const copy = adminCopy(locale);
  const toastCopy = notificationCopy(locale);
  const [filter, setFilter] = useState<ModerationStatus | 'all'>('open');
  const [data, setData] = useState<AdminModerationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await adminRequest<AdminModerationResponse>(
          `/api/admin/moderation${buildQuery({ status: filter === 'all' ? null : filter })}`
        )
      );
      notify.dismiss('admin-moderation-error');
    } catch (err) {
      notify.error(toastCopy.admin.loadFailed, describeError(err, toastCopy.common.genericError), {
        id: 'admin-moderation-error',
        action: { label: toastCopy.common.retry, onAction: () => void load() },
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toastCopy]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (kind: ItemKind, id: string, status: ModerationStatus) => {
    const key = `${kind}:${id}`;
    setBusyKey(key);
    const note = notes[key]?.trim() || undefined;
    try {
      if (kind === 'review') {
        await adminRequest(`/api/admin/reviews/${id}`, { method: 'PATCH', body: { status, reviewerNote: note } });
      } else {
        await adminRequest(`/api/admin/reports/${id}`, { method: 'PATCH', body: { status, resolutionNote: note } });
      }
      notify.success(
        status === 'resolved'
          ? kind === 'review'
            ? toastCopy.editorial.reviewResolved
            : toastCopy.editorial.reportResolved
          : toastCopy.admin.moderationUpdated,
        copy.moderation.statuses[status]
      );
      setNotes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await load();
    } catch (err) {
      notify.error(toastCopy.editorial.resolveFailed, describeError(err, toastCopy.common.genericError));
    } finally {
      setBusyKey(null);
    }
  };

  const renderControls = (kind: ItemKind, id: string, status: ModerationStatus) => {
    const key = `${kind}:${id}`;
    const busy = busyKey === key;
    return (
      <div className="mt-3 space-y-2">
        <label htmlFor={`note-${key}`} className="block text-[11px] text-muted">
          {copy.moderation.noteLabel}
        </label>
        <textarea
          id={`note-${key}`}
          rows={2}
          maxLength={2000}
          value={notes[key] ?? ''}
          onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))}
          placeholder={copy.moderation.notePlaceholder}
          className={adminInputClass}
        />
        <div className="flex flex-wrap gap-2">
          {status !== 'investigating' && status !== 'resolved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void update(kind, id, 'investigating')}
              className={adminButtonClass}
            >
              {copy.moderation.markInvestigating}
            </button>
          )}
          {status !== 'resolved' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void update(kind, id, 'resolved')}
              className={adminPrimaryButtonClass}
              data-testid={`resolve-${kind}-${id}`}
            >
              {copy.moderation.markResolved}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void update(kind, id, 'open')}
              className={adminButtonClass}
            >
              {copy.moderation.reopen}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <AdminPanel
        title={copy.moderation.title}
        subtitle={copy.moderation.subtitle}
        actions={
          <>
            <div role="group" aria-label={copy.moderation.statusFilter} className="flex flex-wrap gap-1">
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`min-h-[32px] rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    filter === value ? 'border-teal bg-chrome text-teal' : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {value === 'all' ? copy.all : copy.moderation.statuses[value]}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className={adminButtonClass}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.refresh}
            </button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div data-testid="admin-segment-review-queue">
            <h3 className="text-sm font-semibold text-ink">
              {copy.moderation.reviewRequests} ({data?.reviewRequests.length ?? 0})
            </h3>
            <div className="mt-3 space-y-2.5">
              {!data || data.reviewRequests.length === 0 ? (
                <AdminEmpty>{loading ? copy.loading : copy.moderation.noReviewRequests}</AdminEmpty>
              ) : (
                data.reviewRequests.map((rv) => (
                  <article key={rv.id} className="rounded-lg border border-line bg-chrome p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {rv.lessonTitle} · <span className="text-teal">{rv.segmentHeading}</span>
                      </span>
                      <span className={`font-semibold ${statusTone[rv.status]}`}>
                        {copy.moderation.statuses[rv.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-muted">
                      <span className="font-medium text-ink">{rv.studentDisplayName}:</span> {rv.comment}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">{formatAdminDate(rv.createdAt, locale)}</p>
                    {rv.reviewerNote ? (
                      <p className="mt-1 text-[11px] text-muted">
                        {copy.moderation.existingNote} {rv.reviewerNote}
                      </p>
                    ) : null}
                    {renderControls('review', rv.id, rv.status)}
                  </article>
                ))
              )}
            </div>
          </div>

          <div data-testid="admin-issue-report-queue">
            <h3 className="text-sm font-semibold text-ink">
              {copy.moderation.issueReports} ({data?.reports.length ?? 0})
            </h3>
            <div className="mt-3 space-y-2.5">
              {!data || data.reports.length === 0 ? (
                <AdminEmpty>{loading ? copy.loading : copy.moderation.noReports}</AdminEmpty>
              ) : (
                data.reports.map((r) => (
                  <article key={r.id} className="rounded-lg border border-line bg-chrome p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {r.category}
                        {r.segmentHeading ? ` · ${r.segmentHeading}` : ''}
                      </span>
                      <span className={`font-semibold ${statusTone[r.status]}`}>
                        {copy.moderation.statuses[r.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-muted">{r.description}</p>
                    <p className="mt-1 text-[11px] text-muted">{formatAdminDate(r.createdAt, locale)}</p>
                    {r.resolutionNote ? (
                      <p className="mt-1 text-[11px] text-muted">
                        {copy.moderation.existingNote} {r.resolutionNote}
                      </p>
                    ) : null}
                    {renderControls('report', r.id, r.status)}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
};
