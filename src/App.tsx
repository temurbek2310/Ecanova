import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  CloudOff,
  Compass,
  Flame,
  Keyboard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PauseCircle,
  PlayCircle,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  Sun,
  Timer,
  Trophy,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AchievementsView } from './components/AchievementsView';
import { AdminStudioView } from './components/AdminStudioView';
import { AiCompanionPanel } from './components/AiCompanionPanel';
import { AssessmentView } from './components/AssessmentView';
import { HeaderAudioControl } from './components/AudioSettingsPanel';
import { AuthModal } from './components/AuthModal';
import { AuthPageView } from './components/AuthPageView';
import { BusinessSection } from './components/BusinessSection';
import { CertificatesView } from './components/CertificatesView';
import { CommandBar } from './components/CommandBar';
import { CommunityView } from './components/CommunityView';
import { CourseMap } from './components/CourseMap';
import { CourseShowcase } from './components/CourseShowcase';
import { DailyStudyGoalCard } from './components/DailyStudyGoalCard';
import { EconomicsLiquidBackground } from './components/EconomicsLiquidBackground';
import { EconomicsSection } from './components/EconomicsSection';
import { FocusTimerPanel } from './components/FocusTimerPanel';
import { KineticHeroSection } from './components/KineticHeroSection';
import { LanguageToggle } from './components/LanguageToggle';
import { LessonPlayer } from './components/LessonPlayer';
import { MagneticCourseCard } from './components/MagneticCourseCard';
import { MathematicsSection } from './components/MathematicsSection';
import { NeobrutalistSectionDivider } from './components/NeobrutalistSectionDivider';
import { NodeUnlockOverlay } from './components/NodeUnlockOverlay';
import { OfflineBanner } from './components/OfflineBanner';
import { ProfilePoliciesView } from './components/ProfilePoliciesView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { Sidebar } from './components/Sidebar';
import { SmoothScroll } from './components/SmoothScroll';
import { LandingPage } from './components/landing/LandingPage';
import { StudyProgressChart } from './components/StudyProgressChart';
import { SyncStatusHUD, dispatchSyncStatusReconcile } from './components/SyncStatusHUD';
import { WeaknessDetectionCard } from './components/WeaknessDetectionCard';
import { dispatchGlobalNodeUnlock } from './context/NodeUnlockContext';
import { useAmbientFocusAudio } from './hooks/useAmbientFocusAudio';
import { useCourseOfflineCache } from './hooks/useCourseOfflineCache';
import { useFocusTimer } from './hooks/useFocusTimer';
import { mapMilestoneToNodeUnlock } from './lib/node-unlock';
import {
  addRecentSearchQuery,
  filterCatalogCourses,
  getCourseTopicLabels,
  getMatchingLessonTitles,
  loadRecentSearches,
  saveRecentSearches,
} from './lib/catalog-filter';
import { isCourseBookmarked } from './lib/course-bookmarks';
import {
  clearClientSessionState,
  apiFetch,
  consumeIntendedDestination,
  getCachedUserSummary,
  peekIntendedDestination,
  persistCachedUserSummary,
  saveIntendedDestination,
} from './lib/auth-client';
import { scrollGlobalToTop } from './lib/scroll-sync';
import {
  buildPathForTab,
  evaluateMiddlewareRouteGuard,
  isProtectedTab,
  parseRouteFromLocation,
  resolveDestinationFromPath,
  type AppNavTab,
  type IntendedDestination,
} from './lib/auth-routing';
import {
  formatTemplate,
  persistLocalePreference,
  resolveInitialLocale,
  t,
} from './lib/i18n';
import {
  clearGuestCompletedLessonIdsForCourse,
  formatLessonSyncStatusMessage,
  loadLocalCompletedLessonIds,
  reconcileCompletedLessonIds,
  recordLocalLessonCompletion,
  saveLocalCompletedLessonIds,
} from './lib/lesson-sync';
import {
  analyzeWeaknessDetection,
  evaluateStreakFlameState,
  loadLocalLessonNotes,
  mergeLessonNotesMaps,
  saveWeaknessConceptsToQuickNotes,
  toggleExpandedRecommendationId,
  type WeaknessLessonRecommendation,
} from './lib/study-features';
import {
  getKeyboardShortcutCheatSheet,
  isCheatSheetShortcutEvent,
  isEditableElementTarget,
  resolveNavigationShortcut,
} from './lib/keyboard-shortcuts';
import { clearCachedCourseEdition, resolveCourseOfflineStatus } from './lib/offline-cache';
import { loadSavedDailyGoalMinutes, saveDailyGoalMinutes } from './lib/study-goal';
import { buildProgressShareData, shareProgressWithWebApi } from './lib/share-progress';
import {
  detectMilestoneCelebration,
  type MilestoneCelebrationEvent,
  type MilestoneSnapshot,
} from './lib/celebrations';
import {
  buildStudyGoalNotificationPayload,
  dispatchBrowserNotification,
  getBrowserNotificationPermission,
  hasSentReminderToday,
  loadSavedGoalNotificationsEnabled,
  markReminderSentToday,
  saveGoalNotificationsEnabled,
  shouldTriggerStudyGoalReminder,
  type BrowserNotificationPermission,
} from './lib/study-notifications';
import { formatLocalDateKey, isStaffRole } from './shared/econova-rules';
import {
  applyDocumentTheme,
  detectSystemColorScheme,
  getNextTheme,
  loadSavedTheme,
  loadSavedThemeSyncOs,
  resolveEffectiveTheme,
  saveThemePreference,
  saveThemeSyncOsPreference,
  subscribeToSystemColorScheme,
  type ThemeMode,
} from './lib/theme';
import type {
  BadgeAward,
  CertificateRecord,
  CourseCatalogItem,
  CourseDetailResponse,
  CourseLevel,
  EnrollmentRecord,
  LeaderboardEntry,
  LocaleCode,
  QuizLeaderboardEntry,
  StreakSummary,
  Subject,
  UserSummary,
  XpLedgerEntry,
} from './shared/types';

type NavTab = AppNavTab;

