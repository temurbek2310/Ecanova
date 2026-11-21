import React from 'react';
import type { CourseCatalogItem, LocaleCode, UserRole } from '../../shared/types';
import type { AdminSection } from '../../lib/auth-routing';
import { AdminLayout } from './AdminLayout';
import { AdminOverviewPage } from './AdminOverviewPage';
import { AdminCurriculumPage } from './AdminCurriculumPage';
import { AdminModerationPage } from './AdminModerationPage';
import { AdminUsersCertificatesPage } from './AdminUsersCertificatesPage';
import { AdminAuditPage } from './AdminAuditPage';

export interface AdminConsoleProps {
  locale: LocaleCode;
  section: AdminSection;
  onNavigate: (section: AdminSection) => void;
  courses: CourseCatalogItem[];
  aiConfigured: boolean;
  onCatalogRefresh: () => Promise<void>;
  currentUser: { id: string; role: UserRole; displayName: string };
}

/** Renders the admin page for `section` inside the shared admin layout. */
export const AdminConsole: React.FC<AdminConsoleProps> = ({
  locale,
  section,
  onNavigate,
  courses,
  aiConfigured,
  onCatalogRefresh,
  currentUser,
}) => (
  <AdminLayout locale={locale} section={section} onNavigate={onNavigate} currentUser={currentUser}>
    {section === 'overview' && <AdminOverviewPage locale={locale} onNavigate={onNavigate} />}
    {section === 'curriculum' && (
      <AdminCurriculumPage
        locale={locale}
        courses={courses}
        aiConfigured={aiConfigured}
        onCatalogRefresh={onCatalogRefresh}
      />
    )}
    {section === 'moderation' && <AdminModerationPage locale={locale} />}
    {section === 'users' && <AdminUsersCertificatesPage locale={locale} currentUserId={currentUser.id} />}
    {section === 'audit' && <AdminAuditPage locale={locale} />}
  </AdminLayout>
);
