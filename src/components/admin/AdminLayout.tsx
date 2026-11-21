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

/** Shared admin console frame: frosted header, signed-in admin, and the five-page sub-nav. */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  locale,
  section,
  onNavigate,
  currentUser,
  children,
}) => {
  const copy = adminCopy(locale);
  return (
    <div className="space-y-6" data-testid="admin-console" data-admin-section={section}>
      <header className="admin-surface p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-ink sm:text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
              {copy.consoleTitle}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13px] text-muted leading-relaxed">
              {copy.consoleSubtitle}
            </p>
          </div>
          <p className="text-[13px] text-muted">
            {copy.signedInAs}{' '}
            <span className="font-semibold text-ink">{currentUser.displayName ?? currentUser.id}</span>
            {' · '}
            <span className="font-semibold text-teal" data-role={currentUser.role}>
              {getRoleDisplayLabel(currentUser.role, locale)}
            </span>
          </p>
        </div>

        <nav aria-label={copy.sectionNavLabel} className="mt-5 -mx-1 overflow-x-auto">
          <ul className="flex min-w-max gap-1 px-1">
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
                    className="admin-nav-pill"
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
  <section className="admin-surface p-4 sm:p-6" data-testid={testId}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="admin-section-title">{title}</h2>
        {subtitle ? <p className="admin-section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    <div className="mt-5">{children}</div>
  </section>
);

export const AdminEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="admin-empty">{children}</p>
);

export const adminInputClass = 'admin-input mt-1';
export const adminButtonClass = 'admin-btn';
export const adminPrimaryButtonClass = 'admin-btn-primary';
export const adminDangerButtonClass = 'admin-btn-danger';