export default function App() {
  const [locale, setLocale] = useState<LocaleCode>(() => resolveInitialLocale());
  const [themeSyncWithOs, setThemeSyncWithOs] = useState<boolean>(() => loadSavedThemeSyncOs());
  const [theme, setTheme] = useState<ThemeMode>(() =>
    resolveEffectiveTheme({
      syncWithOs: loadSavedThemeSyncOs(),
      manualTheme: loadSavedTheme(),
      systemTheme: detectSystemColorScheme(),
    })
  );
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [weaknessRefreshTick, setWeaknessRefreshTick] = useState(0);
  const [expandedWeaknessIds, setExpandedWeaknessIds] = useState<string[]>([]);
  const [savedWeaknessNoteIds, setSavedWeaknessNoteIds] = useState<string[]>([]);
  const [commandBarExpanded, setCommandBarExpanded] = useState(false);
  const ambientAudio = useAmbientFocusAudio();
  const focusTimer = useFocusTimer(ambientAudio);
  const strings = t(locale);

  useEffect(() => {
    persistLocalePreference(locale);
  }, [locale]);

  useEffect(() => {
    applyDocumentTheme(theme);
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    saveThemeSyncOsPreference(themeSyncWithOs);
    if (!themeSyncWithOs) return;
    setTheme(detectSystemColorScheme());
    return subscribeToSystemColorScheme((nextSystemTheme) => {
      setTheme(nextSystemTheme);
    });
  }, [themeSyncWithOs]);

  const handleToggleThemeSyncWithOs = useCallback((nextSync: boolean) => {
    setThemeSyncWithOs(nextSync);
    saveThemeSyncOsPreference(nextSync);
    if (nextSync) {
      setTheme(detectSystemColorScheme());
    }
  }, []);

  const handleSelectManualTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeSyncWithOs(false);
    saveThemeSyncOsPreference(false);
    setTheme(nextTheme);
  }, []);

  // User & protected state (hydrated synchronously from cached session to eliminate sign-in flicker)
  const [user, setUser] = useState<UserSummary | null>(() => getCachedUserSummary());
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Selected course detail workspace
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseRouteFromLocation(window.location.pathname, window.location.search).courseId;
  });
  const [courseDetail, setCourseDetail] = useState<CourseDetailResponse | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState<number | 'assessment'>(0);

  const [intendedDestination, setIntendedDestination] = useState<IntendedDestination | null>(() => {
    if (typeof window === 'undefined') return null;
    const initialRoute = parseRouteFromLocation(window.location.pathname, window.location.search);
    if (initialRoute.redirectTo) {
      const dest = resolveDestinationFromPath(initialRoute.redirectTo, initialRoute.courseId);
      saveIntendedDestination(dest);
      return dest;
    }
    return peekIntendedDestination();
  });

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window === 'undefined') return 'overview';
    const cached = getCachedUserSummary();
    const guard = evaluateMiddlewareRouteGuard({
      pathname: window.location.pathname,
      search: window.location.search,
      isAuthenticated: Boolean(cached),
      userRole: cached?.role ?? null,
    });
    if (guard.action === 'redirect' && guard.destination) {
      if (guard.reason === 'unauthenticated_protected') {
        const dest = resolveDestinationFromPath(window.location.pathname);
        saveIntendedDestination(dest);
        return 'login';
      }
      return parseRouteFromLocation(guard.destination).tab;
    }
    return parseRouteFromLocation(window.location.pathname, window.location.search).tab;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(false);

  // Catalog & filters
  const [courses, setCourses] = useState<CourseCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'ALL'>('ALL');
  const [levelFilter, setLevelFilter] = useState<CourseLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const {
    swStatus,
    cachedEditionKeys,
    refresh: refreshOfflineCache,
  } = useCourseOfflineCache();

  const recordRecentSearch = useCallback((query: string) => {
    const clean = query.trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = addRecentSearchQuery(prev, clean);
      saveRecentSearches(next);
      return next;
    });
  }, []);

  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [xpToday, setXpToday] = useState(0);
  const [studyMinutesToday, setStudyMinutesToday] = useState(0);
  const [dailyStudyGoalMinutes, setDailyStudyGoalMinutes] = useState<number>(() =>
    loadSavedDailyGoalMinutes()
  );
  const [goalNotificationsEnabled, setGoalNotificationsEnabled] = useState<boolean>(() =>
    loadSavedGoalNotificationsEnabled()
  );
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
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
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [weekWindow, setWeekWindow] = useState<{
    weekStartIso: string;
    weekEndIso: string;
  } | null>(null);
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
  const [sharingProgress, setSharingProgress] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [celebrationEvent, setCelebrationEvent] = useState<MilestoneCelebrationEvent | null>(null);
  const prevMilestoneSnapshotRef = useRef<MilestoneSnapshot | null>(null);
  const [bookmarkBusyId, setBookmarkBusyId] = useState<string | null>(null);
  const pendingBookmarkCourseIdRef = useRef<string | null>(null);
  const [syncingSyllabus, setSyncingSyllabus] = useState(false);
  const [localSyllabusCompletedIds, setLocalSyllabusCompletedIds] = useState<string[]>([]);
  const [syllabusSyncNote, setSyllabusSyncNote] = useState<{
    kind: 'ok' | 'info' | 'error';
    text: string;
    syncedAt?: string;
  } | null>(null);

  const isStaff = Boolean(
    user && isStaffRole(user.role)
  );

  const loadHealth = useCallback(async () => {
    try {
      const res = await apiFetch('/api/health');
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
      const res = await apiFetch('/api/catalog');
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Unable to load course catalog.');
      }
      const data = (await res.json()) as { courses: CourseCatalogItem[] };
      setCourses(data.courses);
      window.setTimeout(() => void refreshOfflineCache(), 250);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Catalog load failed.');
    } finally {
      setCatalogLoading(false);
    }
  }, [refreshOfflineCache]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await apiFetch('/api/leaderboards');
      if (res.ok) {
        const data = (await res.json()) as {
          cohortName: string;
          entries: LeaderboardEntry[];
          quizLeaderboard?: QuizLeaderboardEntry[];
          weekWindow?: { weekStartIso: string; weekEndIso: string };
        };
        setCohortName(data.cohortName);
        setLeaderboard(data.entries);
        if (Array.isArray(data.quizLeaderboard)) {
          setQuizLeaderboard(data.quizLeaderboard);
        }
        if (data.weekWindow) {
          setWeekWindow(data.weekWindow);
        }
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const loadProtectedData = useCallback(
    async (options?: { allowCelebrate?: boolean }) => {
      try {
        const [ovRes, certRes, refRes] = await Promise.all([
          apiFetch('/api/me/overview'),
          apiFetch('/api/me/certificates'),
          apiFetch('/api/me/referrals'),
        ]);
        if (ovRes.ok) {
          const ov = (await ovRes.json()) as {
            enrollments: EnrollmentRecord[];
            totalXp: number;
            xpToday: number;
            studyMinutesToday?: number;
            dailyStudyGoalMinutes?: number;
            xpLedger: XpLedgerEntry[];
            streak: StreakSummary;
            badges: BadgeAward[];
          };
          const minutesToday = Number(ov.studyMinutesToday ?? 0);
          const targetMinutes =
            typeof ov.dailyStudyGoalMinutes === 'number'
              ? ov.dailyStudyGoalMinutes
              : dailyStudyGoalMinutes;

          setEnrollments(ov.enrollments);
          setTotalXp(ov.totalXp);
          setXpToday(ov.xpToday);
          setStudyMinutesToday(minutesToday);
          if (typeof ov.dailyStudyGoalMinutes === 'number') {
            setDailyStudyGoalMinutes(ov.dailyStudyGoalMinutes);
          }
          setXpLedger(ov.xpLedger);
          setStreak(ov.streak);
          setBadges(ov.badges);

          const nextSnapshot: MilestoneSnapshot = {
            completedCourseIds: ov.enrollments
              .filter((e) => e.journeyStatus === 'completed')
              .map((e) => e.courseId),
            currentStreak: Number(ov.streak?.currentStreak ?? 0),
            badgeKeys: ov.badges.map((b) => b.badgeKey),
            dailyGoalMet: minutesToday >= targetMinutes,
          };

          if (options?.allowCelebrate) {
            const evt = detectMilestoneCelebration(
              prevMilestoneSnapshotRef.current,
              nextSnapshot,
              locale
            );
            if (evt) {
              setCelebrationEvent(evt);
              dispatchGlobalNodeUnlock(mapMilestoneToNodeUnlock(evt, locale));
            }
          }
          prevMilestoneSnapshotRef.current = nextSnapshot;
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
    },
    [dailyStudyGoalMinutes, locale]
  );

  useEffect(() => {
    if (!celebrationEvent) return;
    const timer = window.setTimeout(() => {
      setCelebrationEvent(null);
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [celebrationEvent]);

  const syncBrowserPath = useCallback(
    (tab: NavTab, options?: { courseId?: string | null; redirectTo?: string | null; replace?: boolean }) => {
      if (typeof window === 'undefined') return;
      const nextPath = buildPathForTab(tab, {
        courseId: options?.courseId ?? selectedCourseId,
        redirectTo: options?.redirectTo ?? null,
      });
      if (`${window.location.pathname}${window.location.search}` === nextPath) {
        return;
      }
      if (options?.replace) {
        window.history.replaceState({}, '', nextPath);
      } else {
        window.history.pushState({}, '', nextPath);
      }
    },
    [selectedCourseId]
  );

  const navigateToLogin = useCallback(
    (destinationOverride?: IntendedDestination, mode: 'login' | 'register' = 'login') => {
      const currentSafeTab: Exclude<NavTab, 'login' | 'register' | 'landing'> =
        activeTab === 'login' || activeTab === 'register' || activeTab === 'landing'
          ? 'overview'
          : activeTab;
      const dest: IntendedDestination =
        destinationOverride ?? {
          tab: currentSafeTab,
          path: buildPathForTab(currentSafeTab, { courseId: selectedCourseId }),
          courseId: selectedCourseId,
          lessonIndex: activeLessonIndex,
        };
      saveIntendedDestination(dest);
      setIntendedDestination(dest);
      setActiveTab(mode);
      setAuthOpen(false);
      syncBrowserPath(mode, { redirectTo: dest.path });
    },
    [activeTab, selectedCourseId, activeLessonIndex, syncBrowserPath]
  );

  const navigateToTab = useCallback(
    (nextTab: NavTab) => {
      if (nextTab === 'login' || nextTab === 'register') {
        navigateToLogin(undefined, nextTab);
        return;
      }
      if (isProtectedTab(nextTab) && !user) {
        const dest: IntendedDestination = {
          tab: nextTab,
          path: buildPathForTab(nextTab),
        };
        navigateToLogin(dest, 'login');
        return;
      }
      setActiveTab(nextTab);
      syncBrowserPath(nextTab);
      scrollGlobalToTop(true);
    },
    [user, navigateToLogin, syncBrowserPath]
  );

  const loadSession = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = (await res.json()) as { user?: UserSummary | null };
        const verifiedUser = data.user ?? null;
        setUser(verifiedUser);
        persistCachedUserSummary(verifiedUser);

        if (verifiedUser) {
          // The first screen may have been chosen from the cached profile; re-check
          // it against the verified role (e.g. a stale or edited cached "admin").
          if (typeof window !== 'undefined') {
            const roleGuard = evaluateMiddlewareRouteGuard({
              pathname: window.location.pathname,
              search: window.location.search,
              isAuthenticated: true,
              userRole: verifiedUser.role,
            });
            if (roleGuard.action === 'redirect' && roleGuard.reason === 'insufficient_role') {
              setActiveTab('overview');
              window.history.replaceState({}, '', '/overview');
            }
          }
          setDailyStudyGoalMinutes(verifiedUser.dailyStudyGoalMinutes);
          setGoalNotificationsEnabled(Boolean(verifiedUser.studyGoalNotificationsEnabled));
          await loadProtectedData();
        } else {
          clearClientSessionState();
          setEnrollments([]);
          setCertificates([]);
          setXpLedger([]);
          setTotalXp(0);
          setStudyMinutesToday(0);
          setDailyStudyGoalMinutes(loadSavedDailyGoalMinutes());
          setGoalNotificationsEnabled(loadSavedGoalNotificationsEnabled());
          setBadges([]);
          if (typeof window !== 'undefined') {
            const guard = evaluateMiddlewareRouteGuard({
              pathname: window.location.pathname,
              search: window.location.search,
              isAuthenticated: false,
            });
            if (guard.action === 'redirect' && guard.destination) {
              const dest = resolveDestinationFromPath(window.location.pathname);
              saveIntendedDestination(dest);
              setIntendedDestination(dest);
              setActiveTab('login');
              window.history.replaceState({}, '', guard.destination);
            }
          }
        }
      }
    } catch {
      // Ignore offline auth probe error
    } finally {
      setSessionLoaded(true);
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
    async (
      courseId: string,
      editionLocale: LocaleCode = locale,
      options?: { lessonIndex?: number | 'assessment'; authenticatedUser?: UserSummary | null }
    ) => {
      setSelectedCourseId(courseId);
      setActiveTab('course');
      syncBrowserPath('course', { courseId });
      scrollGlobalToTop(true);
      setCourseLoading(true);
      setCourseError(null);
      setActiveLessonIndex(options?.lessonIndex ?? 0);
      try {
        const res = await apiFetch(`/api/courses/${courseId}/editions/${editionLocale}`);
        const data = (await res.json()) as CourseDetailResponse & { error?: string };
        if (!res.ok) {
          setCourseDetail(null);
          throw new Error(data.error || strings.editionMissingNote);
        }
        setCourseDetail(data);
        window.setTimeout(() => void refreshOfflineCache(), 250);
        const effectiveUser = options?.authenticatedUser !== undefined ? options.authenticatedUser : user;
        if (effectiveUser) {
          await apiFetch('/api/enrollments', {
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
    [locale, strings.editionMissingNote, user, loadProtectedData, refreshOfflineCache, syncBrowserPath]
  );

  // If browser booted directly onto /course/:courseId, load it automatically
  useEffect(() => {
    if (activeTab === 'course' && selectedCourseId && !courseDetail && !courseLoading) {
      void openCourse(selectedCourseId, locale);
    }
  }, [activeTab, selectedCourseId, courseDetail, courseLoading, locale, openCourse]);

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromLocation(window.location.pathname, window.location.search);
      if (isProtectedTab(parsed.tab) && !user) {
        const dest = resolveDestinationFromPath(window.location.pathname, parsed.courseId);
        navigateToLogin(dest, 'login');
        return;
      }
      setActiveTab(parsed.tab);
      if (parsed.courseId) {
        void openCourse(parsed.courseId, locale);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, locale, navigateToLogin, openCourse]);

  useEffect(() => {
    if (activeTab === 'catalog' || activeTab === 'profile') {
      void refreshOfflineCache();
    }
  }, [activeTab, locale, refreshOfflineCache]);

  // Reload selected course when switching global language edition
  const handleLocaleSwitch = (nextLocale: LocaleCode) => {
    setLocale(nextLocale);
    if (activeTab === 'course' && selectedCourseId) {
      openCourse(selectedCourseId, nextLocale);
    }
  };

  useEffect(() => {
    const courseId = courseDetail?.course.id;
    if (!courseId) {
      setLocalSyllabusCompletedIds([]);
      setSyllabusSyncNote(null);
      return;
    }
    setLocalSyllabusCompletedIds(loadLocalCompletedLessonIds(courseId, user?.id));
    setSyllabusSyncNote(null);
  }, [courseDetail?.course.id, user?.id]);

  // Tell the server when a signed-in learner opens a lesson, so completion can be
  // verified against a server-measured study session.
  const activeLessonIdForProgress =
    typeof activeLessonIndex === 'number' ? courseDetail?.lessons[activeLessonIndex]?.id ?? null : null;
  useEffect(() => {
    if (!user || !activeLessonIdForProgress) return;
    apiFetch(`/api/me/progress/${encodeURIComponent(activeLessonIdForProgress)}/start`, {
      method: 'POST',
    }).catch(() => {
      // Offline: the completion can still sync later as local_sync.
    });
  }, [user?.id, activeLessonIdForProgress]);

  const handleCompleteLesson = async (lessonId: string) => {
    const activeCourseId = courseDetail?.course.id ?? selectedCourseId;
    const lesson = courseDetail?.lessons.find((l) => l.id === lessonId);
    const evidence = lesson && lesson.simulationType !== 'none' ? 'interactive_check' : 'lesson_read';
    let res: Response;
    try {
      res = await apiFetch(`/api/me/progress/${encodeURIComponent(lessonId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence }),
      });
    } catch (err) {
      // Network failure: keep the completion locally so it can sync later.
      if (activeCourseId) {
        setLocalSyllabusCompletedIds(recordLocalLessonCompletion(activeCourseId, lessonId, user?.id));
      }
      throw err instanceof Error ? err : new Error('Could not record completion.');
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      retryAfterSeconds?: number;
    };
    if (!res.ok) {
      if (data.code === 'min_dwell_not_met' && typeof data.retryAfterSeconds === 'number') {
        throw new Error(
          locale === 'uz'
            ? `Darsni tugallangan deb belgilashdan oldin yana ${data.retryAfterSeconds} soniya o‘qing.`
            : `Keep studying for ${data.retryAfterSeconds} more seconds before marking this lesson complete.`
        );
      }
      throw new Error(data.error || 'Could not record completion.');
    }
    if (activeCourseId) {
      setLocalSyllabusCompletedIds(recordLocalLessonCompletion(activeCourseId, lessonId, user?.id));
    }
    await Promise.all([loadProtectedData({ allowCelebrate: true }), loadLeaderboard()]);
  };

  const handleSyncCourseProgress = async () => {
    if (!courseDetail || syncingSyllabus) return;
    const courseId = courseDetail.course.id;
    const validCourseLessonIds = courseDetail.lessons.map((l) => l.id);
    const localIds = loadLocalCompletedLessonIds(courseId, user?.id);
    setLocalSyllabusCompletedIds(localIds);

    if (!user) {
      setSyllabusSyncNote({
        kind: 'info',
        text: formatLessonSyncStatusMessage({
          locale,
          pushedCount: 0,
          pulledCount: 0,
          totalSynced: localIds.length,
          unauthenticated: true,
        }),
      });
      return;
    }

    setSyncingSyllabus(true);
    dispatchSyncStatusReconcile();
    try {
      // Fetch fresh server enrollment state so cross-device completions are pulled cleanly
      const ovRes = await apiFetch('/api/me/overview');
      if (!ovRes.ok) {
        throw new Error(locale === 'uz' ? 'Server bilan bog‘lanib bo‘lmadi.' : 'Could not reach server.');
      }
      const ov = (await ovRes.json()) as { enrollments: EnrollmentRecord[] };
      const freshEnrollment = ov.enrollments.find((e) => e.courseId === courseId);
      const serverIds = freshEnrollment?.completedLessonIds ?? [];

      const plan = reconcileCompletedLessonIds({
        localIds,
        serverIds,
        validCourseLessonIds,
      });

      let pushedCount = 0;
      const failedPushIds: string[] = [];
      for (const lessonId of plan.missingOnServer) {
        const putRes = await apiFetch(`/api/me/progress/${encodeURIComponent(lessonId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evidence: 'local_sync' }),
        });
        if (putRes.ok) {
          pushedCount += 1;
        } else {
          failedPushIds.push(lessonId);
        }
      }

      await Promise.all([
        loadProtectedData({ allowCelebrate: pushedCount > 0 }),
        loadLeaderboard(),
      ]);

      const syncedIds =
        failedPushIds.length === 0
          ? plan.mergedIds
          : plan.mergedIds.filter((id) => !failedPushIds.includes(id));
      const savedLocal = saveLocalCompletedLessonIds(
        courseId,
        failedPushIds.length === 0 ? syncedIds : [...syncedIds, ...failedPushIds],
        user.id
      );
      if (failedPushIds.length === 0) {
        clearGuestCompletedLessonIdsForCourse(courseId);
      }
      setLocalSyllabusCompletedIds(savedLocal);

      setSyllabusSyncNote({
        kind: failedPushIds.length > 0 ? 'error' : 'ok',
        text: formatLessonSyncStatusMessage({
          locale,
          pushedCount,
          pulledCount: plan.missingLocally.length,
          totalSynced: syncedIds.length,
          error:
            failedPushIds.length > 0
              ? locale === 'uz'
                ? `${failedPushIds.length} ta dars yuklanmadi`
                : `${failedPushIds.length} lesson(s) failed to upload`
              : null,
        }),
        syncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      setSyllabusSyncNote({
        kind: 'error',
        text: formatLessonSyncStatusMessage({
          locale,
          pushedCount: 0,
          pulledCount: 0,
          totalSynced: localIds.length,
          error: err instanceof Error ? err.message : 'Sync error',
        }),
      });
    } finally {
      setSyncingSyllabus(false);
    }
  };

  const handlePauseToggle = async (courseId: string, paused: boolean) => {
    await apiFetch(`/api/enrollments/${courseId}/pause`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused }),
    });
    await loadProtectedData();
  };

  const applyBookmarkChange = useCallback(async (courseId: string, bookmarked: boolean) => {
    setBookmarkBusyId(courseId);
    try {
      const res = await apiFetch(`/api/me/bookmarks/${encodeURIComponent(courseId)}`, {
        method: bookmarked ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: bookmarked ? JSON.stringify({ bookmarked: true }) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: UserSummary | null;
        bookmarkedCourseIds?: string[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Could not update bookmark.');
      }
      if (data.user) {
        setUser(data.user);
      } else if (Array.isArray(data.bookmarkedCourseIds)) {
        setUser((prev) =>
          prev ? { ...prev, bookmarkedCourseIds: data.bookmarkedCourseIds! } : prev
        );
      }
    } finally {
      setBookmarkBusyId(null);
    }
  }, []);

  const handleToggleBookmark = useCallback(
    async (courseId: string) => {
      if (!user) {
        pendingBookmarkCourseIdRef.current = courseId;
        const currentSafeTab: Exclude<NavTab, 'login' | 'register' | 'landing'> =
          activeTab === 'login' || activeTab === 'register' || activeTab === 'landing'
            ? 'catalog'
            : activeTab;
        navigateToLogin({
          tab: currentSafeTab,
          path: buildPathForTab(currentSafeTab, { courseId: selectedCourseId }),
          courseId: selectedCourseId,
          lessonIndex: activeLessonIndex,
        });
        return;
      }
      const currentlyBookmarked = isCourseBookmarked(user.bookmarkedCourseIds ?? [], courseId);
      await applyBookmarkChange(courseId, !currentlyBookmarked);
    },
    [user, activeTab, selectedCourseId, activeLessonIndex, navigateToLogin, applyBookmarkChange]
  );

  const handleUpdateDailyGoal = async (nextTargetMinutes: number) => {
    if (!user) {
      saveDailyGoalMinutes(nextTargetMinutes);
      setDailyStudyGoalMinutes(nextTargetMinutes);
      return;
    }
    const res = await apiFetch('/api/me/study-goal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMinutes: nextTargetMinutes }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      dailyStudyGoalMinutes?: number;
      user?: UserSummary | null;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || 'Could not update daily study goal.');
    }
    const confirmedMinutes = data.dailyStudyGoalMinutes ?? nextTargetMinutes;
    setDailyStudyGoalMinutes(confirmedMinutes);
    if (data.user) {
      setUser(data.user);
    }
  };

  const handleToggleGoalNotifications = async (nextEnabled: boolean): Promise<{
    enabled: boolean;
    permission: BrowserNotificationPermission;
    error?: string;
  }> => {
    if (nextEnabled) {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        setNotificationPermission('unsupported');
        return {
          enabled: false,
          permission: 'unsupported',
          error: strings.notifications.unsupportedHelp,
        };
      }
      let perm: BrowserNotificationPermission = Notification.permission;
      if (perm === 'default') {
        try {
          perm = await Notification.requestPermission();
        } catch {
          perm = getBrowserNotificationPermission();
        }
      }
      setNotificationPermission(perm);

      if (perm !== 'granted') {
        saveGoalNotificationsEnabled(false);
        setGoalNotificationsEnabled(false);
        if (user) {
          await apiFetch('/api/me/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studyGoalNotificationsEnabled: false }),
          }).catch(() => {});
        }
        return {
          enabled: false,
          permission: perm,
          error: strings.notifications.deniedHelp,
        };
      }
    }

    saveGoalNotificationsEnabled(nextEnabled);
    setGoalNotificationsEnabled(nextEnabled);

    if (user) {
      const res = await apiFetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyGoalNotificationsEnabled: nextEnabled }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: UserSummary | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Could not save notification preference.');
      }
      if (data.user) {
        setUser(data.user);
      }
    }

    return {
      enabled: nextEnabled,
      permission: getBrowserNotificationPermission(),
    };
  };

  const handleSendTestNotification = async () => {
    const completed = user ? studyMinutesToday : 0;
    return dispatchBrowserNotification(
      buildStudyGoalNotificationPayload({
        completedMinutes: completed,
        targetMinutes: dailyStudyGoalMinutes,
        locale,
      })
    );
  };

  useEffect(() => {
    if (!sessionLoaded) return;
    const perm = getBrowserNotificationPermission();
    setNotificationPermission(perm);

    const timeZone = user?.timezone || streak.timezone || 'Asia/Tashkent';
    const todayDateKey = formatLocalDateKey(new Date(), timeZone);
    const scopeKey = user?.id || 'guest';
    const completed = user ? studyMinutesToday : 0;

    if (
      shouldTriggerStudyGoalReminder({
        notificationsEnabled: goalNotificationsEnabled,
        permission: perm,
        completedMinutes: completed,
        targetMinutes: dailyStudyGoalMinutes,
        alreadySentToday: hasSentReminderToday(scopeKey, todayDateKey),
      })
    ) {
      markReminderSentToday(scopeKey, todayDateKey);
      void dispatchBrowserNotification(
        buildStudyGoalNotificationPayload({
          completedMinutes: completed,
          targetMinutes: dailyStudyGoalMinutes,
          locale,
        })
      );
    }
  }, [
    sessionLoaded,
    user,
    studyMinutesToday,
    dailyStudyGoalMinutes,
    goalNotificationsEnabled,
    notificationPermission,
    locale,
    streak.timezone,
  ]);

  const handleShareProgress = async () => {
    setSharingProgress(true);
    setShareFeedback(null);
    try {
      const shareData = buildProgressShareData({
        xpToday: user ? xpToday : 0,
        currentStreak: user ? streak.currentStreak : 0,
        locale,
        url: window.location.origin,
      });
      const result = await shareProgressWithWebApi(shareData);
      if (result.ok) {
        setShareFeedback(
          result.method === 'web-share'
            ? strings.shareProgress.sharedWebApi
            : strings.shareProgress.sharedClipboard
        );
      } else if (!result.cancelled) {
        setShareFeedback(strings.shareProgress.unavailable);
      }
    } finally {
      setSharingProgress(false);
    }
  };

  const handleUserAuthenticated = useCallback(
    async (
      authedUser: UserSummary,
      options?: { redirectTo?: string | null }
    ) => {
      persistCachedUserSummary(authedUser);
      setUser(authedUser);
      setLocale(authedUser.preferredLocale);
      setDailyStudyGoalMinutes(authedUser.dailyStudyGoalMinutes);
      setGoalNotificationsEnabled(Boolean(authedUser.studyGoalNotificationsEnabled));
      setAuthOpen(false);

      const storedDest = consumeIntendedDestination();
      const targetDest: IntendedDestination =
        storedDest ??
        (options?.redirectTo
          ? resolveDestinationFromPath(options.redirectTo, selectedCourseId)
          : {
              tab:
                activeTab === 'login' || activeTab === 'register' || activeTab === 'landing'
                  ? selectedCourseId
                    ? 'course'
                    : 'overview'
                  : activeTab,
              path: buildPathForTab(
                activeTab === 'login' || activeTab === 'register' || activeTab === 'landing'
                  ? selectedCourseId
                    ? 'course'
                    : 'overview'
                  : activeTab,
                { courseId: selectedCourseId }
              ),
              courseId: selectedCourseId,
              lessonIndex: activeLessonIndex,
            });

      setIntendedDestination(null);

      const pendingCourseId = pendingBookmarkCourseIdRef.current;
      pendingBookmarkCourseIdRef.current = null;

      await Promise.all([loadProtectedData(), loadLeaderboard()]);

      if (pendingCourseId) {
        await applyBookmarkChange(pendingCourseId, true).catch(() => {});
      }

      if (targetDest.tab === 'course' && (targetDest.courseId || selectedCourseId)) {
        const cid = targetDest.courseId || selectedCourseId!;
        await openCourse(cid, authedUser.preferredLocale, {
          lessonIndex: targetDest.lessonIndex ?? activeLessonIndex,
          authenticatedUser: authedUser,
        });
        syncBrowserPath('course', { courseId: cid, replace: true });
      } else {
        setActiveTab(targetDest.tab);
        syncBrowserPath(targetDest.tab, { replace: true });
      }
    },
    [
      activeTab,
      selectedCourseId,
      activeLessonIndex,
      loadProtectedData,
      loadLeaderboard,
      applyBookmarkChange,
      openCourse,
      syncBrowserPath,
    ]
  );

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearClientSessionState();
    setUser(null);
    setEnrollments([]);
    setCertificates([]);
    setXpLedger([]);
    setTotalXp(0);
    setXpToday(0);
    setStudyMinutesToday(0);
    setDailyStudyGoalMinutes(loadSavedDailyGoalMinutes());
    setGoalNotificationsEnabled(loadSavedGoalNotificationsEnabled());
    setStreak({
      currentStreak: 0,
      bestStreak: 0,
      lastActivityLocalDate: null,
      timezone: 'Asia/Tashkent',
    });
    setBadges([]);
    setShareFeedback(null);
    setCelebrationEvent(null);
    prevMilestoneSnapshotRef.current = null;
    if (isProtectedTab(activeTab)) {
      setActiveTab('overview');
      syncBrowserPath('overview', { replace: true });
    }
  };

  const filteredCourses = filterCatalogCourses(courses, {
    subject: subjectFilter,
    level: levelFilter,
    searchQuery,
    locale,
  });

  const hasActiveCatalogFilters =
    subjectFilter !== 'ALL' || levelFilter !== 'ALL' || searchQuery.trim().length > 0;

  const activeEnrollment = selectedCourseId
    ? enrollments.find((e) => e.courseId === selectedCourseId)
    : undefined;

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const targetEl = event.target as HTMLElement | null;
      const isEditable = isEditableElementTarget(targetEl);

      if (event.key === 'Escape' && cheatSheetOpen) {
        event.preventDefault();
        setCheatSheetOpen(false);
        return;
      }

      if (
        isCheatSheetShortcutEvent({
          key: event.key,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          repeat: event.repeat,
          defaultPrevented: event.defaultPrevented,
          isEditableTarget: isEditable,
        })
      ) {
        event.preventDefault();
        setCheatSheetOpen((prev) => !prev);
        return;
      }

      const inDialog =
        authOpen ||
        companionOpen ||
        cheatSheetOpen ||
        Boolean(targetEl?.closest?.('[role="dialog"]')) ||
        Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));

      const nextTab = resolveNavigationShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        defaultPrevented: event.defaultPrevented,
        isEditableTarget: isEditable,
        hasOpenDialog: inDialog,
        isStaff,
      });

      if (nextTab) {
        event.preventDefault();
        setActiveTab(nextTab);
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [authOpen, companionOpen, cheatSheetOpen, isStaff]);

  const streakFlame = evaluateStreakFlameState({
    currentStreak: streak.currentStreak,
    xpToday,
    studyMinutesToday,
    dailyStudyGoalMinutes,
    locale,
  });

  const weaknessAnalysis = React.useMemo(
    () =>
      analyzeWeaknessDetection({
        courses,
        enrollments,
        locale,
      }),
    [courses, enrollments, locale, weaknessRefreshTick]
  );

  const handleSaveWeaknessToNotes = useCallback(
    async (rec: WeaknessLessonRecommendation) => {
      const enr = enrollments.find((e) => e.courseId === rec.courseId);
      const targetLessonId = enr?.requiredLessonIds?.[rec.lessonIndex];
      const existingMerged = mergeLessonNotesMaps(loadLocalLessonNotes(), user?.lessonNotes);

      const { updatedNotes } = saveWeaknessConceptsToQuickNotes({
        recommendation: rec,
        existingNotes: existingMerged,
        targetLessonId,
        locale,
      });

      setSavedWeaknessNoteIds((prev) => (prev.includes(rec.id) ? prev : [...prev, rec.id]));

      if (user) {
        try {
          const res = await apiFetch('/api/me/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonNotes: updatedNotes }),
          });
          if (res.ok) {
            const data = (await res.json()) as { user?: UserSummary };
            if (data.user) {
              setUser(data.user);
              persistCachedUserSummary(data.user);
            }
          }
        } catch {
          // Local Quick Notes are already persisted in localStorage
        }
      }
    },
    [enrollments, locale, user]
  );

  const shortcutCheatSheet = React.useMemo(
    () => getKeyboardShortcutCheatSheet(locale, isStaff),
    [locale, isStaff]
  );

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);
    const id = window.requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeTab, locale, courses.length]);

  // Public marketing landing at `/`: pure #000000 void + ConstellationCanvas only —
  // no Sidebar, app Header, EconomicsLiquidBackground or dashboard overlays.
  if (activeTab === 'landing') {
    return (
      <SmoothScroll>
        <LandingPage
          locale={locale}
          onToggleLocale={handleLocaleSwitch}
          onEnterApp={() => navigateToTab('overview')}
          onSignIn={() =>
            navigateToLogin({ tab: 'overview', path: buildPathForTab('overview') }, 'login')
          }
        />
      </SmoothScroll>
    );
  }

  return (
    <SmoothScroll>
    <div className="relative isolate min-h-screen overflow-x-clip text-ink flex flex-col md:flex-row">
      {/* Economics WebGL Liquid Background (-z-10, decoupled behind UI shell) */}
      <EconomicsLiquidBackground
        active={activeTab !== 'admin'}
        theme={theme}
      />

      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        locale={locale}
        navItems={navItems}
        streakFlame={streakFlame}
        installAppLabel={strings.installApp}
        onNavigateTab={navigateToTab}
        onOpenCompanion={() => setCompanionOpen(true)}
      />

      {/* Main Content Shell */}
      <div className="relative flex flex-1 flex-col min-w-0 overflow-x-clip pb-20 md:pb-0">
        <OfflineBanner message={strings.offlineBanner} />

        {/* Clean Responsive Top Bar (3-col grid centering; backdrop isolated on child layer so mobile fixed CommandBar takeover attaches to viewport) */}
        <header
          data-testid="main-header"
          className={`no-print sticky top-0 ${
            commandBarExpanded ? 'z-[100]' : 'z-40'
          } grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full h-16 px-3 sm:px-6`}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 border-b-2 border-slate-500 bg-white/25 backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
          />

          <div className="justify-self-start flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-theme-border bg-theme-base text-ink shadow-brutal-sm md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('overview')}
              aria-label="ECONOVA"
              data-testid="header-mobile-logo"
              className="inline-flex items-center gap-1.5 shrink-0 md:hidden"
            >
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-theme-border bg-[#5DE1D2] font-display text-xs font-black text-black shadow-[2px_2px_0px_#000]"
                aria-hidden="true"
              >
                E
              </span>
              <span className="hidden sm:inline font-display text-sm font-extrabold tracking-tight text-ink whitespace-nowrap">
                ECONOVA
              </span>
            </button>
            <span className="hidden text-xs font-semibold text-muted truncate md:inline max-w-[180px] lg:max-w-[260px]">
              {activeTab === 'course' && courseDetail
                ? `${strings.subjects[courseDetail.course.subject]} / ${courseDetail.edition.title}`
                : navItems.find((n) => n.id === activeTab)?.label || 'ECONOVA'}
            </span>
          </div>

          {/* Dead-Center CommandBar on Desktop & Mobile (Zero CSS transform on wrapper so fixed mobile takeover attaches to viewport) */}
          <div className="justify-self-center flex items-center justify-center z-50">
            <CommandBar
              locale={locale}
              theme={theme}
              courses={courses}
              onNavigateTab={navigateToTab}
              onOpenCourse={(courseId, editionLocale) => void openCourse(courseId, editionLocale)}
              onJumpSection={(sectionId) => {
                navigateToTab('overview');
                window.setTimeout(() => {
                  const target = document.querySelector(`[data-testid="${sectionId}-section"]`);
                  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 120);
              }}
              onSwitchLocale={handleLocaleSwitch}
              onToggleTheme={handleSelectManualTheme}
              onOpenShortcuts={() => setCheatSheetOpen(true)}
              onExpandedChange={setCommandBarExpanded}
            />
          </div>

          <div className="justify-self-end flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Focus Timer + Ambient Soundscape Hub (Header Popover on sm+; Mobile accesses via Drawer, Lesson Bar & Profile) */}
            <HeaderAudioControl
              locale={locale}
              audio={ambientAudio}
              timer={focusTimer}
              className="hidden sm:block"
            />

            {/* Theme Mode Toggle (Compact icon on mobile/laptop; label on 2xl+) */}
            <button
              type="button"
              onClick={() => handleSelectManualTheme(getNextTheme(theme))}
              aria-label={theme === 'dark' ? strings.theme.switchToLight : strings.theme.switchToDark}
              title={theme === 'dark' ? strings.theme.switchToLight : strings.theme.switchToDark}
              aria-pressed={theme === 'light'}
              data-testid="theme-mode-toggle"
              className="inline-flex h-9 w-9 2xl:h-auto 2xl:w-auto 2xl:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-base 2xl:px-3 2xl:py-1.5 text-xs font-semibold text-ink shadow-brutal-sm transition-colors hover:border-theme-accent whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 text-warning shrink-0" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden="true" />
              )}
              <span className="hidden 2xl:inline">
                {theme === 'dark' ? strings.theme.lightLabel : strings.theme.darkLabel}
              </span>
            </button>

            {/* Viscous Language Edition Toggle (EN / O'Z — hidden on mobile) */}
            <LanguageToggle
              locale={locale}
              onChange={handleLocaleSwitch}
              className="hidden md:flex"
            />

            {/* Primary Account Action */}
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateToTab('profile')}
                  aria-label={user.displayName}
                  data-testid="header-user-profile-btn"
                  className="inline-flex h-9 w-9 md:h-auto md:w-auto md:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-base md:px-3 md:py-1.5 text-xs font-semibold text-ink shadow-brutal-sm hover:border-theme-accent"
                >
                  <User className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden="true" />
                  <span className="hidden md:block max-w-[120px] truncate">{user.displayName}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label={strings.signOut}
                  data-testid="header-logout-btn"
                  className="hidden sm:inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border-2 border-theme-border bg-theme-base text-muted shadow-brutal-sm hover:text-ink"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigateToLogin()}
                data-testid="header-signin-btn"
                className="h-9 sm:min-h-[38px] rounded-lg border-2 border-theme-border bg-theme-accent px-2.5 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold text-theme-accent-ink shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-accent-hover whitespace-nowrap"
              >
                {strings.signIn}
              </button>
            )}
          </div>
        </header>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="no-print border-b-2 border-slate-500 bg-white/30 p-4 backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30 md:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigateToTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-semibold ${
                    activeTab === item.id
                      ? 'border-theme-accent bg-theme-base text-theme-accent shadow-brutal-sm'
                      : 'border-theme-border bg-theme-base text-muted'
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
                className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-2 text-xs font-semibold text-ink"
              >
                <MessageSquare className="h-4 w-4 text-teal" aria-hidden="true" />
                <span>{locale === 'uz' ? 'Yordamchi' : 'Companion'}</span>
              </button>
              <button
                type="button"
                onClick={() => void ambientAudio.togglePlay()}
                aria-pressed={ambientAudio.isPlaying}
                data-testid="mobile-drawer-audio-toggle"
                className={`flex min-h-[44px] items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-semibold ${
                  ambientAudio.isPlaying
                    ? 'border-[#5DE1D2] bg-[#5DE1D2]/15 text-ink shadow-brutal-sm'
                    : 'border-theme-border bg-theme-base text-ink'
                }`}
              >
                {ambientAudio.isPlaying ? (
                  <Volume2 className="h-4 w-4 text-[#5DE1D2]" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted" aria-hidden="true" />
                )}
                <span>
                  {locale === 'uz'
                    ? ambientAudio.isPlaying
                      ? 'Fokus audio: Faol'
                      : 'Fokus audio'
                    : ambientAudio.isPlaying
                    ? 'Focus Audio: On'
                    : 'Focus Audio'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => focusTimer.toggleStartPause()}
                aria-pressed={focusTimer.status === 'running'}
                data-testid="mobile-drawer-timer-toggle"
                className={`flex min-h-[44px] items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-semibold ${
                  focusTimer.status === 'running'
                    ? 'border-[#5DE1D2] bg-[#5DE1D2]/15 text-ink shadow-brutal-sm'
                    : 'border-theme-border bg-theme-base text-ink'
                }`}
              >
                <Timer
                  className={`h-4 w-4 ${
                    focusTimer.status === 'running' ? 'text-[#5DE1D2]' : 'text-muted'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono tabular-nums">
                  {focusTimer.status === 'running' || focusTimer.status === 'paused'
                    ? focusTimer.formattedClock
                    : locale === 'uz'
                    ? `Taymer ${focusTimer.durationMinutes}m`
                    : `Timer ${focusTimer.durationMinutes}m`}
                </span>
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-2 text-xs font-semibold text-muted"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>{strings.signOut}</span>
                </button>
              )}
            </nav>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div
                role="group"
                aria-label="Mobile Language Edition Switcher"
                className="inline-flex items-center rounded-lg border-2 border-theme-border bg-theme-base p-0.5 text-xs shadow-brutal-sm"
              >
                <button
                  type="button"
                  onClick={() => handleLocaleSwitch('en')}
                  className={`min-h-[30px] rounded-md px-2.5 py-1 font-mono font-bold ${
                    locale === 'en' ? 'bg-[#5DE1D2] text-black' : 'text-muted'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleLocaleSwitch('uz')}
                  className={`min-h-[30px] rounded-md px-2.5 py-1 font-mono font-bold ${
                    locale === 'uz' ? 'bg-[#5DE1D2] text-black' : 'text-muted'
                  }`}
                >
                  O‘Z
                </button>
              </div>
              <PWAInstallButton label={strings.installApp} />
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 overflow-x-clip p-4 sm:p-6 lg:p-8">
          {/* NEOBRUTALIST /login AND /register ROUTES */}
          {(activeTab === 'login' || activeTab === 'register') && (
            <AuthPageView
              mode={activeTab}
              locale={locale}
              sandboxEnabled={health.sandboxEnabled}
              intendedDestination={intendedDestination}
              onSwitchMode={(nextMode) => {
                setActiveTab(nextMode);
                syncBrowserPath(nextMode, { redirectTo: intendedDestination?.path ?? '/overview' });
              }}
              onBackToOverview={() => navigateToTab('overview')}
              onAuthenticated={handleUserAuthenticated}
            />
          )}

          {/* OVERVIEW & DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <KineticHeroSection
                locale={locale}
                isAuthenticated={Boolean(user)}
                sharingProgress={sharingProgress}
                shareFeedback={shareFeedback}
                activeCoursesCount={enrollments.length}
                currentStreak={streak.currentStreak}
                totalXp={totalXp}
                certificatesCount={certificates.length}
                streakPopActive={celebrationEvent?.kind === 'streak_reached'}
                onExploreCatalog={() => navigateToTab('catalog')}
                onSignIn={() => navigateToLogin()}
                onShareProgress={() => void handleShareProgress()}
              />

              {/* Daily Study Goal Ring & 7-Day XP Progress Chart */}
              <div className="relative z-10 grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <DailyStudyGoalCard
                    locale={locale}
                    isAuthenticated={Boolean(user)}
                    completedMinutesToday={studyMinutesToday}
                    targetMinutes={dailyStudyGoalMinutes}
                    onUpdateTarget={handleUpdateDailyGoal}
                    onRequireAuth={() => navigateToLogin()}
                  />
                </div>
                <div className="lg:col-span-7">
                  <StudyProgressChart
                    locale={locale}
                    isAuthenticated={Boolean(user)}
                    xpLedger={xpLedger}
                    timeZone={user?.timezone || streak.timezone || 'Asia/Tashkent'}
                    onRequireAuth={() => navigateToLogin()}
                  />
                </div>
              </div>

              {/* Weakness Detection Card (Radar Chart + Blocky List View Toggle) */}
              <WeaknessDetectionCard
                locale={locale}
                weaknessAnalysis={weaknessAnalysis}
                courses={courses}
                enrollments={enrollments}
                expandedWeaknessIds={expandedWeaknessIds}
                savedWeaknessNoteIds={savedWeaknessNoteIds}
                onToggleExpand={(id) =>
                  setExpandedWeaknessIds((prev) =>
                    toggleExpandedRecommendationId(prev, id)
                  )
                }
                onSaveToNotes={handleSaveWeaknessToNotes}
                onReviewLesson={(courseId, lessonIndex) =>
                  void openCourse(courseId, locale, { lessonIndex })
                }
              />

              {/* Horizontal Pinned GSAP ScrollTrigger Course Showcase */}
              <CourseShowcase
                locale={locale}
                courses={courses}
                enrollments={enrollments}
                bookmarkedCourseIds={user?.bookmarkedCourseIds ?? []}
                bookmarkBusyId={bookmarkBusyId}
                onOpenCourse={(courseId, openLocale, lessonIndex) =>
                  void openCourse(
                    courseId,
                    openLocale,
                    typeof lessonIndex === 'number' ? { lessonIndex } : undefined
                  )
                }
                onToggleBookmark={(courseId) => void handleToggleBookmark(courseId)}
              />

              {/* Neobrutalist Dotted Section Divider: Economics */}
              <NeobrutalistSectionDivider subject="Economics" locale={locale} indexLabel="01" />

              {/* Economics Subject Section ("Data & Flow" WebGL Liquid Shader + Neobrutalist Overlay) */}
              <EconomicsSection
                locale={locale}
                courses={courses}
                enrollments={enrollments}
                bookmarkedCourseIds={user?.bookmarkedCourseIds ?? []}
                bookmarkBusyId={bookmarkBusyId}
                swStatus={swStatus}
                cachedEditionKeys={cachedEditionKeys}
                showFixedShaderBackground={false}
                onOpenCourse={(courseId, openLocale) => void openCourse(courseId, openLocale)}
                onToggleBookmark={(courseId) => void handleToggleBookmark(courseId)}
              />

              {/* Neobrutalist Dotted Section Divider: Mathematics */}
              <NeobrutalistSectionDivider subject="Mathematics" locale={locale} indexLabel="02" />

              {/* Mathematics Subject Section ("Precision & The Human Touch" Chalkboard SVG + GSAP DrawSVG) */}
              <MathematicsSection
                locale={locale}
                courses={courses}
                enrollments={enrollments}
                bookmarkedCourseIds={user?.bookmarkedCourseIds ?? []}
                bookmarkBusyId={bookmarkBusyId}
                swStatus={swStatus}
                cachedEditionKeys={cachedEditionKeys}
                onOpenCourse={(courseId, openLocale) => void openCourse(courseId, openLocale)}
                onToggleBookmark={(courseId) => void handleToggleBookmark(courseId)}
              />

              {/* Neobrutalist Dotted Section Divider: Business */}
              <NeobrutalistSectionDivider subject="Business" locale={locale} indexLabel="03" />

              {/* Business Subject Section ("Structure & High-Impact" Asymmetrical Bento + GSAP Pin & Stack) */}
              <BusinessSection
                locale={locale}
                courses={courses}
                enrollments={enrollments}
                bookmarkedCourseIds={user?.bookmarkedCourseIds ?? []}
                bookmarkBusyId={bookmarkBusyId}
                swStatus={swStatus}
                cachedEditionKeys={cachedEditionKeys}
                onOpenCourse={(courseId, openLocale) => void openCourse(courseId, openLocale)}
                onToggleBookmark={(courseId) => void handleToggleBookmark(courseId)}
              />

              {/* Featured Courses Preview */}
              <section className="relative z-10 isolate mt-8 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-ink">
                    {locale === 'uz' ? 'Nashr etilgan kurslar' : 'Published Curriculum'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className="text-xs font-medium text-teal hover:underline"
                  >
                    {locale === 'uz' ? 'Barchasini filtrlash' : 'Filter all courses'}
                  </button>
                </div>

                {catalogLoading ? (
                  <div className="rounded-xl border-2 border-slate-500 bg-white/25 p-6 text-sm text-muted shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
                    {strings.overview.loadingCourses}
                  </div>
                ) : catalogError ? (
                  <div className="rounded-xl border-2 border-danger/60 bg-danger-surface/40 p-6 text-sm text-danger-text shadow-[8px_8px_0px_#000000] backdrop-blur-2xl">
                    {catalogError}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {courses.map((course, idx) => {
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
                        <MagneticCourseCard
                          key={course.id}
                          testId={`overview-course-card-${course.id}`}
                          subject={course.subject}
                          artifactIndex={idx}
                          className="flex flex-col justify-between rounded-xl border-2 border-slate-500 bg-white/25 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
                        >
                          <div>
                            <div className="text-xs font-medium text-muted">
                              {strings.subjects[course.subject]} · {strings.levels[course.level]} · {course.estimatedMinutes} {strings.overview.minUnit}
                            </div>
                            <h3 className="mt-2 text-base font-bold text-ink">
                              {ed ? ed.title : course.editions.en?.title || course.slug}
                            </h3>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted">
                              {ed ? ed.subtitle : strings.editionMissingNote}
                            </p>
                          </div>

                          <div className="mt-5 space-y-3 border-t-2 border-theme-border pt-3">
                            {enr && (
                              <div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-teal">{strings.journey[enr.journeyStatus]}</span>
                                  <span className="font-mono tabular-nums text-muted">{pct}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-canvas border border-theme-border">
                                  <div className="h-full bg-theme-accent" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={!ed}
                              onClick={() => openCourse(course.id, locale)}
                              className="min-h-[40px] w-full rounded-lg bg-theme-base border-2 border-theme-border px-3 py-2 text-xs font-bold text-ink shadow-brutal-sm hover:border-theme-accent disabled:opacity-50"
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
                        </MagneticCourseCard>
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
              <header className="rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h1 className="text-xl font-semibold text-ink sm:text-2xl">
                    {strings.catalog.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        swStatus === 'active' ? 'text-teal' : 'text-muted'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          swStatus === 'active'
                            ? 'bg-success'
                            : swStatus === 'registering'
                            ? 'bg-warning animate-pulse'
                            : 'bg-muted'
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {swStatus === 'active'
                          ? strings.catalog.swActive
                          : swStatus === 'registering'
                          ? strings.catalog.swPending
                          : strings.catalog.swUnavailable}
                      </span>
                    </span>
                    {!catalogLoading && (
                      <span className="font-mono tabular-nums text-muted" aria-live="polite">
                        {filteredCourses.length} / {courses.length}{' '}
                        {locale === 'uz' ? 'kurs' : filteredCourses.length === 1 ? 'course' : 'courses'}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {strings.catalog.subtitleTaxonomy}
                </p>

                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <label htmlFor="catalog-search-input" className="sr-only">
                      {strings.catalog.searchLabel}
                    </label>
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <input
                      id="catalog-search-input"
                      data-testid="catalog-search-input"
                      type="text"
                      value={searchQuery}
                      onFocus={() => setSearchDropdownOpen(true)}
                      onBlur={() => {
                        if (searchQuery.trim().length >= 2) {
                          recordRecentSearch(searchQuery);
                        }
                        window.setTimeout(() => setSearchDropdownOpen(false), 180);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
                          recordRecentSearch(searchQuery);
                          setSearchDropdownOpen(false);
                        } else if (e.key === 'Escape') {
                          setSearchDropdownOpen(false);
                        }
                      }}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchDropdownOpen(true);
                      }}
                      placeholder={
                        locale === 'uz'
                          ? 'Kurs nomi, mavzu yoki dars sarlavhasi bo‘yicha qidirish...'
                          : 'Search by course title, topic label, or specific lesson title...'
                      }
                      aria-label={strings.catalog.searchLabel}
                      className="min-h-[42px] w-full rounded-lg border-2 border-theme-border bg-theme-base pl-10 pr-10 py-2 text-sm text-ink placeholder:text-muted transition-colors focus:border-theme-accent focus:outline-none"
                    />
                    {searchQuery.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (searchQuery.trim().length >= 2) {
                            recordRecentSearch(searchQuery);
                          }
                          setSearchQuery('');
                        }}
                        aria-label={strings.catalog.clearSearch}
                        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-ink"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}

                    {/* Recent Searches Dropdown (stores last 5 unique queries in localStorage) */}
                    {searchDropdownOpen && recentSearches.length > 0 && (
                      <div
                        data-testid="catalog-recent-searches-dropdown"
                        className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-xl border-2 border-slate-500 bg-white/30 p-3 shadow-[8px_8px_0px_#000000] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-theme-border pb-2 text-[11px] font-semibold text-muted">
                          <span>
                            {locale === 'uz'
                              ? 'So‘nggi qidiruvlar (oxirgi 5 ta)'
                              : 'Recent Searches (Last 5)'}
                          </span>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setRecentSearches(saveRecentSearches([]));
                            }}
                            data-testid="clear-recent-searches-btn"
                            className="text-theme-accent hover:underline"
                          >
                            {locale === 'uz' ? 'Tozalash' : 'Clear'}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {recentSearches.map((q, idx) => (
                            <button
                              key={q}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSearchQuery(q);
                                recordRecentSearch(q);
                                setSearchDropdownOpen(false);
                              }}
                              data-testid={`recent-search-item-${idx}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-base px-2.5 py-1 text-xs font-medium text-ink hover:border-theme-accent hover:text-theme-accent"
                            >
                              <Search className="h-3 w-3 text-muted" aria-hidden="true" />
                              <span>{q}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-chrome p-1 text-xs">
                      {(['ALL', 'Economics', 'Mathematics', 'Business'] as const).map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSubjectFilter(sub)}
                          className={`min-h-[34px] rounded-md px-3 py-1 font-medium whitespace-nowrap ${
                            subjectFilter === sub ? 'bg-elevated text-teal' : 'text-muted hover:text-ink'
                          }`}
                        >
                          {sub === 'ALL' ? strings.allSubjects : strings.subjects[sub]}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-chrome p-1 text-xs">
                      {(['ALL', 'Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setLevelFilter(lvl)}
                          className={`min-h-[34px] rounded-md px-3 py-1 font-medium whitespace-nowrap ${
                            levelFilter === lvl ? 'bg-elevated text-accent' : 'text-muted hover:text-ink'
                          }`}
                        >
                          {lvl === 'ALL' ? strings.allLevels : strings.levels[lvl]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </header>

              {(subjectFilter === 'ALL' || subjectFilter === 'Economics') && (
                <>
                  <NeobrutalistSectionDivider subject="Economics" locale={locale} indexLabel="01" />
                  <EconomicsSection
                    locale={locale}
                    courses={filteredCourses}
                    enrollments={enrollments}
                    bookmarkedCourseIds={user?.bookmarkedCourseIds ?? []}
                    bookmarkBusyId={bookmarkBusyId}
                    swStatus={swStatus}
                    cachedEditionKeys={cachedEditionKeys}
                    showFixedShaderBackground={false}
                    onOpenCourse={(courseId, openLocale) => void openCourse(courseId, openLocale)}
                    onToggleBookmark={(courseId) => void handleToggleBookmark(courseId)}
                  />
                </>
              )}

              {(subjectFilter === 'ALL' || subjectFilter === 'Mathematics') && (
                <>
                  <NeobrutalistSectionDivider subject="Mathematics" locale={locale} indexLabel="02" />
                  <MathematicsSection
                    locale={locale}
                    courses={filteredCourses}
                    enrollments={enrollments}
                    bookmarkedCourseIds={user?.bookmarkedCourseIds ?? []}
                    bookmarkBusyId={bookmarkBusyId}
                    swStatus={swStatus}
                    cachedEditionKeys={cachedEditionKeys}
                    onOpenCourse={(courseId, openLocale) => void openCourse(courseId, openLocale)}
                    onToggleBookmark={(courseId) => void handleToggleBookmark(courseId)}
                  />
                </>
              )}

              {(subjectFilter === 'ALL' || subjectFilter === 'Business') && (
                <>
                  <NeobrutalistSectionDivider subject="Business" locale={locale} indexLabel="03" />
                  <BusinessSection
                    locale={locale}
                    courses={filteredCourses}
                    enrollments={enrollments}
                    bookmarkedCourseIds={user?.bookmarkedCourseIds ?? []}
                    bookmarkBusyId={bookmarkBusyId}
                    swStatus={swStatus}
                    cachedEditionKeys={cachedEditionKeys}
                    onOpenCourse={(courseId, openLocale) => void openCourse(courseId, openLocale)}
                    onToggleBookmark={(courseId) => void handleToggleBookmark(courseId)}
                  />
                </>
              )}

              {filteredCourses.length === 0 ? (
                <div className="relative z-10 isolate mt-8 rounded-xl border-2 border-slate-500 bg-white/25 p-8 text-center text-sm text-muted shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
                  <p>{strings.catalog.noMatches}</p>
                  {hasActiveCatalogFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSubjectFilter('ALL');
                        setLevelFilter('ALL');
                      }}
                      className="mt-4 min-h-[38px] rounded-lg border-2 border-theme-border bg-white/60 dark:bg-[#080B14]/60 px-4 py-1.5 text-xs font-semibold text-ink shadow-brutal-sm transition-colors hover:border-theme-accent"
                    >
                      {strings.catalog.resetFilters}
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative z-10 isolate mt-8 grid gap-4 md:grid-cols-2">
                  {filteredCourses.map((course, idx) => {
                    const ed = course.editions[locale];
                    const hasEn = Boolean(course.editions.en);
                    const hasUz = Boolean(course.editions.uz);
                    const enr = enrollments.find((e) => e.courseId === course.id);
                    const courseTitle = ed ? ed.title : course.editions.en?.title || course.slug;
                    const bookmarked = user
                      ? isCourseBookmarked(user.bookmarkedCourseIds ?? [], course.id)
                      : false;
                    const offlineStatus = resolveCourseOfflineStatus({
                      swStatus,
                      cachedEditionKeys,
                      courseId: course.id,
                      locale,
                      hasEditionInLocale: Boolean(ed),
                    });
                    const topicLabels = getCourseTopicLabels(course, locale);
                    const matchedLessons = getMatchingLessonTitles(course, searchQuery, locale);

                    return (
                      <MagneticCourseCard
                        key={course.id}
                        testId={`catalog-course-card-${course.id}`}
                        subject={course.subject}
                        artifactIndex={idx}
                        className="flex flex-col justify-between rounded-xl border-2 border-slate-500 bg-white/25 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                                <span>
                                  {strings.subjects[course.subject]} · {strings.levels[course.level]}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {strings.catalog.editionsLabel} {hasEn ? 'EN' : ''}{hasEn && hasUz ? ' / ' : ''}{hasUz ? 'O‘Z' : ''}
                                </span>
                              </div>

                              {/* Small Color-Coded Topic Labels */}
                              {topicLabels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {topicLabels.map((lbl) => (
                                    <span
                                      key={lbl.id}
                                      data-testid="course-topic-label"
                                      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${
                                        lbl.colorVariant === 'cyan'
                                          ? 'border-theme-cyan/50 bg-theme-cyan/10 text-theme-cyan'
                                          : lbl.colorVariant === 'emerald'
                                          ? 'border-theme-emerald/50 bg-theme-emerald/10 text-theme-emerald'
                                          : lbl.colorVariant === 'violet'
                                          ? 'border-theme-accent/50 bg-theme-accent/15 text-theme-accent'
                                          : 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                                      }`}
                                    >
                                      {lbl.label}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <h2 className="mt-2 text-lg font-semibold text-ink">
                                {courseTitle}
                              </h2>
                            </div>
                            <button
                              type="button"
                              disabled={bookmarkBusyId === course.id}
                              onClick={() => void handleToggleBookmark(course.id)}
                              aria-label={`${bookmarked ? strings.bookmarks.removeLabel : strings.bookmarks.addLabel}: ${courseTitle}`}
                              aria-pressed={bookmarked}
                              title={bookmarked ? strings.bookmarks.removeLabel : strings.bookmarks.addLabel}
                              data-testid={`catalog-bookmark-btn-${course.id}`}
                              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                                bookmarked
                                  ? 'border-accent/60 bg-accent/15 text-accent hover:bg-accent/25'
                                  : 'border-line bg-chrome text-muted hover:border-line-strong hover:text-ink'
                              }`}
                            >
                              <Bookmark
                                className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted">
                            {ed ? ed.description : strings.editionMissingNote}
                          </p>

                          {/* Matched Lesson Content Titles when searching */}
                          {matchedLessons.length > 0 && (
                            <div
                              data-testid="course-matched-lesson-badge"
                              className="mt-2.5 rounded-lg border border-theme-cyan/40 bg-theme-base px-3 py-2 text-xs"
                            >
                              <span className="font-semibold text-theme-cyan">
                                {locale === 'uz' ? 'Mos kelgan dars: ' : 'Matching Lesson: '}
                              </span>
                              <span className="text-ink">{matchedLessons.join(' · ')}</span>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            {ed ? (
                              <span className="text-xs text-muted">
                                {formatTemplate(strings.catalog.cardMetaSummary, {
                                  lessons: ed.lessonCount,
                                  minutes: ed.estimatedMinutes,
                                  pass: ed.passingScorePercent,
                                })}
                              </span>
                            ) : (
                              <span />
                            )}
                            <span
                              data-offline-status={offlineStatus}
                              title={
                                offlineStatus === 'cached_full'
                                  ? strings.catalog.offlineCachedHint
                                  : offlineStatus === 'not_cached'
                                  ? strings.catalog.offlineNotCachedHint
                                  : undefined
                              }
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                                offlineStatus === 'cached_full'
                                  ? 'border-success/40 bg-success/10 text-success'
                                  : 'border-line bg-chrome text-muted'
                              }`}
                            >
                              {offlineStatus === 'cached_full' ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span>{strings.catalog.offlineCached}</span>
                                </>
                              ) : offlineStatus === 'sw_pending' ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                                  <span>{strings.catalog.offlineChecking}</span>
                                </>
                              ) : (
                                <>
                                  <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span>
                                    {offlineStatus === 'sw_unavailable'
                                      ? strings.catalog.offlineUnavailable
                                      : strings.catalog.offlineNotCached}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                          {enr ? (
                            <span className="text-xs font-medium text-teal">
                              {strings.journey[enr.journeyStatus]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">{strings.catalog.publicPreviewAvailable}</span>
                          )}
                          <button
                            type="button"
                            disabled={!ed}
                            onClick={() => openCourse(course.id, locale)}
                            className="min-h-[40px] rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-2 text-xs font-bold text-theme-accent-ink shadow-brutal-sm hover:bg-accent-hover disabled:opacity-50"
                          >
                            {ed ? strings.catalog.openCourseEdition : strings.catalog.unavailableInLocale}
                          </button>
                        </div>
                      </MagneticCourseCard>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* COURSE DETAIL & LESSON WORKSPACE */}
          {activeTab === 'course' && (
            <div data-print-section="course-detail" className="relative space-y-6">
              <div data-print-hide="course-nav" className="no-print relative z-10 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="text-xs font-medium text-teal hover:underline"
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
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink"
                  >
                    {activeEnrollment.journeyStatus === 'paused' ? (
                      <>
                        <PlayCircle className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                        <span>{strings.courseDetail.resumeJourney}</span>
                      </>
                    ) : (
                      <>
                        <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{strings.courseDetail.pauseCourse}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {courseLoading ? (
                <div className="relative z-10 rounded-xl border-2 border-slate-500 bg-white/25 p-8 text-sm text-muted shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
                  {strings.courseDetail.loadingEdition}
                </div>
              ) : courseError || !courseDetail ? (
                <div className="relative z-10 rounded-xl border-2 border-warning/60 bg-white/25 p-6 text-sm text-warning shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:bg-[#101522]/25">
                  {courseError || strings.editionMissingNote}
                </div>
              ) : (
                <div className="relative z-10 space-y-6">
                  {/* Course Metadata & Completion Criteria */}
                  <section className="rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
                    {(() => {
                      const detailBookmarked = user
                        ? isCourseBookmarked(user.bookmarkedCourseIds ?? [], courseDetail.course.id)
                        : false;
                      return (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span>
                                {strings.subjects[courseDetail.course.subject]} · {strings.levels[courseDetail.course.level]} ·{' '}
                                {courseDetail.edition.locale === 'uz' ? strings.editionUz : strings.editionEn} (v{courseDetail.edition.version})
                              </span>
                              {activeEnrollment && (
                                <span className="font-semibold text-teal">
                                  · {strings.journey[activeEnrollment.journeyStatus]}
                                </span>
                              )}
                            </div>
                            <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                              {courseDetail.edition.title}
                            </h1>
                          </div>

                          <button
                            type="button"
                            disabled={bookmarkBusyId === courseDetail.course.id}
                            onClick={() => void handleToggleBookmark(courseDetail.course.id)}
                            aria-label={`${detailBookmarked ? strings.bookmarks.removeLabel : strings.bookmarks.addLabel}: ${courseDetail.edition.title}`}
                            aria-pressed={detailBookmarked}
                            data-testid="course-detail-bookmark-btn"
                            className={`no-print inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              detailBookmarked
                                ? 'border-accent/60 bg-accent/15 text-accent hover:bg-accent/25'
                                : 'border-line bg-chrome text-muted hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            <Bookmark
                              className={`h-4 w-4 ${detailBookmarked ? 'fill-current' : ''}`}
                              aria-hidden="true"
                            />
                            <span>
                              {detailBookmarked
                                ? strings.bookmarks.bookmarkedLabel
                                : strings.bookmarks.buttonLabel}
                            </span>
                          </button>
                        </div>
                      );
                    })()}
                    <p className="mt-1.5 text-sm text-muted">{courseDetail.edition.description}</p>

                    <div className="mt-4 grid gap-4 border-t border-line pt-4 text-xs md:grid-cols-3">
                      <div>
                        <div className="font-semibold text-ink">{strings.courseDetail.learningOutcomes}</div>
                        <ul className="mt-1 space-y-1 text-muted">
                          {courseDetail.edition.outcomes.map((o, i) => (
                            <li key={i}>• {o}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-ink">{strings.courseDetail.prerequisites}</div>
                        <ul className="mt-1 space-y-1 text-muted">
                          {courseDetail.edition.prerequisites.map((p, i) => (
                            <li key={i}>• {p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-ink">{strings.courseDetail.certificateCriteria}</div>
                        <p className="mt-1 text-muted">{courseDetail.edition.completionRules}</p>
                      </div>
                    </div>
                  </section>

                  {/* Interactive D3 Course Map: Prerequisites, Lessons & Assessment Flow */}
                  <div className="no-print">
                    <CourseMap
                      courseId={courseDetail.course.id}
                      prerequisites={courseDetail.edition.prerequisites}
                      lessons={courseDetail.lessons}
                      assessment={courseDetail.assessment}
                      completedLessonIds={activeEnrollment?.completedLessonIds ?? []}
                      passedAssessment={activeEnrollment?.passedAssessment ?? false}
                      activeLessonIndex={activeLessonIndex}
                      locale={courseDetail.edition.locale}
                      onSelectLesson={(idx) => setActiveLessonIndex(idx)}
                      onSelectAssessment={() => setActiveLessonIndex('assessment')}
                    />
                  </div>

                  {/* Printable Full Syllabus & Lesson Notes & Assessment Record (active in @media print) */}
                  <div className="hidden print:block w-full space-y-4 my-6">
                    <div className="border-b-2 border-black pb-3">
                      <h2 className="font-display text-lg font-black uppercase tracking-wider text-black">
                        {locale === 'uz' ? 'Kurs dasturi va o‘quv rejasi' : 'Complete Course Syllabus & Progress Record'}
                      </h2>
                      <p className="text-xs text-black/70 mt-1">
                        {courseDetail.edition.title} · {courseDetail.course.subject} ({courseDetail.course.level}) · {courseDetail.lessons.length} {locale === 'uz' ? 'dars' : 'lessons'}
                      </p>
                    </div>

                    <table className="print-syllabus-table w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-2 border-black text-left text-xs uppercase font-bold text-black">
                          <th className="p-2 border-2 border-black w-12 text-center">#</th>
                          <th className="p-2 border-2 border-black">
                            {locale === 'uz' ? 'Dars mavzusi va o‘quv maqsadi' : 'Lesson Topic & Objectives'}
                          </th>
                          <th className="p-2 border-2 border-black w-28 text-center">
                            {locale === 'uz' ? 'Holat' : 'Status'}
                          </th>
                          <th className="p-2 border-2 border-black w-56">
                            {locale === 'uz' ? 'Talaba qaydlari' : 'Lesson Notes & Key Formulas'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {courseDetail.lessons.map((les) => {
                          const isDone = activeEnrollment?.completedLessonIds.includes(les.id) ?? false;
                          const note = user?.lessonNotes?.[les.id];
                          return (
                            <tr key={les.id} className="border-2 border-black print-break-inside-avoid">
                              <td className="p-2 border-2 border-black font-mono font-bold text-center align-top">
                                {les.sequenceNum}
                              </td>
                              <td className="p-2 border-2 border-black align-top">
                                <div className="font-bold text-black">{les.title}</div>
                                <ul className="mt-1 list-disc list-inside text-[11px] text-black/80 space-y-0.5">
                                  {les.objectives.map((obj, i) => (
                                    <li key={i}>{obj}</li>
                                  ))}
                                </ul>
                              </td>
                              <td className="p-2 border-2 border-black text-center align-top font-mono font-bold">
                                {isDone ? (
                                  <span className="text-black font-bold">✓ COMPLETED</span>
                                ) : (
                                  <span className="text-black/60 font-medium">○ PENDING</span>
                                )}
                              </td>
                              <td className="p-2 border-2 border-black align-top font-mono text-[10.5px]">
                                {note ? (
                                  <div className="whitespace-pre-wrap text-black">{note}</div>
                                ) : (
                                  <span className="italic text-black/50">
                                    {locale === 'uz' ? 'Qaydlar kiritilmagan' : 'No personal notes recorded'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Final Assessment Score Summary for Print */}
                    {courseDetail.assessment && (
                      <div className="border-2 border-black p-4 mt-4 print-break-inside-avoid bg-slate-50">
                        <div className="flex items-center justify-between border-b border-black pb-2">
                          <div className="font-black text-sm uppercase text-black">
                            {locale === 'uz' ? 'Yakuniy baholash natijasi' : 'Final Assessment Mastery Record'}
                          </div>
                          <div className="font-mono text-xs font-bold text-black">
                            {locale === 'uz' ? 'Talab: kamida 75%' : 'Passing Threshold: 75%'}
                          </div>
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="font-bold text-black">{courseDetail.assessment.title}</span>
                            <div className="text-[11px] text-black/80 mt-0.5">
                              {courseDetail.assessment.questions.length} {locale === 'uz' ? 'ta savol' : 'quantitative questions'}
                            </div>
                          </div>
                          <div className="font-mono text-right">
                            <div className="font-bold text-sm text-black">
                              {activeEnrollment?.passedAssessment
                                ? `PASSED · BEST SCORE: ${activeEnrollment.bestScorePercent ?? 100}%`
                                : activeEnrollment?.bestScorePercent !== null && activeEnrollment?.bestScorePercent !== undefined
                                ? `ATTEMPTED · ${activeEnrollment.bestScorePercent}% (75% REQUIRED)`
                                : 'STATUS: NOT YET ATTEMPTED'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Syllabus + Active Lesson/Assessment Split */}
                  <div className="grid gap-6 lg:grid-cols-12">
                    <aside data-print-hide="course-syllabus" className="no-print min-w-0 space-y-5 lg:col-span-4">
                      <div className="rounded-xl border-2 border-slate-500 bg-white/25 p-4 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-xs font-semibold text-muted">
                            {locale === 'uz' ? 'Kurs dasturi' : 'Course Syllabus'}
                          </h2>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="syllabus-download-pdf-btn"
                              onClick={() => window.print()}
                              title={
                                locale === 'uz'
                                  ? 'Kurs dasturini PDF formatida yuklab olish yoki chop etish'
                                  : 'Download or print the Course Syllabus as a PDF'
                              }
                              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-[11px] font-bold text-ink shadow-brutal-sm transition-all hover:border-theme-accent hover:text-theme-accent active:translate-x-[1px] active:translate-y-[1px]"
                            >
                              <Printer className="h-3 w-3 text-theme-cyan" aria-hidden="true" />
                              <span>{locale === 'uz' ? 'PDF yuklab olish' : 'Download PDF'}</span>
                            </button>
                            <button
                              type="button"
                              data-testid="syllabus-sync-now-btn"
                              disabled={syncingSyllabus}
                              onClick={() => void handleSyncCourseProgress()}
                              title={
                                locale === 'uz'
                                  ? 'Mahalliy (localStorage) va serverdagi tugallangan darslarni qo‘lda sinxronlash'
                                  : 'Reconcile completed lesson IDs between localStorage and server'
                              }
                              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-1 font-mono text-[11px] font-bold text-ink shadow-brutal-sm transition-all hover:border-theme-accent hover:text-theme-accent active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-60"
                            >
                              <RefreshCw
                                className={`h-3 w-3 text-theme-cyan ${syncingSyllabus ? 'animate-spin' : ''}`}
                                aria-hidden="true"
                              />
                              <span>
                                {syncingSyllabus
                                  ? locale === 'uz'
                                    ? 'Sinxronlanmoqda...'
                                    : 'Syncing...'
                                  : locale === 'uz'
                                  ? 'Hozir sinxronlash'
                                  : 'Sync Now'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const pendingLocalCount = reconcileCompletedLessonIds({
                            localIds: localSyllabusCompletedIds,
                            serverIds: activeEnrollment?.completedLessonIds ?? [],
                            validCourseLessonIds: courseDetail.lessons.map((l) => l.id),
                          }).missingOnServer.length;

                          if (!syllabusSyncNote && pendingLocalCount === 0) return null;

                          return (
                            <div
                              role="status"
                              data-testid="syllabus-sync-status"
                              className={`mt-2.5 flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                                syllabusSyncNote?.kind === 'error'
                                  ? 'border-danger/60 bg-danger-surface/40 text-danger-text'
                                  : syllabusSyncNote?.kind === 'ok'
                                  ? 'border-theme-emerald/50 bg-theme-base/70 text-theme-emerald'
                                  : 'border-theme-border bg-theme-base/70 text-muted'
                              }`}
                            >
                              <span className="min-w-0 leading-snug">
                                {syllabusSyncNote
                                  ? `${syllabusSyncNote.text}${
                                      syllabusSyncNote.syncedAt ? ` · ${syllabusSyncNote.syncedAt}` : ''
                                    }`
                                  : locale === 'uz'
                                  ? `${pendingLocalCount} ta mahalliy dars sinxronlashni kutmoqda`
                                  : `${pendingLocalCount} local completion pending server sync`}
                              </span>
                              {!user && (
                                <button
                                  type="button"
                                  onClick={() => setAuthOpen(true)}
                                  className="shrink-0 font-semibold text-theme-accent underline"
                                >
                                  {strings.signIn}
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        <div className="mt-3 space-y-1.5">
                          {courseDetail.lessons.map((les, idx) => {
                            const serverDone =
                              activeEnrollment?.completedLessonIds.includes(les.id) ?? false;
                            const localPending =
                              !serverDone && localSyllabusCompletedIds.includes(les.id);
                            const isSelected = activeLessonIndex === idx;
                            return (
                              <button
                                key={les.id}
                                type="button"
                                onClick={() => setActiveLessonIndex(idx)}
                                className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                  isSelected
                                    ? 'border-accent bg-elevated text-ink'
                                    : 'border-line bg-chrome text-muted hover:text-ink'
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
                                  <span className="truncate">{les.sequenceNum}. {les.title}</span>
                                </span>
                                {serverDone ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Completed" />
                                ) : localPending ? (
                                  <span
                                    title={
                                      locale === 'uz'
                                        ? 'Mahalliy saqlangan — Sync Now tugmasini bosing'
                                        : 'Saved locally — click Sync Now to upload'
                                    }
                                    className="shrink-0 rounded border border-theme-amber/60 bg-theme-base px-1.5 py-0.5 font-mono text-[10px] font-semibold text-theme-amber"
                                  >
                                    {locale === 'uz' ? 'Mahalliy' : 'Local'}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}

                          {courseDetail.assessment && (
                            <button
                              type="button"
                              onClick={() => setActiveLessonIndex('assessment')}
                              className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                activeLessonIndex === 'assessment'
                                  ? 'border-teal bg-elevated text-ink'
                                  : 'border-line bg-chrome text-muted hover:text-ink'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                <span className="truncate">
                                  {locale === 'uz' ? 'Yakuniy baholash' : 'Final Course Assessment'}
                                </span>
                              </span>
                              {activeEnrollment?.passedAssessment && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Passed" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <FocusTimerPanel
                        locale={locale}
                        timer={focusTimer}
                        audio={ambientAudio}
                        variant="card"
                        lessonTitle={
                          typeof activeLessonIndex === 'number'
                            ? courseDetail.lessons[activeLessonIndex]?.title
                            : undefined
                        }
                      />
                    </aside>

                    <div data-print-content="course-main" className="min-w-0 lg:col-span-8">
                      {typeof activeLessonIndex === 'number' && courseDetail.lessons[activeLessonIndex] && (
                        <LessonPlayer
                          courseId={courseDetail.course.id}
                          courseTitle={courseDetail.edition.title}
                          lesson={courseDetail.lessons[activeLessonIndex]}
                          locale={courseDetail.edition.locale}
                          focusTimer={focusTimer}
                          ambientAudio={ambientAudio}
                          isCompleted={
                            activeEnrollment?.completedLessonIds.includes(
                              courseDetail.lessons[activeLessonIndex].id
                            ) ?? false
                          }
                          isAuthenticated={Boolean(user)}
                          profileNotes={user?.lessonNotes}
                          onSyncNotesToProfile={async (nextNotes) => {
                            if (!user) return;
                            const res = await apiFetch('/api/me/profile', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ lessonNotes: nextNotes }),
                            });
                            if (res.ok) {
                              const data = (await res.json()) as { user?: UserSummary };
                              if (data.user) setUser(data.user);
                            }
                          }}
                          onCompleteLesson={handleCompleteLesson}
                          onRequireAuth={() =>
                            navigateToLogin({
                              tab: 'course',
                              path: buildPathForTab('course', { courseId: courseDetail.course.id }),
                              courseId: courseDetail.course.id,
                              lessonIndex: activeLessonIndex,
                            })
                          }
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
                          courseId={courseDetail.course.id}
                          assessment={courseDetail.assessment}
                          locale={courseDetail.edition.locale}
                          isAuthenticated={Boolean(user)}
                          onRequireAuth={() =>
                            navigateToLogin({
                              tab: 'course',
                              path: buildPathForTab('course', { courseId: courseDetail.course.id }),
                              courseId: courseDetail.course.id,
                              lessonIndex: 'assessment',
                            })
                          }
                          onAttemptCompleted={async () => {
                            setWeaknessRefreshTick((t) => t + 1);
                            await Promise.all([
                              loadProtectedData({ allowCelebrate: true }),
                              loadLeaderboard(),
                            ]);
                          }}
                          onViewCertificates={() => navigateToTab('certificates')}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACHIEVEMENTS & NON-CASH XP */}
          {activeTab === 'achievements' && (
            <AchievementsView
              locale={locale}
              isAuthenticated={Boolean(user)}
              overviewLoaded={sessionLoaded}
              totalXp={totalXp}
              xpToday={xpToday}
              xpLedger={xpLedger}
              streak={streak}
              badges={badges}
              onRequireAuth={() =>
                navigateToLogin({
                  tab: 'achievements',
                  path: '/achievements',
                })
              }
            />
          )}

          {/* COMMUNITY / OPT-IN LEADERBOARD & REFERRALS */}
          {activeTab === 'community' && (
            <CommunityView
              locale={locale}
              user={user}
              cohortName={cohortName}
              entries={leaderboard}
              quizEntries={quizLeaderboard}
              weekWindow={weekWindow}
              courses={courses}
              referralCode={referralCode}
              referralsCount={referralsCount}
              claimedReferralCode={claimedReferralCode}
              onToggleLeaderboardOptIn={async (optIn, pseudonym) => {
                if (!user) return;
                const res = await apiFetch('/api/me/profile', {
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
                persistCachedUserSummary(data.user);
                await loadLeaderboard();
              }}
              onClaimReferral={async (code) => {
                const res = await apiFetch('/api/referrals/claim', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code }),
                });
                const data = (await res.json()) as { error?: string };
                if (!res.ok) throw new Error(data.error || 'Could not apply code.');
                await loadProtectedData();
              }}
              onRequireAuth={() =>
                navigateToLogin({
                  tab: 'community',
                  path: '/community',
                })
              }
            />
          )}

          {/* CERTIFICATES & PUBLIC VERIFICATION */}
          {activeTab === 'certificates' && (
            <CertificatesView
              locale={locale}
              isAuthenticated={Boolean(user)}
              certificates={certificates}
              completedLessonsCount={
                new Set(enrollments.flatMap((enr) => enr.completedLessonIds)).size
              }
              initialVerifyToken={verifyTokenFromUrl}
              onRefreshCertificates={loadProtectedData}
              onRequireAuth={() =>
                navigateToLogin({
                  tab: 'certificates',
                  path: '/certificates',
                })
              }
            />
          )}

          {/* PROFILE & POLICIES */}
          {activeTab === 'profile' && (
            <ProfilePoliciesView
              locale={locale}
              user={user}
              courses={courses}
              catalogLoading={catalogLoading}
              enrollments={enrollments}
              xpLedger={xpLedger}
              bookmarkBusyId={bookmarkBusyId}
              swStatus={swStatus}
              cachedEditionKeys={cachedEditionKeys}
              goalNotificationsEnabled={goalNotificationsEnabled}
              notificationPermission={notificationPermission}
              theme={theme}
              themeSyncWithOs={themeSyncWithOs}
              ambientAudio={ambientAudio}
              onToggleThemeSyncWithOs={handleToggleThemeSyncWithOs}
              onSelectManualTheme={handleSelectManualTheme}
              onToggleGoalNotifications={handleToggleGoalNotifications}
              onSendTestNotification={handleSendTestNotification}
              onClearCourseCache={async (courseId, editionLocale) => {
                await clearCachedCourseEdition(courseId, editionLocale);
                await refreshOfflineCache();
              }}
              onToggleBookmark={handleToggleBookmark}
              onOpenBookmarkedCourse={(courseId, openLocale) => {
                void openCourse(courseId, openLocale);
              }}
              onToggleWeeklyDigestEmail={async (enabled) => {
                if (!user) return;
                const res = await apiFetch('/api/me/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ weeklyDigestEmailEnabled: enabled }),
                });
                if (res.ok) {
                  const data = (await res.json()) as { user?: UserSummary };
                  if (data.user) {
                    setUser(data.user);
                    persistCachedUserSummary(data.user);
                  }
                }
              }}
              onUpdateProfile={async (patch) => {
                const res = await apiFetch('/api/me/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(patch),
                });
                const data = (await res.json()) as { user: UserSummary };
                setUser(data.user);
                persistCachedUserSummary(data.user);
                setLocale(data.user.preferredLocale);
                await Promise.all([loadProtectedData(), loadLeaderboard()]);
              }}
              onAccountDeleted={async () => {
                clearClientSessionState();
                setUser(null);
                setEnrollments([]);
                setCertificates([]);
                setStudyMinutesToday(0);
                setDailyStudyGoalMinutes(loadSavedDailyGoalMinutes());
                setGoalNotificationsEnabled(loadSavedGoalNotificationsEnabled());
                setCelebrationEvent(null);
                prevMilestoneSnapshotRef.current = null;
                setActiveTab('overview');
                syncBrowserPath('overview', { replace: true });
              }}
              onRequireAuth={() =>
                navigateToLogin({
                  tab: 'profile',
                  path: '/profile',
                })
              }
            />
          )}

          {/* STAFF EDITORIAL & CONTENT GOVERNANCE STUDIO */}
          {activeTab === 'admin' && isStaff && user && (
            <AdminStudioView
              locale={locale}
              courses={courses}
              aiConfigured={health.aiConfigured}
              onCatalogRefresh={loadCatalog}
              currentUser={{ id: user.id, role: user.role }}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (4 destinations, 56px height) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="no-print fixed bottom-0 left-0 right-0 z-30 grid h-14 grid-cols-4 border-t-2 border-slate-500 bg-white/30 backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30 md:hidden"
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
              onClick={() => navigateToTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-theme-accent' : 'text-muted'
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

      {/* Asynchronous Data Reconciliation HUD (Offline-to-Online Sync Terminal) */}
      <SyncStatusHUD onReconcile={() => loadProtectedData({ allowCelebrate: true })} />

      {/* Competency Node Unlock Overlay (Glass-Brutalism Milestone Celebration) */}
      <NodeUnlockOverlay />

      {/* Auth Modal */}
      {authOpen && (
        <AuthModal
          locale={locale}
          sandboxEnabled={health.sandboxEnabled}
          redirectTo={intendedDestination?.path ?? null}
          onClose={() => {
            pendingBookmarkCourseIdRef.current = null;
            setAuthOpen(false);
          }}
          onAuthenticated={handleUserAuthenticated}
        />
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal (Shift + ?) */}
      {cheatSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={locale === 'uz' ? 'Klaviatura yorliqlari jadvali' : 'Keyboard Shortcuts Cheat Sheet'}
          data-testid="keyboard-shortcuts-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setCheatSheetOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border-2 border-slate-500 bg-white/30 p-6 shadow-[8px_8px_0px_#9274FF] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b-2 border-theme-border pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-md border-2 border-theme-border bg-theme-base px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-theme-cyan">
                  <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Shift + ?</span>
                </div>
                <h2 className="mt-2 font-display text-lg font-extrabold text-ink">
                  {locale === 'uz' ? 'Klaviatura yorliqlari jadvali' : 'Keyboard Shortcuts Cheat Sheet'}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {locale === 'uz'
                    ? 'ECONOVA bo‘ylab tezkor harakatlanish uchun tugmalar kombinatsiyasi.'
                    : 'Navigate rapidly across ECONOVA tabs and modal tools using single-key shortcuts.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheatSheetOpen(false)}
                data-testid="close-shortcuts-modal-btn"
                aria-label={locale === 'uz' ? 'Yopish' : 'Close'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-theme-border bg-theme-base text-muted shadow-brutal-sm hover:border-theme-accent hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
                  {locale === 'uz' ? 'Asosiy navigatsiya' : 'Navigation Shortcuts'}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {shortcutCheatSheet
                    .filter((item) => item.category === 'navigation')
                    .map((item) => {
                      const keyLabel = item.keys.join(' + ');
                      return (
                        <div
                          key={item.id}
                          data-testid={`shortcut-cheat-item-${item.keys.join('-')}`}
                          className="flex items-center justify-between gap-3 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-ink truncate">{item.title}</div>
                            <div className="text-[11px] text-muted truncate">{item.description}</div>
                          </div>
                          <kbd className="inline-flex min-w-[28px] shrink-0 items-center justify-center rounded-md border-2 border-theme-border bg-theme-panel px-2 py-1 font-mono text-xs font-extrabold text-theme-accent shadow-brutal-sm">
                            {keyLabel}
                          </kbd>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
                  {locale === 'uz' ? 'Yordamchi tugmalar' : 'Interface & Modal Controls'}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {shortcutCheatSheet
                    .filter((item) => item.category === 'workspace')
                    .map((item) => {
                      const keyLabel = item.keys.join(' + ');
                      return (
                        <div
                          key={item.id}
                          data-testid={`shortcut-cheat-item-${item.keys.join('-')}`}
                          className="flex items-center justify-between gap-3 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-ink truncate">{item.title}</div>
                            <div className="text-[11px] text-muted truncate">{item.description}</div>
                          </div>
                          <kbd className="inline-flex shrink-0 items-center justify-center rounded-md border-2 border-theme-border bg-theme-panel px-2 py-1 font-mono text-xs font-extrabold text-theme-cyan shadow-brutal-sm">
                            {keyLabel}
                          </kbd>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </SmoothScroll>
  );
}
