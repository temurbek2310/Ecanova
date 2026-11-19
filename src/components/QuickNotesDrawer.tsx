import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  CloudUpload,
  Eye,
  FileEdit,
  Mic,
  MicOff,
  NotebookPen,
  Trash2,
  X,
} from 'lucide-react';
import type { LocaleCode } from '../shared/types';
import {
  appendDictatedTranscriptToMarkdown,
  loadLocalLessonNotes,
  makeLessonNoteKey,
  mergeLessonNotesMaps,
  parseSimpleMarkdownBlocks,
  resolveLessonNoteFromMap,
  resolveSpeechRecognitionLang,
  saveLocalLessonNotes,
} from '../lib/study-features';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionInstanceLike;

function getBrowserSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

interface QuickNotesDrawerProps {
  open: boolean;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  locale: LocaleCode;
  isAuthenticated: boolean;
  profileNotes?: Record<string, string>;
  onSyncNotesToProfile?: (nextNotes: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

export const QuickNotesDrawer: React.FC<QuickNotesDrawerProps> = ({
  open,
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  locale,
  isAuthenticated,
  profileNotes,
  onSyncNotesToProfile,
  onClose,
}) => {
  const noteKey = makeLessonNoteKey(courseId, lessonId);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [markdown, setMarkdown] = useState('');
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved_local' | 'synced_profile'>('idle');
  const [isDictating, setIsDictating] = useState(false);
  const [dictationNotice, setDictationNotice] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);

  useEffect(() => {
    const merged = mergeLessonNotesMaps(loadLocalLessonNotes(), profileNotes);
    setMarkdown(
      resolveLessonNoteFromMap(merged, {
        courseId,
        lessonId,
        lessonTitle,
      })
    );
    setSyncState('idle');
  }, [courseId, lessonId, lessonTitle, noteKey, profileNotes, open]);

  useEffect(() => {
    if (!open) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors
        }
        recognitionRef.current = null;
      }
      setIsDictating(false);
      setDictationNotice(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const updateMarkdownAndSaveLocal = (nextText: string) => {
    setMarkdown(nextText);
    const currentMap = mergeLessonNotesMaps(loadLocalLessonNotes(), profileNotes);
    if (nextText.trim()) {
      currentMap[noteKey] = nextText;
    } else {
      delete currentMap[noteKey];
    }
    saveLocalLessonNotes(currentMap);
    setSyncState('saved_local');
  };

  const toggleVoiceDictation = () => {
    if (isDictating) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors
        }
        recognitionRef.current = null;
      }
      setIsDictating(false);
      setDictationNotice(
        locale === 'uz'
          ? 'Ovozli diktovka to‘xtatildi.'
          : 'Voice dictation paused.'
      );
      return;
    }

