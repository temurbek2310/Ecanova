import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { LocaleCode } from '../../shared/types';
import { getAdminSectionLabel, type AdminSection } from '../../lib/auth-routing';
import { notificationCopy } from '../../lib/notification-copy';
import { describeError, notify } from '../../lib/notifications';
import { adminRequest, formatAdminDate, type AdminOverviewResponse } from './admin-api';
import { adminCopy } from './admin-copy';
import { ADMIN_SECTION_ICONS, AdminEmpty, AdminPanel, adminButtonClass } from './AdminLayout';

export interface AdminOverviewPageProps {
  locale: LocaleCode;
  onNavigate: (section: AdminSection) => void;
}

const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: string;
  testId?: string;
}> = ({ label, value, detail, tone = 'text-ink', testId }) => (
  <div className="admin-metric" data-testid={testId}>
    <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
    <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
    {detail ? <div className="mt-2 text-[12px] text-muted leading-relaxed">{detail}</div> : null}
  </div>
);

/** `/admin`: KPI cards, quick links to the other admin pages, latest audit events. */
export const AdminOverviewPage: React.FC<AdminOverviewPageProps> = ({ locale, onNavigate }) => {
  const copy = adminCopy(locale);
  const toastCopy = notificationCopy(locale);
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminRequest<AdminOverviewResponse>('/api/admin/overview'));
      notify.dismiss('admin-overview-error');
    } catch (err) {
      notify.error(toastCopy.admin.loadFailed, describeError(err, toastCopy.common.genericError), {
        id: 'admin-overview-error',
        action: { label: toastCopy.common.retry, onAction: () => void load() },
      });
    } finally {
      setLoading(false);
    }
  }, [toastCopy]);

  useEffect(() => {
    void load();
  }, [load]);

  const k = data?.kpis;
  const quickLinks: AdminSection[] = ['curriculum', 'moderation', 'users', 'audit'];

  return (
    <div className="space-y-6">
      <AdminPanel
        title={copy.overview.title}
        subtitle={copy.overview.subtitle}
        actions={
          <button type="button" onClick={() => void load()} disabled={loading} className={adminButtonClass}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.refresh}
          </button>
        }
      >
        {!k ? (
          <AdminEmpty>{loading ? copy.loading : copy.empty}</AdminEmpty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              testId="admin-kpi-editions"
              label={copy.overview.editions}
              value={k.editions.published}
              tone="text-success"
              detail={`${copy.overview.published} ${k.editions.published} · ${copy.overview.drafts} ${k.editions.draft} · ${copy.overview.inReview} ${k.editions.inReview} · ${copy.overview.approved} ${k.editions.approved} · ${copy.overview.retired} ${k.editions.retired}`}
            />
            <KpiCard
              testId="admin-kpi-moderation"
              label={copy.overview.moderation}
              value={k.moderation.openReports + k.moderation.openReviewRequests}
              tone="text-warning"
              detail={`${copy.overview.openReports} ${k.moderation.openReports} · ${copy.overview.openReviewRequests} ${k.moderation.openReviewRequests}`}
            />
            <KpiCard
              testId="admin-kpi-users"
              label={copy.overview.users}
              value={k.users.total}
              detail={`${copy.overview.admins} ${k.users.admins} · ${copy.overview.learners} ${k.users.learners}`}
            />
            <KpiCard
              testId="admin-kpi-certificates"
              label={copy.overview.certificates}
              value={k.certificates.valid}
              tone="text-teal"
              detail={`${copy.overview.valid} ${k.certificates.valid} · ${copy.overview.revoked} ${k.certificates.revoked}`}
            />
            <KpiCard
              testId="admin-kpi-xp"
              label={copy.overview.xp}
              value={`${k.xp.totalNonCashXpIssued} XP`}
              tone="text-success"
              detail={copy.overview.xpEntries(k.xp.validEntriesCount)}
            />
          </div>
        )}
      </AdminPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel title={copy.overview.quickLinks}>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((section) => {
              const Icon = ADMIN_SECTION_ICONS[section];
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => onNavigate(section)}
                  className="admin-card flex min-h-[48px] items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-ink transition-colors hover:border-teal/50"
                  style={{ cursor: 'pointer' }}
                >
                  <Icon className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
                  {getAdminSectionLabel(section, locale)}
                </button>
              );
            })}
          </div>
        </AdminPanel>

        <AdminPanel
          title={copy.overview.recentActivity}
          actions={
            <button type="button" onClick={() => onNavigate('audit')} className={adminButtonClass}>
              {copy.overview.viewAll}
            </button>
          }
        >
          {!data || data.recentAuditEvents.length === 0 ? (
            <AdminEmpty>{loading ? copy.loading : copy.empty}</AdminEmpty>
          ) : (
            <ul className="space-y-3">
              {data.recentAuditEvents.map((event) => (
                <li key={event.id} className="admin-card p-4 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-ink">{event.action}</span>
                    <span className="text-[11px] text-muted">{formatAdminDate(event.createdAt, locale)}</span>
                  </div>
                  <p className="mt-1.5 text-muted">
                    {event.actorDisplayName ?? event.actorUserId ?? copy.audit.system} · {event.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </div>
  );
};
