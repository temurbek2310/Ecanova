import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  Bookmark,
  CalendarRange,
  CheckCircle2,
  Download,
  HardDrive,
  Mail,
  Monitor,
  Moon,
  Shield,
  Sun,
  Trash2,
} from 'lucide-react';
import type { CourseCatalogItem, EnrollmentRecord, LocaleCode, UserSummary, XpLedgerEntry } from '../shared/types';
import { t } from '../lib/i18n';
import { apiFetch } from '../lib/auth-client';
import { resolveBookmarkedCourses } from '../lib/course-bookmarks';
import {
  resolveCachedCourseDetails,
  type CachedCourseEntry,
  type ServiceWorkerAvailability,
} from '../lib/offline-cache';
import type { BrowserNotificationPermission } from '../lib/study-notifications';
import { buildWeeklyStudyDigest } from '../lib/study-features';
import type { ThemeMode } from '../lib/theme';

interface ProfilePoliciesViewProps {
  locale: LocaleCode;
  theme?: ThemeMode;
  themeSyncWithOs?: boolean;
  onToggleThemeSyncWithOs?: (nextSyncWithOs: boolean) => void;
  onSelectManualTheme?: (manualTheme: ThemeMode) => void;
  user: UserSummary | null;
  courses: CourseCatalogItem[];
  catalogLoading?: boolean;
  enrollments: EnrollmentRecord[];
  xpLedger?: XpLedgerEntry[];
  bookmarkBusyId: string | null;
  swStatus: ServiceWorkerAvailability;
  cachedEditionKeys: ReadonlySet<string>;
  goalNotificationsEnabled: boolean;
  notificationPermission: BrowserNotificationPermission;
  onToggleGoalNotifications: (nextEnabled: boolean) => Promise<{
    enabled: boolean;
    permission: BrowserNotificationPermission;
    error?: string;
  }>;
  onSendTestNotification: () => Promise<{ sent: boolean; reason?: string }>;
  onClearCourseCache: (courseId: string, editionLocale: LocaleCode) => Promise<void>;
  onToggleBookmark: (courseId: string) => Promise<void>;
  onOpenBookmarkedCourse: (courseId: string, openLocale: LocaleCode) => void;
  onUpdateProfile: (patch: {
    displayName: string;
    preferredLocale: LocaleCode;
    timezone: string;
    leaderboardOptIn: boolean;
    leaderboardPseudonym: string;
    weeklyDigestEmailEnabled?: boolean;
  }) => Promise<void>;
  onToggleWeeklyDigestEmail?: (enabled: boolean) => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onRequireAuth: () => void;
}

