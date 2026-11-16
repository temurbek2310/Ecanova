import React, { useState } from 'react';
import { Download, Shield, Trash2 } from 'lucide-react';
import type { LocaleCode, UserSummary } from '../shared/types';
import { t } from '../lib/i18n';

interface ProfilePoliciesViewProps {
  locale: LocaleCode;
  user: UserSummary | null;
  onUpdateProfile: (patch: {
    displayName: string;
    preferredLocale: LocaleCode;
    timezone: string;
    leaderboardOptIn: boolean;
    leaderboardPseudonym: string;
  }) => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onRequireAuth: () => void;
}

export const ProfilePoliciesView: React.FC<ProfilePoliciesViewProps> = ({
  locale,
  user,
  onUpdateProfile,
  onAccountDeleted,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [preferredLocale, setPreferredLocale] = useState<LocaleCode>(user?.preferredLocale || locale);
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Tashkent');
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(user?.leaderboardOptIn || false);
  const [pseudonym, setPseudonym] = useState(user?.leaderboardPseudonym || '');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setStatusMsg('Profile and privacy settings saved.');
  };

  const handleExport = async () => {
    const res = await fetch('/api/me/export');
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
    const res = await fetch('/api/me/account', { method: 'DELETE' });
    const out = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatusMsg(out.error || 'Could not delete account.');
      return;
    }
    await onAccountDeleted();
  };

  return (
    <div className="space-y-6">
      {user ? (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
          <div className="border-b border-[#222B3D] pb-3">
            <h1 className="text-xl font-semibold text-[#F3F6FF]">Profile & Privacy Preferences</h1>
            <p className="mt-1 text-xs text-[#8994AA]">
              Learner data stays private by default. Leaderboard visibility and certificate sharing are strictly opt-in.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prof-name" className="block text-xs text-[#8994AA]">Display Name</label>
              <input
                id="prof-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
              />
            </div>
            <div>
              <label htmlFor="prof-locale" className="block text-xs text-[#8994AA]">Preferred Edition Language</label>
              <select
                id="prof-locale"
                value={preferredLocale}
                onChange={(e) => setPreferredLocale(e.target.value as LocaleCode)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
              >
                <option value="en">English (en)</option>
                <option value="uz">O‘zbekcha (uz)</option>
              </select>
            </div>
            <div>
              <label htmlFor="prof-tz" className="block text-xs text-[#8994AA]">Study Streak Timezone</label>
              <select
                id="prof-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
              >
                <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label htmlFor="prof-pseudo" className="block text-xs text-[#8994AA]">Cohort Pseudonym</label>
              <input
                id="prof-pseudo"
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 text-sm text-[#F3F6FF]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#F3F6FF]">
            <input
              type="checkbox"
              checked={leaderboardOptIn}
              onChange={(e) => setLeaderboardOptIn(e.target.checked)}
              className="accent-[#5DE1D2]"
            />
            <span>Opt in to Cohort Leaderboard (displays pseudonym only)</span>
          </label>

          {statusMsg && <p className="text-xs text-[#5DE1D2]">{statusMsg}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#222B3D] pt-4">
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-[#9274FF] px-5 py-2 text-xs font-semibold text-[#080B14]"
            >
              Save Preferences
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#222B3D] bg-[#141B2B] px-3.5 py-2 text-xs text-[#F3F6FF]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export My Data (JSON)</span>
              </button>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-500/40 px-3.5 py-2 text-xs text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete Account</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="min-h-[40px] rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  Confirm Permanent Deletion
                </button>
              )}
            </div>
          </div>
        </form>
      ) : (
        <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-6">
          <h1 className="text-xl font-semibold text-[#F3F6FF]">Profile & Privacy</h1>
          <p className="mt-2 text-sm text-[#8994AA]">
            Sign in to customize your timezone, preferred edition language, pseudonym visibility, or export/delete your account records.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-4 min-h-[42px] rounded-lg bg-[#9274FF] px-5 py-2 text-xs font-semibold text-[#080B14]"
          >
            {strings.signIn}
          </button>
        </section>
      )}

      {/* Policies, Privacy, Age Safeguards & Disclosures */}
      <section className="space-y-4 rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#F3F6FF]">
          <Shield className="h-4 w-4 text-[#5DE1D2]" aria-hidden="true" />
          <span>Platform Policies, Privacy & Safety Commitments</span>
        </h2>

        <div className="grid gap-4 md:grid-cols-2 text-xs leading-relaxed text-[#8994AA]">
          <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <h3 className="font-semibold text-[#F3F6FF]">Privacy & Youth Safeguards</h3>
            <p className="mt-1">
              We collect only information needed to save learning progress and issue certificates. Social leaderboards and certificate share links are private by default, use pseudonyms, and never expose emails, school names, or ages.
            </p>
          </div>
          <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <h3 className="font-semibold text-[#F3F6FF]">Non-Cash XP & No Withdrawals</h3>
            <p className="mt-1">{strings.nonCashNotice}</p>
          </div>
          <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <h3 className="font-semibold text-[#F3F6FF]">Course Certificates</h3>
            <p className="mt-1">{strings.nonAccreditationNotice}</p>
          </div>
          <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <h3 className="font-semibold text-[#F3F6FF]">Editorial & AI Accountability</h3>
            <p className="mt-1">
              English and Uzbek editions are authored and reviewed separately. AI tools may assist drafting, but every published lesson and assessment requires human subject, language, and rights approval.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