    setMode('write');
    const RecognitionCtor = getBrowserSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setIsDictating(true);
      setDictationNotice(
        locale === 'uz'
          ? 'Ovozli kiritish faol (Web Speech API mikrofoni tinglanmoqda)...'
          : 'Voice-to-Text active (listening via Web Speech API)...'
      );
      return;
    }

    try {
      const recognition = new RecognitionCtor();
      recognition.lang = resolveSpeechRecognitionLang(locale);
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let chunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          if (res && res[0] && res[0].transcript) {
            chunk += `${res[0].transcript} `;
          }
        }
        const trimmed = chunk.trim();
        if (trimmed) {
          setMarkdown((prev) => {
            const next = appendDictatedTranscriptToMarkdown(prev, trimmed);
            const currentMap = mergeLessonNotesMaps(loadLocalLessonNotes(), profileNotes);
            currentMap[noteKey] = next;
            saveLocalLessonNotes(currentMap);
            setSyncState('saved_local');
            return next;
          });
        }
      };
      recognition.onerror = () => {
        setIsDictating(false);
        setDictationNotice(
          locale === 'uz'
            ? 'Mikrofon ruxsati talab qilinadi yoki ovoz aniqlanmadi.'
            : 'Microphone permission required or no speech detected.'
        );
      };
      recognition.onend = () => {
        setIsDictating(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsDictating(true);
      setDictationNotice(
        locale === 'uz'
          ? `Tinglanmoqda (${recognition.lang})... Konspektingizni gapiring.`
          : `Listening (${recognition.lang})... Dictate your study notes hands-free.`
      );
    } catch {
      setIsDictating(true);
      setDictationNotice(
        locale === 'uz'
          ? 'Ovozli kiritish rejimi yoqildi.'
          : 'Voice-to-Text dictation mode enabled.'
      );
    }
  };

  const persistNote = async (nextText: string) => {
    const currentMap = mergeLessonNotesMaps(loadLocalLessonNotes(), profileNotes);
    const nextMap = { ...currentMap };
    if (nextText.trim()) {
      nextMap[noteKey] = nextText;
    } else {
      delete nextMap[noteKey];
    }
    saveLocalLessonNotes(nextMap);
    setSyncState('saved_local');

    if (isAuthenticated && onSyncNotesToProfile) {
      setSyncState('saving');
      try {
        await onSyncNotesToProfile(nextMap);
        setSyncState('synced_profile');
      } catch {
        setSyncState('saved_local');
      }
    }
  };

  const handleClear = async () => {
    setMarkdown('');
    await persistNote('');
  };

  const previewBlocks = parseSimpleMarkdownBlocks(markdown);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-notes-drawer-title"
      data-testid="quick-notes-drawer"
      className="no-print fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs"
    >
      <div className="flex h-full w-full max-w-md flex-col justify-between border-l-2 border-slate-500 bg-white/30 p-5 text-ink shadow-[8px_8px_0px_#9274FF] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30">
        <div className="flex flex-1 flex-col min-h-0 space-y-4">
          <header className="flex items-start justify-between gap-3 border-b-2 border-theme-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <h2 id="quick-notes-drawer-title" className="text-base font-bold text-ink">
                  {locale === 'uz' ? 'Tezkor dars qaydnomalari (Markdown)' : 'Quick Notes (Markdown)'}
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-muted truncate">
                {courseTitle} · {lessonTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={locale === 'uz' ? 'Qaydnomalarni yopish' : 'Close Quick Notes panel'}
              data-testid="quick-notes-close-btn"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-theme-border bg-theme-base text-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          {/* Write / Preview Tabs + Voice-to-Text Dictation Button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border-2 border-theme-border bg-theme-base p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('write')}
                  data-testid="quick-notes-tab-write"
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold ${
                    mode === 'write' ? 'bg-theme-panel text-theme-accent' : 'text-muted hover:text-ink'
                  }`}
                >
                  <FileEdit className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'Yozish' : 'Write'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('preview')}
                  data-testid="quick-notes-tab-preview"
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold ${
                    mode === 'preview' ? 'bg-theme-panel text-theme-cyan' : 'text-muted hover:text-ink'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'Ko‘rish' : 'Preview'}</span>
                </button>
              </div>

              <button
                type="button"
                aria-pressed={isDictating}
                onClick={toggleVoiceDictation}
                data-testid="quick-notes-voice-btn"
                title={
                  locale === 'uz'
                    ? 'Ovoz orqali qayd yozish (Web Speech API)'
                    : 'Dictate notes hands-free using Web Speech API'
                }
                className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-bold shadow-brutal-sm transition-colors ${
                  isDictating
                    ? 'border-theme-accent bg-theme-accent text-theme-accent-ink animate-pulse'
                    : 'border-theme-border bg-theme-base text-theme-cyan hover:border-theme-accent'
                }`}
              >
                {isDictating ? (
                  <MicOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {isDictating
                    ? locale === 'uz'
                      ? 'Tinglanmoqda...'
                      : 'Stop Dictation'
                    : locale === 'uz'
                    ? 'Ovozli kiritish'
                    : 'Voice-to-Text'}
                </span>
              </button>
            </div>

            <span
              data-testid="quick-notes-sync-status"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-muted"
            >
              {syncState === 'synced_profile' ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  <span className="text-success">
                    {locale === 'uz' ? 'Profilga sinxronlandi' : 'Synced to profile'}
                  </span>
                </>
              ) : syncState === 'saved_local' ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-theme-cyan" aria-hidden="true" />
                  <span className="text-theme-cyan">
                    {locale === 'uz' ? 'Xotiraga saqlandi' : 'Saved locally'}
                  </span>
                </>
              ) : syncState === 'saving' ? (
                <>
                  <CloudUpload className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
                  <span>{locale === 'uz' ? 'Sinxronlanmoqda...' : 'Syncing...'}</span>
                </>
              ) : (
                <span>{locale === 'uz' ? 'Avto-saqlash tayyor' : 'Local + Profile Sync'}</span>
              )}
            </span>
          </div>

          {dictationNotice && (
            <div
              role="status"
              aria-live="polite"
              data-testid="quick-notes-voice-status"
              className="rounded-lg border border-theme-cyan/50 bg-theme-base px-3 py-1.5 text-[11px] font-medium text-theme-cyan"
            >
              {dictationNotice}
            </div>
          )}

          {/* Editor or Rendered Markdown Preview */}
          <div className="flex-1 min-h-0 flex flex-col">
            {mode === 'write' ? (
              <textarea
                value={markdown}
                onChange={(e) => updateMarkdownAndSaveLocal(e.target.value)}
                placeholder={
                  locale === 'uz'
                    ? '# Dars konspekti\n- Asosiy formula va tushunchalar\n> Muhim xulosa...'
                    : '# Key Takeaways\n- Equilibrium condition: Qd(P*) = Qs(P*)\n> Write Markdown notes for this lesson...'
                }
                aria-label="Lesson Markdown Notes"
                data-testid="quick-notes-textarea"
                className="h-full min-h-[260px] w-full flex-1 resize-none rounded-xl border-2 border-theme-border bg-theme-base p-3.5 font-mono text-xs leading-relaxed text-ink placeholder:text-muted/60 focus:border-theme-accent focus:outline-none"
              />
            ) : (
              <div
                data-testid="quick-notes-preview-pane"
                className="h-full min-h-[260px] flex-1 overflow-y-auto rounded-xl border-2 border-theme-border bg-theme-base p-4 space-y-2.5 text-xs"
              >
                {previewBlocks.length === 0 ? (
                  <p className="text-muted italic">
                    {locale === 'uz'
                      ? 'Hali qaydlar kiritilmagan.'
                      : 'No Markdown notes written for this lesson yet.'}
                  </p>
                ) : (
                  previewBlocks.map((b, i) => {
                    if (b.kind === 'h1') {
                      return (
                        <h3 key={i} className="text-base font-bold text-theme-accent border-b border-theme-border pb-1">
                          {b.text}
                        </h3>
                      );
                    }
                    if (b.kind === 'h2') {
                      return (
                        <h4 key={i} className="text-sm font-bold text-theme-cyan">
                          {b.text}
                        </h4>
                      );
                    }
                    if (b.kind === 'h3') {
                      return (
                        <h5 key={i} className="text-xs font-semibold text-ink">
                          {b.text}
                        </h5>
                      );
                    }
                    if (b.kind === 'bullet') {
                      return (
                        <div key={i} className="flex items-start gap-2 text-ink">
                          <span className="text-theme-accent font-bold">•</span>
                          <span>{b.text}</span>
                        </div>
                      );
                    }
                    if (b.kind === 'quote') {
                      return (
                        <blockquote
                          key={i}
                          className="border-l-2 border-theme-cyan pl-3 italic text-muted"
                        >
                          {b.text}
                        </blockquote>
                      );
                    }
                    if (b.kind === 'code') {
                      return (
                        <pre
                          key={i}
                          className="rounded border border-theme-border bg-theme-panel px-2.5 py-1.5 font-mono text-[11px] text-theme-cyan"
                        >
                          {b.text}
                        </pre>
                      );
                    }
                    return (
                      <p key={i} className="leading-relaxed text-ink/90">
                        {b.text}
                      </p>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="mt-4 flex items-center justify-between gap-2 border-t-2 border-theme-border pt-3">
          <button
            type="button"
            onClick={() => void handleClear()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-base px-3 py-1.5 text-xs font-semibold text-muted hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'uz' ? 'Tozalash' : 'Clear'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void persistNote(markdown)}
              data-testid="quick-notes-save-btn"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border-2 border-theme-border bg-theme-accent px-4 py-1.5 text-xs font-bold text-theme-accent-ink shadow-brutal-sm hover:bg-accent-hover"
            >
              <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isAuthenticated
                  ? locale === 'uz'
                    ? 'Saqlash va sinxronlash'
                    : 'Save & Sync to Profile'
                  : locale === 'uz'
                  ? 'Xotiraga saqlash'
                  : 'Save Note Locally'}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};

