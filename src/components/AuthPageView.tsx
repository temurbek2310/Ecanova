import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import type { AgeBand, CourseCatalogItem, LocaleCode, UserSummary } from '../shared/types';
import { computeCatalogStats, formatCatalogStat } from '../lib/catalog-stats';
import type { ThemeMode } from '../lib/theme';
import { t } from '../lib/i18n';
import { notificationCopy } from '../lib/notification-copy';
import { useNotify, useToastSlot } from '../context/NotificationContext';
import {
  apiFetch,
  persistCachedUserSummary,
  readJsonSafely,
  readOAuthPopupMessage,
  startGooglePopupSignIn,
  subscribeToOAuthEvents,
} from '../lib/auth-client';
import {
  formatDestinationLabel,
  type IntendedDestination,
} from '../lib/auth-routing';
import { FloatingWatermark } from './FloatingWatermark';
import { InteractiveDotGrid } from './ui/InteractiveDotGrid';

export interface AuthPageViewProps {
  mode: 'login' | 'register';
  locale: LocaleCode;
  theme?: ThemeMode;
  intendedDestination?: IntendedDestination | null;
  /** Live catalog for the platform highlight tiles (no hardcoded counts). */
  courses?: CourseCatalogItem[];
  catalogLoading?: boolean;
  catalogUnavailable?: boolean;
  onSwitchMode: (nextMode: 'login' | 'register') => void;
  onBackToOverview?: () => void;
  onBackToLanding?: () => void;
  onToggleTheme?: () => void;
  onToggleLocale?: (nextLocale: LocaleCode) => void;
  onAuthenticated: (
    user: UserSummary,
    options?: { redirectTo?: string | null }
  ) => Promise<void>;
}

export const GoogleLogoSvg: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="currentColor"
      className="text-theme-cyan"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="currentColor"
      className="text-theme-emerald"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="currentColor"
      className="text-warning"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="currentColor"
      className="text-theme-accent"
    />
  </svg>
);

export function calculatePasswordStrength(pass: string): {
  score: 0 | 1 | 2 | 3 | 4;
  labelKey: 'passwordStrengthWeak' | 'passwordStrengthFair' | 'passwordStrengthGood' | 'passwordStrengthStrong';
} {
  if (!pass) return { score: 0, labelKey: 'passwordStrengthWeak' };
  let points = 0;
  if (pass.length >= 8) points++;
  if (pass.length >= 12) points++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) points++;
  if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) points++;
  const score = Math.min(4, Math.max(1, points)) as 1 | 2 | 3 | 4;
  const labelMap: Record<1 | 2 | 3 | 4, 'passwordStrengthWeak' | 'passwordStrengthFair' | 'passwordStrengthGood' | 'passwordStrengthStrong'> = {
    1: 'passwordStrengthWeak',
    2: 'passwordStrengthFair',
    3: 'passwordStrengthGood',
    4: 'passwordStrengthStrong',
  };
  return { score, labelKey: labelMap[score] };
}

/**
 * Economic Growth & Supply-and-Demand equilibrium SVG curve illustration
 * with subtle pointer-reactive parallax (strictly paused under prefers-reduced-motion).
 */
