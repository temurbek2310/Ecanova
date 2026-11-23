import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Award, Flame, ShieldCheck } from 'lucide-react';
import type { BadgeAward, LocaleCode, StreakSummary, XpLedgerEntry } from '../shared/types';
import { DAILY_XP_CAP } from '../shared/econova-rules';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import {
  BADGE_SLIDE_IN_DEFAULTS,
  annotateBadgesForEntrance,
  buildBadgeEntranceAnimationPlan,
  resolveNewlyUnlockedBadgeIds,
} from '../lib/badge-entrance';
import { t } from '../lib/i18n';
import { FloatingWatermark } from './FloatingWatermark';
import { InteractiveDotGrid } from './ui/InteractiveDotGrid';
import { ContentReveal, SkeletonBlock, SkeletonLine } from './ui/BrutalSkeleton';

interface AchievementsViewProps {
  locale: LocaleCode;
  isAuthenticated: boolean;
  overviewLoaded?: boolean;
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
  overviewLoaded = true,
  totalXp,
  xpToday,
  xpLedger,
  streak,
  badges,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const annotatedBadges = useMemo(() => annotateBadgesForEntrance(badges), [badges]);
  const badgeListContainerRef = useRef<HTMLDivElement | null>(null);
  const badgeCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hasHydratedBaselineRef = useRef<boolean>(false);
  const prevBadgeIdsRef = useRef<string[]>([]);
  const [recentUnlockIds, setRecentUnlockIds] = useState<string[]>([]);

  badgeCardRefs.current.length = annotatedBadges.length;

  const badgeIdsSignature = useMemo(
    () => annotatedBadges.map((b) => b.id).join('|'),
    [annotatedBadges]
  );

  // Commit baseline and newly unlocked badge IDs after layout GSAP phase
  useEffect(() => {
    if (!overviewLoaded) return;

    const currentIds = annotatedBadges.map((b) => b.id);
    if (!hasHydratedBaselineRef.current) {
      hasHydratedBaselineRef.current = true;
      prevBadgeIdsRef.current = currentIds;
      return;
    }

    const newlyAdded = resolveNewlyUnlockedBadgeIds(prevBadgeIdsRef.current, annotatedBadges);
    prevBadgeIdsRef.current = currentIds;

    if (newlyAdded.length > 0) {
      setRecentUnlockIds((prev) => Array.from(new Set([...prev, ...newlyAdded])));
    }
  }, [annotatedBadges, badgeIdsSignature, overviewLoaded]);

