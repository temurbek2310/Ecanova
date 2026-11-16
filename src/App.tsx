import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Flame,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Shield,
  SlidersHorizontal,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { AchievementsView } from './components/AchievementsView';
import { AdminStudioView } from './components/AdminStudioView';
import { AiCompanionPanel } from './components/AiCompanionPanel';
import { AssessmentView } from './components/AssessmentView';
import { AuthModal } from './components/AuthModal';
import { CertificatesView } from './components/CertificatesView';
import { CommunityView } from './components/CommunityView';
import { LessonPlayer } from './components/LessonPlayer';
import { OfflineBanner } from './components/OfflineBanner';
import { ProfilePoliciesView } from './components/ProfilePoliciesView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { t } from './lib/i18n';
import type {
  BadgeAward,
  CertificateRecord,
  CourseCatalogItem,
  CourseDetailResponse,
  CourseLevel,
  EnrollmentRecord,
  LeaderboardEntry,
  LocaleCode,
  StreakSummary,
  Subject,
  UserSummary,
  XpLedgerEntry,
} from './shared/types';

type NavTab =
  | 'overview'
  | 'catalog'
  | 'course'
  | 'achievements'
  | 'community'
  | 'certificates'
  | 'profile'
  | 'admin';

export default function App() {
  const [locale, setLocale] = useState<LocaleCode>('en');
  const strings = t(locale);

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(false);

  // Catalog & filters
  const [courses, setCourses] = useState<CourseCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'ALL'>('ALL');
  const [levelFilter, setLevelFilter] = useState<CourseLevel | 'ALL'>('ALL');

  // Selected course detail workspace
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetailResponse | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState<number | 'assessment'>(0);

  // User & protected state
  const [user, setUser] = useState<UserSummary | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [xpToday, setXpToday] = useState(0);
  const [xpLedger, setXpLedger] = useState<XpLedgerEntry[]>([]);
  const [streak, setStreak] = useState<StreakSummary>({
    currentStreak: 0,
    bestStreak: 0,
    lastActivityLocalDate: null,
    timezone: 'Asia/Tashkent',
  });
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);

  // Community & referrals
  const [cohortName, setCohortName] = useState('Active Weekly Study Cohort');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralsCount, setReferralsCount] = useState(0);
  const [claimedReferralCode, setClaimedReferralCode] = useState<string | null>(null);

  // Runtime capability flags from server (/api/health — booleans only, never secrets)
  const [health, setHealth] = useState<{
    aiConfigured: boolean;
    databaseConfigured: boolean;
    sandboxEnabled: boolean;
  }>({
    aiConfigured: false,
    databaseConfigured: true,
    sandboxEnabled: false,
  });

  // Deep link verification token (?verify=...)
  const [verifyTokenFromUrl, setVerifyTokenFromUrl] = useState<string | null>(null);

  const isStaff = Boolean(
    user && ['editor', 'reviewer', 'publisher', 'admin'].includes(user.role)
  );

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = (await res.json()) as {
          aiConfigured?: boolean;
          databaseConfigured?: boolean;
          sandboxEnabled?: boolean;
        };
        setHealth({
          aiConfigured: Boolean(data.aiConfigured),
          databaseConfigured: data.databaseConfigured !== false,
          sandboxEnabled: Boolean(data.sandboxEnabled),
        });
      }
    } catch {
      // Offline or unreachable
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Unable to load course catalog.');
      }
      const data = (await res.json()) as { courses: CourseCatalogItem[] };
      setCourses(data.courses);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Catalog load failed.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboards');
      if (res.ok) {
        const data = (await res.json()) as {
          cohortName: string;
          entries: LeaderboardEntry[];
        };
        setCohortName(data.cohortName);
        setLeaderboard(data.entries);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const loadProtectedData = useCallback(async () => {
    try {
      const [ovRes, certRes, refRes] = await Promise.all([
        fetch('/api/me/overview'),
        fetch('/api/me/certificates'),
        fetch('/api/me/referrals'),
      ]);
      if (ovRes.ok) {
        const ov = (await ovRes.json()) as {
          enrollments: EnrollmentRecord[];
          totalXp: number;
          xpToday: number;
          xpLedger: XpLedgerEntry[];
          streak: StreakSummary;
          badges: BadgeAward[];
        };
        setEnrollments(ov.enrollments);
        setTotalXp(ov.totalXp);
        setXpToday(ov.xpToday);
        setXpLedger(ov.xpLedger);
        setStreak(ov.streak);
        setBadges(ov.badges);
      }
      if (certRes.ok) {
        const cData = (await certRes.json()) as { certificates: CertificateRecord[] };
        setCertificates(cData.certificates);
      }
      if (refRes.ok) {
        const rData = (await refRes.json()) as {
          myCode: string;
          referralsCount: number;
          claimedByMe: { code: string } | null;
        };
        setReferralCode(rData.myCode);
        setReferralsCount(rData.referralsCount);
        setClaimedReferralCode(rData.claimedByMe?.code ?? null);
      }
    } catch {
      // Offline or unauthenticated
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = (await res.json()) as { user: UserSummary | null };
        setUser(data.user);
        if (data.user) {
          await loadProtectedData();
        } else {
          setEnrollments([]);
          setCertificates([]);
          setXpLedger([]);
          setTotalXp(0);
          setBadges([]);
        }
      }
    } catch {
      // Ignore offline auth probe error
    }
  }, [loadProtectedData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get('verify');
    if (verifyParam) {
      setVerifyTokenFromUrl(verifyParam);
      setActiveTab('certificates');
    }
    loadHealth();
    loadCatalog();
    loadSession();
    loadLeaderboard();
  }, [loadHealth, loadCatalog, loadSession, loadLeaderboard]);

  const openCourse = useCallback(
    async (courseId: string, editionLocale: LocaleCode = locale) => {
      setSelectedCourseId(courseId);
      setActiveTab('course');
      setCourseLoading(true);
      setCourseError(null);
      setActiveLessonIndex(0);
      try {
        const res = await fetch(`/api/courses/${courseId}/editions/${editionLocale}`);
        const data = (await res.json()) as CourseDetailResponse & { error?: string };
        if (!res.ok) {
          setCourseDetail(null);
          throw new Error(data.error || strings.editionMissingNote);
        }
        setCourseDetail(data);
        if (user) {
          await fetch('/api/enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, locale: editionLocale }),
          });
          await loadProtectedData();
        }
      } catch (err) {
        setCourseError(err instanceof Error ? err.message : 'Unable to load course.');
      } finally {
        setCourseLoading(false);
      }
    },
    [locale, strings.editionMissingNote, user, loadProtectedData]
  );

  // Reload selected course when switching global language edition
  const handleLocaleSwitch = (nextLocale: LocaleCode) => {
    setLocale(nextLocale);
    if (activeTab === 'course' && selectedCourseId) {
      openCourse(selectedCourseId, nextLocale);
    }
  };

  const handleCompleteLesson = async (lessonId: string) => {
    const res = await fetch(`/api/me/progress/${lessonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidence: 'study_and_simulation' }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Could not record completion.');
    await Promise.all([loadProtectedData(), loadLeaderboard()]);
  };

  const handlePauseToggle = async (courseId: string, paused: boolean) => {
    await fetch(`/api/enrollments/${courseId}/pause`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused }),
    });
    await loadProtectedData();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setEnrollments([]);
    setCertificates([]);
    setXpLedger([]);
    setTotalXp(0);
    setBadges([]);
    if (activeTab === 'admin') setActiveTab('overview');
  };

  const filteredCourses = courses.filter((c) => {
    if (subjectFilter !== 'ALL' && c.subject !== subjectFilter) return false;
    if (levelFilter !== 'ALL' && c.level !== levelFilter) return false;
    return true;
  });

  const activeEnrollment = selectedCourseId
    ? enrollments.find((e) => e.courseId === selectedCourseId)
    : undefined;

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: strings.nav.overview, icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> },
    { id: 'catalog', label: strings.nav.catalog, icon: <Compass className="h-4 w-4" aria-hidden="true" /> },
    { id: 'achievements', label: strings.nav.achievements, icon: <Flame className="h-4 w-4" aria-hidden="true" /> },
    { id: 'community', label: strings.nav.community, icon: <Trophy className="h-4 w-4" aria-hidden="true" /> },
    { id: 'certificates', label: strings.nav.certificates, icon: <Award className="h-4 w-4" aria-hidden="true" /> },
    { id: 'profile', label: strings.nav.profile, icon: <Shield className="h-4 w-4" aria-hidden="true" /> },
  ];

  if (isStaff) {
    navItems.push({
      id: 'admin',
      label: strings.nav.admin,
      icon: <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />,
    });
  }

  return (
    <div className="min-h-screen bg-[#080B14] text-[#F3F6FF] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="no-print hidden md:flex md:w-64 md:shrink-0 md:flex-col md:justify-between border-r border-[#222B3D] bg-[#0B0F19] p-4"
      >
        <div className="space-y-6">
          <div className="px-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="font-display text-xl font-bold tracking-tight text-[#F3F6FF] whitespace-nowrap"
            >
              ECONOVA
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id || (item.id === 'catalog' && activeTab === 'course');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#141B2B] text-[#5DE1D2]'
                      : 'text-[#8994AA] hover:bg-[#101522] hover:text-[#F3F6FF]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-[#222B3D] pt-4">
          <button
            type="button"
            onClick={() => setCompanionOpen(true)}
            className="flex w-full min-h-[40px] items-center gap-2.5 rounded-lg border border-[#222B3D] bg-[#101522] px-3 py-2 text-xs font-medium text-[#F3F6FF] hover:border-[#5DE1D2]/50"
          >
            <MessageSquare className="h-4 w-4 text-[#5DE1D2]" aria-hidden="true" />
            <span>{locale === 'uz' ? 'O‘quv yordamchisi' : 'Study Companion'}</span>
          </button>

          <PWAInstallButton label={strings.installApp} />
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex flex-1 flex-col min-w-0 pb-20 md:pb-0">
        <OfflineBanner message={strings.offlineBanner} />

        {/* Clean 3-Zone Top Bar */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 sm:gap-4 border-b border-[#222B3D] bg-[#0B0F19]/95 px-3 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#222B3D] text-[#F3F6FF] md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="font-display text-base font-bold tracking-tight text-[#F3F6FF] whitespace-nowrap shrink-0 md:hidden"
            >
              ECONOVA
            </button>
            <span className="hidden text-xs font-medium text-[#8994AA] truncate md:inline">
              {activeTab === 'course' && courseDetail
                ? `${strings.subjects[courseDetail.course.subject]} / ${courseDetail.edition.title}`
                : navItems.find((n) => n.id === activeTab)?.label || 'ECONOVA'}
            </span>
          </div>

          {/* Language Edition Toggle (EN / O'Z) */}
          <div
            role="group"
            aria-label="Language Edition Switcher"
            className="flex items-center rounded-lg border border-[#222B3D] bg-[#101522] p-0.5 text-xs shrink-0"
          >
            <Globe className="ml-2 mr-1 hidden h-3.5 w-3.5 text-[#8994AA] sm:block" aria-hidden="true" />
            <button
              type="button"
              onClick={() => handleLocaleSwitch('en')}
              className={`min-h-[32px] rounded-md px-2 sm:px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
                locale === 'en' ? 'bg-[#141B2B] text-[#5DE1D2]' : 'text-[#8994AA] hover:text-[#F3F6FF]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleLocaleSwitch('uz')}
              className={`min-h-[32px] rounded-md px-2 sm:px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
                locale === 'uz' ? 'bg-[#141B2B] text-[#5DE1D2]' : 'text-[#8994AA] hover:text-[#F3F6FF]'
              }`}
            >
              O‘Z
            </button>
          </div>

          {/* Primary Account Action */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#222B3D] bg-[#101522] px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#F3F6FF] hover:border-[#9274FF]"
                >
                  <User className="h-3.5 w-3.5 text-[#9274FF] shrink-0" aria-hidden="true" />
                  <span className="max-w-[78px] sm:max-w-[120px] truncate">{user.displayName}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label={strings.signOut}
                  className="hidden sm:inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-[#222B3D] text-[#8994AA] hover:text-[#F3F6FF]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="min-h-[38px] rounded-lg bg-[#9274FF] px-3.5 sm:px-4 py-1.5 text-xs font-semibold text-[#080B14] hover:bg-[#a68dff] whitespace-nowrap"
              >
                {strings.signIn}
              </button>
            )}
          </div>
        </header>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="no-print border-b border-[#222B3D] bg-[#0B0F19] p-4 md:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                    activeTab === item.id
                      ? 'border-[#5DE1D2]/50 bg-[#141B2B] text-[#5DE1D2]'
                      : 'border-[#222B3D] bg-[#101522] text-[#8994AA]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCompanionOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#222B3D] bg-[#101522] px-3 py-2 text-xs font-medium text-[#F3F6FF]"
              >
                <MessageSquare className="h-4 w-4 text-[#5DE1D2]" aria-hidden="true" />
                <span>{locale === 'uz' ? 'Yordamchi' : 'Companion'}</span>
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#222B3D] bg-[#101522] px-3 py-2 text-xs font-medium text-[#8994AA]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>{strings.signOut}</span>
                </button>
              )}
            </nav>
            <div className="mt-3">
              <PWAInstallButton label={strings.installApp} />
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {/* OVERVIEW & DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <section className="rounded-2xl border border-[#222B3D] bg-[#101522] p-6 sm:p-8">
                <div className="max-w-3xl">
                  <div className="text-xs font-medium text-[#5DE1D2]">
                    {strings.subjects.Economics} · {strings.subjects.Mathematics} · {strings.subjects.Business}
                  </div>
                  <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#F3F6FF] sm:text-4xl [text-wrap:balance]">
                    {strings.heroTitle}
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-[#8994AA] sm:text-base">
                    {strings.heroSubtitle}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className="min-h-[44px] rounded-lg bg-[#9274FF] px-5 py-2.5 text-sm font-semibold text-[#080B14] hover:bg-[#a68dff]"
                    >
                      {strings.browseCatalog}
                    </button>
                    {!user && (
                      <button
                        type="button"
                        onClick={() => setAuthOpen(true)}
                        className="min-h-[44px] rounded-lg border border-[#222B3D] bg-[#141B2B] px-5 py-2.5 text-sm font-medium text-[#F3F6FF] hover:border-[#5DE1D2]/50"
                      >
                        {strings.signIn}
                      </button>
                    )}
                  </div>
                </div>

                {/* Learner Stats Strip (if signed in) */}
                {user && (
                  <div className="mt-8 grid grid-cols-2 gap-3 border-t border-[#222B3D] pt-6 sm:grid-cols-4">
                    <div className="rounded-lg bg-[#0B0F19]/75 p-3.5">
                      <div className="text-xs text-[#8994AA]">Active Courses</div>
                      <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#F3F6FF]">
                        {enrollments.length}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0B0F19]/75 p-3.5">
                      <div className="text-xs text-[#8994AA]">Study Streak</div>
                      <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#5DE1D2]">
                        {streak.currentStreak}d
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0B0F19]/75 p-3.5">
                      <div className="text-xs text-[#8994AA]">Non-Cash XP</div>
                      <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#FFC96B]">
                        {totalXp} XP
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0B0F19]/75 p-3.5">
                      <div className="text-xs text-[#8994AA]">Certificates</div>
                      <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#6FE0A1]">
                        {certificates.length}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Featured Courses Preview */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-[#F3F6FF]">
                    {locale === 'uz' ? 'Nashr etilgan kurslar' : 'Published Curriculum'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className="text-xs font-medium text-[#5DE1D2] hover:underline"
                  >
                    {locale === 'uz' ? 'Barchasini filtrlash' : 'Filter all courses'}
                  </button>
                </div>

                {catalogLoading ? (
                  <div className="rounded-xl border border-[#222B3D] bg-[#101522] p-6 text-sm text-[#8994AA]">
                    Loading published courses...
                  </div>
                ) : catalogError ? (
                  <div className="rounded-xl border border-rose-500/40 bg-[#101522] p-6 text-sm text-rose-200">
                    {catalogError}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {courses.map((course) => {
                      const ed = course.editions[locale];
                      const enr = enrollments.find((e) => e.courseId === course.id);
                      const pct =
                        enr && enr.requiredLessonIds.length > 0
                          ? Math.round(
                              ((enr.completedLessonIds.length + (enr.passedAssessment ? 1 : 0)) /
                                (enr.requiredLessonIds.length + 1)) *
                                100
                            )
                          : 0;

                      return (
                        <div
                          key={course.id}
                          className="flex flex-col justify-between rounded-xl border border-[#222B3D] bg-[#101522] p-5"
                        >
                          <div>
                            <div className="text-xs text-[#8994AA]">
                              {strings.subjects[course.subject]} · {strings.levels[course.level]} · {course.estimatedMinutes} min
                            </div>
                            <h3 className="mt-2 text-base font-semibold text-[#F3F6FF]">
                              {ed ? ed.title : course.editions.en?.title || course.slug}
                            </h3>
                            <p className="mt-1.5 text-xs leading-relaxed text-[#8994AA]">
                              {ed ? ed.subtitle : strings.editionMissingNote}
                            </p>
                          </div>

                          <div className="mt-5 space-y-3 border-t border-[#222B3D] pt-3">
                            {enr && (
                              <div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-[#5DE1D2]">{strings.journey[enr.journeyStatus]}</span>
                                  <span className="font-mono tabular-nums text-[#8994AA]">{pct}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#080B14]">
                                  <div className="h-full bg-[#9274FF]" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={!ed}
                              onClick={() => openCourse(course.id, locale)}
                              className="min-h-[40px] w-full rounded-lg bg-[#141B2B] border border-[#222B3D] px-3 py-2 text-xs font-semibold text-[#F3F6FF] hover:border-[#9274FF] disabled:opacity-50"
                            >
                              {ed
                                ? enr
                                  ? strings.continueLearning
                                  : locale === 'uz'
                                  ? 'Kursni ochish'
                                  : 'Open Course'
                                : locale === 'uz'
                                ? 'Nashr kutilmoqda'
                                : 'Edition Unavailable'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* COURSE CATALOG */}
          {activeTab === 'catalog' && (
            <div className="space-y-6">
              <header className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
                <h1 className="text-xl font-semibold text-[#F3F6FF] sm:text-2xl">
                  {locale === 'uz' ? 'Kurslar katalogi' : 'Course Catalog'}
                </h1>
                <p className="mt-1 text-xs text-[#8994AA]">
                  Subjects: Economics, Mathematics, Business · Difficulty Levels: Beginner, Intermediate, Advanced. Progressing reflects ongoing learner status, not a fourth difficulty level.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-1 text-xs">
                    {(['ALL', 'Economics', 'Mathematics', 'Business'] as const).map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSubjectFilter(sub)}
                        className={`min-h-[34px] rounded-md px-3 py-1 font-medium whitespace-nowrap ${
                          subjectFilter === sub ? 'bg-[#141B2B] text-[#5DE1D2]' : 'text-[#8994AA] hover:text-[#F3F6FF]'
                        }`}
                      >
                        {sub === 'ALL' ? strings.allSubjects : strings.subjects[sub]}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-1 text-xs">
                    {(['ALL', 'Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLevelFilter(lvl)}
                        className={`min-h-[34px] rounded-md px-3 py-1 font-medium whitespace-nowrap ${
                          levelFilter === lvl ? 'bg-[#141B2B] text-[#9274FF]' : 'text-[#8994AA] hover:text-[#F3F6FF]'
                        }`}
                      >
                        {lvl === 'ALL' ? strings.allLevels : strings.levels[lvl]}
                      </button>
                    ))}
                  </div>
                </div>
              </header>

              {filteredCourses.length === 0 ? (
                <div className="rounded-xl border border-[#222B3D] bg-[#101522] p-8 text-center text-sm text-[#8994AA]">
                  No courses match this subject and difficulty filter.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredCourses.map((course) => {
                    const ed = course.editions[locale];
                    const hasEn = Boolean(course.editions.en);
                    const hasUz = Boolean(course.editions.uz);
                    const enr = enrollments.find((e) => e.courseId === course.id);

                    return (
                      <article
                        key={course.id}
                        className="flex flex-col justify-between rounded-xl border border-[#222B3D] bg-[#101522] p-5"
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8994AA]">
                            <span>
                              {strings.subjects[course.subject]} · {strings.levels[course.level]}
                            </span>
                            <span>
                              Editions: {hasEn ? 'EN' : ''}{hasEn && hasUz ? ' / ' : ''}{hasUz ? 'O‘Z' : ''}
                            </span>
                          </div>
                          <h2 className="mt-2 text-lg font-semibold text-[#F3F6FF]">
                            {ed ? ed.title : course.editions.en?.title || course.slug}
                          </h2>
                          <p className="mt-1.5 text-sm leading-relaxed text-[#8994AA]">
                            {ed ? ed.description : strings.editionMissingNote}
                          </p>
                          {ed && (
                            <div className="mt-3 text-xs text-[#8994AA]">
                              {ed.lessonCount} lessons · {ed.estimatedMinutes} min · Passing {ed.passingScorePercent}% · Dedicated course certificate
                            </div>
                          )}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#222B3D] pt-4">
                          {enr ? (
                            <span className="text-xs font-medium text-[#5DE1D2]">
                              {strings.journey[enr.journeyStatus]}
                            </span>
                          ) : (
                            <span className="text-xs text-[#8994AA]">Public preview available</span>
                          )}
                          <button
                            type="button"
                            disabled={!ed}
                            onClick={() => openCourse(course.id, locale)}
                            className="min-h-[40px] rounded-lg bg-[#9274FF] px-4 py-2 text-xs font-semibold text-[#080B14] hover:bg-[#a68dff] disabled:opacity-50"
                          >
                            {ed ? 'Open Course Edition' : 'Unavailable in Selected Language'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* COURSE DETAIL & LESSON WORKSPACE */}
          {activeTab === 'course' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="text-xs font-medium text-[#5DE1D2] hover:underline"
                >
                  ← {locale === 'uz' ? 'Kurslar katalogiga qaytish' : 'Back to Course Catalog'}
                </button>
                {activeEnrollment && activeEnrollment.journeyStatus !== 'completed' && (
                  <button
                    type="button"
                    onClick={() =>
                      handlePauseToggle(
                        activeEnrollment.courseId,
                        activeEnrollment.journeyStatus !== 'paused'
                      )
                    }
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#222B3D] bg-[#101522] px-3 py-1.5 text-xs text-[#8994AA] hover:text-[#F3F6FF]"
                  >
                    {activeEnrollment.journeyStatus === 'paused' ? (
                      <>
                        <PlayCircle className="h-3.5 w-3.5 text-[#5DE1D2]" aria-hidden="true" />
                        <span>Resume Journey</span>
                      </>
                    ) : (
                      <>
                        <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Pause Course</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {courseLoading ? (
                <div className="rounded-xl border border-[#222B3D] bg-[#101522] p-8 text-sm text-[#8994AA]">
                  Loading course edition...
                </div>
              ) : courseError || !courseDetail ? (
                <div className="rounded-xl border border-[#FFC96B]/40 bg-[#101522] p-6 text-sm text-[#FFC96B]">
                  {courseError || strings.editionMissingNote}
                </div>
              ) : (
                <>
                  {/* Course Metadata & Completion Criteria */}
                  <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8994AA]">
                      <span>
                        {strings.subjects[courseDetail.course.subject]} · {strings.levels[courseDetail.course.level]} ·{' '}
                        {courseDetail.edition.locale === 'uz' ? strings.editionUz : strings.editionEn} (v{courseDetail.edition.version})
                      </span>
                      {activeEnrollment && (
                        <span className="font-semibold text-[#5DE1D2]">
                          {strings.journey[activeEnrollment.journeyStatus]}
                        </span>
                      )}
                    </div>
                    <h1 className="mt-2 text-xl font-bold text-[#F3F6FF] sm:text-2xl">
                      {courseDetail.edition.title}
                    </h1>
                    <p className="mt-1.5 text-sm text-[#8994AA]">{courseDetail.edition.description}</p>

                    <div className="mt-4 grid gap-4 border-t border-[#222B3D] pt-4 text-xs md:grid-cols-3">
                      <div>
                        <div className="font-semibold text-[#F3F6FF]">Learning Outcomes</div>
                        <ul className="mt-1 space-y-1 text-[#8994AA]">
                          {courseDetail.edition.outcomes.map((o, i) => (
                            <li key={i}>• {o}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-[#F3F6FF]">Prerequisites</div>
                        <ul className="mt-1 space-y-1 text-[#8994AA]">
                          {courseDetail.edition.prerequisites.map((p, i) => (
                            <li key={i}>• {p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-[#F3F6FF]">Certificate Criteria</div>
                        <p className="mt-1 text-[#8994AA]">{courseDetail.edition.completionRules}</p>
                      </div>
                    </div>
                  </section>

                  {/* Syllabus + Active Lesson/Assessment Split */}
                  <div className="grid gap-6 lg:grid-cols-12">
                    <aside className="space-y-2 lg:col-span-4">
                      <div className="rounded-xl border border-[#222B3D] bg-[#101522] p-4">
                        <h2 className="text-xs font-semibold text-[#8994AA]">
                          {locale === 'uz' ? 'Kurs dasturi' : 'Course Syllabus'}
                        </h2>
                        <div className="mt-3 space-y-1.5">
                          {courseDetail.lessons.map((les, idx) => {
                            const done = activeEnrollment?.completedLessonIds.includes(les.id) ?? false;
                            const isSelected = activeLessonIndex === idx;
                            return (
                              <button
                                key={les.id}
                                type="button"
                                onClick={() => setActiveLessonIndex(idx)}
                                className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                  isSelected
                                    ? 'border-[#9274FF] bg-[#141B2B] text-[#F3F6FF]'
                                    : 'border-[#222B3D] bg-[#0B0F19] text-[#8994AA] hover:text-[#F3F6FF]'
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#5DE1D2]" aria-hidden="true" />
                                  <span className="truncate">{les.sequenceNum}. {les.title}</span>
                                </span>
                                {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6FE0A1]" aria-label="Completed" />}
                              </button>
                            );
                          })}

                          {courseDetail.assessment && (
                            <button
                              type="button"
                              onClick={() => setActiveLessonIndex('assessment')}
                              className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                activeLessonIndex === 'assessment'
                                  ? 'border-[#5DE1D2] bg-[#141B2B] text-[#F3F6FF]'
                                  : 'border-[#222B3D] bg-[#0B0F19] text-[#8994AA] hover:text-[#F3F6FF]'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-[#9274FF]" aria-hidden="true" />
                                <span className="truncate">
                                  {locale === 'uz' ? 'Yakuniy baholash' : 'Final Course Assessment'}
                                </span>
                              </span>
                              {activeEnrollment?.passedAssessment && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6FE0A1]" aria-label="Passed" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </aside>

                    <div className="lg:col-span-8">
                      {typeof activeLessonIndex === 'number' && courseDetail.lessons[activeLessonIndex] && (
                        <LessonPlayer
                          courseId={courseDetail.course.id}
                          lesson={courseDetail.lessons[activeLessonIndex]}
                          locale={courseDetail.edition.locale}
                          isCompleted={
                            activeEnrollment?.completedLessonIds.includes(
                              courseDetail.lessons[activeLessonIndex].id
                            ) ?? false
                          }
                          isAuthenticated={Boolean(user)}
                          onCompleteLesson={handleCompleteLesson}
                          onRequireAuth={() => setAuthOpen(true)}
                          onNextLesson={
                            activeLessonIndex + 1 < courseDetail.lessons.length
                              ? () => setActiveLessonIndex(activeLessonIndex + 1)
                              : undefined
                          }
                          onOpenAssessment={
                            courseDetail.assessment ? () => setActiveLessonIndex('assessment') : undefined
                          }
                        />
                      )}

                      {activeLessonIndex === 'assessment' && courseDetail.assessment && (
                        <AssessmentView
                          assessment={courseDetail.assessment}
                          locale={courseDetail.edition.locale}
                          isAuthenticated={Boolean(user)}
                          onRequireAuth={() => setAuthOpen(true)}
                          onAttemptCompleted={async () => {
                            await Promise.all([loadProtectedData(), loadLeaderboard()]);
                          }}
                          onViewCertificates={() => setActiveTab('certificates')}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ACHIEVEMENTS & NON-CASH XP */}
          {activeTab === 'achievements' && (
            <AchievementsView
              locale={locale}
              isAuthenticated={Boolean(user)}
              totalXp={totalXp}
              xpToday={xpToday}
              xpLedger={xpLedger}
              streak={streak}
              badges={badges}
              onRequireAuth={() => setAuthOpen(true)}
            />
          )}

          {/* COMMUNITY / OPT-IN LEADERBOARD & REFERRALS */}
          {activeTab === 'community' && (
            <CommunityView
              locale={locale}
              user={user}
              cohortName={cohortName}
              entries={leaderboard}
              referralCode={referralCode}
              referralsCount={referralsCount}
              claimedReferralCode={claimedReferralCode}
              onToggleLeaderboardOptIn={async (optIn, pseudonym) => {
                if (!user) return;
                const res = await fetch('/api/me/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    leaderboardOptIn: optIn,
                    leaderboardPseudonym: pseudonym,
                  }),
                });
                const data = (await res.json()) as { user?: UserSummary; error?: string };
                if (!res.ok || !data.user) throw new Error(data.error || 'Could not update.');
                setUser(data.user);
                await loadLeaderboard();
              }}
              onClaimReferral={async (code) => {
                const res = await fetch('/api/referrals/claim', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code }),
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) throw new Error(data.error || 'Could not apply code.');
                await loadProtectedData();
              }}
              onRequireAuth={() => setAuthOpen(true)}
            />
          )}

          {/* CERTIFICATES & PUBLIC VERIFICATION */}
          {activeTab === 'certificates' && (
            <CertificatesView
              locale={locale}
              isAuthenticated={Boolean(user)}
              certificates={certificates}
              initialVerifyToken={verifyTokenFromUrl}
              onRefreshCertificates={loadProtectedData}
              onRequireAuth={() => setAuthOpen(true)}
            />
          )}

          {/* PROFILE & POLICIES */}
          {activeTab === 'profile' && (
            <ProfilePoliciesView
              locale={locale}
              user={user}
              onUpdateProfile={async (patch) => {
                const res = await fetch('/api/me/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(patch),
                });
                const data = (await res.json()) as { user: UserSummary };
                setUser(data.user);
                setLocale(data.user.preferredLocale);
                await Promise.all([loadProtectedData(), loadLeaderboard()]);
              }}
              onAccountDeleted={async () => {
                setUser(null);
                setEnrollments([]);
                setCertificates([]);
                setActiveTab('overview');
              }}
              onRequireAuth={() => setAuthOpen(true)}
            />
          )}

          {/* STAFF EDITORIAL & CONTENT GOVERNANCE STUDIO */}
          {activeTab === 'admin' && isStaff && (
            <AdminStudioView
              locale={locale}
              courses={courses}
              aiConfigured={health.aiConfigured}
              onCatalogRefresh={loadCatalog}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (4 destinations, 56px height) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="no-print fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-4 border-t border-[#222B3D] bg-[#0B0F19]/95 backdrop-blur-md md:hidden"
      >
        {(
          [
            { id: 'overview', label: strings.nav.overview, icon: <LayoutDashboard className="h-5 w-5" /> },
            { id: 'catalog', label: strings.nav.catalog, icon: <Compass className="h-5 w-5" /> },
            { id: 'certificates', label: strings.nav.certificates, icon: <Award className="h-5 w-5" /> },
            { id: 'profile', label: strings.nav.profile, icon: <User className="h-5 w-5" /> },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id || (tab.id === 'catalog' && activeTab === 'course');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-[#5DE1D2]' : 'text-[#8994AA]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Study Companion Drawer Modal */}
      {companionOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Study Companion"
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg">
            <AiCompanionPanel
              locale={locale}
              isStaff={isStaff}
              aiConfigured={health.aiConfigured}
              onClose={() => setCompanionOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {authOpen && (
        <AuthModal
          locale={locale}
          sandboxEnabled={health.sandboxEnabled}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={async (authedUser) => {
            setUser(authedUser);
            setLocale(authedUser.preferredLocale);
            await Promise.all([loadProtectedData(), loadLeaderboard()]);
          }}
        />
      )}
    </div>
  );
}
