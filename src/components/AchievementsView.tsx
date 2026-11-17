import React, { useMemo } from 'react';
import { Award, Flame, ShieldCheck, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { BadgeAward, LocaleCode, StreakSummary, XpLedgerEntry } from '../shared/types';
import { DAILY_XP_CAP } from '../shared/econova-rules';
import { annotateBadgesForEntrance, buildBadgePopVariants } from '../lib/badge-entrance';
import { t } from '../lib/i18n';
import { FloatingWatermark } from './FloatingWatermark';

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
  const annotatedBadges = useMemo(() => annotateBadgesForEntrance(badges), [badges]);

  if (!isAuthenticated) {
    return (
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
        <FloatingWatermark
          theme="gamification"
          seedIndex={0}
          testId="achievements-guest-floating-watermark"
        />
        <div className="relative z-10">
          <h1 className="text-xl font-semibold text-ink">
            {locale === 'uz' ? 'Yutuqlar va naqd pulsiz XP' : 'Achievements, Streaks & Non-Cash XP'}
          </h1>
          <p className="mt-2 text-sm text-muted">{strings.nonCashNotice}</p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-4 min-h-[44px] rounded-lg border-2 border-theme-border bg-accent px-5 py-2 text-sm font-semibold text-accent-ink shadow-brutal-sm hover:bg-accent-hover"
          >
            {strings.signIn}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
        <FloatingWatermark
          theme="gamification"
          seedIndex={0}
          testId="achievements-summary-floating-watermark"
        />
        <div className="relative z-10">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">
            {locale === 'uz' ? 'O‘quv davomiyligi va naqd pulsiz XP' : 'Learning Streaks, Badges & Non-Cash XP'}
          </h1>
          <p className="mt-1 text-xs text-muted">{strings.nonCashNotice}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/55 p-4 backdrop-blur-md">
            <div className="text-xs text-muted">{strings.achievements.nonCashXpTotal}</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-warning">{totalXp} XP</div>
            <div className="mt-1 font-mono text-xs tabular-nums text-muted">
              {locale === 'uz'
                ? `Bugun: ${xpToday} / ${DAILY_XP_CAP} XP kunlik me’yor`
                : `Today: ${xpToday} / ${DAILY_XP_CAP} XP daily cap`}
            </div>
          </div>

          <div className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/55 p-4 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Flame className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
              <span>
                {strings.achievements.studyStreak} ({streak.timezone})
              </span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-teal">
              {streak.currentStreak}{' '}
              {locale === 'uz'
                ? strings.achievements.daysLabel
                : streak.currentStreak === 1
                ? 'day'
                : 'days'}
            </div>
            <div className="mt-1 text-xs text-muted">
              {locale === 'uz' ? (
                <>
                  Eng yaxshi: <span className="font-mono tabular-nums">{streak.bestStreak}</span> · O‘tkazib yuborilgan kunlar kurs natijasini o‘chirmaydi
                </>
              ) : (
                <>
                  Best: <span className="font-mono tabular-nums">{streak.bestStreak}</span> · Missed days never erase course progress
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/55 p-4 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Award className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>{strings.achievements.earnedBadges}</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">{badges.length}</div>
            <div className="mt-1 text-xs text-muted">{strings.achievements.verifiedServerRecords}</div>
          </div>
        </div>
        </div>
      </section>

      {/* Badges with Framer Motion Pop-In Entrance Animation */}
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
        <FloatingWatermark
          theme="gamification"
          seedIndex={1}
          testId="achievements-badges-floating-watermark"
        />
        <div className="relative z-10">
          <h2 className="text-base font-semibold text-ink">
            {strings.achievements.badgesTitle}
          </h2>
        {annotatedBadges.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {strings.achievements.noBadgesYet}
          </p>
        ) : (
          <div
            data-testid="achievements-badge-list"
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <AnimatePresence initial={true} mode="popLayout">
              {annotatedBadges.map((b) => {
                const popVariants = buildBadgePopVariants(b.index);
                return (
                  <motion.div
                    key={b.id}
                    layout
                    data-testid={`achievement-badge-item-${b.id}`}
                    data-badge-key={b.badgeKey}
                    data-badge-animated="true"
                    data-badge-stagger-delay={b.staggerDelaySec}
                    initial={popVariants.hidden}
                    animate={popVariants.visible}
                    whileHover={popVariants.hover}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    className="flex items-start gap-3 rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/55 p-4 shadow-brutal-sm backdrop-blur-md"
                  >
                    <motion.div
                      initial={{ scale: 0.5, rotate: -14 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 460,
                        damping: 22,
                        delay: b.staggerDelaySec + 0.04,
                      }}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-theme-border bg-theme-base text-success"
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{b.title}</span>
                        {b.isRecentAward && (
                          <span className="inline-flex items-center gap-1 rounded border border-theme-accent/50 bg-theme-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-theme-accent">
                            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                            <span>{locale === 'uz' ? 'YANGI' : 'NEW'}</span>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{b.criteria}</p>
                      <div className="mt-1 font-mono text-[11px] text-muted">
                        {locale === 'uz' ? 'Berilgan sana:' : 'Awarded'} {b.awardedAt.slice(0, 10)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        </div>
      </section>

      {/* Append-Only Non-Cash XP Ledger */}
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
        <FloatingWatermark
          theme="gamification"
          seedIndex={2}
          testId="achievements-ledger-floating-watermark"
        />
        <div className="relative z-10">
          <h2 className="text-base font-semibold text-ink">
            {strings.achievements.ledgerTitle}
          </h2>
        <p className="mt-1 text-xs text-muted">
          {locale === 'uz'
            ? 'Majburiy dars uchun +25 XP · O‘tilgan baholash uchun +50 XP · Yakunlangan kurs uchun +100 XP · Tasdiqlangan taklif uchun +40 XP.'
            : '+25 XP per required lesson · +50 XP per passed assessment · +100 XP per completed course · +40 XP per eligible referral.'}
        </p>

        {xpLedger.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{strings.achievements.noLedgerEntries}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-4 font-medium">{strings.achievements.colMilestone}</th>
                  <th className="py-2 pr-4 font-medium">{strings.achievements.colRule}</th>
                  <th className="py-2 pr-4 font-medium">{strings.achievements.colDate}</th>
                  <th className="py-2 text-right font-medium">{strings.achievements.colNonCashXp}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {xpLedger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-4 text-ink">{entry.description}</td>
                    <td className="py-2.5 pr-4 font-mono text-muted">{entry.ruleVersion}</td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-muted">{entry.createdAt.slice(0, 10)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-warning">
                      +{entry.amount} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </section>
    </div>
  );
};