export const ProfilePoliciesView: React.FC<ProfilePoliciesViewProps> = ({
  locale,
  theme = 'dark',
  themeSyncWithOs = false,
  onToggleThemeSyncWithOs,
  onSelectManualTheme,
  user,
  courses,
  catalogLoading = false,
  enrollments,
  xpLedger = [],
  bookmarkBusyId,
  swStatus,
  cachedEditionKeys,
  goalNotificationsEnabled,
  notificationPermission,
  onToggleGoalNotifications,
  onSendTestNotification,
  onClearCourseCache,
  onToggleBookmark,
  onOpenBookmarkedCourse,
  onUpdateProfile,
  onToggleWeeklyDigestEmail,
  onAccountDeleted,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [preferredLocale, setPreferredLocale] = useState<LocaleCode>(user?.preferredLocale || locale);
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Tashkent');
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(user?.leaderboardOptIn || false);
  const [pseudonym, setPseudonym] = useState(user?.leaderboardPseudonym || '');
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState<boolean>(
    Boolean(user?.weeklyDigestEmailEnabled)
  );
  const [digestBusy, setDigestBusy] = useState(false);
  const [digestMsg, setDigestMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [cacheStatusMsg, setCacheStatusMsg] = useState<string | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const weeklyDigest = useMemo(
    () =>
      buildWeeklyStudyDigest({
        xpLedger,
        enrollments,
        courses,
        locale,
      }),
    [xpLedger, enrollments, courses, locale]
  );

  const handleToggleDigestEmail = async () => {
    const next = !weeklyDigestEnabled;
    setWeeklyDigestEnabled(next);
    setDigestBusy(true);
    setDigestMsg(null);
    try {
      if (onToggleWeeklyDigestEmail) {
        await onToggleWeeklyDigestEmail(next);
      } else if (user) {
        await onUpdateProfile({
          displayName,
          preferredLocale,
          timezone,
          leaderboardOptIn,
          leaderboardPseudonym: pseudonym,
          weeklyDigestEmailEnabled: next,
        });
      }
      setDigestMsg(
        next
          ? locale === 'uz'
            ? 'Haftalik o‘quv xulosasi (Email Digest) yoqildi.'
            : 'Weekly email study summary enabled for your account.'
          : locale === 'uz'
          ? 'Haftalik email xulosasi o‘chirildi.'
          : 'Weekly email study summary turned off.'
      );
    } finally {
      setDigestBusy(false);
    }
  };

  const cachedCourses = useMemo(
    () => resolveCachedCourseDetails(cachedEditionKeys, courses),
    [cachedEditionKeys, courses]
  );

  const bookmarkedCourses = useMemo(
    () =>
      resolveBookmarkedCourses({
        bookmarkedIds: user?.bookmarkedCourseIds ?? [],
        courses,
        locale,
        enrollments,
      }),
    [user?.bookmarkedCourseIds, courses, locale, enrollments]
  );

  const handleClearCourseCache = async (entry: CachedCourseEntry) => {
    setClearingKey(entry.key);
    setCacheStatusMsg(null);
    try {
      await onClearCourseCache(entry.courseId, entry.locale);
      setCacheStatusMsg(strings.offlineManager.clearedNotice);
    } finally {
      setClearingKey(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    await onUpdateProfile({
      displayName,
      preferredLocale,
      timezone,
      leaderboardOptIn,
      leaderboardPseudonym: pseudonym,
    });
    setStatusMsg(strings.profile.savedStatus);
  };

  const handleExport = async () => {
    const res = await apiFetch('/api/me/export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `econova-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    const res = await apiFetch('/api/me/account', { method: 'DELETE' });
    const out = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatusMsg(out.error || strings.profile.deleteError);
      return;
    }
    await onAccountDeleted();
  };

  const notificationsActive =
    goalNotificationsEnabled && notificationPermission === 'granted';

  const handleToggleNotifications = async () => {
    setNotifBusy(true);
    setNotifMsg(null);
    try {
      const next = !goalNotificationsEnabled;
      const result = await onToggleGoalNotifications(next);
      if (result.error) {
        setNotifMsg({ kind: 'error', text: result.error });
      } else if (result.enabled) {
        setNotifMsg({ kind: 'info', text: strings.notifications.enabledNotice });
      } else {
        setNotifMsg({ kind: 'info', text: strings.notifications.disabledNotice });
      }
    } catch (err) {
      setNotifMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not update notification preferences.',
      });
    } finally {
      setNotifBusy(false);
    }
  };

  const handleTestNotification = async () => {
    setNotifBusy(true);
    setNotifMsg(null);
    try {
      const res = await onSendTestNotification();
      if (res.sent) {
        setNotifMsg({ kind: 'info', text: strings.notifications.testSent });
      } else {
        setNotifMsg({
          kind: 'error',
          text: res.reason || strings.notifications.deniedHelp,
        });
      }
    } finally {
      setNotifBusy(false);
    }
  };

  const rawBookmarkCount = user?.bookmarkedCourseIds?.length ?? 0;

  const bookmarksSection = (
    <section
      aria-labelledby="bookmarked-courses-title"
      className="space-y-4 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
      data-testid="profile-bookmarks-section"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2
            id="bookmarked-courses-title"
            className="flex items-center gap-2 text-base font-semibold text-ink"
          >
            <Bookmark className="h-4 w-4 text-accent fill-accent" aria-hidden="true" />
            <span>{strings.bookmarks.sectionTitle}</span>
          </h2>
          <p className="mt-1 text-xs text-muted">{strings.bookmarks.sectionSubtitle}</p>
        </div>
        {user && (
          <span
            className="font-mono text-xs tabular-nums text-muted"
            aria-live="polite"
            data-testid="profile-bookmarks-count"
          >
            {rawBookmarkCount === 1
              ? strings.bookmarks.countSingular
              : `${rawBookmarkCount} ${strings.bookmarks.countPlural}`}
          </span>
        )}
      </div>

      {!user ? (
        <div className="rounded-lg border border-line bg-chrome p-4 text-xs text-muted">
          {strings.bookmarks.emptyGuest}
        </div>
      ) : catalogLoading && rawBookmarkCount > 0 && bookmarkedCourses.length === 0 ? (
        <div className="rounded-lg border border-line bg-chrome p-4 text-xs text-muted">
          {locale === 'uz' ? 'Saqlangan kurslar yuklanmoqda...' : 'Loading bookmarked courses...'}
        </div>
      ) : bookmarkedCourses.length === 0 ? (
        <div
          className="rounded-lg border border-line bg-chrome p-4 text-xs text-muted"
          data-testid="profile-bookmarks-empty"
        >
          {strings.bookmarks.emptyAuthenticated}
        </div>
      ) : (
        <ul className="space-y-2.5" aria-label={strings.bookmarks.sectionTitle}>
          {bookmarkedCourses.map((item) => (
            <li
              key={item.courseId}
              data-testid={`profile-bookmark-item-${item.courseId}`}
              className="flex flex-col gap-3 rounded-lg border border-line bg-chrome p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span>
                    {strings.subjects[item.subject]} · {strings.levels[item.level]} · {item.estimatedMinutes} min
                  </span>
                  {item.enrollment && (
                    <span className="font-medium text-teal">
                      · {strings.journey[item.enrollment.journeyStatus]}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-ink">{item.title}</h3>
                {item.subtitle && (
                  <p className="mt-0.5 text-xs text-muted line-clamp-1">{item.subtitle}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBookmarkedCourse(item.courseId, item.openLocale)}
                  data-testid={`profile-bookmark-open-${item.courseId}`}
                  className="min-h-[38px] rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover whitespace-nowrap"
                >
                  {strings.bookmarks.openCourse}
                </button>
                <button
                  type="button"
                  disabled={bookmarkBusyId === item.courseId}
                  onClick={() => void onToggleBookmark(item.courseId)}
                  aria-label={`${strings.bookmarks.removeLabel}: ${item.title}`}
                  aria-pressed={true}
                  data-testid={`profile-bookmark-remove-${item.courseId}`}
                  className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-accent/60 bg-accent/15 text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
                >
                  <Bookmark className="h-4 w-4 fill-current" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const weeklyDigestSection = (
    <section
      aria-labelledby="weekly-study-digest-title"
      data-testid="weekly-study-digest-section"
      className="space-y-4 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-theme-border pb-3">
        <div>
          <h2
            id="weekly-study-digest-title"
            className="flex items-center gap-2 text-base font-bold text-ink"
          >
            <CalendarRange className="h-4 w-4 text-theme-accent" aria-hidden="true" />
            <span>
              {locale === 'uz' ? 'Haftalik o‘quv xulosasi (7 kun)' : 'Weekly Study Digest'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted">
            {locale === 'uz'
              ? 'So‘nggi 7 kun davomida to‘plangan XP va yakunlangan kurslar ko‘rsatkichi.'
              : 'Summary of total non-cash XP earned and courses completed over the last 7 days.'}
          </p>
        </div>
        <span className="font-mono text-xs text-theme-cyan">
          {weeklyDigest.windowStartIso.slice(0, 10)} → {weeklyDigest.windowEndIso.slice(0, 10)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border-2 border-theme-border bg-theme-base p-3.5">
          <div className="text-xs text-muted">
            {locale === 'uz' ? '7 kunlik jami XP' : 'Total XP (Last 7 Days)'}
          </div>
          <div
            data-testid="weekly-digest-xp-value"
            className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-theme-accent"
          >
            +{weeklyDigest.weeklyXpEarned} XP
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {weeklyDigest.weeklyEventsCount}{' '}
            {locale === 'uz' ? 'ta tasdiqlangan o‘quv harakati' : 'verified learning events'}
          </div>
        </div>

        <div className="rounded-lg border-2 border-theme-border bg-theme-base p-3.5">
          <div className="text-xs text-muted">
            {locale === 'uz' ? 'Yakunlangan kurslar (7 kun)' : 'Completed Courses (7 Days)'}
          </div>
          <div
            data-testid="weekly-digest-completed-courses"
            className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-theme-cyan"
          >
            {weeklyDigest.completedCoursesCount}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {weeklyDigest.completedCoursesCount > 0
              ? weeklyDigest.completedCourses.map((c) => c.title).join(', ')
              : locale === 'uz'
              ? 'So‘nggi 7 kunda yakunlangan kurs yo‘q'
              : 'No courses finished in the past 7 days'}
          </div>
        </div>

        <div className="rounded-lg border-2 border-theme-border bg-theme-base p-3.5">
          <div className="text-xs text-muted">
            {locale === 'uz' ? 'Faol o‘quv kunlari' : 'Active Study Days'}
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-ink">
            {weeklyDigest.activeDaysCount} / 7
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {locale === 'uz' ? 'Sinxronlangan qaydlar: ' : 'Synced Quick Notes: '}
            {Object.keys(user?.lessonNotes ?? {}).length}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border-2 border-theme-border bg-theme-base p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div id="weekly-digest-email-label" className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Mail className="h-4 w-4 text-theme-cyan" aria-hidden="true" />
            <span>
              {locale === 'uz'
                ? 'Haftalik xulosani email orqali olish'
                : 'Email-Based Weekly Study Summary'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {user
              ? locale === 'uz'
                ? `Har dushanba kuni ${user.email} manziliga 7 kunlik XP va kurs natijalari yuboriladi.`
                : `Receive a weekly digest of your 7-day XP and completed courses at ${user.email}.`
              : locale === 'uz'
              ? 'Haftalik email xulosasini yoqish uchun hisobingizga kiring.'
              : 'Sign in to enable weekly email study summaries for your learner account.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={weeklyDigestEnabled}
          aria-labelledby="weekly-digest-email-label"
          disabled={digestBusy}
          onClick={() => {
            if (!user) {
              onRequireAuth();
              return;
            }
            void handleToggleDigestEmail();
          }}
          data-testid="weekly-digest-email-toggle"
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-theme-accent disabled:opacity-50 ${
            weeklyDigestEnabled
              ? 'border-theme-border bg-theme-accent'
              : 'border-theme-border bg-theme-panel'
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
              weeklyDigestEnabled
                ? 'translate-x-5 bg-theme-accent-ink'
                : 'translate-x-0.5 bg-muted'
            }`}
          />
        </button>
      </div>

      {digestMsg && (
        <p
          role="status"
          aria-live="polite"
          data-testid="weekly-digest-feedback"
          className="text-xs font-medium text-theme-cyan"
        >
          {digestMsg}
        </p>
      )}
    </section>
  );

  const themeSyncSection = (
    <section
      aria-labelledby="profile-theme-sync-title"
      data-testid="profile-theme-sync-section"
      className="space-y-4 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-theme-border pb-3">
        <div>
          <h2
            id="profile-theme-sync-title"
            className="flex items-center gap-2 text-base font-bold text-ink"
          >
            <Monitor className="h-4 w-4 text-theme-cyan" aria-hidden="true" />
            <span>
              {locale === 'uz'
                ? 'Mavzu va operatsion tizim (OS) bilan sinxronizatsiya'
                : 'Theme & OS Preference Synchronization'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted">
            {locale === 'uz'
              ? 'ECONOVA mavzusini qurilmangizning prefers-color-scheme sozlamasi bilan avtomatik moslashtiring yoki yuqori panel orqali qo‘lda boshqaring.'
              : 'Automatically synchronize the ECONOVA theme with your OS preference (prefers-color-scheme), while keeping manual override via the header toggle.'}
          </p>
        </div>

        <span
          data-testid="profile-theme-sync-status"
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-xs font-bold text-theme-cyan"
        >
          {themeSyncWithOs
            ? locale === 'uz'
              ? `OS bilan avto-sinxron (${theme.toUpperCase()})`
              : `Synced with OS (${theme.toUpperCase()})`
            : locale === 'uz'
            ? `Qo‘lda tanlangan (${theme.toUpperCase()})`
            : `Manual Override (${theme.toUpperCase()})`}
        </span>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border-2 border-theme-border bg-theme-base p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div id="theme-sync-os-label" className="text-sm font-semibold text-ink">
            {locale === 'uz'
              ? 'OS rang sxemasi bilan avtomatik sinxronlash (prefers-color-scheme)'
              : 'Sync Theme with OS Preference (prefers-color-scheme)'}
          </div>
          <p className="mt-1 text-xs text-muted">
            {locale === 'uz'
              ? 'Yoqilganda tizimingiz Tungi yoki Yorug‘ rejimga o‘zgarganda platforma avtomatik moslashadi. Yuqori paneldagi tugma istalgan vaqtda qo‘lda o‘zgartirish imkonini beradi.'
              : 'When enabled, ECONOVA automatically follows your operating system Dark or Light mode. Clicking the header theme button anytime applies a manual override.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border-2 border-theme-border bg-theme-panel p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onSelectManualTheme?.('dark')}
              data-testid="theme-manual-dark-btn"
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                !themeSyncWithOs && theme === 'dark'
                  ? 'bg-theme-accent text-theme-accent-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Tungi' : 'Dark'}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectManualTheme?.('light')}
              data-testid="theme-manual-light-btn"
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                !themeSyncWithOs && theme === 'light'
                  ? 'bg-theme-accent text-theme-accent-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Yorug‘' : 'Light'}</span>
            </button>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={themeSyncWithOs}
            aria-labelledby="theme-sync-os-label"
            onClick={() => onToggleThemeSyncWithOs?.(!themeSyncWithOs)}
            data-testid="theme-sync-os-toggle"
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-theme-accent ${
              themeSyncWithOs
                ? 'border-theme-border bg-theme-cyan'
                : 'border-theme-border bg-theme-panel'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                themeSyncWithOs
                  ? 'translate-x-5 bg-theme-base'
                  : 'translate-x-0.5 bg-muted'
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      {themeSyncSection}
      {weeklyDigestSection}
      {user && bookmarksSection}

      {user ? (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
          <div className="border-b border-line pb-3">
            <h1 className="text-xl font-semibold text-ink">{strings.profile.title}</h1>
            <p className="mt-1 text-xs text-muted">
              {strings.profile.subtitle}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prof-name" className="block text-xs text-muted">{strings.profile.displayNameLabel}</label>
              <input
                id="prof-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-line bg-chrome px-3 text-sm text-ink"
              />
            </div>
            <div>
              <label htmlFor="prof-locale" className="block text-xs text-muted">{strings.profile.preferredLanguageLabel}</label>
              <select
                id="prof-locale"
                value={preferredLocale}
                onChange={(e) => setPreferredLocale(e.target.value as LocaleCode)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-line bg-chrome px-3 text-sm text-ink"
              >
                <option value="en">English (en)</option>
                <option value="uz">O‘zbekcha (uz)</option>
              </select>
            </div>
            <div>
              <label htmlFor="prof-tz" className="block text-xs text-muted">{strings.profile.timezoneLabel}</label>
              <select
                id="prof-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-line bg-chrome px-3 text-sm text-ink"
              >
                <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label htmlFor="prof-pseudo" className="block text-xs text-muted">{strings.profile.pseudonymLabel}</label>
              <input
                id="prof-pseudo"
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-line bg-chrome px-3 text-sm text-ink"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={leaderboardOptIn}
              onChange={(e) => setLeaderboardOptIn(e.target.checked)}
              className="accent-teal"
            />
            <span>{strings.profile.optInLeaderboardLabel}</span>
          </label>

          {statusMsg && <p className="text-xs text-teal">{statusMsg}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
            >
              {strings.profile.savePreferences}
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-3.5 py-2 text-xs text-ink"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{strings.profile.exportDataJson}</span>
              </button>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-danger/50 bg-danger-surface/30 px-3.5 py-2 text-xs text-danger-text"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{strings.profile.deleteAccount}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="min-h-[40px] rounded-lg bg-danger px-3.5 py-2 text-xs font-semibold text-white"
                >
                  {strings.profile.confirmPermanentDelete}
                </button>
              )}
            </div>
          </div>
        </form>
      ) : (
        <section className="rounded-xl border-2 border-slate-500 bg-white/40 p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
          <h1 className="text-xl font-semibold text-ink">{strings.profile.guestTitle}</h1>
          <p className="mt-2 text-sm text-muted">
            {strings.profile.guestSubtitle}
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-4 min-h-[42px] rounded-lg border-2 border-theme-border bg-accent px-5 py-2 text-xs font-semibold text-accent-ink shadow-brutal-sm hover:bg-accent-hover"
          >
            {strings.signIn}
          </button>
        </section>
      )}

      {!user && bookmarksSection}

      {/* Study Goal Push Notifications */}
      <section
        aria-labelledby="study-goal-notifications-title"
        className="space-y-4 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
        data-testid="study-goal-notifications-section"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
          <div>
            <h2
              id="study-goal-notifications-title"
              className="flex items-center gap-2 text-base font-semibold text-ink"
            >
              {notificationsActive ? (
                <Bell className="h-4 w-4 text-teal" aria-hidden="true" />
              ) : (
                <BellOff className="h-4 w-4 text-muted" aria-hidden="true" />
              )}
              <span>{strings.notifications.title}</span>
            </h2>
            <p className="mt-1 text-xs text-muted">{strings.notifications.subtitle}</p>
          </div>

          <span
            className={`font-mono text-xs font-medium ${
              notificationPermission === 'unsupported' || notificationPermission === 'denied'
                ? 'text-warning'
                : notificationsActive
                ? 'text-success'
                : 'text-muted'
            }`}
            data-testid="notification-permission-status"
          >
            {notificationPermission === 'unsupported'
              ? strings.notifications.statusUnsupported
              : notificationPermission === 'denied'
              ? strings.notifications.statusDenied
              : goalNotificationsEnabled && notificationPermission === 'granted'
              ? strings.notifications.statusActive
              : goalNotificationsEnabled
              ? strings.notifications.statusPermissionNeeded
              : strings.notifications.statusOff}
          </span>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-line bg-chrome p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div id="goal-notif-switch-label" className="text-sm font-medium text-ink">
              {strings.notifications.toggleLabel}
            </div>
            <p className="mt-1 text-xs text-muted">{strings.notifications.toggleHint}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {notificationsActive && (
              <button
                type="button"
                disabled={notifBusy}
                onClick={() => void handleTestNotification()}
                className="min-h-[36px] rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-ink hover:border-teal/50 disabled:opacity-50"
              >
                {strings.notifications.testButton}
              </button>
            )}

            <button
              type="button"
              role="switch"
              aria-checked={goalNotificationsEnabled}
              aria-labelledby="goal-notif-switch-label"
              disabled={notifBusy || notificationPermission === 'unsupported'}
              onClick={() => void handleToggleNotifications()}
              data-testid="study-goal-notifications-switch"
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                goalNotificationsEnabled
                  ? 'border-teal bg-teal'
                  : 'border-line-strong bg-elevated'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                  goalNotificationsEnabled
                    ? 'translate-x-6 bg-teal-ink'
                    : 'translate-x-1 bg-muted'
                }`}
              />
            </button>
          </div>
        </div>

        {notificationPermission === 'denied' && (
          <p role="alert" className="text-xs text-warning">
            {strings.notifications.deniedHelp}
          </p>
        )}

        {notificationPermission === 'unsupported' && (
          <p className="text-xs text-muted">{strings.notifications.unsupportedHelp}</p>
        )}

        {notifMsg && (
          <p
            role={notifMsg.kind === 'error' ? 'alert' : 'status'}
            className={`text-xs font-medium ${
              notifMsg.kind === 'error' ? 'text-danger-text' : 'text-teal'
            }`}
            data-testid="notification-feedback-msg"
          >
            {notifMsg.text}
          </p>
        )}
      </section>

      {/* Offline Cache Manager */}
      <section
        aria-labelledby="offline-cache-manager-title"
        className="space-y-4 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
          <div>
            <h2
              id="offline-cache-manager-title"
              className="flex items-center gap-2 text-base font-semibold text-ink"
            >
              <HardDrive className="h-4 w-4 text-teal" aria-hidden="true" />
              <span>{strings.offlineManager.title}</span>
            </h2>
            <p className="mt-1 text-xs text-muted">{strings.offlineManager.subtitle}</p>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted" aria-live="polite">
            {cachedCourses.length === 1
              ? strings.offlineManager.storedCountSingular
              : `${cachedCourses.length} ${strings.offlineManager.storedCountPlural}`}
          </span>
        </div>

        {cacheStatusMsg && (
          <p className="text-xs font-medium text-teal" role="status" aria-live="polite">
            {cacheStatusMsg}
          </p>
        )}

        {swStatus === 'unsupported' || swStatus === 'error' ? (
          <div className="rounded-lg border border-line bg-chrome p-4 text-xs text-muted">
            {strings.offlineManager.unavailable}
          </div>
        ) : cachedCourses.length === 0 ? (
          <div className="rounded-lg border border-line bg-chrome p-4 text-xs text-muted">
            {strings.offlineManager.empty}
          </div>
        ) : (
          <ul className="space-y-2.5" aria-label={strings.offlineManager.title}>
            {cachedCourses.map((item) => (
              <li
                key={item.key}
                data-cached-course-key={item.key}
                className="flex flex-col gap-3 rounded-lg border border-line bg-chrome p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                    <span className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>{strings.catalog.offlineCached}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {[
                      item.subject ? strings.subjects[item.subject] : null,
                      item.level ? strings.levels[item.level] : null,
                      item.locale === 'uz' ? 'O‘Z' : 'EN',
                      item.estimatedMinutes ? `${item.estimatedMinutes} min` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={clearingKey === item.key}
                  onClick={() => void handleClearCourseCache(item)}
                  aria-label={`${strings.offlineManager.clearButton}: ${item.title} (${item.locale.toUpperCase()})`}
                  className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-danger/50 bg-danger-surface/30 px-3.5 py-1.5 text-xs font-medium text-danger-text transition-colors hover:bg-danger-surface/50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {clearingKey === item.key
                      ? strings.offlineManager.clearing
                      : strings.offlineManager.clearButton}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Policies, Privacy, Age Safeguards & Disclosures */}
      <section className="space-y-4 rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Shield className="h-4 w-4 text-teal" aria-hidden="true" />
          <span>{strings.profile.policiesTitle}</span>
        </h2>

        <div className="grid gap-4 md:grid-cols-2 text-xs leading-relaxed text-muted">
          <div className="rounded-lg border border-line bg-chrome p-4">
            <h3 className="font-semibold text-ink">{strings.profile.policyPrivacyTitle}</h3>
            <p className="mt-1">{strings.profile.policyPrivacyBody}</p>
          </div>
          <div className="rounded-lg border border-line bg-chrome p-4">
            <h3 className="font-semibold text-ink">{strings.profile.policyNonCashTitle}</h3>
            <p className="mt-1">{strings.nonCashNotice}</p>
          </div>
          <div className="rounded-lg border border-line bg-chrome p-4">
            <h3 className="font-semibold text-ink">{strings.profile.policyCertificatesTitle}</h3>
            <p className="mt-1">{strings.nonAccreditationNotice}</p>
          </div>
          <div className="rounded-lg border border-line bg-chrome p-4">
            <h3 className="font-semibold text-ink">{strings.profile.policyEditorialTitle}</h3>
            <p className="mt-1">{strings.profile.policyEditorialBody}</p>
          </div>
        </div>
      </section>
    </div>
  );
};
