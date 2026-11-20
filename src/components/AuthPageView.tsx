import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import type { AgeBand, LocaleCode, UserSummary } from '../shared/types';
import { t } from '../lib/i18n';
import {
  apiFetch,
  persistCachedUserSummary,
  readJsonSafely,
  readOAuthPopupMessage,
  startGooglePopupSignIn,
} from '../lib/auth-client';
import {
  formatDestinationLabel,
  type IntendedDestination,
} from '../lib/auth-routing';

export interface AuthPageViewProps {
  mode: 'login' | 'register';
  locale: LocaleCode;
  sandboxEnabled?: boolean;
  intendedDestination?: IntendedDestination | null;
  onSwitchMode: (nextMode: 'login' | 'register') => void;
  onBackToOverview?: () => void;
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

export const AuthPageView: React.FC<AuthPageViewProps> = ({
  mode,
  locale,
  sandboxEnabled = false,
  intendedDestination,
  onSwitchMode,
  onBackToOverview,
  onAuthenticated,
}) => {
  const strings = t(locale);
  const authStrings = strings.auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('university');
  const [consentChecked, setConsentChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googlePressed, setGooglePressed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const destinationPath = intendedDestination?.path || '/overview';
  const destinationLabel = formatDestinationLabel(intendedDestination, locale);

  // Full-page OAuth fallback lands back on /login?oauthError=<reason>.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('oauthError')) {
      setErrorMsg(authStrings.googleFailed);
    }
  }, [authStrings.googleFailed]);

  // Listen for OAuth popup completion postMessage (same origin only)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = readOAuthPopupMessage(event);
      if (!message) return;
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
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authStrings.googleFailed, destinationPath, onAuthenticated]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGooglePressed(true);
    setGoogleLoading(true);
    window.setTimeout(() => setGooglePressed(false), 180);

    const result = await startGooglePopupSignIn(destinationPath, locale);
    // The popup reports back via postMessage; the button is usable again either way.
    setGoogleLoading(false);
    if (result === 'not_configured') setErrorMsg(authStrings.googleNotConfigured);
    else if (result === 'popup_blocked') setErrorMsg(authStrings.googlePopupBlocked);
    else if (result === 'failed') setErrorMsg(authStrings.googleFailed);
  };

  const completeSignIn = async (res: Response) => {
    const data = await readJsonSafely<{ user: UserSummary; error: string }>(res);
    if (!res.ok || !data.user) {
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
      setErrorMsg(err instanceof Error ? err.message : authStrings.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleSandbox = async (account: 'learner' | 'staff') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });
      await completeSignIn(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : authStrings.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      data-testid="neobrutalist-auth-page"
      data-auth-mode={mode}
      className="mx-auto max-w-4xl py-4 sm:py-8"
    >
      {onBackToOverview && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToOverview}
            data-testid="auth-back-overview-btn"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border-2 border-theme-border bg-theme-panel px-3.5 py-1.5 text-xs font-bold text-ink shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:border-theme-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-theme-cyan" aria-hidden="true" />
            <span>{authStrings.backToOverview}</span>
          </button>

          <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-panel px-3 py-1 font-mono text-[11px] font-bold text-theme-emerald shadow-brutal-sm">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{authStrings.sessionPersistedBadge}</span>
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Tactical Architecture & Destination Panel */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-slate-500 bg-white/25 p-6 sm:p-8 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25 lg:col-span-5">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase text-theme-cyan shadow-brutal-sm backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-theme-accent" aria-hidden="true" />
              <span>{authStrings.protectedRouteBadge}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-ink">
              {mode === 'login' ? authStrings.signInTitle : authStrings.registerTitle}
            </h1>

            <p className="text-xs sm:text-sm leading-relaxed text-muted">
              {authStrings.subtitle}
            </p>

            {/* Intended Destination Callout */}
            <div
              data-testid="auth-intended-destination-card"
              className="rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 p-4 shadow-brutal-sm backdrop-blur-md"
            >
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                {authStrings.redirectingToLabel}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-theme-accent">
                  {destinationLabel}
                </span>
                <code className="rounded border border-slate-500 dark:border-[#222B3D] bg-white/30 dark:bg-[#101522]/30 px-2 py-0.5 font-mono text-[11px] text-theme-cyan">
                  {destinationPath}
                </code>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2.5 border-t-2 border-slate-500 dark:border-[#222B3D] pt-4 text-xs text-muted">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 shrink-0 text-theme-emerald" aria-hidden="true" />
              <span>
                {locale === 'uz'
                  ? 'Google OAuth 2.0 + Email/Parol orqali ko‘p provayderli himoyalangan kirish'
                  : 'Multi-provider authentication via Google OAuth 2.0 + Email/Password'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-theme-accent" aria-hidden="true" />
              <span>
                {locale === 'uz'
                  ? 'Server va mijoz komponentlari o‘rtasida uzluksiz sessiya sinxronizatsiyasi'
                  : 'Zero-drop session synchronization across Server & Client routes'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Neobrutalist Auth Form Card */}
        <div className="rounded-2xl border-2 border-slate-500 bg-white/25 p-6 sm:p-8 shadow-[8px_8px_0px_#9274FF] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25 lg:col-span-7">
          {/* Mode Switcher Tabs (/login vs /register) */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/50 dark:bg-[#080B14]/60 p-1.5 shadow-brutal-sm backdrop-blur-md">
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

          {/* Primary Google OAuth Button with Physical Push-Down Translation */}
          <div className="mt-5">
            <button
              type="button"
              disabled={loading || googleLoading}
              onClick={() => void handleGoogleSignIn()}
              data-testid="google-oauth-btn"
              className={`flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/65 px-4 py-3 text-sm font-extrabold text-ink backdrop-blur-md transition-transform duration-75 select-none active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60 ${
                googlePressed
                  ? 'translate-x-[3px] translate-y-[3px] shadow-none'
                  : 'shadow-brutal-sm hover:border-theme-accent'
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
            <div className="h-0.5 flex-1 bg-theme-border" />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-muted">
              {authStrings.orContinueWithEmail}
            </span>
            <div className="h-0.5 flex-1 bg-theme-border" />
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
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/65 px-3.5 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
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
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/65 px-3.5 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
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
                  placeholder="scholar@econova.edu"
                  className="min-h-[44px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/65 pl-10 pr-3.5 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
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
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-[44px] w-full rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/60 dark:bg-[#080B14]/65 pl-10 pr-3.5 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
                />
              </div>
            </div>

            {mode === 'register' && (
              <label className="flex items-start gap-2.5 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 p-3 text-xs text-muted">
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

            {errorMsg && (
              <div
                role="alert"
                data-testid="auth-error-alert"
                className="rounded-xl border-2 border-danger bg-danger-surface/50 px-4 py-2.5 text-xs font-semibold text-danger-text shadow-brutal-sm"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              data-testid="auth-submit-btn"
              className="min-h-[48px] w-full rounded-xl border-2 border-theme-border bg-theme-accent py-2.5 text-sm font-extrabold text-theme-accent-ink shadow-brutal-sm transition-transform duration-75 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none hover:bg-accent-hover disabled:opacity-60"
            >
              {loading
                ? authStrings.pleaseWait
                : mode === 'login'
                ? authStrings.tabSignIn
                : authStrings.createAccountBtn}
            </button>
          </form>

          {/* Sandbox Evaluation Quick Access (when ENABLE_DEMO_SANDBOX=true) */}
          {sandboxEnabled && (
            <div className="mt-5 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 p-3.5 backdrop-blur-md">
              <div className="font-mono text-[11px] font-bold text-muted">
                {authStrings.sandboxHeader}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={loading || googleLoading}
                  onClick={() => void handleSandbox('learner')}
                  data-testid="sandbox-learner-btn"
                  className="min-h-[40px] rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/30 dark:bg-[#101522]/30 px-3 py-1.5 text-xs font-bold text-theme-cyan shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:border-theme-cyan"
                >
                  {authStrings.sandboxLearner} (Dilnoza)
                </button>
                <button
                  type="button"
                  disabled={loading || googleLoading}
                  onClick={() => void handleSandbox('staff')}
                  data-testid="sandbox-staff-btn"
                  className="min-h-[40px] rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/30 dark:bg-[#101522]/30 px-3 py-1.5 text-xs font-bold text-theme-accent shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:border-theme-accent"
                >
                  {authStrings.sandboxStaff}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
