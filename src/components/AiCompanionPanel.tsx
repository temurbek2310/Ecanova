import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, MessageSquare, Send, X } from 'lucide-react';
import type { LocaleCode } from '../shared/types';
import { t } from '../lib/i18n';
import { apiFetch } from '../lib/auth-client';
import { notificationCopy } from '../lib/notification-copy';
import { useToastSlot } from '../context/NotificationContext';
import { notify } from '../lib/notifications';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
}

interface AiCompanionPanelProps {
  locale: LocaleCode;
  isStaff: boolean;
  aiConfigured?: boolean;
  defaultMode?: 'study_tutor' | 'editorial_draft';
  onClose?: () => void;
  embedded?: boolean;
}

export const AiCompanionPanel: React.FC<AiCompanionPanelProps> = ({
  locale,
  isStaff,
  aiConfigured = false,
  defaultMode = 'study_tutor',
  onClose,
  embedded = false,
}) => {
  const compStrings = t(locale).companion;
  const toastCopy = notificationCopy(locale);
  const [mode, setMode] = useState<'study_tutor' | 'editorial_draft'>(
    isStaff ? defaultMode : 'study_tutor'
  );
  const [model, setModel] = useState<string>('gemini-4-hydrogen');
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const setErrorMsg = useToastSlot('ai-companion-error', toastCopy.companion.requestFailed, 'warning');

  // Editorial Diagram Image Generator (1K / 2K / 4K)
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgSize, setImgSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgResult, setImgResult] = useState<{
    imageDataUrl: string;
    captionText: string;
    provenanceNote: string;
  } | null>(null);
  const setImgError = useToastSlot('ai-companion-diagram-error', toastCopy.companion.diagramFailed, 'warning');

  // Capability notice: shown once as a toast when the panel opens without AI configured.
  useEffect(() => {
    if (aiConfigured) return;
    notify.info(toastCopy.companion.unavailable, toastCopy.companion.unavailableMessage, {
      id: 'ai-companion-unconfigured',
      durationMs: 9000,
    });
  }, [aiConfigured, toastCopy]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiConfigured) return;
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextHistory: ChatTurn[] = [...history, { role: 'user', text: trimmed }];
    setHistory(nextHistory);
    setInput('');
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          mode,
          locale,
          history: history.map((h) => ({ role: h.role, text: h.text })),
          message: trimmed,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        model?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'AI service returned an error.');
      setHistory([...nextHistory, { role: 'model', text: data.reply || '', modelUsed: data.model }]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach AI service.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiConfigured) return;
    if (!imgPrompt.trim() || imgLoading) return;
    setImgError(null);
    setImgLoading(true);
    try {
      const res = await apiFetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imgPrompt.trim(),
          imageSize: imgSize,
          aspectRatio: '16:9',
        }),
      });
      const data = (await res.json()) as {
        imageDataUrl?: string;
        captionText?: string;
        provenanceNote?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Diagram generation failed.');
      if (data.imageDataUrl) {
        setImgResult({
          imageDataUrl: data.imageDataUrl,
          captionText: data.captionText || '',
          provenanceNote: data.provenanceNote || '',
        });
      }
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Could not generate diagram.');
    } finally {
      setImgLoading(false);
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl border-2 border-slate-500 bg-white/30 shadow-[8px_8px_0px_#9274FF] backdrop-blur-3xl dark:border-[#222B3D] dark:bg-[#101522]/30 ${
        embedded ? 'p-5' : 'h-full max-h-[82vh] p-5'
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b-2 border-theme-border pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MessageSquare className="h-4 w-4 text-teal" aria-hidden="true" />
            <span>{compStrings.title}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted">{compStrings.subtitle}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === 'uz' ? 'Yordamchini yopish' : 'Close AI Companion'}
            className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Role & Model Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {isStaff && (
          <div className="flex items-center rounded-lg border-2 border-slate-500 bg-white/45 p-0.5 backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55">
            <button
              type="button"
              onClick={() => setMode('study_tutor')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                mode === 'study_tutor' ? 'bg-elevated text-ink' : 'text-muted'
              }`}
            >
              {compStrings.modeTutor}
            </button>
            <button
              type="button"
              onClick={() => setMode('editorial_draft')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                mode === 'editorial_draft' ? 'bg-elevated text-teal' : 'text-muted'
              }`}
            >
              {compStrings.modeEditorial}
            </button>
          </div>
        )}

        <label className="flex items-center gap-1.5 text-muted">
          <span>{compStrings.modelLabel}</span>
          <select
            value={model}
            disabled={!aiConfigured}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-md border-2 border-slate-500 bg-white/50 px-2 py-1 text-xs text-ink backdrop-blur-md disabled:opacity-50 dark:border-[#222B3D] dark:bg-[#080B14]/60"
          >
            <option value="gemini-4-hydrogen">gemini-4-hydrogen</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
            <option value="gemini-4-argon">gemini-4-argon</option>
            <option value="gemini-4-carbon">gemini-4-carbon</option>
          </select>
        </label>
      </div>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div
        aria-label={locale === 'uz' ? 'Suhbat tarixi' : 'Conversation history'}
        className="mt-3 flex-1 min-h-[220px] max-h-[340px] space-y-3 overflow-y-auto rounded-lg border-2 border-slate-500 bg-white/45 p-3.5 backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55"
      >
        {history.length === 0 && (
          <p className="text-xs text-muted">
            {mode === 'editorial_draft'
              ? compStrings.emptyEditorial
              : compStrings.emptyTutor}
          </p>
        )}
        {history.map((turn, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 text-xs leading-relaxed ${
              turn.role === 'user'
                ? 'ml-6 bg-elevated text-ink'
                : 'mr-4 border-2 border-slate-500 bg-white/60 text-ink backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/65'
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
              <span>{turn.role === 'user' ? compStrings.youLabel : compStrings.assistantLabel}</span>
              {turn.modelUsed && <span className="font-mono">{turn.modelUsed}</span>}
            </div>
            <div className="whitespace-pre-wrap">{turn.text}</div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-teal">{compStrings.generating}</div>
        )}
      </div>

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          disabled={!aiConfigured}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === 'editorial_draft'
              ? compStrings.placeholderEditorial
              : compStrings.placeholderTutor
          }
          className="min-h-[42px] flex-1 rounded-lg border-2 border-slate-500 bg-white/50 px-3 py-2 text-xs text-ink backdrop-blur-md disabled:opacity-50 dark:border-[#222B3D] dark:bg-[#080B14]/60"
        />
        <button
          type="submit"
          disabled={!aiConfigured || loading || !input.trim()}
          aria-label={compStrings.sendButton}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{compStrings.sendButton}</span>
        </button>
      </form>

      {/* Staff-only 1K / 2K / 4K Lesson Visual Asset Draft Generator */}
      {isStaff && mode === 'editorial_draft' && (
        <form onSubmit={handleGenerateDiagram} className="mt-4 border-t-2 border-theme-border pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <ImageIcon className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
              <span>{compStrings.generateVisualBtn} (gemini-3-pro-image-preview)</span>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <span>{compStrings.resolutionLabel}</span>
              <select
                value={imgSize}
                disabled={!aiConfigured}
                onChange={(e) => setImgSize(e.target.value as '1K' | '2K' | '4K')}
                className="rounded-md border-2 border-slate-500 bg-white/50 px-2 py-1 text-xs text-ink backdrop-blur-md disabled:opacity-50 dark:border-[#222B3D] dark:bg-[#080B14]/60"
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={imgPrompt}
              disabled={!aiConfigured}
              onChange={(e) => setImgPrompt(e.target.value)}
              placeholder={compStrings.placeholderEditorial}
              className="min-h-[40px] flex-1 rounded-lg border-2 border-slate-500 bg-white/50 px-3 py-1.5 text-xs text-ink backdrop-blur-md disabled:opacity-50 dark:border-[#222B3D] dark:bg-[#080B14]/60"
            />
            <button
              type="submit"
              disabled={!aiConfigured || imgLoading || imgPrompt.trim().length < 5}
              className="min-h-[40px] rounded-lg bg-teal px-3.5 py-2 text-xs font-semibold text-teal-ink hover:bg-teal-hover disabled:opacity-50"
            >
              {imgLoading ? compStrings.generating : compStrings.generateVisualBtn}
            </button>
          </div>
          {imgResult && (
            <div className="rounded-lg border-2 border-slate-500 bg-white/55 p-3 backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
              <img
                src={imgResult.imageDataUrl}
                alt={compStrings.generateVisualBtn}
                referrerPolicy="no-referrer"
                className="w-full rounded-md object-cover"
              />
              <p className="mt-2 text-[11px] text-muted">{imgResult.provenanceNote}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
