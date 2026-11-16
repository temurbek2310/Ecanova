import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AgeBand, LocaleCode, UserSummary } from '../shared/types';

interface AuthModalProps {
  locale: LocaleCode;
  sandboxEnabled?: boolean;
  onClose: () => void;
  onAuthenticated: (user: UserSummary) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  locale,
  sandboxEnabled = false,
  onClose,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('university');
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (mode === 'register' && !consentChecked) {
      setErrorMsg('Please confirm the Privacy Notice and non-cash / non-accreditation terms.');
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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { user?: UserSummary; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error || 'Authentication failed.');
      await onAuthenticated(data.user);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSandbox = async (account: 'learner' | 'staff') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });
      const data = (await res.json()) as { user?: UserSummary; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error || 'Sandbox sign-in failed.');
      await onAuthenticated(data.user);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-[#222B3D] bg-[#101522] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-semibold text-[#F3F6FF]">
              {mode === 'login' ? 'Sign In to ECONOVA' : 'Create Learner Account'}
            </h2>
            <p className="mt-1 text-xs text-[#8994AA]">
              Save progress across devices, earn course-specific certificates, and manage privacy settings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in dialog"
            className="rounded-lg p-1.5 text-[#8994AA] hover:bg-[#141B2B] hover:text-[#F3F6FF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sandbox Evaluation Quick Access (only when ENABLE_DEMO_SANDBOX=true) */}
        {sandboxEnabled && (
          <div className="mt-4 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3">
            <div className="text-[11px] font-medium text-[#8994AA]">
              Sandbox Preview Accounts (Local Testing Only)
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSandbox('learner')}
                className="min-h-[38px] rounded-lg border border-[#222B3D] bg-[#141B2B] px-3 py-1.5 text-xs font-medium text-[#5DE1D2] hover:border-[#5DE1D2]/50"
              >
                Demo Learner (Dilnoza)
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSandbox('staff')}
                className="min-h-[38px] rounded-lg border border-[#222B3D] bg-[#141B2B] px-3 py-1.5 text-xs font-medium text-[#9274FF] hover:border-[#9274FF]/50"
              >
                Demo Staff Editor
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-1 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-md py-1.5 font-medium ${
              mode === 'login' ? 'bg-[#141B2B] text-[#F3F6FF]' : 'text-[#8994AA]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-md py-1.5 font-medium ${
              mode === 'register' ? 'bg-[#141B2B] text-[#F3F6FF]' : 'text-[#8994AA]'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="auth-name" className="block text-xs text-[#8994AA]">
                  Display Name (Shown on certificates you choose to share)
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
                />
              </div>

              <div>
                <label htmlFor="auth-age" className="block text-xs text-[#8994AA]">
                  Learner Group (Privacy defaults to private)
                </label>
                <select
                  id="auth-age"
                  value={ageBand}
                  onChange={(e) => setAgeBand(e.target.value as AgeBand)}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
                >
                  <option value="school">School Learner</option>
                  <option value="university">University Student</option>
                  <option value="independent">Independent Learner</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs text-[#8994AA]">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs text-[#8994AA]">
              Password (minimum 8 characters)
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
            />
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-2 text-xs text-[#8994AA]">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 accent-[#9274FF]"
              />
              <span>
                I acknowledge ECONOVA&apos;s Privacy Notice, non-cash XP rules, and that certificates represent course completion only.
              </span>
            </label>
          )}

          {errorMsg && (
            <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] w-full rounded-lg bg-[#9274FF] py-2.5 text-sm font-semibold text-[#080B14] hover:bg-[#a68dff] disabled:opacity-60"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
