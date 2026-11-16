import React from 'react';
import { Award, Flame, ShieldCheck } from 'lucide-react';
import type { BadgeAward, LocaleCode, StreakSummary, XpLedgerEntry } from '../shared/types';
import { DAILY_XP_CAP } from '../shared/econova-rules';
import { t } from '../lib/i18n';

interface AchievementsViewProps {
  locale: LocaleCode;
  isAuthenticated: boolean;
  totalXp: number;
  xpToday: number;
  xpLedger: XpLedgerEntry[];
  streak: StreakSummary;
  badges: BadgeAward[];
  onRequireAuth: () => void;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  locale,
  isAuthenticated,
  totalXp,
  xpToday,
  xpLedger,
  streak,
  badges,
  onRequireAuth,
}) => {
  const strings = t(locale);

  if (!isAuthenticated) {
    return (
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-6">
        <h1 className="text-xl font-semibold text-[#F3F6FF]">
          {locale === 'uz' ? 'Yutuqlar va naqd pulsiz XP' : 'Achievements, Streaks & Non-Cash XP'}
        </h1>
        <p className="mt-2 text-sm text-[#8994AA]">{strings.nonCashNotice}</p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="mt-4 min-h-[44px] rounded-lg bg-[#9274FF] px-5 py-2 text-sm font-semibold text-[#080B14]"
        >
          {strings.signIn}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-[#F3F6FF] sm:text-2xl">
          {locale === 'uz' ? 'O‘quv davomiyligi va naqd pulsiz XP' : 'Learning Streaks, Badges & Non-Cash XP'}
        </h1>
        <p className="mt-1 text-xs text-[#8994AA]">{strings.nonCashNotice}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <div className="text-xs text-[#8994AA]">Non-Cash XP Total</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#FFC96B]">{totalXp} XP</div>
            <div className="mt-1 font-mono text-xs tabular-nums text-[#8994AA]">
              Today: {xpToday} / {DAILY_XP_CAP} XP daily cap
            </div>
          </div>

          <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <div className="flex items-center gap-1.5 text-xs text-[#8994AA]">
              <Flame className="h-3.5 w-3.5 text-[#5DE1D2]" aria-hidden="true" />
              <span>Study Streak ({streak.timezone})</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#5DE1D2]">
              {streak.currentStreak} {streak.currentStreak === 1 ? 'day' : 'days'}
            </div>
            <div className="mt-1 text-xs text-[#8994AA]">
              Best: <span className="font-mono tabular-nums">{streak.bestStreak}</span> · Missed days never erase course progress
            </div>
          </div>

          <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
            <div className="flex items-center gap-1.5 text-xs text-[#8994AA]">
              <Award className="h-3.5 w-3.5 text-[#9274FF]" aria-hidden="true" />
              <span>Earned Badges</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#F3F6FF]">{badges.length}</div>
            <div className="mt-1 text-xs text-[#8994AA]">Awarded strictly from verified server records</div>
          </div>
        </div>
      </section>

      {/* Badges */}
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[#F3F6FF]">
          {locale === 'uz' ? 'Qo‘lga kiritilgan nishonlar' : 'Verified Badges'}
        </h2>
        {badges.length === 0 ? (
          <p className="mt-2 text-sm text-[#8994AA]">
            Complete your first reviewed lesson or pass an assessment to earn your first badge.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {badges.map((b) => (
              <div key={b.id} className="flex items-start gap-3 rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#6FE0A1]" aria-hidden="true" />
                <div>
                  <div className="text-sm font-semibold text-[#F3F6FF]">{b.title}</div>
                  <p className="mt-0.5 text-xs text-[#8994AA]">{b.criteria}</p>
                  <div className="mt-1 font-mono text-[11px] text-[#8994AA]">Awarded {b.awardedAt.slice(0, 10)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Append-Only Non-Cash XP Ledger */}
      <section className="rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[#F3F6FF]">
          {locale === 'uz' ? 'Naqd pulsiz XP tarixi (Append-only Ledger)' : 'Non-Cash XP Activity Ledger'}
        </h2>
        <p className="mt-1 text-xs text-[#8994AA]">
          +25 XP per required lesson · +50 XP per passed assessment · +100 XP per completed course · +40 XP per eligible referral.
        </p>

        {xpLedger.length === 0 ? (
          <p className="mt-4 text-sm text-[#8994AA]">No XP transactions recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#222B3D] text-[#8994AA]">
                  <th className="py-2 pr-4 font-medium">Milestone</th>
                  <th className="py-2 pr-4 font-medium">Rule</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Non-Cash XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222B3D]/60">
                {xpLedger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-4 text-[#F3F6FF]">{entry.description}</td>
                    <td className="py-2.5 pr-4 font-mono text-[#8994AA]">{entry.ruleVersion}</td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-[#8994AA]">{entry.createdAt.slice(0, 10)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[#FFC96B]">
                      +{entry.amount} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
