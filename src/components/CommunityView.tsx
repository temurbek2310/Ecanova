import React, { useState } from 'react';
import { Copy, Gift, Lock, Trophy, Users } from 'lucide-react';
import type { LeaderboardEntry, LocaleCode, UserSummary } from '../shared/types';
import { t } from '../lib/i18n';

interface CommunityViewProps {
  locale: LocaleCode;
  user: UserSummary | null;
  cohortName: string;
  entries: LeaderboardEntry[];
  referralCode: string | null;
  referralsCount: number;
  claimedReferralCode: string | null;
  onToggleLeaderboardOptIn: (optIn: boolean, pseudonym: string) => Promise<void>;
  onClaimReferral: (code: string) => Promise<void>;
  onRequireAuth: () => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  locale,
  user,
  cohortName,
  entries,
  referralCode,
  referralsCount,
  claimedReferralCode,
  onToggleLeaderboardOptIn,
  onClaimReferral,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const [pseudonym, setPseudonym] = useState(user?.leaderboardPseudonym || 'ECONOVAScholar');
  const [claimInput, setClaimInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOptToggle = async (next: boolean) => {
    setFeedback(null);
    try {
      await onToggleLeaderboardOptIn(next, pseudonym);
      setFeedback(
        next
          ? 'Opted in to cohort leaderboard using your chosen pseudonym.'
          : 'You are hidden from public cohort rankings.'
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await onClaimReferral(claimInput);
      setClaimInput('');
      setFeedback('Referral code applied! Eligible non-cash XP credited.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not apply code.');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#222B3D] pb-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[#F3F6FF] sm:text-2xl">
              <Trophy className="h-5 w-5 text-[#5DE1D2]" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Ixtiyoriy kohorta reytingi' : 'Opt-In Cohort Leaderboard'}</span>
            </h1>
            <p className="mt-1 text-xs text-[#8994AA]">
              {cohortName} · Only learners who explicitly opt in appear here under a chosen pseudonym. No email, age, or school is ever shown.
            </p>
          </div>
        </div>

        {user ? (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="lb-pseudo" className="block text-xs font-medium text-[#8994AA]">
                Your Cohort Pseudonym (Never exposes legal name or email)
              </label>
              <input
                id="lb-pseudo"
                type="text"
                maxLength={32}
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-[#222B3D] bg-[#101522] px-3 py-1.5 text-sm text-[#F3F6FF]"
              />
            </div>
            <button
              type="button"
              onClick={() => handleOptToggle(!user.leaderboardOptIn)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
                user.leaderboardOptIn
                  ? 'border border-[#222B3D] bg-[#141B2B] text-[#8994AA] hover:text-[#F3F6FF]'
                  : 'bg-[#5DE1D2] text-[#080B14]'
              }`}
            >
              {user.leaderboardOptIn ? <Lock className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              <span>{user.leaderboardOptIn ? 'Hide Me From Leaderboard' : 'Opt In to Leaderboard'}</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4 text-xs text-[#8994AA]">
            Sign in to choose a pseudonym and opt in or out of cohort rankings.
          </div>
        )}

        {feedback && (
          <div role="status" className="mt-3 rounded-lg border border-[#5DE1D2]/40 bg-[#0B0F19] px-3.5 py-2 text-xs text-[#5DE1D2]">
            {feedback}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#222B3D] text-xs text-[#8994AA]">
                <th className="py-2 pr-4 font-medium">Rank</th>
                <th className="py-2 pr-4 font-medium">Pseudonym</th>
                <th className="py-2 pr-4 text-right font-medium">Lessons</th>
                <th className="py-2 text-right font-medium">Cohort Non-Cash XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222B3D]/60">
              {entries.map((row) => (
                <tr key={row.rank} className={row.isCurrentUser ? 'bg-[#9274FF]/10' : ''}>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-[#8994AA]">#{row.rank}</td>
                  <td className="py-2.5 pr-4 font-medium text-[#F3F6FF]">
                    {row.pseudonym} {row.isCurrentUser ? '(You)' : ''}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#8994AA]">
                    {row.lessonsCompleted}
                  </td>
                  <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[#FFC96B]">
                    {row.cohortXp} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Referrals */}
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#F3F6FF]">
          <Gift className="h-5 w-5 text-[#9274FF]" aria-hidden="true" />
          <span>{locale === 'uz' ? 'Do‘stlarni taklif qilish (naqd pulsiz XP)' : 'User-Initiated Study Referrals'}</span>
        </h2>
        <p className="mt-1 text-xs text-[#8994AA]">
          Share your code manually if you choose. ECONOVA never accesses your contacts and never awards cash or cash-equivalent rewards. Self-referrals are blocked.
        </p>

        {!user ? (
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-4 min-h-[40px] rounded-lg bg-[#9274FF] px-4 py-2 text-xs font-semibold text-[#080B14]"
          >
            {strings.signIn}
          </button>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
              <div className="text-xs text-[#8994AA]">Your Personal Referral Code</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold tracking-wider text-[#5DE1D2]">
                  {referralCode || 'Loading...'}
                </span>
                {referralCode && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(referralCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#222B3D] bg-[#141B2B] px-3 py-1.5 text-xs text-[#F3F6FF]"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                )}
              </div>
              <div className="mt-2 text-xs text-[#8994AA]">
                Verified peers referred: <span className="font-mono tabular-nums text-[#F3F6FF]">{referralsCount}</span>
              </div>
            </div>

            <form onSubmit={handleClaim} className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
              <label htmlFor="ref-claim" className="block text-xs text-[#8994AA]">
                {claimedReferralCode
                  ? `Applied referral code: ${claimedReferralCode}`
                  : 'Have a peer referral code? Apply once (+40 non-cash XP)'}
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="ref-claim"
                  type="text"
                  disabled={Boolean(claimedReferralCode)}
                  value={claimInput}
                  onChange={(e) => setClaimInput(e.target.value)}
                  placeholder="ECO-XXXXXX"
                  className="min-h-[40px] flex-1 rounded-lg border border-[#222B3D] bg-[#101522] px-3 py-1.5 font-mono text-sm text-[#F3F6FF] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={Boolean(claimedReferralCode) || !claimInput.trim()}
                  className="min-h-[40px] rounded-lg bg-[#9274FF] px-4 py-2 text-xs font-semibold text-[#080B14] disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
};
