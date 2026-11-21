import React from 'react';
import { ClipboardList, FileText, LayoutDashboard, MessageSquareWarning, Users } from 'lucide-react';
import type { LocaleCode, UserRole } from '../../shared/types';
import { getRoleDisplayLabel } from '../../shared/econova-rules';
import {
  ADMIN_SECTIONS,
  getAdminSectionLabel,
  type AdminSection,
} from '../../lib/auth-routing';
import { adminCopy } from './admin-copy';

/** One icon per admin page, shared by the sub-nav and the app sidebar. */
export const ADMIN_SECTION_ICONS: Record<AdminSection, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  curriculum: FileText,
  moderation: MessageSquareWarning,
  users: Users,
  audit: ClipboardList,
};

export interface AdminLayoutProps {
  locale: LocaleCode;
  section: AdminSection;
  onNavigate: (section: AdminSection) => void;
  currentUser: { id: string; role: UserRole; displayName?: string };
  children: React.ReactNode;
}

/** Shared admin console frame: title, signed-in admin, and the five-page sub-nav. */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  locale,
  section,
  onNavigate,
  currentUser,
  children,
}) => {
  const copy = adminCopy(locale);
  return (
    <div className="space-y-5" data-testid="admin-console" data-admin-section={section}>
      <header className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-ink sm:text-2xl">{copy.consoleTitle}</h1>
            <p className="mt-1 max-w-2xl text-xs text-muted">{copy.consoleSubtitle}</p>
          </div>
          <p className="text-xs text-muted">
            {copy.signedInAs}{' '}
            <span className="font-semibold text-ink">{currentUser.displayName ?? currentUser.id}</span>
            {' · '}
            <span className="font-semibold text-teal" data-role={currentUser.role}>
              {getRoleDisplayLabel(currentUser.role, locale)}
            </span>
          </p>
        </div>

        <nav aria-label={copy.sectionNavLabel} className="mt-4 -mx-1 overflow-x-auto">
          <ul className="flex min-w-max gap-1.5 px-1">
            {ADMIN_SECTIONS.map((id) => {
              const Icon = ADMIN_SECTION_ICONS[id];
              const active = id === section;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(id)}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`admin-subnav-${id}`}
                    className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                      active
                        ? 'border-teal bg-chrome text-teal'
                        : 'border-line bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {getAdminSectionLabel(id, locale)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {children}
    </div>
  );
};

/** Bordered page section used by every admin page. */
export const AdminPanel: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}> = ({ title, subtitle, actions, children, testId }) => (
  <section className="rounded-xl border border-line bg-surface p-5" data-testid={testId}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

export const AdminEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">{children}</p>
);

export const adminInputClass =
  'mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink';
export const adminButtonClass =
  'inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1 text-xs font-medium text-ink hover:border-teal disabled:cursor-not-allowed disabled:opacity-50';
export const adminPrimaryButtonClass =
  'inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50';
export const adminDangerButtonClass =
  'inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-danger/50 bg-danger-surface/30 px-3 py-1 text-xs font-semibold text-danger-text hover:bg-danger-surface/60 disabled:cursor-not-allowed disabled:opacity-50';
