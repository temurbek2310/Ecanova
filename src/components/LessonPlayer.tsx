import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Captions,
  FileText,
  MessageSquarePlus,
  NotebookPen,
  Pause,
  Play,
  Share2,
  SkipBack,
  SkipForward,
  Square,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { GlossaryTermItem, LessonPublic, LocaleCode } from '../shared/types';
import type { AmbientFocusAudioController } from '../hooks/useAmbientFocusAudio';
import type { FocusTimerController } from '../hooks/useFocusTimer';
import {
  buildLessonReadAloudSegments,
  clampSpeechRate,
  selectPreferredSpeechVoice,
} from '../lib/read-aloud';
import { buildLessonShareData, shareProgressWithWebApi } from '../lib/share-progress';
import { apiFetch } from '../lib/auth-client';
import { FocusTimerPanel } from './FocusTimerPanel';
import { InteractiveTerminologyText } from './InteractiveTerminologyText';
import { QuickNotesDrawer } from './QuickNotesDrawer';
import { InteractiveSimulation } from './simulations/InteractiveSimulation';

interface LessonPlayerProps {
  courseId: string;
  courseTitle?: string;
  lesson: LessonPublic;
  locale: LocaleCode;
  isCompleted: boolean;
  isAuthenticated: boolean;
  profileNotes?: Record<string, string>;
  onSyncNotesToProfile?: (nextNotes: Record<string, string>) => Promise<void>;
  onCompleteLesson: (lessonId: string) => Promise<void>;
  onRequireAuth: () => void;
  onNextLesson?: () => void;
  onOpenAssessment?: () => void;
  focusTimer?: FocusTimerController;
  ambientAudio?: AmbientFocusAudioController;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({
  courseId,
  courseTitle = 'ECONOVA Course',
  lesson,
  locale,
  isCompleted,
  isAuthenticated,
  profileNotes,
  onSyncNotesToProfile,
  onCompleteLesson,
  onRequireAuth,
  onNextLesson,
  onOpenAssessment,
  focusTimer,
  ambientAudio,
}) => {
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null
  );
  const shareTimerRef = useRef<number | null>(null);
  const isReadingAloudRef = useRef(false);
  const playbackRateRef = useRef(playbackRate);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  // Structured Read Aloud segments for course content
  const readAloudSegments = useMemo(
    () => buildLessonReadAloudSegments(lesson, locale, courseTitle),
    [lesson, locale, courseTitle]
  );

  // Glossary API terms for Interactive Terminology overlay
  const [apiGlossaryTerms, setApiGlossaryTerms] = useState<GlossaryTermItem[]>([]);

  // Quick Notes slide-out drawer & inline Focus Timer bar state
  const [notesOpen, setNotesOpen] = useState(false);
  const [focusBarOpen, setFocusBarOpen] = useState(false);