const EconomicCurveIllustration: React.FC<{
  pointerOffset: { x: number; y: number };
  reducedMotion: boolean;
  strings: ReturnType<typeof t>['auth'];
}> = ({ pointerOffset, reducedMotion, strings }) => {
  const transformStyle = useMemo(() => {
    if (reducedMotion) return undefined;
    const tx = pointerOffset.x * 6;
    const ty = pointerOffset.y * 6;
    return {
      transform: `translate3d(${tx}px, ${ty}px, 0)`,
      transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
    };
  }, [pointerOffset, reducedMotion]);

  return (
    <div
      style={transformStyle}
      className="relative overflow-hidden rounded-2xl border-2 border-slate-500/40 bg-white/20 p-5 shadow-[6px_6px_0px_#000000] backdrop-blur-xl dark:border-[#222B3D]/80 dark:bg-[#080B14]/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-theme-border/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#5DE1D2] animate-ping motion-reduce:animate-none" />
          <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-theme-cyan">
            {strings.equilibriumModelTitle}
          </span>
        </div>
        <span className="rounded border border-theme-border/60 bg-theme-panel/40 px-2 py-0.5 font-mono text-[10px] text-muted">
          P* = f(Q*)
        </span>
      </div>

      <div className="relative mt-3">
        <svg
          data-testid="market-equilibrium-svg"
          viewBox="0 0 420 180"
          className="w-full h-auto select-none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="demandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9274FF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#9274FF" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="supplyGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5DE1D2" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#5DE1D2" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="growthArea" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5DE1D2" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#5DE1D2" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Coordinate grid lines */}
          <line x1="50" y1="20" x2="50" y2="150" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
          <line x1="50" y1="150" x2="390" y2="150" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />

          {/* Dashed equilibrium guidelines */}
          <line x1="50" y1="85" x2="210" y2="85" stroke="#9274FF" strokeDasharray="3 3" strokeOpacity="0.6" strokeWidth="1" />
          <line x1="210" y1="85" x2="210" y2="150" stroke="#5DE1D2" strokeDasharray="3 3" strokeOpacity="0.6" strokeWidth="1" />

          {/* Area fill under curve */}
          <polygon points="50,150 50,135 210,85 370,35 370,150" fill="url(#growthArea)" />

          {/* Demand curve (downward sloping) */}
          <path
            d="M 60 35 Q 210 85 370 135"
            fill="none"
            stroke="url(#demandGrad)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Supply curve (upward sloping) */}
          <path
            d="M 60 135 Q 210 85 370 35"
            fill="none"
            stroke="url(#supplyGrad)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Axis Labels */}
          <text x="50" y="14" fill="currentColor" fontSize="10" fontFamily="monospace" fontWeight="bold">P (Price)</text>
          <text x="350" y="168" fill="currentColor" fontSize="10" fontFamily="monospace" fontWeight="bold">Q (Output)</text>
          <text x="375" y="140" fill="#9274FF" fontSize="11" fontFamily="sans-serif" fontWeight="bold">D</text>
          <text x="375" y="35" fill="#5DE1D2" fontSize="11" fontFamily="sans-serif" fontWeight="bold">S</text>

          {/* Equilibrium intersection point */}
          <circle cx="210" cy="85" r="8" fill="#5DE1D2" fillOpacity="0.25" />
          <circle cx="210" cy="85" r="4.5" fill="#5DE1D2" stroke="#080B14" strokeWidth="1.5" />

          {/* Equilibrium label pill */}
          <rect x="180" y="60" width="60" height="18" rx="4" fill="#080B14" fillOpacity="0.85" stroke="#5DE1D2" strokeWidth="1" />
          <text x="210" y="73" fill="#5DE1D2" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
            E* (Q*, P*)
          </text>
        </svg>

        <p className="mt-1 text-center font-mono text-[10px] text-muted">
          {strings.equilibriumModelSubtitle}
        </p>
      </div>
    </div>
  );
};

