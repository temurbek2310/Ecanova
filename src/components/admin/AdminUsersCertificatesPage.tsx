import React, { useCallback, useEffect, useState } from 'react';
import { Search, ShieldCheck, ShieldOff } from 'lucide-react';
import type { LocaleCode, UserRole } from '../../shared/types';
import { getRoleDisplayLabel } from '../../shared/econova-rules';
import { notificationCopy } from '../../lib/notification-copy';
import { describeError, notify } from '../../lib/notifications';
import {
  adminRequest,
  buildQuery,
  formatAdminDate,
  type AdminCertificate,
  type AdminUser,
} from './admin-api';
import { adminCopy } from './admin-copy';
import {
  AdminEmpty,
  AdminPanel,
  adminButtonClass,
  adminDangerButtonClass,
  adminInputClass,
  adminPrimaryButtonClass,
} from './AdminLayout';
import { AdminCardSkeleton, AdminTableSkeleton, ContentReveal } from '../ui/BrutalSkeleton';

export interface AdminUsersCertificatesPageProps {
  locale: LocaleCode;
  currentUserId: string;
}

const MIN_REVOKE_REASON = 5;

/** `/admin/users`: user search + learner/admin role toggle, certificate list + revoke dialog. */
export const AdminUsersCertificatesPage: React.FC<AdminUsersCertificatesPageProps> = ({
  locale,
  currentUserId,
}) => {
  const copy = adminCopy(locale);
  const toastCopy = notificationCopy(locale);

  const [userQuery, setUserQuery] = useState('');
  const [appliedUserQuery, setAppliedUserQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const [certQuery, setCertQuery] = useState('');
  const [appliedCertQuery, setAppliedCertQuery] = useState('');
  const [certificates, setCertificates] = useState<AdminCertificate[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<AdminCertificate | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const out = await adminRequest<{ users: AdminUser[] }>(
        `/api/admin/users${buildQuery({ q: appliedUserQuery })}`
      );
      setUsers(out.users);
      notify.dismiss('admin-users-error');
    } catch (err) {
      notify.error(toastCopy.admin.loadFailed, describeError(err, toastCopy.common.genericError), {
        id: 'admin-users-error',
        action: { label: toastCopy.common.retry, onAction: () => void loadUsers() },
      });
    } finally {
      setUsersLoading(false);
    }
  }, [appliedUserQuery, toastCopy]);

  const loadCertificates = useCallback(async () => {
    setCertsLoading(true);
    try {
      const out = await adminRequest<{ certificates: AdminCertificate[] }>(
        `/api/admin/certificates${buildQuery({ q: appliedCertQuery })}`
      );
      setCertificates(out.certificates);
      notify.dismiss('admin-certificates-error');
    } catch (err) {
      notify.error(toastCopy.admin.loadFailed, describeError(err, toastCopy.common.genericError), {
        id: 'admin-certificates-error',
        action: { label: toastCopy.common.retry, onAction: () => void loadCertificates() },
      });
    } finally {
      setCertsLoading(false);
    }
  }, [appliedCertQuery, toastCopy]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadCertificates();
  }, [loadCertificates]);

  const changeRole = async (target: AdminUser, nextRole: UserRole) => {
    if (target.id === currentUserId && nextRole !== 'admin') {
      notify.warning(toastCopy.admin.roleUpdateFailed, toastCopy.admin.selfDemotionBlocked);
      return;
    }
    setRoleBusyId(target.id);
    try {
      await adminRequest(`/api/admin/users/${target.id}/role`, { method: 'PATCH', body: { role: nextRole } });
      notify.success(toastCopy.admin.roleUpdated(target.displayName, getRoleDisplayLabel(nextRole, locale)));
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u)));
    } catch (err) {
      notify.error(toastCopy.admin.roleUpdateFailed, describeError(err, toastCopy.common.genericError));
    } finally {
      setRoleBusyId(null);
    }
  };

  const closeRevoke = () => {
    if (revoking) return;
    setRevokeTarget(null);
    setRevokeReason('');
  };

  const confirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget) return;
    if (revokeReason.trim().length < MIN_REVOKE_REASON) {
      notify.warning(toastCopy.certificate.revokeFailed, toastCopy.admin.revokeReasonRequired);
      return;
    }
    setRevoking(true);
    try {
      await adminRequest(`/api/admin/certificates/${revokeTarget.id}/revoke`, {
        method: 'POST',
        body: { reason: revokeReason.trim() },
      });
      notify.success(toastCopy.certificate.revoked, toastCopy.certificate.revokedMessage);
      setRevokeTarget(null);
      setRevokeReason('');
      await loadCertificates();
    } catch (err) {
      notify.error(toastCopy.certificate.revokeFailed, describeError(err, toastCopy.common.genericError));
    } finally {
      setRevoking(false);
    }
  };

  useEffect(() => {
    if (!revokeTarget) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRevoke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-6">
      <AdminPanel title={copy.users.title} subtitle={copy.users.subtitle} testId="admin-users">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedUserQuery(userQuery.trim());
          }}
          className="flex flex-wrap gap-2"
          role="search"
        >
          <label htmlFor="admin-user-search" className="sr-only">
            {copy.users.searchPlaceholder}
          </label>
          <input
            id="admin-user-search"
            type="search"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder={copy.users.searchPlaceholder}
            className="admin-input mt-0 max-w-sm flex-1"
          />
          <button type="submit" className={adminButtonClass}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.search}
          </button>
        </form>

        <h3 className="mt-6 admin-section-title">
          {copy.users.usersHeading} ({users.length})
        </h3>
        {users.length === 0 ? (
          usersLoading ? (
            <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
              <table className="admin-table" style={{ minWidth: '640px' }}>
                <thead>
                  <tr>
                    <th scope="col">{copy.users.columns.name}</th>
                    <th scope="col">{copy.users.columns.email}</th>
                    <th scope="col">{copy.users.columns.role}</th>
                    <th scope="col">{copy.users.columns.joined}</th>
                    <th scope="col">{copy.users.columns.actions}</th>
                  </tr>
                </thead>
                <AdminTableSkeleton rows={4} cols={5} locale={locale} />
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <AdminEmpty>{copy.users.noUsers}</AdminEmpty>
            </div>
          )
        ) : (
          <ContentReveal>
            <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
              <table className="admin-table" style={{ minWidth: '640px' }}>
                <thead>
                  <tr>
                    <th scope="col">{copy.users.columns.name}</th>
                    <th scope="col">{copy.users.columns.email}</th>
                    <th scope="col">{copy.users.columns.role}</th>
                    <th scope="col">{copy.users.columns.joined}</th>
                    <th scope="col">{copy.users.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId;
                    const isAdmin = u.role === 'admin';
                    const selfDemotion = isSelf && isAdmin;
                    return (
                      <tr key={u.id} data-user-role={u.role}>
                        <td className="font-medium text-ink">
                          {u.displayName}
                          {isSelf ? <span className="ml-1 text-[11px] font-normal text-muted">({copy.users.you})</span> : null}
                        </td>
                        <td className="text-muted">{u.email}</td>
                        <td className={`font-semibold ${isAdmin ? 'text-teal' : 'text-ink'}`}>
                          {getRoleDisplayLabel(u.role, locale)}
                        </td>
                        <td className="text-muted whitespace-nowrap">{formatAdminDate(u.createdAt, locale)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={roleBusyId === u.id || selfDemotion}
                              title={selfDemotion ? copy.users.selfDemotionHint : undefined}
                              aria-describedby={selfDemotion ? `self-demotion-${u.id}` : undefined}
                              onClick={() => void changeRole(u, isAdmin ? 'learner' : 'admin')}
                              className={adminButtonClass}
                              data-testid={`role-toggle-${u.id}`}
                            >
                              {isAdmin ? (
                                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              {isAdmin ? copy.users.makeLearner : copy.users.makeAdmin}
                            </button>
                            {selfDemotion ? (
                              <span id={`self-demotion-${u.id}`} className="sr-only">
                                {copy.users.selfDemotionHint}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ContentReveal>
        )}
      </AdminPanel>

      <AdminPanel title={copy.users.certificatesHeading} testId="admin-certificates">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedCertQuery(certQuery.trim());
          }}
          className="flex flex-wrap gap-2"
          role="search"
        >
          <label htmlFor="admin-cert-search" className="sr-only">
            {copy.users.certificateSearchPlaceholder}
          </label>
          <input
            id="admin-cert-search"
            type="search"
            value={certQuery}
            onChange={(e) => setCertQuery(e.target.value)}
            placeholder={copy.users.certificateSearchPlaceholder}
            className="admin-input mt-0 max-w-sm flex-1"
          />
          <button type="submit" className={adminButtonClass}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.search}
          </button>
        </form>

        <div className="mt-5 space-y-3">
          {certificates.length === 0 ? (
            certsLoading ? (
              <div aria-busy="true" aria-label={copy.loading} className="space-y-3">
                <AdminCardSkeleton locale={locale} lines={2} />
                <AdminCardSkeleton locale={locale} lines={2} />
                <AdminCardSkeleton locale={locale} lines={2} />
              </div>
            ) : (
              <AdminEmpty>{copy.users.noCertificates}</AdminEmpty>
            )
          ) : (
            <ContentReveal className="space-y-3">
              {certificates.map((c) => (
                <article key={c.id} className="admin-card p-4 text-[13px]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">
                        {c.recipientDisplayName} · {c.courseTitle}
                      </div>
                      <div className="mt-1.5 font-mono text-[11px] text-muted">
                        {c.publicToken} · {c.locale.toUpperCase()} · {formatAdminDate(c.issuedAt, locale)}
                      </div>
                      {c.status === 'revoked' && c.revokeReason ? (
                        <div className="mt-1.5 text-[12px] text-danger-text">
                          {copy.users.revokedOn} {c.revokedAt ? formatAdminDate(c.revokedAt, locale) : ''}: {c.revokeReason}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`admin-badge ${c.status === 'valid' ? '!text-success' : '!text-danger-text'}`}>
                        {copy.users.certificateStatus[c.status]}
                      </span>
                      {c.status === 'valid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRevokeTarget(c);
                            setRevokeReason('');
                          }}
                          className={adminDangerButtonClass}
                          data-testid={`revoke-open-${c.id}`}
                        >
                          {copy.users.revoke}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </ContentReveal>
          )}
        </div>
      </AdminPanel>

      {revokeTarget && (
        <div
          className="admin-dialog-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeRevoke();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-dialog-title"
            onSubmit={confirmRevoke}
            className="admin-dialog-panel space-y-4"
          >
            <h2 id="revoke-dialog-title" className="text-base font-semibold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              {copy.users.revokeTitle}
            </h2>
            <p className="text-[13px] text-muted">
              {copy.users.revokeBody(revokeTarget.recipientDisplayName, revokeTarget.courseTitle)}
            </p>
            <div>
              <label htmlFor="revoke-reason" className="block text-[13px] text-muted">
                {copy.users.revokeReasonLabel}
              </label>
              <textarea
                id="revoke-reason"
                autoFocus
                required
                minLength={MIN_REVOKE_REASON}
                maxLength={1000}
                rows={3}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder={copy.users.revokeReasonPlaceholder}
                className={adminInputClass}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeRevoke} disabled={revoking} className={adminButtonClass}>
                {copy.cancel}
              </button>
              <button
                type="submit"
                disabled={revoking || revokeReason.trim().length < MIN_REVOKE_REASON}
                className={adminDangerButtonClass}
                data-testid="revoke-confirm"
              >
                {copy.users.confirmRevoke}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
