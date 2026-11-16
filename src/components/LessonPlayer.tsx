import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Captions,
  FileText,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { LessonPublic, LocaleCode } from '../shared/types';
import { InteractiveSimulation } from './simulations/InteractiveSimulation';

interface LessonPlayerProps {
  courseId: string;
  lesson: LessonPublic;
  locale: LocaleCode;
  isCompleted: boolean;
  isAuthenticated: boolean;
  onCompleteLesson: (lessonId: string) => Promise<void>;
  onRequireAuth: () => void;
  onNextLesson?: () => void;
  onOpenAssessment?: () => void;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({
  courseId,
  lesson,
  locale,
  isCompleted,
  isAuthenticated,
  onCompleteLesson,
  onRequireAuth,
  onNextLesson,
  onOpenAssessment,
}) => {
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Report-an-issue modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<'accuracy' | 'translation' | 'accessibility' | 'rights' | 'safety'>('accuracy');
  const [reportText, setReportText] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [lesson.id]);

  const toggleNarration = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setShowTranscript(true);
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(lesson.transcript);
    utter.lang = locale === 'uz' ? 'uz-UZ' : 'en-US';
    utter.rate = playbackRate;
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

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
      const res = await fetch('/api/reports', {
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

  return (
    <article className="space-y-6 rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
      <header className="border-b border-[#222B3D] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8994AA]">
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
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-[#8994AA] underline-offset-4 hover:text-[#F3F6FF] hover:underline"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-[#FFC96B]" aria-hidden="true" />
            <span>{locale === 'uz' ? 'Xato haqida xabar berish' : 'Report Issue'}</span>
          </button>
        </div>

        <h2 className="mt-2 text-xl font-semibold text-[#F3F6FF] sm:text-2xl">{lesson.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#8994AA]">{lesson.summary}</p>
      </header>

      {/* Learning Objectives */}
      <section aria-label="Learning Objectives" className="border-b border-[#222B3D] pb-5">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-[#5DE1D2]">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{locale === 'uz' ? 'O‘quv maqsadlari' : 'Learning Objectives'}</span>
        </h3>
        <ul className="mt-2.5 space-y-1.5 text-sm text-[#F3F6FF]">
          {lesson.objectives.map((obj, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="font-mono text-xs text-[#8994AA] tabular-nums">{idx + 1}.</span>
              <span>{obj}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Accessible Media / Narration & Captions Bar (Works without external video dependency) */}
      <section
        aria-label="Lesson Narration and Transcript Controls"
        className="border-b border-[#222B3D] pb-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleNarration}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#9274FF] px-3.5 py-2 text-xs font-semibold text-[#080B14] transition-colors hover:bg-[#a68dff]"
            >
              {isSpeaking ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
              <span>
                {isSpeaking
                  ? locale === 'uz'
                    ? 'Audio tinglashni to‘xtatish'
                    : 'Stop Audio Narration'
                  : locale === 'uz'
                  ? 'Darsni audio tinglash'
                  : 'Listen to Lesson Audio'}
              </span>
            </button>

            <label className="inline-flex items-center gap-1.5 text-xs text-[#8994AA]">
              <span>{locale === 'uz' ? 'Tezlik:' : 'Speed:'}</span>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="min-h-[36px] rounded-md border border-[#222B3D] bg-[#0B0F19] px-2 text-xs text-[#F3F6FF]"
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
                  ? 'border-[#5DE1D2]/60 bg-[#0B0F19] text-[#5DE1D2]'
                  : 'border-[#222B3D] bg-[#0B0F19] text-[#8994AA]'
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
                  ? 'border-[#9274FF]/60 bg-[#0B0F19] text-[#F3F6FF]'
                  : 'border-[#222B3D] bg-[#0B0F19] text-[#8994AA]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{locale === 'uz' ? 'To‘liq matn' : 'Transcript'}</span>
            </button>
          </div>
        </div>

        {showCaptions && lesson.captionsVtt && (
          <div className="mt-3 rounded-md bg-[#080B14] px-3.5 py-2.5 text-xs text-[#F3F6FF]">
            {lesson.captionsVtt
              .replace('WEBVTT', '')
              .trim()
              .split('\n')
              .filter((line) => line.trim() && !line.includes('-->'))
              .join(' ')}
          </div>
        )}

        {showTranscript && (
          <div className="mt-3 rounded-md bg-[#080B14] p-3.5 text-sm leading-relaxed text-[#8994AA]">
            <div className="mb-1 text-xs font-semibold text-[#F3F6FF]">
              {locale === 'uz' ? 'Dars transkripti' : 'Full Lesson Transcript'}
            </div>
            {lesson.transcript}
          </div>
        )}
      </section>

      {/* Structured Lesson Blocks */}
      <div className="space-y-5">
        {lesson.bodyBlocks.map((block, i) => (
          <section key={i} className="space-y-1.5">
            <h3 className="text-sm font-semibold text-[#F3F6FF]">{block.heading}</h3>
            <p className={`text-sm leading-relaxed ${block.kind === 'formula' ? 'rounded-lg bg-[#080B14] p-3 font-mono text-[#5DE1D2]' : 'text-[#8994AA]'}`}>
              {block.body}
            </p>
          </section>
        ))}
      </div>

      {/* Interactive Simulation Stage */}
      <InteractiveSimulation type={lesson.simulationType} locale={locale} />

      {/* Key Terms */}
      {lesson.keyTerms.length > 0 && (
        <section className="border-t border-[#222B3D] pt-5">
          <h3 className="text-xs font-semibold text-[#F3F6FF]">
            {locale === 'uz' ? 'Asosiy atamalar' : 'Key Terminology'}
          </h3>
          <dl className="mt-2.5 grid gap-3 sm:grid-cols-2">
            {lesson.keyTerms.map((kt, idx) => (
              <div key={idx} className="border-t border-[#222B3D]/60 pt-2">
                <dt className="text-xs font-semibold text-[#5DE1D2]">{kt.term}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-[#8994AA]">{kt.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Provenance & Attribution */}
      {lesson.provenance && (
        <footer className="border-t border-[#222B3D] pt-4 text-xs text-[#8994AA]">
          <div className="font-medium text-[#F3F6FF]">
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
        <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#222B3D] pt-4">
        <button
          type="button"
          disabled={submitting}
          onClick={handleComplete}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            isCompleted
              ? 'border border-[#6FE0A1]/40 bg-[#0B0F19] text-[#6FE0A1]'
              : 'bg-[#9274FF] text-[#080B14] hover:bg-[#a68dff]'
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
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#222B3D] bg-[#141B2B] px-4 py-2 text-sm font-medium text-[#F3F6FF] hover:border-[#9274FF]"
            >
              <span>{locale === 'uz' ? 'Keyingi dars' : 'Next Lesson'}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {!onNextLesson && onOpenAssessment && (
            <button
              type="button"
              onClick={onOpenAssessment}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#5DE1D2] px-4 py-2 text-sm font-semibold text-[#080B14] hover:bg-[#7cebe0]"
            >
              <span>{locale === 'uz' ? 'Yakuniy testga o‘tish' : 'Take Course Assessment'}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Report Issue Modal */}
      {reportOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="report-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#222B3D] bg-[#101522] p-5">
            <h3 id="report-modal-title" className="text-base font-semibold text-[#F3F6FF]">
              {locale === 'uz' ? 'Dars bo‘yicha xabar yuborish' : 'Report a Content or Accessibility Issue'}
            </h3>
            <form onSubmit={handleReportSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="rep-cat" className="block text-xs font-medium text-[#8994AA]">
                  {locale === 'uz' ? 'Kategoriya' : 'Category'}
                </label>
                <select
                  id="rep-cat"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value as typeof reportCategory)}
                  className="mt-1 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-sm text-[#F3F6FF]"
                >
                  <option value="accuracy">Factual / Mathematical Accuracy</option>
                  <option value="translation">Language / Terminology Clarity</option>
                  <option value="accessibility">Captions / Transcript / Accessibility</option>
                  <option value="rights">Source Rights / Attribution</option>
                  <option value="safety">Age Suitability / Safety</option>
                </select>
              </div>
              <div>
                <label htmlFor="rep-desc" className="block text-xs font-medium text-[#8994AA]">
                  {locale === 'uz' ? 'Tavsif' : 'Description'}
                </label>
                <textarea
                  id="rep-desc"
                  required
                  minLength={10}
                  rows={3}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describe the issue clearly so our editorial reviewers can inspect it..."
                  className="mt-1 w-full rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-sm text-[#F3F6FF]"
                />
              </div>
              {reportStatus && <p className="text-xs text-[#5DE1D2]">{reportStatus}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="min-h-[40px] rounded-lg border border-[#222B3D] px-4 py-2 text-xs text-[#8994AA] hover:text-[#F3F6FF]"
                >
                  {locale === 'uz' ? 'Yopish' : 'Close'}
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] rounded-lg bg-[#9274FF] px-4 py-2 text-xs font-semibold text-[#080B14]"
                >
                  {locale === 'uz' ? 'Yuborish' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  );
};
