import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { LocaleCode } from '../../shared/types';
import { notificationCopy } from '../../lib/notification-copy';
import { describeError, notify } from '../../lib/notifications';
import { adminRequest, buildQuery, formatAdminDate, type AdminAuditResponse } from './admin-api';
import { adminCopy } from './admin-copy';
import { AdminEmpty, AdminPanel, adminButtonClass, adminInputClass } from './AdminLayout';

export interface AdminAuditPageProps {
  locale: LocaleCode;
}

/** `/admin/audit`: audit events, filterable by action, target type and free text. */
export const AdminAuditPage: React.FC<AdminAuditPageProps> = ({ locale }) => {
  const copy = adminCopy(locale);
  const toastCopy = notificationCopy(locale);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [data, setData] = useState<AdminAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await adminRequest<AdminAuditResponse>(
          `/api/admin/audit${buildQuery({ action, targetType, q: appliedQuery, limit: '200' })}`
        )
      );
      notify.dismiss('admin-audit-error');
    } catch (err) {
      notify.error(toastCopy.admin.loadFailed, describeError(err, toastCopy.common.genericError), {
        id: 'admin-audit-error',
        action: { label: toastCopy.common.retry, onAction: () => void load() },
      });
    } finally {
      setLoading(false);
    }
  }, [action, targetType, appliedQuery, toastCopy]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectClass = 'rounded-lg border border-line bg-chrome px-2 py-1.5 text-xs text-ink';

  return (
    <AdminPanel
      title={copy.audit.title}
      subtitle={copy.audit.subtitle}
      testId="admin-audit"
      actions={
        <button type="button" onClick={() => void load()} disabled={loading} className={adminButtonClass}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.refresh}
        </button>
      }
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedQuery(query.trim());
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          {copy.audit.actionFilter}
          <select value={action} onChange={(e) => setAction(e.target.value)} className={selectClass}>
            <option value="">{copy.all}</option>
            {(data?.actions ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {copy.audit.targetFilter}
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className={selectClass}>
            <option value="">{copy.all}</option>
            {(data?.targetTypes ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="admin-audit-search" className="sr-only">
          {copy.audit.searchPlaceholder}
        </label>
        <input
          id="admin-audit-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.audit.searchPlaceholder}
          className={`${adminInputClass} mt-0 max-w-xs flex-1`}
        />
        <button type="submit" className={adminButtonClass}>
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.search}
        </button>
      </form>

      <div className="mt-4">
        {!data || data.events.length === 0 ? (
          <AdminEmpty>{loading ? copy.loading : copy.audit.noEvents}</AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-semibold">{copy.audit.columns.when}</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">{copy.audit.columns.actor}</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">{copy.audit.columns.action}</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">{copy.audit.columns.target}</th>
                  <th scope="col" className="py-2 font-semibold">{copy.audit.columns.reason}</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.id} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatAdminDate(event.createdAt, locale)}</td>
                    <td className="py-2 pr-3 text-ink">{event.actorDisplayName ?? event.actorUserId ?? copy.audit.system}</td>
                    <td className="py-2 pr-3 font-mono text-ink">{event.action}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted">
                      {event.targetType}
                      <br />
                      {event.targetId}
                    </td>
                    <td className="py-2 text-muted">{event.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPanel>
  );
};
