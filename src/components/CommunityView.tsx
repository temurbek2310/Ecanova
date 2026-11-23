import React, { useState } from 'react';
import {
  Award,
  Copy,
  Gift,
  Lock,
  Trophy,
  Users,
} from 'lucide-react';
import type {
  CourseCatalogItem,
  LeaderboardEntry,
  LocaleCode,
  QuizLeaderboardEntry,
  UserSummary,
} from '../shared/types';
import { t } from '../lib/i18n';
import { notificationCopy } from '../lib/notification-copy';
import { describeError, notify } from '../lib/notifications';
import type { WeekWindow } from '../lib/quiz-leaderboard';
import { FloatingWatermark } from './FloatingWatermark';
import { InteractiveDotGrid } from './ui/InteractiveDotGrid';
import { RankingMatrix } from './RankingMatrix';
import { BrutalLeaderboardSkeleton, ContentReveal, SkeletonLine } from './ui/BrutalSkeleton';

interface CommunityViewProps {
  locale: LocaleCode;
  loading?: boolean;
  user: UserSummary | null;
  cohortName: string;
  entries: LeaderboardEntry[];
  quizEntries?: QuizLeaderboardEntry[];
  weekWindow?: WeekWindow | null;
  courses?: CourseCatalogItem[];
  referralCode: string | null;
  referralsCount: number;
  claimedReferralCode: string | null;
  onToggleLeaderboardOptIn: (optIn: boolean, pseudonym: string) => Promise<void>;
  onClaimReferral: (code: string) => Promise<void>;
  onRequireAuth: () => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  locale,
  loading = false,
  user,
  cohortName,
  entries,
  quizEntries = [],
  weekWindow,
  courses = [],
  referralCode,
  referralsCount,
  claimedReferralCode,
  onToggleLeaderboardOptIn,
  onClaimReferral,
  onRequireAuth,
}) => {
  const strings = t(locale);
  const toastCopy = notificationCopy(locale);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'cohort' | 'quiz'>('cohort');
  const [selectedQuizCourseId, setSelectedQuizCourseId] = useState<string>('all');
  const [pseudonym, setPseudonym] = useState(user?.leaderboardPseudonym || 'ECONOVAScholar');
  const [claimInput, setClaimInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleOptToggle = async (next: boolean) => {
    try {
      await onToggleLeaderboardOptIn(next, pseudonym);
      notify.success(
        next ? toastCopy.community.joined : toastCopy.community.left,
        next
          ? locale === 'uz'
            ? 'Siz tanlagan taxallus bilan reytingga qo‘shildingiz.'
            : 'Opted in to cohort and weekly quiz leaderboards using your chosen pseudonym.'
          : locale === 'uz'
          ? 'Siz ommaviy reytinglardan yashirildingiz.'
          : 'You are hidden from public cohort and quiz rankings.'
      );
    } catch (err) {
      notify.error(toastCopy.community.updateFailed, describeError(err, toastCopy.common.genericError));
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onClaimReferral(claimInput);
      setClaimInput('');
      notify.success(
        toastCopy.community.referralApplied,
        locale === 'uz'
          ? 'Naqd pulsiz XP hisoblandi.'
          : 'Eligible non-cash XP credited.'
      );
    } catch (err) {
      notify.error(toastCopy.community.referralFailed, describeError(err, toastCopy.common.genericError));
    }
  };

  return (
    <ContentReveal className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
        <InteractiveDotGrid testId="community-leaderboard-dot-grid" />
        <FloatingWatermark
          theme="gamification"
          seedIndex={0}
          testId="leaderboard-floating-watermark"
        />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-ink sm:text-2xl">
              <Trophy className="h-5 w-5 text-theme-cyan" aria-hidden="true" />
              <span>
                {locale === 'uz'
                  ? 'Ixtiyoriy kohorta va haftalik test reytingi'
                  : 'Opt-In Cohort & Weekly Quiz Leaderboard'}
              </span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              {cohortName} ·{' '}
              {locale === 'uz'
                ? 'Faqat ixtiyoriy ravishda rozilik bildirgan o‘quvchilar tanlangan taxallus ostida ko‘rinadi.'
                : 'Only learners who explicitly opt in appear here under a chosen pseudonym. No email, age, or school is ever shown.'}
            </p>
          </div>

          {/* Leaderboard Mode Sub-Tabs: Cohort XP vs. Weekly Quiz Leaderboard */}
          <div
            role="tablist"
            aria-label={locale === 'uz' ? 'Reyting turlari' : 'Leaderboard Views'}
            className="inline-flex rounded-lg border-2 border-theme-border bg-theme-base p-1 shadow-brutal-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeLeaderboardTab === 'cohort'}
              onClick={() => setActiveLeaderboardTab('cohort')}
              data-testid="leaderboard-tab-cohort"
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeLeaderboardTab === 'cohort'
                  ? 'bg-theme-accent text-theme-accent-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Umumiy XP reytingi' : 'Cohort XP'}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeLeaderboardTab === 'quiz'}
              onClick={() => setActiveLeaderboardTab('quiz')}
              data-testid="leaderboard-tab-matrix"
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeLeaderboardTab === 'quiz'
                  ? 'bg-theme-accent text-theme-accent-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Reyting matritsasi' : 'Ranking Matrix'}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                  activeLeaderboardTab === 'quiz'
                    ? 'bg-theme-base/20 text-theme-accent-ink'
                    : 'bg-theme-panel text-theme-cyan'
                }`}
              >
                {quizEntries.length}
              </span>
            </button>
          </div>
        </div>

        {user ? (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/40 dark:bg-[#080B14]/55 p-4 shadow-brutal-sm backdrop-blur-md">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="lb-pseudo" className="block text-xs font-medium text-muted">
                {locale === 'uz'
                  ? 'Sizning kohorta taxallusingiz (shaxsiy ism va email ko‘rsatilmaydi)'
                  : 'Your Cohort Pseudonym (Never exposes legal name or email)'}
              </label>
              <input
                id="lb-pseudo"
                type="text"
                maxLength={32}
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
                className="mt-1 min-h-[40px] w-full rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/50 dark:bg-[#080B14]/60 px-3 py-1.5 text-sm text-ink"
              />
            </div>
            <button
              type="button"
              onClick={() => handleOptToggle(!user.leaderboardOptIn)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
                user.leaderboardOptIn
                  ? 'border border-line bg-elevated text-muted hover:text-ink'
                  : 'bg-teal text-teal-ink hover:bg-teal-hover'
              }`}
            >
              {user.leaderboardOptIn ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              <span>
                {user.leaderboardOptIn
                  ? locale === 'uz'
                    ? 'Reytingdan yashirish'
                    : 'Hide Me From Leaderboard'
                  : locale === 'uz'
                  ? 'Reytingga qo‘shilish'
                  : 'Opt In to Leaderboard'}
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/40 dark:bg-[#080B14]/55 p-4 text-xs text-muted shadow-brutal-sm backdrop-blur-md">
            {locale === 'uz'
              ? 'Taxallus tanlash va reytingda ishtirok etish uchun tizimga kiring.'
              : 'Sign in to choose a pseudonym and opt in or out of cohort and weekly quiz rankings.'}
          </div>
        )}


        {/* TAB 1: COHORT XP LEADERBOARD */}
        {activeLeaderboardTab === 'cohort' && (
          <div
            role="tabpanel"
            data-testid="cohort-leaderboard-panel"
            className="mt-4 overflow-x-auto"
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pr-4 font-medium">
                    {locale === 'uz' ? 'O‘rin' : 'Rank'}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {locale === 'uz' ? 'Taxallus' : 'Pseudonym'}
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    {locale === 'uz' ? 'Darslar' : 'Lessons'}
                  </th>
                  <th className="py-2 text-right font-medium">
                    {locale === 'uz' ? 'Kohorta XP (naqd pulsiz)' : 'Cohort Non-Cash XP'}
                  </th>
                </tr>
              </thead>
              {loading && entries.length === 0 ? (
                <BrutalLeaderboardSkeleton rows={5} locale={locale} />
              ) : (
                <tbody className="divide-y divide-line/60">
                  {entries.map((row) => (
                    <tr key={row.rank} className={row.isCurrentUser ? 'bg-accent/10' : ''}>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-muted">
                        #{row.rank}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-ink">
                        {row.pseudonym}{' '}
                        {row.isCurrentUser ? (locale === 'uz' ? '(Siz)' : '(You)') : ''}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-muted">
                        {row.lessonsCompleted}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-warning">
                        {row.cohortXp} XP
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}

        {/* TAB 2: QUANTITATIVE RANKING MATRIX */}
        {activeLeaderboardTab === 'quiz' && (
          <RankingMatrix
            locale={locale}
            quizEntries={quizEntries}
            weekWindow={weekWindow}
            courses={courses}
            selectedCourseId={selectedQuizCourseId}
            onSelectCourseId={setSelectedQuizCourseId}
          />
        )}
        </div>
      </section>

      {/* Referrals */}
      <section className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
        <InteractiveDotGrid testId="community-referrals-dot-grid" />
        <FloatingWatermark
          theme="gamification"
          seedIndex={1}
          testId="referrals-floating-watermark"
        />
        <div className="relative z-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Gift className="h-5 w-5 text-accent" aria-hidden="true" />
          <span>
            {locale === 'uz'
              ? 'Do‘stlarni taklif qilish (naqd pulsiz XP)'
              : 'User-Initiated Study Referrals'}
          </span>
        </h2>
        <p className="mt-1 text-xs text-muted">
          {locale === 'uz'
            ? 'Kodingizni ixtiyoriy ravishda ulashing. ECONOVA hech qachon kontaktlaringizga kirmaydi va pul mukofotlari bermaydi.'
            : 'Share your code manually if you choose. ECONOVA never accesses your contacts and never awards cash or cash-equivalent rewards. Self-referrals are blocked.'}
        </p>

        {!user ? (
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-4 min-h-[40px] rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
          >
            {strings.signIn}
          </button>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/40 dark:bg-[#080B14]/55 p-4 shadow-brutal-sm backdrop-blur-md">
              <div className="text-xs text-muted">
                {locale === 'uz' ? 'Shaxsiy taklif kodingiz' : 'Your Personal Referral Code'}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold tracking-wider text-teal">
                  {referralCode ? (
                    referralCode
                  ) : (
                    <SkeletonLine width="130px" height="22px" className="inline-block" />
                  )}
                </span>
                {referralCode && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (!navigator.clipboard) throw new Error(toastCopy.share.copyFailed);
                        await navigator.clipboard.writeText(referralCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        notify.success(toastCopy.share.copied, referralCode);
                      } catch (err) {
                        notify.error(toastCopy.share.copyFailed, describeError(err, toastCopy.common.genericError));
                      }
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs text-ink"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {copied
                        ? locale === 'uz'
                          ? 'Nusxalandi'
                          : 'Copied'
                        : locale === 'uz'
                        ? 'Kodni nusxalash'
                        : 'Copy Code'}
                    </span>
                  </button>
                )}
              </div>
              <div className="mt-2 text-xs text-muted">
                {locale === 'uz' ? 'Taklif qilingan tengdoshlar:' : 'Verified peers referred:'}{' '}
                <span className="font-mono tabular-nums text-ink">{referralsCount}</span>
              </div>
            </div>

            <form onSubmit={handleClaim} className="rounded-xl border-2 border-slate-500 dark:border-[#222B3D] bg-white/40 dark:bg-[#080B14]/55 p-4 shadow-brutal-sm backdrop-blur-md">
              <label htmlFor="ref-claim" className="block text-xs text-muted">
                {claimedReferralCode
                  ? locale === 'uz'
                    ? `Qo‘llanilgan taklif kodi: ${claimedReferralCode}`
                    : `Applied referral code: ${claimedReferralCode}`
                  : locale === 'uz'
                  ? 'Tengdoshingiz taklif kodi bormi? Bir marta kiriting (+40 naqd pulsiz XP)'
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
                  className="min-h-[40px] flex-1 rounded-lg border-2 border-slate-500 dark:border-[#222B3D] bg-white/50 dark:bg-[#080B14]/60 px-3 py-1.5 font-mono text-sm text-ink disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={Boolean(claimedReferralCode) || !claimInput.trim()}
                  className="min-h-[40px] rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                >
                  {locale === 'uz' ? 'Qo‘llash' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        )}
        </div>
      </section>
    </ContentReveal>
  );
};