  // Staggered Glass-Brutalist GSAP fade-in and scale animation (`power3.out`) for badge cards
  useEconovaGSAP(
    badgeListContainerRef,
    () => {
      const containerEl = badgeListContainerRef.current;
      if (!containerEl || annotatedBadges.length === 0) return;

      const cards = badgeCardRefs.current
        .slice(0, annotatedBadges.length)
        .filter((el): el is HTMLDivElement => el !== null);
      if (cards.length === 0) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        gsap.set(cards, {
          autoAlpha: 1,
          scale: 1,
          x: 0,
          y: 0,
          clearProps: 'transform',
        });
        return;
      }

      const plan = buildBadgeEntranceAnimationPlan({
        hasHydratedBaseline: hasHydratedBaselineRef.current,
        previousBadgeIds: prevBadgeIdsRef.current,
        currentBadges: annotatedBadges,
      });

      if (plan.mode === 'none') return;

      const targetCards =
        plan.mode === 'unlock-stagger'
          ? cards.filter((el) =>
              plan.targetIds.includes(el.getAttribute('data-badge-id') || '')
            )
          : cards;

      if (targetCards.length === 0) return;

      const fromVars: gsap.TweenVars =
        plan.mode === 'unlock-stagger'
          ? {
              autoAlpha: 0,
              scale: plan.fromScale,
              x: BADGE_SLIDE_IN_DEFAULTS.unlockXOffsetPx,
              y: 10,
            }
          : {
              autoAlpha: 0,
              scale: plan.fromScale,
              y: BADGE_SLIDE_IN_DEFAULTS.initialYOffsetPx,
            };

      const duration =
        plan.mode === 'unlock-stagger'
          ? BADGE_SLIDE_IN_DEFAULTS.unlockDurationSec
          : BADGE_SLIDE_IN_DEFAULTS.durationSec;

      gsap.fromTo(targetCards, fromVars, {
        autoAlpha: 1,
        scale: 1,
        x: 0,
        y: 0,
        duration,
        stagger: plan.staggerSec,
        ease: plan.ease,
        transformOrigin: 'center center',
        overwrite: 'auto',
        clearProps: 'transform',
      });

      const iconSlabs = targetCards
        .map((card) => card.querySelector<HTMLElement>('[data-badge-icon="true"]'))
        .filter((el): el is HTMLElement => Boolean(el));

      if (iconSlabs.length > 0) {
        gsap.fromTo(
          iconSlabs,
          { scale: 0.84, autoAlpha: 0.6 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.42,
            stagger: plan.staggerSec,
            ease: plan.ease,
            transformOrigin: 'center center',
            overwrite: 'auto',
            clearProps: 'transform',
          }
        );
      }
    },
    { dependencies: [isAuthenticated, overviewLoaded, badgeIdsSignature] }
  );

  if (!isAuthenticated) {
    return (
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
        <InteractiveDotGrid testId="achievements-guest-dot-grid" />
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

  if (!overviewLoaded) {
    return (
      <div
        aria-busy="true"
        aria-label={locale === 'uz' ? 'Yutuqlar yuklanmoqda...' : 'Loading achievements...'}
        className="space-y-6"
      >
        <section className="rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
          <SkeletonLine width="260px" height="24px" />
          <SkeletonLine width="180px" height="12px" className="mt-2" />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/55 p-4 backdrop-blur-md space-y-2"
              >
                <SkeletonLine width="60%" height="12px" />
                <SkeletonLine width="45%" height="28px" />
                <SkeletonLine width="75%" height="11px" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
          <SkeletonLine width="200px" height="20px" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/55 dark:bg-[#080B14]/55 p-4 backdrop-blur-md space-y-2"
              >
                <div className="flex items-center gap-3">
                  <SkeletonBlock width="40px" height="40px" className="rounded-full shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <SkeletonLine width="70%" height="14px" />
                    <SkeletonLine width="40%" height="10px" />
                  </div>
                </div>
                <SkeletonLine width="90%" height="11px" className="mt-2" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
        <InteractiveDotGrid testId="achievements-summary-dot-grid" />
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

      {/* Competency Milestone Credentials with Glass-Brutalism GSAP Slide-In */}
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
        <InteractiveDotGrid testId="achievements-badges-dot-grid" />
        <FloatingWatermark
          theme="gamification"
          seedIndex={1}
          testId="achievements-badges-floating-watermark"
        />
        <div ref={badgeListContainerRef} className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">
              {strings.achievements.badgesTitle}
            </h2>
            <span className="border-2 border-[#222B3D] bg-[#080B14]/70 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#5DE1D2] shadow-[3px_3px_0px_#000000]">
              {annotatedBadges.length} {locale === 'uz' ? 'TASDIQLANGAN' : 'VERIFIED'}
            </span>
          </div>

          {annotatedBadges.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              {strings.achievements.noBadgesYet}
            </p>
          ) : (
            <div
              data-testid="achievements-badge-list"
              data-badge-ease={BADGE_SLIDE_IN_DEFAULTS.ease}
              className="mt-4 grid gap-3.5 sm:grid-cols-2"
            >
              {annotatedBadges.map((b, idx) => {
                const isNewlyUnlocked = recentUnlockIds.includes(b.id);
                return (
                  <div
                    key={b.id}
                    ref={(el) => {
                      badgeCardRefs.current[idx] = el;
                    }}
                    data-testid={`achievement-badge-item-${b.id}`}
                    data-badge-id={b.id}
                    data-badge-card="true"
                    data-badge-key={b.badgeKey}
                    data-badge-newly-unlocked={isNewlyUnlocked ? 'true' : 'false'}
                    data-badge-stagger-delay={b.staggerDelaySec}
                    className={`flex items-start gap-3.5 border-2 bg-white/30 p-4 backdrop-blur-2xl transition-colors dark:bg-[#101522]/30 ${
                      isNewlyUnlocked
                        ? 'border-[#5DE1D2] shadow-[6px_6px_0px_#5DE1D2] dark:border-[#5DE1D2] dark:shadow-[6px_6px_0px_#000000]'
                        : 'border-slate-500 shadow-[6px_6px_0px_#000000] dark:border-[#222B3D] dark:shadow-[6px_6px_0px_#000000]'
                    }`}
                  >
                    <div
                      data-badge-icon="true"
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border-2 bg-[#080B14] shadow-[3px_3px_0px_#000000] ${
                        isNewlyUnlocked ? 'border-[#5DE1D2] text-[#5DE1D2]' : 'border-[#222B3D] text-[#6FE0A1]'
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold tracking-tight text-ink">{b.title}</span>
                        {(isNewlyUnlocked || b.isRecentAward) && (
                          <span className="inline-flex items-center border border-[#5DE1D2] bg-[#5DE1D2]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#5DE1D2]">
                            {isNewlyUnlocked
                              ? locale === 'uz'
                                ? 'OCHILDI'
                                : 'UNLOCKED'
                              : locale === 'uz'
                              ? 'YANGI'
                              : 'RECENT'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{b.criteria}</p>
                      <div className="mt-2 font-mono text-[11px] tabular-nums text-muted">
                        {locale === 'uz' ? 'BERILGAN:' : 'VERIFIED'} // {b.awardedAt.slice(0, 10)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Append-Only Non-Cash XP Ledger */}
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
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
    </ContentReveal>
  );
};