  // Request Review modal state (student segment review notification to AdminStudioView)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSegmentHeading, setReviewSegmentHeading] = useState<string>(
    lesson.bodyBlocks[0]?.heading || lesson.title
  );
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null
  );

  // Report-an-issue modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<
    'accuracy' | 'translation' | 'accessibility' | 'rights' | 'safety'
  >('accuracy');
  const [reportText, setReportText] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    setShareStatus(null);
    setReviewSegmentHeading(lesson.bodyBlocks[0]?.heading || lesson.title);
    setReviewStatus(null);
    isReadingAloudRef.current = false;
    setIsReadingAloud(false);
    setIsSpeechPaused(false);
    setActiveSegmentIndex(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return () => {
      isReadingAloudRef.current = false;
      if (shareTimerRef.current !== null) {
        window.clearTimeout(shareTimerRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [lesson.id, lesson.title, lesson.bodyBlocks]);

  useEffect(() => {
    let cancelled = false;
    const loadGlossary = async () => {
      try {
        const res = await apiFetch(
          `/api/glossary?courseId=${encodeURIComponent(courseId)}&locale=${encodeURIComponent(locale)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { terms?: GlossaryTermItem[] };
        if (!cancelled && Array.isArray(data.terms)) {
          setApiGlossaryTerms(data.terms);
        }
      } catch {
        // Non-blocking fallback to lesson.keyTerms
      }
    };
    void loadGlossary();
    return () => {
      cancelled = true;
    };
  }, [courseId, locale]);

  const combinedGlossaryTerms = useMemo<GlossaryTermItem[]>(() => {
    const map = new Map<string, GlossaryTermItem>();
    for (const kt of lesson.keyTerms) {
      if (kt?.term && kt?.definition) {
        map.set(kt.term.trim().toLowerCase(), {
          term: kt.term.trim(),
          definition: kt.definition.trim(),
          courseId,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        });
      }
    }
    for (const gt of apiGlossaryTerms) {
      if (gt?.term && gt?.definition) {
        const key = gt.term.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, gt);
        }
      }
    }
    return Array.from(map.values());
  }, [lesson.keyTerms, lesson.id, lesson.title, courseId, apiGlossaryTerms]);

  const stopReadAloud = () => {
    isReadingAloudRef.current = false;
    setIsReadingAloud(false);
    setIsSpeechPaused(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakSegmentAtIndex = (index: number, rateOverride?: number) => {
    const safeIndex = Math.max(0, Math.min(readAloudSegments.length - 1, index));
    const segment = readAloudSegments[safeIndex];
    if (!segment) {
      stopReadAloud();
      return;
    }

    isReadingAloudRef.current = true;
    setIsReadingAloud(true);
    setIsSpeechPaused(false);
    setActiveSegmentIndex(safeIndex);

    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(segment.text);
      utter.lang = segment.lang;
      utter.rate = clampSpeechRate(rateOverride ?? playbackRateRef.current);
      const voices = window.speechSynthesis.getVoices?.() ?? [];
      const preferredVoice = selectPreferredSpeechVoice(voices, locale);
      if (preferredVoice) {
        utter.voice = preferredVoice;
      }
      utter.onend = () => {
        if (!isReadingAloudRef.current) return;
        if (safeIndex + 1 < readAloudSegments.length) {
          speakSegmentAtIndex(safeIndex + 1);
        } else {
          isReadingAloudRef.current = false;
          setIsReadingAloud(false);
          setIsSpeechPaused(false);
        }
      };
      utter.onerror = (event) => {
        // Ignore intentional cancel/interrupted events when user skips or changes speed
        if (event.error === 'canceled' || event.error === 'interrupted') {
          return;
        }
      };
      window.speechSynthesis.speak(utter);
    } catch {
      // Keep visual Read Aloud bar active even if browser speech engine is restricted
    }
  };

  const toggleReadAloud = () => {
    if (isReadingAloud) {
      stopReadAloud();
      return;
    }
    speakSegmentAtIndex(0);
  };

  const togglePauseResumeReadAloud = () => {
    if (!isReadingAloud) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (isSpeechPaused) {
        window.speechSynthesis.resume();
        setIsSpeechPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsSpeechPaused(true);
      }
    } else {
      setIsSpeechPaused((prev) => !prev);
    }
  };

  const handlePlaybackRateChange = (nextRate: number) => {
    const clamped = clampSpeechRate(nextRate);
    setPlaybackRate(clamped);
    playbackRateRef.current = clamped;
    if (isReadingAloud && !isSpeechPaused) {
      speakSegmentAtIndex(activeSegmentIndex, clamped);
    }
  };

  const activeSegment = readAloudSegments[activeSegmentIndex] ?? readAloudSegments[0] ?? null;

  const handleComplete = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onCompleteLesson(lesson.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save progress.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportStatus(null);
    try {
      const res = await apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId: lesson.id,
          category: reportCategory,
          description: reportText,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not submit report.');
      setReportText('');
      setReportStatus(
        locale === 'uz'
          ? 'Rahmat! Xabaringiz tahririyat ko‘rib chiqish navbatiga yuborildi.'
          : 'Thank you. Your report has been logged for human editorial review.'
      );
    } catch (err) {
      setReportStatus(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const handleRequestReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewBusy(true);
    setReviewStatus(null);
    try {
      const res = await apiFetch('/api/reviews/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          segmentHeading: reviewSegmentHeading,
          comment: reviewComment,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit review request.');
      }
      setReviewComment('');
      setReviewStatus({
        kind: 'ok',
        text:
          locale === 'uz'
            ? 'So‘rov yuborildi! Ekspert muharrirlar ushbu dars qismini ko‘rib chiqadi.'
            : 'Review notification dispatched! Human reviewers can now inspect this segment in the Editorial Studio.',
      });
    } catch (err) {
      setReviewStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not send review request.',
      });
    } finally {
      setReviewBusy(false);
    }
  };

  const handleShareLesson = async () => {
    if (shareTimerRef.current !== null) {
      window.clearTimeout(shareTimerRef.current);
    }
    const payload = buildLessonShareData({
      courseTitle,
      lessonTitle: lesson.title,
      locale,
      url: window.location.href,
    });
    const res = await shareProgressWithWebApi(payload);
    if (res.cancelled) {
      return;
    }
    if (res.ok) {
      setShareStatus({
        kind: 'ok',
        text:
          res.method === 'web-share'
            ? locale === 'uz'
              ? 'Dars ma’lumoti ulashish oynasi orqali yuborildi.'
              : 'Lesson shared via your device share sheet.'
            : locale === 'uz'
            ? 'Dars havolasi va matni buferga nusxalandi.'
            : 'Lesson details copied to clipboard.',
      });
    } else {
      setShareStatus({
        kind: 'error',
        text:
          res.reason ||
          (locale === 'uz' ? 'Darsni ulashib bo‘lmadi.' : 'Unable to share lesson right now.'),
      });
    }
    shareTimerRef.current = window.setTimeout(() => {
      setShareStatus(null);
    }, 3000);
  };

  return (
    <article className="space-y-6 rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25">
      <header className="border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {locale === 'uz' ? `${lesson.sequenceNum}-dars` : `Lesson ${lesson.sequenceNum}`}
            {' · '}
            {lesson.estimatedMinutes} {locale === 'uz' ? 'daqiqa' : 'min'}
            {' · '}
            {lesson.isRequired
              ? locale === 'uz'
                ? 'Majburiy'
                : 'Required'
              : locale === 'uz'
              ? 'Ixtiyoriy'
              : 'Optional'}
          </span>
          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={isReadingAloud}
              onClick={toggleReadAloud}
              data-testid="lesson-read-aloud-toggle"
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold shadow-brutal-sm transition-colors ${
                isReadingAloud
                  ? 'border-theme-accent bg-theme-accent text-theme-accent-ink'
                  : 'border-theme-border bg-theme-base text-theme-cyan hover:border-theme-cyan'
              }`}
            >
              {isReadingAloud ? (
                <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {isReadingAloud
                  ? locale === 'uz'
                    ? 'Ovozli o‘qishni to‘xtatish'
                    : 'Stop Read Aloud'
                  : locale === 'uz'
                  ? 'Ovozli o‘qish'
                  : 'Read Aloud'}
              </span>
            </button>

            {focusTimer && ambientAudio && (
              <button
                type="button"
                aria-pressed={focusBarOpen || focusTimer.status === 'running'}
                onClick={() => setFocusBarOpen((prev) => !prev)}
                data-testid="lesson-focus-timer-toggle"
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold shadow-brutal-sm transition-colors ${
                  focusTimer.status === 'running'
                    ? 'border-black bg-[#5DE1D2] text-black dark:border-[#5DE1D2] dark:bg-[#5DE1D2]/20 dark:text-[#5DE1D2]'
                    : focusBarOpen
                    ? 'border-theme-accent bg-theme-base text-theme-accent'
                    : 'border-theme-border bg-theme-base text-ink hover:border-[#5DE1D2]'
                }`}
              >
                <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="font-mono tabular-nums">
                  {focusTimer.status === 'running' || focusTimer.status === 'paused'
                    ? focusTimer.formattedClock
                    : locale === 'uz'
                    ? `Fokus ${focusTimer.durationMinutes}m`
                    : `Focus ${focusTimer.durationMinutes}m`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              data-testid="lesson-quick-notes-btn"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-1.5 text-xs font-semibold text-theme-accent shadow-brutal-sm hover:border-theme-accent"
            >
              <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Tezkor qaydlar' : 'Quick Notes'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReviewSegmentHeading(lesson.bodyBlocks[0]?.heading || lesson.title);
                setReviewStatus(null);
                setReviewOpen(true);
              }}
              data-testid="lesson-request-review-btn"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-1.5 text-xs font-semibold text-ink shadow-brutal-sm hover:border-theme-cyan"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-theme-cyan" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Ko‘rib chiqishni so‘rash' : 'Request Review'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareLesson()}
              data-testid="share-lesson-btn"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-teal/50 bg-elevated px-3 py-1.5 text-xs font-medium text-teal hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Darsni ulashish' : 'Share Lesson'}</span>
            </button>

            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Xato haqida xabar berish' : 'Report Issue'}</span>
            </button>
          </div>
        </div>

        <h2 className="mt-2 text-xl font-semibold text-ink sm:text-2xl">{lesson.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{lesson.summary}</p>
        {focusTimer &&
          ambientAudio &&
          (focusBarOpen || focusTimer.status === 'running' || focusTimer.status === 'paused') && (
            <FocusTimerPanel
              locale={locale}
              timer={focusTimer}
              audio={ambientAudio}
              variant="lesson-bar"
              lessonTitle={lesson.title}
            />
          )}
        {shareStatus && (
          <p
            role={shareStatus.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            data-testid="share-lesson-status"
            className={`no-print mt-2 text-xs ${
              shareStatus.kind === 'error' ? 'text-danger-text' : 'text-teal'
            }`}
          >
            {shareStatus.text}
          </p>
        )}
      </header>

      {/* Learning Objectives */}
      <section aria-label="Learning Objectives" className="border-b border-line pb-5">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-teal">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{locale === 'uz' ? 'O‘quv maqsadlari' : 'Learning Objectives'}</span>
        </h3>
        <ul className="mt-2.5 space-y-1.5 text-sm text-ink">
          {lesson.objectives.map((obj, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="font-mono text-xs text-muted tabular-nums">{idx + 1}.</span>
              <span>{obj}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Accessible Media / Web Speech API Read Aloud & Captions Bar */}
      <section
        aria-label="Lesson Narration and Transcript Controls"
        className="border-b border-line pb-5"
      >
        <div
          data-print-hide="lesson-controls"
          className="no-print flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={isReadingAloud}
              onClick={toggleReadAloud}
              data-testid="lesson-narration-btn"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {isReadingAloud ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isReadingAloud
                  ? locale === 'uz'
                    ? 'Ovozli o‘qishni to‘xtatish'
                    : 'Stop Read Aloud'
                  : locale === 'uz'
                  ? 'Darsni ovozli o‘qish (Read Aloud)'
                  : 'Read Aloud Course Content'}
              </span>
            </button>

            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span>{locale === 'uz' ? 'Tezlik:' : 'Speed:'}</span>
              <select
                value={playbackRate}
                onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                data-testid="lesson-read-aloud-rate"
                className="min-h-[36px] rounded-md border border-line bg-chrome px-2 text-xs text-ink"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={showCaptions}
              onClick={() => setShowCaptions((v) => !v)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                showCaptions
                  ? 'border-teal/60 bg-chrome text-teal'
                  : 'border-line bg-chrome text-muted'
              }`}
            >
              <Captions className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'Subtitrlar' : 'Captions'}</span>
            </button>
            <button
              type="button"
              aria-expanded={showTranscript}
              onClick={() => setShowTranscript((v) => !v)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                showTranscript
                  ? 'border-accent/60 bg-chrome text-ink'
                  : 'border-line bg-chrome text-muted'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'To‘liq matn' : 'Transcript'}</span>
            </button>
          </div>
        </div>

        {/* Active Web Speech API Read Aloud Controller Bar */}
        {isReadingAloud && activeSegment && (
          <div
            role="region"
            aria-live="polite"
            aria-label={locale === 'uz' ? 'Ovozli o‘qish boshqaruvi' : 'Read Aloud Active Controls'}
            data-testid="lesson-read-aloud-bar"
            className="no-print mt-3 rounded-lg border-2 border-theme-accent bg-theme-base p-3.5 shadow-brutal-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-theme-emerald" aria-hidden="true" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-theme-accent">
                  {isSpeechPaused
                    ? locale === 'uz'
                      ? 'Vaqtincha to‘xtatilgan'
                      : 'Read Aloud Paused'
                    : locale === 'uz'
                    ? 'Ovozli o‘qilmoqda'
                    : 'Reading Aloud'}
                </span>
                <span className="font-mono text-xs text-muted">
                  ({activeSegmentIndex + 1}/{readAloudSegments.length} · {activeSegment.label})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={activeSegmentIndex <= 0}
                  onClick={() => speakSegmentAtIndex(activeSegmentIndex - 1)}
                  data-testid="lesson-read-aloud-prev"
                  className="inline-flex min-h-[30px] items-center gap-1 rounded border border-theme-border bg-theme-panel px-2 py-1 text-xs font-medium text-ink hover:border-theme-accent disabled:opacity-40"
                  title={locale === 'uz' ? 'Oldingi qism' : 'Previous section'}
                >
                  <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'Oldingi' : 'Prev'}</span>
                </button>

                <button
                  type="button"
                  onClick={togglePauseResumeReadAloud}
                  data-testid="lesson-read-aloud-pause"
                  className="inline-flex min-h-[30px] items-center gap-1 rounded border border-theme-border bg-theme-panel px-2.5 py-1 text-xs font-semibold text-theme-cyan hover:border-theme-cyan"
                >
                  {isSpeechPaused ? (
                    <>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{locale === 'uz' ? 'Davom ettirish' : 'Resume'}</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{locale === 'uz' ? 'Pauza' : 'Pause'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={activeSegmentIndex >= readAloudSegments.length - 1}
                  onClick={() => speakSegmentAtIndex(activeSegmentIndex + 1)}
                  data-testid="lesson-read-aloud-next"
                  className="inline-flex min-h-[30px] items-center gap-1 rounded border border-theme-border bg-theme-panel px-2 py-1 text-xs font-medium text-ink hover:border-theme-accent disabled:opacity-40"
                  title={locale === 'uz' ? 'Keyingi qism' : 'Next section'}
                >
                  <span>{locale === 'uz' ? 'Keyingi' : 'Next'}</span>
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={stopReadAloud}
                  data-testid="lesson-read-aloud-stop"
                  className="inline-flex min-h-[30px] items-center gap-1 rounded border border-theme-border bg-theme-panel px-2 py-1 text-xs font-medium text-muted hover:text-ink"
                >
                  <Square className="h-3 w-3" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'To‘xtatish' : 'Stop'}</span>
                </button>
              </div>
            </div>

            <p
              data-testid="lesson-read-aloud-active-text"
              className="mt-2 border-t border-theme-border/60 pt-2 text-xs leading-relaxed text-muted"
            >
              {activeSegment.text}
            </p>
          </div>
        )}

        {showCaptions && lesson.captionsVtt && (
          <div className="mt-3 rounded-md border border-line/60 bg-canvas px-3.5 py-2.5 text-xs text-ink">
            {lesson.captionsVtt
              .replace('WEBVTT', '')
              .trim()
              .split('\n')
              .filter((line) => line.trim() && !line.includes('-->'))
              .join(' ')}
          </div>
        )}

        {showTranscript && (
          <div className="mt-3 rounded-md border border-line/60 bg-canvas p-3.5 text-sm leading-relaxed text-muted">
            <div className="mb-1 text-xs font-semibold text-ink">
              {locale === 'uz' ? 'Dars transkripti' : 'Full Lesson Transcript'}
            </div>
            {lesson.transcript}
          </div>
        )}
      </section>

      {/* Structured Lesson Blocks with Interactive Terminology, Block Read Aloud & Segment Review Trigger */}
      <div className="space-y-5">
        {lesson.bodyBlocks.map((block, i) => {
          const blockSegmentIndex = readAloudSegments.findIndex(
            (seg) => seg.kind === 'block' && seg.blockIndex === i
          );
          const isBlockSpeaking =
            isReadingAloud && activeSegment?.kind === 'block' && activeSegment.blockIndex === i;

          return (
            <section
              key={i}
              data-testid={`lesson-block-${i}`}
              data-speaking={isBlockSpeaking ? 'true' : 'false'}
              className={`space-y-1.5 rounded-lg p-3 transition-colors ${
                isBlockSpeaking
                  ? 'border-2 border-theme-accent bg-theme-base/70 shadow-brutal-sm'
                  : 'border border-transparent'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{block.heading}</h3>
                <div className="no-print flex items-center gap-1.5">
                  {blockSegmentIndex >= 0 && (
                    <button
                      type="button"
                      aria-pressed={isBlockSpeaking}
                      onClick={() => {
                        if (isBlockSpeaking) {
                          stopReadAloud();
                        } else {
                          speakSegmentAtIndex(blockSegmentIndex);
                        }
                      }}
                      data-testid={`block-read-aloud-btn-${i}`}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        isBlockSpeaking
                          ? 'border-theme-accent bg-theme-accent text-theme-accent-ink'
                          : 'border-theme-border bg-theme-base text-muted hover:border-theme-accent hover:text-ink'
                      }`}
                    >
                      {isBlockSpeaking ? (
                        <VolumeX className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Volume2 className="h-3 w-3 text-theme-accent" aria-hidden="true" />
                      )}
                      <span>
                        {isBlockSpeaking
                          ? locale === 'uz'
                            ? 'O‘qilmoqda'
                            : 'Speaking'
                          : locale === 'uz'
                          ? 'Ovozli o‘qish'
                          : 'Read Aloud'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setReviewSegmentHeading(block.heading);
                      setReviewStatus(null);
                      setReviewOpen(true);
                    }}
                    data-testid={`segment-request-review-btn-${i}`}
                    className="inline-flex items-center gap-1 rounded border border-theme-border bg-theme-base px-2 py-0.5 text-[11px] font-medium text-muted hover:border-theme-cyan hover:text-ink"
                  >
                    <MessageSquarePlus className="h-3 w-3 text-theme-cyan" aria-hidden="true" />
                    <span>{locale === 'uz' ? 'Savol / Taqriz' : 'Request Review'}</span>
                  </button>
                </div>
              </div>
              {block.kind === 'formula' ? (
                <p className="rounded-lg border border-line/60 bg-canvas p-3 font-mono text-sm leading-relaxed text-teal">
                  {block.body}
                </p>
              ) : (
                <InteractiveTerminologyText
                  text={block.body}
                  terms={combinedGlossaryTerms}
                  locale={locale}
                  courseTitle={courseTitle}
                  className="text-sm leading-relaxed text-muted"
                />
              )}
            </section>
          );
        })}
      </div>

      {/* Interactive Simulation Stage */}
      <InteractiveSimulation type={lesson.simulationType} locale={locale} />

      {/* Key Terms */}
      {lesson.keyTerms.length > 0 && (
        <section className="border-t border-line pt-5">
          <h3 className="text-xs font-semibold text-ink">
            {locale === 'uz' ? 'Asosiy atamalar' : 'Key Terminology'}
          </h3>
          <dl className="mt-2.5 grid gap-3 sm:grid-cols-2">
            {lesson.keyTerms.map((kt, idx) => (
              <div key={idx} className="border-t border-line/60 pt-2">
                <dt className="text-xs font-semibold text-teal">{kt.term}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-muted">{kt.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Provenance & Attribution */}
      {lesson.provenance && (
        <footer className="border-t border-line pt-4 text-xs text-muted">
          <div className="font-medium text-ink">
            {locale === 'uz' ? 'Manba va mualliflik huquqi' : 'Source & Provenance'}
          </div>
          <p className="mt-1">
            {lesson.provenance.sourceTitle} · {lesson.provenance.licenseBasis}
            {lesson.provenance.reviewedBy ? ` · Reviewed by ${lesson.provenance.reviewedBy}` : ''}
          </p>
          <p className="mt-0.5">{lesson.provenance.attributionText}</p>
        </footer>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-danger/50 bg-danger-surface/40 px-4 py-2.5 text-xs text-danger-text"
        >
          {errorMsg}
        </div>
      )}

      {/* Action Bar */}
      <div
        data-print-hide="lesson-controls"
        className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
      >
        <button
          type="button"
          disabled={submitting}
          onClick={handleComplete}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            isCompleted
              ? 'border border-success/40 bg-chrome text-success'
              : 'bg-accent text-accent-ink hover:bg-accent-hover'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>
            {submitting
              ? locale === 'uz'
                ? 'Saqlanmoqda...'
                : 'Saving...'
              : isCompleted
              ? locale === 'uz'
                ? 'Dars yakunlangan'
                : 'Lesson Completed'
              : isAuthenticated
              ? locale === 'uz'
                ? 'Darsni yakunlash (+25 XP)'
                : 'Complete Lesson (+25 XP)'
              : locale === 'uz'
              ? 'Saqlash uchun kiring'
              : 'Sign in to Save Progress'}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {onNextLesson && (
            <button
              type="button"
              onClick={onNextLesson}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-4 py-2 text-sm font-medium text-ink hover:border-accent"
            >
              <span>{locale === 'uz' ? 'Keyingi dars' : 'Next Lesson'}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {!onNextLesson && onOpenAssessment && (
            <button
              type="button"
              onClick={onOpenAssessment}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-teal-ink hover:bg-teal-hover"
            >
              <span>{locale === 'uz' ? 'Yakuniy testga o‘tish' : 'Take Course Assessment'}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Notes Slide-Out Drawer */}
      <QuickNotesDrawer
        open={notesOpen}
        courseId={courseId}
        courseTitle={courseTitle}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        locale={locale}
        isAuthenticated={isAuthenticated}
        profileNotes={profileNotes}
        onSyncNotesToProfile={onSyncNotesToProfile}
        onClose={() => setNotesOpen(false)}
      />

      {/* Request Human Review Modal (Segment Comment / Question -> AdminStudioView) */}
      {reviewOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-review-modal-title"
            data-testid="request-review-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-md rounded-xl border-2 border-theme-border bg-theme-panel p-5 shadow-brutal">
              <h3 id="request-review-modal-title" className="text-base font-bold text-ink">
                {locale === 'uz'
                  ? 'Dars qismi bo‘yicha muharrir ko‘rib chiqishini so‘rash'
                  : 'Request Human Review on Lesson Segment'}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {locale === 'uz'
                  ? 'Savolingiz yoki izohingiz tahririyat studiyasidagi fan muharrirlariga asinxron bildirishnoma sifatida yuboriladi.'
                  : 'Your question or comment on this segment triggers an asynchronous notification to human subject reviewers in the Editorial Studio.'}
              </p>
              <form onSubmit={handleRequestReviewSubmit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="rev-segment" className="block text-xs font-medium text-muted">
                    {locale === 'uz' ? 'Dars qismi (Segment)' : 'Lesson Segment'}
                  </label>
                  <select
                    id="rev-segment"
                    value={reviewSegmentHeading}
                    onChange={(e) => setReviewSegmentHeading(e.target.value)}
                    data-testid="request-review-segment-select"
                    className="mt-1 w-full rounded-lg border-2 border-theme-border bg-theme-base px-3 py-2 text-xs text-ink"
                  >
                    {lesson.bodyBlocks.map((b, idx) => (
                      <option key={idx} value={b.heading}>
                        {b.heading}
                      </option>
                    ))}
                    <option value={lesson.title}>{lesson.title} (General)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rev-comment" className="block text-xs font-medium text-muted">
                    {locale === 'uz' ? 'Savol yoki izohingiz' : 'Your Comment or Question'}
                  </label>
                  <textarea
                    id="rev-comment"
                    required
                    minLength={5}
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    data-testid="request-review-comment-input"
                    placeholder={
                      locale === 'uz'
                        ? 'Ushbu formula yoki misol bo‘yicha savolingizni yozing...'
                        : 'Ask a question or request clarification on this derivation or example...'
                    }
                    className="mt-1 w-full rounded-lg border-2 border-theme-border bg-theme-base px-3 py-2 text-xs text-ink"
                  />
                </div>

                {reviewStatus && (
                  <p
                    role={reviewStatus.kind === 'error' ? 'alert' : 'status'}
                    data-testid="request-review-status"
                    className={`text-xs font-medium ${
                      reviewStatus.kind === 'error' ? 'text-danger-text' : 'text-theme-cyan'
                    }`}
                  >
                    {reviewStatus.text}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewOpen(false)}
                    className="min-h-[38px] rounded-lg border-2 border-theme-border bg-theme-base px-4 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                  >
                    {locale === 'uz' ? 'Yopish' : 'Close'}
                  </button>
                  <button
                    type="submit"
                    disabled={reviewBusy}
                    data-testid="request-review-submit-btn"
                    className="min-h-[38px] rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-1.5 text-xs font-bold text-theme-accent-ink shadow-brutal-sm hover:bg-accent-hover disabled:opacity-50"
                  >
                    {reviewBusy
                      ? locale === 'uz'
                        ? 'Yuborilmoqda...'
                        : 'Sending...'
                      : locale === 'uz'
                      ? 'Muharrirga yuborish'
                      : 'Notify Reviewers'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Report Issue Modal */}
      {reportOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5">
              <h3 id="report-modal-title" className="text-base font-semibold text-ink">
                {locale === 'uz'
                  ? 'Dars bo‘yicha xabar yuborish'
                  : 'Report a Content or Accessibility Issue'}
              </h3>
              <form onSubmit={handleReportSubmit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="rep-cat" className="block text-xs font-medium text-muted">
                    {locale === 'uz' ? 'Kategoriya' : 'Category'}
                  </label>
                  <select
                    id="rep-cat"
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as typeof reportCategory)}
                    className="mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-sm text-ink"
                  >
                    <option value="accuracy">
                      {locale === 'uz'
                        ? 'Faktik / matematik aniqlik'
                        : 'Factual / Mathematical Accuracy'}
                    </option>
                    <option value="translation">
                      {locale === 'uz'
                        ? 'Til / atamalar tushunarliligi'
                        : 'Language / Terminology Clarity'}
                    </option>
                    <option value="accessibility">
                      {locale === 'uz'
                        ? 'Taglavha / transkript / qulaylik'
                        : 'Captions / Transcript / Accessibility'}
                    </option>
                    <option value="rights">
                      {locale === 'uz'
                        ? 'Manba huquqlari / mualliflik'
                        : 'Source Rights / Attribution'}
                    </option>
                    <option value="safety">
                      {locale === 'uz'
                        ? 'Yoshga moslik / xavfsizlik'
                        : 'Age Suitability / Safety'}
                    </option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rep-desc" className="block text-xs font-medium text-muted">
                    {locale === 'uz' ? 'Tavsif' : 'Description'}
                  </label>
                  <textarea
                    id="rep-desc"
                    required
                    minLength={10}
                    rows={3}
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder={
                      locale === 'uz'
                        ? 'Tahririyat taqrizchilarimiz tekshirishi uchun muammoni aniq tasvirlab bering...'
                        : 'Describe the issue clearly so our editorial reviewers can inspect it...'
                    }
                    className="mt-1 w-full rounded-lg border border-line bg-chrome px-3 py-2 text-sm text-ink"
                  />
                </div>
                {reportStatus && <p className="text-xs text-teal">{reportStatus}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="min-h-[40px] rounded-lg border border-line px-4 py-2 text-xs text-muted hover:text-ink"
                  >
                    {locale === 'uz' ? 'Yopish' : 'Close'}
                  </button>
                  <button
                    type="submit"
                    className="min-h-[40px] rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                  >
                    {locale === 'uz' ? 'Yuborish' : 'Submit Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </article>
  );
};