export const AuthPageView: React.FC<AuthPageViewProps> = ({
  mode,
  locale,
  theme = 'dark',
  intendedDestination,
  courses = [],
  catalogLoading = false,
  catalogUnavailable = false,
  onSwitchMode,
  onBackToOverview,
  onBackToLanding,
  onToggleTheme,
  onToggleLocale,
  onAuthenticated,
}) => {
  const strings = t(locale);
  const authStrings = strings.auth;
  const catalogStats = computeCatalogStats(courses, locale);
  const statState = { loading: catalogLoading, unavailable: catalogUnavailable && courses.length === 0 };
  const notify = useNotify();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('university');
  const [consentChecked, setConsentChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googlePressed, setGooglePressed] = useState(false);
  const [googleHighlighted, setGoogleHighlighted] = useState(false);
  const googleBtnRef = React.useRef<HTMLButtonElement>(null);
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });

  const setErrorMsg = useToastSlot('auth-page-error', notificationCopy(locale).auth.failed);

  const destinationPath = intendedDestination?.path || '/overview';
  const destinationLabel = formatDestinationLabel(intendedDestination, locale);

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);

  // Pointer movement listener for subtle visual parallax on desktop
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const { clientX, clientY, currentTarget } = e;
    const rect = currentTarget.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((clientY - rect.top) / rect.height) * 2 - 1;
    setPointerOffset({ x, y });
  }, [reducedMotion]);

  // Full-page OAuth fallback lands back on /login?oauthError=<reason>.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('oauthError')) {
      setErrorMsg(authStrings.googleFailed);
    }
  }, [authStrings.googleFailed, setErrorMsg]);

  // Listen for OAuth completion across popup postMessage, BroadcastChannel, and storage
  useEffect(() => {
    const unsubscribe = subscribeToOAuthEvents((message) => {
      setGoogleLoading(false);
      setGooglePressed(false);
      if (message.type === 'error') {
        setErrorMsg(authStrings.googleFailed);
        return;
      }
      persistCachedUserSummary(message.user);
      void onAuthenticated(message.user, {
        redirectTo: message.redirectTo ?? destinationPath,
      });
    });

    return unsubscribe;
  }, [authStrings.googleFailed, destinationPath, onAuthenticated, setErrorMsg]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGooglePressed(true);
    setGoogleLoading(true);
    window.setTimeout(() => setGooglePressed(false), 180);

    const result = await startGooglePopupSignIn(destinationPath, locale);
    setGoogleLoading(false);
    if (result === 'not_configured') setErrorMsg(authStrings.googleNotConfigured);
    else if (result === 'popup_blocked') setErrorMsg(authStrings.googlePopupBlocked);
    else if (result === 'failed') setErrorMsg(authStrings.googleFailed);
  };

  const completeSignIn = async (res: Response) => {
    const data = await readJsonSafely<{ user: UserSummary; error: string; code?: string }>(res);
    if (!res.ok || !data.user) {
      if (data.code === 'GOOGLE_ONLY_ACCOUNT') {
        const error = new Error(authStrings.googleOnlyAccountNotice);
        (error as unknown as { code: string }).code = 'GOOGLE_ONLY_ACCOUNT';
        throw error;
      }
      throw new Error(data.error || (res.status >= 500 ? authStrings.networkError : authStrings.authFailed));
    }
    persistCachedUserSummary(data.user);
    await onAuthenticated(data.user, { redirectTo: destinationPath });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (mode === 'register' && !consentChecked) {
      setErrorMsg(authStrings.consentError);
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { email, password }
          : {
              email,
              password,
              displayName,
              preferredLocale: locale,
              ageBand,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent',
            };
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await completeSignIn(res);
    } catch (err) {
      const code = (err as unknown as { code?: string })?.code;
      if (code === 'GOOGLE_ONLY_ACCOUNT') {
        notify.info(
          notificationCopy(locale).auth.googleOnly,
          authStrings.googleOnlyAccountNotice,
          { durationMs: 9000 }
        );
        setGoogleHighlighted(true);
        googleBtnRef.current?.focus();
        window.setTimeout(() => setGoogleHighlighted(false), 3000);
      } else {
        setErrorMsg(err instanceof Error ? err.message : authStrings.networkError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onBackToLanding) {
      onBackToLanding();
    } else if (onBackToOverview) {
      onBackToOverview();
    }
  };

  return (
    <div
      data-testid="neobrutalist-auth-page"
      data-auth-mode={mode}
      onPointerMove={handlePointerMove}
      className="relative z-10 flex min-h-screen flex-col overflow-x-clip"
    >
      {/* ---------------- 1. Minimal Clean Top Bar ---------------- */}
      <header className="relative z-20 w-full border-b-2 border-slate-500/30 dark:border-[#222B3D]/60 bg-white/30 dark:bg-[#080B14]/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              data-testid="auth-back-overview-btn"
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-panel/80 px-3.5 py-1.5 text-xs font-bold text-ink shadow-brutal-sm backdrop-blur-md transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:border-theme-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-theme-cyan" aria-hidden="true" />
              <span>{authStrings.backToLanding}</span>
            </button>

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-panel/80 px-3 py-1 font-mono text-[11px] font-bold text-theme-emerald shadow-brutal-sm">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{authStrings.sessionPersistedBadge}</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Language Switcher */}
            {onToggleLocale && (
              <div className="inline-flex items-center rounded-lg border-2 border-theme-border bg-theme-panel/80 p-0.5 shadow-brutal-sm">
                <button
                  type="button"
                  data-testid="auth-locale-en"
                  onClick={() => onToggleLocale('en')}
                  className={`min-h-[30px] rounded-md px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
                    locale === 'en'
                      ? 'border border-theme-border bg-theme-accent text-theme-accent-ink shadow-xs'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  data-testid="auth-locale-uz"
                  onClick={() => onToggleLocale('uz')}
                  className={`min-h-[30px] rounded-md px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
                    locale === 'uz'
                      ? 'border border-theme-border bg-theme-cyan text-black shadow-xs'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  O‘Z
                </button>
              </div>
            )}

            {/* Dark / Light Theme Toggle */}
            {onToggleTheme && (
              <button
                type="button"
                data-testid="theme-mode-toggle"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? strings.theme.switchToLight : strings.theme.switchToDark}
                title={theme === 'dark' ? strings.theme.switchToLight : strings.theme.switchToDark}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-theme-border bg-theme-panel/80 text-ink shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:border-theme-accent"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4 text-theme-cyan" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------- 2. Split-Canvas Main Body ---------------- */}
      <main className="relative flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        {/* Subtle Watermark particle accent in the background */}
        <FloatingWatermark
          theme="course-economics"
          layout="standard"
          className="pointer-events-none opacity-40 dark:opacity-30"
        />

        <div className="relative z-10 grid w-full max-w-7xl items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* ---------------- LEFT COLUMN: Open Editorial Showcase ---------------- */}
          <div className="flex flex-col justify-center space-y-6 lg:col-span-6 lg:py-6 xl:col-span-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border-2 border-slate-500/60 dark:border-[#222B3D] bg-white/50 dark:bg-[#080B14]/60 px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase text-theme-cyan shadow-brutal-sm backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-theme-accent" aria-hidden="true" />
                <span>{authStrings.editorialKicker}</span>
              </div>

              <h1 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink leading-[1.1]">
                <span>{authStrings.editorialHeadline1}</span>{' '}
                <span className="text-theme-cyan">{authStrings.editorialHeadline2}</span>
              </h1>

              <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted max-w-xl">
                {authStrings.editorialSubtitle}
              </p>
            </div>

            {/* Subject Pills */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#9274FF]/60 bg-[#9274FF]/15 px-3 py-1 text-xs font-bold text-[#9274FF] shadow-brutal-sm backdrop-blur-md">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                {authStrings.trackEconomics}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#5DE1D2]/60 bg-[#5DE1D2]/15 px-3 py-1 text-xs font-bold text-[#0F766E] dark:text-[#5DE1D2] shadow-brutal-sm backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {authStrings.trackMathematics}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#FBBF24]/60 bg-[#FBBF24]/15 px-3 py-1 text-xs font-bold text-[#B45309] dark:text-[#FBBF24] shadow-brutal-sm backdrop-blur-md">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {authStrings.trackBusiness}
              </span>
            </div>

            {/* Compact Platform Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="rounded-xl border-2 border-slate-500/40 dark:border-[#222B3D]/70 bg-white/30 dark:bg-[#101522]/40 p-2.5 text-center shadow-brutal-sm backdrop-blur-md">
                <div className="font-mono text-xs font-extrabold text-theme-accent" data-testid="auth-stat-courses">{formatCatalogStat(catalogStats.courseCount, statState)}</div>
                <div className="text-[10px] font-bold text-muted mt-0.5">{authStrings.highlightCourses}</div>
              </div>
              <div className="rounded-xl border-2 border-slate-500/40 dark:border-[#222B3D]/70 bg-white/30 dark:bg-[#101522]/40 p-2.5 text-center shadow-brutal-sm backdrop-blur-md">
                <div className="font-mono text-xs font-extrabold text-theme-cyan" data-testid="auth-stat-lessons">{formatCatalogStat(catalogStats.lessonCount, statState)}</div>
                <div className="text-[10px] font-bold text-muted mt-0.5">{authStrings.highlightLessons}</div>
              </div>
              <div className="rounded-xl border-2 border-slate-500/40 dark:border-[#222B3D]/70 bg-white/30 dark:bg-[#101522]/40 p-2.5 text-center shadow-brutal-sm backdrop-blur-md">
                <div className="font-mono text-xs font-extrabold text-theme-emerald">O‘Z / EN</div>
                <div className="text-[10px] font-bold text-muted mt-0.5">{authStrings.highlightEditions}</div>
              </div>
              <div className="rounded-xl border-2 border-slate-500/40 dark:border-[#222B3D]/70 bg-white/30 dark:bg-[#101522]/40 p-2.5 text-center shadow-brutal-sm backdrop-blur-md">
                <div className="font-mono text-xs font-extrabold text-[#FBBF24]">100%</div>
                <div className="text-[10px] font-bold text-muted mt-0.5">{authStrings.highlightCertificates}</div>
              </div>
            </div>

            {/* SVG Economic Growth / Supply-and-Demand Illustration (Collapsible on mobile) */}
            <div className="hidden lg:block pt-1">
              <EconomicCurveIllustration
                pointerOffset={pointerOffset}
                reducedMotion={reducedMotion}
                strings={authStrings}
              />
            </div>
          </div>

          {/* ---------------- RIGHT COLUMN: Tactile Neobrutalist Auth Card ---------------- */}
          <div className="flex justify-center lg:col-span-6 xl:col-span-6">
            <div className="relative overflow-hidden w-full max-w-md rounded-2xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/25 dark:bg-[#101522]/25 p-6 sm:p-8 shadow-[8px_8px_0px_#000000] dark:shadow-[8px_8px_0px_#9274FF] backdrop-blur-2xl transition-all">
              <InteractiveDotGrid testId="auth-card-dot-grid" />
              <div className="relative z-10">
              {/* Smooth Sliding Pill Toggle (/login vs /register) */}
              <div className="relative grid grid-cols-2 gap-1.5 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/60 p-1.5 shadow-brutal-sm backdrop-blur-md">
                <button
                  type="button"
                  data-testid="auth-tab-login"
                  onClick={() => {
                    setErrorMsg(null);
                    onSwitchMode('login');
                  }}
                  className={`min-h-[40px] rounded-lg border-2 px-3 py-2 text-xs font-extrabold tracking-wide transition-all ${
                    mode === 'login'
                      ? 'border-theme-border bg-theme-accent text-theme-accent-ink shadow-brutal-sm'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {authStrings.tabSignIn}
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-register"
                  onClick={() => {
                    setErrorMsg(null);
                    onSwitchMode('register');
                  }}
                  className={`min-h-[40px] rounded-lg border-2 px-3 py-2 text-xs font-extrabold tracking-wide transition-all ${
                    mode === 'register'
                      ? 'border-theme-border bg-theme-accent text-theme-accent-ink shadow-brutal-sm'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {authStrings.tabRegister}
                </button>
              </div>

              {/* Intended Destination Card (if redirecting somewhere specific) */}
              {intendedDestination && destinationPath !== '/overview' && (
                <div
                  data-testid="auth-intended-destination-card"
                  className="mt-4 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/50 dark:bg-[#080B14]/60 p-3.5 shadow-brutal-sm backdrop-blur-md"
                >
                  <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                    {authStrings.redirectingToLabel}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-theme-accent truncate">
                      {destinationLabel}
                    </span>
                    <code className="rounded border border-slate-500 dark:border-[#222B3D] bg-white/40 dark:bg-[#101522]/40 px-2 py-0.5 font-mono text-[10px] text-theme-cyan">
                      {destinationPath}
                    </code>
                  </div>
                </div>
              )}

              {/* Primary Google OAuth Button with Tactile Push-Down */}
              <div className="mt-5">
                <button
                  ref={googleBtnRef}
                  type="button"
                  disabled={loading || googleLoading}
                  onClick={() => {
                    setGoogleHighlighted(false);
                    void handleGoogleSignIn();
                  }}
                  data-testid="google-oauth-btn"
                  className={`flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-extrabold text-ink backdrop-blur-md transition-all duration-150 select-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 ${
                    googleHighlighted
                      ? 'border-theme-accent bg-theme-accent/20 ring-4 ring-theme-accent/50 animate-pulse shadow-brutal-sm'
                      : googlePressed
                      ? 'translate-x-[2px] translate-y-[2px] shadow-none border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/65'
                      : 'border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/65 shadow-brutal-sm hover:border-theme-accent'
                  }`}
                >
                  <GoogleLogoSvg className="h-5 w-5 shrink-0" />
                  <span>
                    {googleLoading ? authStrings.connectingGoogle : authStrings.signInWithGoogle}
                  </span>
                  <ArrowRight className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                </button>
              </div>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-0.5 flex-1 bg-theme-border/60" />
                <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-muted">
                  {authStrings.orContinueWithEmail}
                </span>
                <div className="h-0.5 flex-1 bg-theme-border/60" />
              </div>

              {/* Email / Password Fallback Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="auth-page-name" className="block text-xs font-bold text-ink">
                        {authStrings.displayNameLabel}
                      </label>
                      <input
                        id="auth-page-name"
                        data-testid="auth-name-input"
                        type="text"
                        required
                        minLength={2}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="mt-1.5 min-h-[42px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/70 dark:bg-[#080B14]/70 px-3.5 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="auth-page-age" className="block text-xs font-bold text-ink">
                        {authStrings.learnerGroupLabel}
                      </label>
                      <select
                        id="auth-page-age"
                        data-testid="auth-age-select"
                        value={ageBand}
                        onChange={(e) => setAgeBand(e.target.value as AgeBand)}
                        className="mt-1.5 min-h-[42px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/70 dark:bg-[#080B14]/70 px-3.5 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
                      >
                        <option value="school">{authStrings.ageBracketSchool}</option>
                        <option value="university">{authStrings.ageBracketUniversity}</option>
                        <option value="independent">{authStrings.ageBracketAdult}</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-page-email" className="block text-xs font-bold text-ink">
                    {authStrings.emailLabel}
                  </label>
                  <div className="relative mt-1.5">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-page-email"
                      data-testid="auth-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="scholar@econova.uz"
                      className="min-h-[44px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/70 dark:bg-[#080B14]/70 pl-10 pr-3.5 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-page-password" className="block text-xs font-bold text-ink">
                    {authStrings.passwordLabel}
                  </label>
                  <div className="relative mt-1.5">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-page-password"
                      data-testid="auth-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="min-h-[44px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/70 dark:bg-[#080B14]/70 pl-10 pr-10 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      data-testid="auth-password-toggle-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? authStrings.hidePassword : authStrings.showPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {/* 4-Segment Password Strength Indicator (in register mode) */}
                  {mode === 'register' && (
                    <div
                      data-testid="auth-password-strength-bar"
                      data-strength={passwordStrength.score}
                      className="mt-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted">{authStrings.passwordStrengthLabel}</span>
                        <span
                          className={`font-bold ${
                            password.length === 0
                              ? 'text-muted'
                              : passwordStrength.score === 1
                              ? 'text-red-500'
                              : passwordStrength.score === 2
                              ? 'text-amber-500'
                              : passwordStrength.score === 3
                              ? 'text-theme-cyan'
                              : 'text-theme-emerald'
                          }`}
                        >
                          {password.length === 0 ? '—' : authStrings[passwordStrength.labelKey]}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((seg) => {
                          const isActive = password.length > 0 && passwordStrength.score >= seg;
                          return (
                            <div
                              key={seg}
                              className={`h-1.5 rounded-full transition-colors ${
                                isActive
                                  ? passwordStrength.score === 1
                                    ? 'bg-red-500'
                                    : passwordStrength.score === 2
                                    ? 'bg-amber-500'
                                    : passwordStrength.score === 3
                                    ? 'bg-theme-cyan'
                                    : 'bg-theme-emerald'
                                  : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {mode === 'register' && (
                  <label className="flex items-start gap-2.5 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/60 p-3 text-xs text-muted">
                    <input
                      type="checkbox"
                      data-testid="auth-consent-checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-accent"
                    />
                    <span>{authStrings.consentText}</span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  data-testid="auth-submit-btn"
                  aria-busy={loading || googleLoading}
                  className="min-h-[48px] w-full rounded-xl border-2 border-theme-border bg-theme-accent py-2.5 text-sm font-extrabold text-theme-accent-ink shadow-brutal-sm transition-transform duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-accent-hover disabled:opacity-60"
                >
                  {loading
                    ? authStrings.pleaseWait
                    : mode === 'login'
                    ? authStrings.tabSignIn
                    : authStrings.createAccountBtn}
                </button>
              </form>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
