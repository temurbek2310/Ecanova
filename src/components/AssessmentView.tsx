import React, { useState } from 'react';
import { Award, CheckCircle2, HelpCircle, RotateCcw, XCircle } from 'lucide-react';
import type { AssessmentPublic, LocaleCode } from '../shared/types';

interface AssessmentAttemptFeedback {
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  xpAwarded: number;
  xpNote: string;
  journeyStatus: string;
  certificateIssuedNow: boolean;
  certificateToken: string | null;
  questionFeedback: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanation: string;
  }>;
}

interface AssessmentViewProps {
  assessment: AssessmentPublic;
  locale: LocaleCode;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onAttemptCompleted: () => Promise<void>;
  onViewCertificates: () => void;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  assessment,
  locale,
  isAuthenticated,
  onRequireAuth,
  onAttemptCompleted,
  onViewCertificates,
}) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentAttemptFeedback | null>(null);

  const allAnswered = assessment.questions.every((q) => typeof answers[q.id] === 'number');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (!allAnswered) {
      setErrorMsg(
        locale === 'uz'
          ? 'Iltimos, yuborishdan oldin barcha savollarga javob bering.'
          : 'Please answer every question before submitting.'
      );
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessments/${assessment.id}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = (await res.json()) as AssessmentAttemptFeedback & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not grade assessment.');
      setResult(data);
      await onAttemptCompleted();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Grading request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6 rounded-xl border border-[#222B3D] bg-[#101522] p-5 sm:p-6">
      <header className="border-b border-[#222B3D] pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8994AA]">
          <span>{locale === 'uz' ? `Versiya ${assessment.version}` : `Version ${assessment.version}`}</span>
          <span aria-hidden="true">·</span>
          <span>
            {locale === 'uz'
              ? `O‘tish chegarasi: ${assessment.passingScorePercent}%`
              : `Passing Threshold: ${assessment.passingScorePercent}%`}
          </span>
          <span aria-hidden="true">·</span>
          <span>{assessment.questions.length} {locale === 'uz' ? 'savol' : 'questions'}</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold text-[#F3F6FF]">{assessment.title}</h2>
        <p className="mt-1 text-xs text-[#8994AA]">{assessment.retryPolicyText}</p>
      </header>

      {result && (
        <div
          role="status"
          className={`rounded-xl border p-4 ${
            result.passed
              ? 'border-[#6FE0A1]/50 bg-[#0B0F19]'
              : 'border-[#FFC96B]/50 bg-[#0B0F19]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={`text-sm font-semibold ${result.passed ? 'text-[#6FE0A1]' : 'text-[#FFC96B]'}`}>
                {result.passed
                  ? locale === 'uz'
                    ? 'Baholashdan muvaffaqiyatli o‘tdingiz'
                    : 'Assessment Passed'
                  : locale === 'uz'
                  ? 'O‘tish baliga yetmadi — qayta urinib ko‘ring'
                  : 'Below Passing Threshold — Review Explanations & Retry'}
              </div>
              <p className="mt-1 font-mono text-xs tabular-nums text-[#8994AA]">
                Score: {result.scorePercent}% ({result.correctCount}/{result.totalQuestions} correct) ·{' '}
                {result.xpAwarded > 0 ? `+${result.xpAwarded} non-cash XP` : result.xpNote}
              </p>
            </div>

            {result.certificateToken && (
              <button
                type="button"
                onClick={onViewCertificates}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#5DE1D2] px-4 py-2 text-xs font-semibold text-[#080B14] hover:bg-[#7cebe0]"
              >
                <Award className="h-4 w-4" aria-hidden="true" />
                <span>{locale === 'uz' ? 'Sertifikatni ko‘rish' : 'View Course Certificate'}</span>
              </button>
            )}
          </div>
          {result.certificateIssuedNow && (
            <p className="mt-2 text-xs text-[#5DE1D2]">
              {locale === 'uz'
                ? 'Tabriklaymiz! Ushbu kurs bo‘yicha shaxsiy tasdiqlanadigan sertifikatingiz yaratildi.'
                : 'Course completion criteria met! Your verifiable course-specific certificate has been issued.'}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {assessment.questions.map((q, qIdx) => {
          const fb = result?.questionFeedback.find((f) => f.questionId === q.id);
          return (
            <fieldset
              key={q.id}
              className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-4"
            >
              <legend className="px-1 text-sm font-medium text-[#F3F6FF]">
                <span className="mr-2 font-mono text-xs text-[#8994AA] tabular-nums">{qIdx + 1}.</span>
                {q.prompt}
              </legend>

              <div className="mt-3 space-y-2">
                {q.options.map((opt, optIdx) => {
                  const selected = answers[q.id] === optIdx;
                  const isCorrectOption = fb && fb.correctIndex === optIdx;
                  const isWrongSelected = fb && selected && !fb.isCorrect;

                  return (
                    <label
                      key={optIdx}
                      className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                        isCorrectOption
                          ? 'border-[#6FE0A1]/70 bg-[#6FE0A1]/10 text-[#F3F6FF]'
                          : isWrongSelected
                          ? 'border-rose-500/70 bg-rose-950/30 text-rose-100'
                          : selected
                          ? 'border-[#9274FF] bg-[#141B2B] text-[#F3F6FF]'
                          : 'border-[#222B3D] bg-[#101522] text-[#8994AA] hover:border-[#33415C] hover:text-[#F3F6FF]'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={optIdx}
                        checked={selected}
                        onChange={() => {
                          setAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                          if (result) setResult(null);
                        }}
                        className="h-4 w-4 accent-[#9274FF]"
                      />
                      <span className="flex-1">{opt}</span>
                    </label>
                  );
                })}
              </div>

              {fb && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-[#222B3D] bg-[#101522] p-3 text-xs">
                  {fb.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6FE0A1]" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                  )}
                  <p className="leading-relaxed text-[#8994AA]">{fb.explanation}</p>
                </div>
              )}
            </fieldset>
          );
        })}

        {errorMsg && (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-[#8994AA]">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {locale === 'uz'
                ? 'Javob kalitlari xavfsiz tarzda faqat serverda tekshiriladi.'
                : 'Answer keys remain protected server-side until submission.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {result && !result.passed && (
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setResult(null);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#222B3D] bg-[#141B2B] px-4 py-2 text-sm font-medium text-[#F3F6FF]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>{locale === 'uz' ? 'Qayta urinish' : 'Reset Answers'}</span>
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#9274FF] px-5 py-2.5 text-sm font-semibold text-[#080B14] hover:bg-[#a68dff] disabled:opacity-60"
            >
              <span>
                {submitting
                  ? locale === 'uz'
                    ? 'Tekshirilmoqda...'
                    : 'Grading...'
                  : isAuthenticated
                  ? locale === 'uz'
                    ? 'Natijani tekshirish'
                    : 'Submit Assessment'
                  : locale === 'uz'
                  ? 'Topshirish uchun kiring'
                  : 'Sign in to Submit'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
