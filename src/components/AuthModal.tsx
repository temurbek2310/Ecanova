import React, { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { AgeBand, LocaleCode, UserSummary } from '../shared/types';
import { t } from '../lib/i18n';
import {
  apiFetch,
  persistCachedUserSummary,
  readJsonSafely,
  readOAuthPopupMessage,
  startGooglePopupSignIn,
} from '../lib/auth-client';
import { GoogleLogoSvg } from './AuthPageView';

interface AuthModalProps {
  locale: LocaleCode;
  sandboxEnabled?: boolean;
  redirectTo?: string | null;
  onClose: () => void;
  onAuthenticated: (
    user: UserSummary,
    options?: { redirectTo?: string | null }
  ) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  locale,
  sandboxEnabled = false,
  redirectTo = null,
  onClose,
  onAuthenticated,
}) => {
  const strings = t(locale);
  const authStrings = strings.auth;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('university');
  const [consentChecked, setConsentChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googlePressed, setGooglePressed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        redirectTo: message.redirectTo ?? redirectTo,
      }).then(() => onClose());
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authStrings.googleFailed, onAuthenticated, onClose, redirectTo]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGooglePressed(true);
    setGoogleLoading(true);
    window.setTimeout(() => setGooglePressed(false), 180);

    const result = await startGooglePopupSignIn(redirectTo || '/overview', locale);
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
    await onAuthenticated(data.user, { redirectTo });
    onClose();
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-slate-500 bg-white/30 p-6 shadow-[8px_8px_0px_#9274FF] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-extrabold text-ink">
              {mode === 'login' ? authStrings.signInTitle : authStrings.registerTitle}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {authStrings.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={authStrings.closeAria}
            className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 p-1.5 text-muted shadow-brutal-sm hover:border-theme-accent hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Primary Google OAuth Button with Physical Push-Down Translation */}
        <div className="mt-4">
          <button
            type="button"
            disabled={loading || googleLoading}
            onClick={() => void handleGoogleSignIn()}
            data-testid="modal-google-oauth-btn"
            className={`flex min-h-[46px] w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/65 px-4 py-2.5 text-xs font-extrabold text-ink backdrop-blur-md transition-transform duration-75 select-none active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60 ${
              googlePressed
                ? 'translate-x-[3px] translate-y-[3px] shadow-none'
                : 'shadow-brutal-sm hover:border-theme-accent'
            }`}
          >
            <GoogleLogoSvg className="h-4 w-4 shrink-0" />
            <span>
              {googleLoading ? authStrings.connectingGoogle : authStrings.signInWithGoogle}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
          </button>
        </div>

        {/* Sandbox Evaluation Quick Access (only when ENABLE_DEMO_SANDBOX=true) */}
        {sandboxEnabled && (
          <div className="mt-4 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/60 p-3 backdrop-blur-md">
            <div className="text-[11px] font-bold text-muted">
              {authStrings.sandboxHeader}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading || googleLoading}
                onClick={() => void handleSandbox('learner')}
                className="min-h-[38px] rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/30 dark:bg-[#101522]/30 px-3 py-1.5 text-xs font-bold text-theme-cyan shadow-brutal-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:border-theme-cyan"
              >
                {authStrings.sandboxLearner} (Dilnoza)
              </button>
              <button
                type="button"
                disabled={loading || googleLoading}
                onClick={() => void handleSandbox('staff')}
                className="min-h-[38px] rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/30 dark:bg-[#101522]/30 px-3 py-1.5 text-xs font-bold text-theme-accent shadow-brutal-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:border-theme-accent"
              >
                {authStrings.sandboxStaff}
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-1.5 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/50 dark:bg-[#080B14]/60 p-1 text-xs shadow-brutal-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg border-2 py-1.5 font-extrabold transition-all ${
              mode === 'login'
                ? 'border-theme-border bg-theme-accent text-theme-accent-ink shadow-brutal-sm'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {authStrings.tabSignIn}
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-lg border-2 py-1.5 font-extrabold transition-all ${
              mode === 'register'
                ? 'border-theme-border bg-theme-accent text-theme-accent-ink shadow-brutal-sm'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {authStrings.tabRegister}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="auth-name" className="block text-xs font-bold text-ink">
                  {authStrings.displayNameLabel}
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-xl border-2 border-theme-border bg-theme-base px-3 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="auth-age" className="block text-xs font-bold text-ink">
                  {authStrings.learnerGroupLabel}
                </label>
                <select
                  id="auth-age"
                  value={ageBand}
                  onChange={(e) => setAgeBand(e.target.value as AgeBand)}
                  className="mt-1 min-h-[42px] w-full rounded-xl border-2 border-theme-border bg-theme-base px-3 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
                >
                  <option value="school">{authStrings.ageBracketSchool}</option>
                  <option value="university">{authStrings.ageBracketUniversity}</option>
                  <option value="independent">{authStrings.ageBracketAdult}</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-bold text-ink">
              {authStrings.emailLabel}
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 min-h-[42px] w-full rounded-xl border-2 border-theme-border bg-theme-base px-3 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-bold text-ink">
              {authStrings.passwordLabel}
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 min-h-[42px] w-full rounded-xl border-2 border-theme-border bg-theme-base px-3 text-sm text-ink shadow-brutal-sm focus:border-theme-accent focus:outline-none"
            />
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span>{authStrings.consentText}</span>
            </label>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border-2 border-danger bg-danger-surface/40 px-3 py-2 text-xs font-semibold text-danger-text"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="min-h-[44px] w-full rounded-xl border-2 border-theme-border bg-theme-accent py-2.5 text-sm font-extrabold text-theme-accent-ink shadow-brutal-sm transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none hover:bg-accent-hover disabled:opacity-60"
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
  );
};
