import React, { useState } from 'react';
import { Image as ImageIcon, MessageSquare, Send, X } from 'lucide-react';
import type { LocaleCode } from '../shared/types';

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
  const [mode, setMode] = useState<'study_tutor' | 'editorial_draft'>(
    isStaff ? defaultMode : 'study_tutor'
  );
  const [model, setModel] = useState<string>('gemini-4-hydrogen');
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editorial Diagram Image Generator (1K / 2K / 4K)
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgSize, setImgSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgResult, setImgResult] = useState<{
    imageDataUrl: string;
    captionText: string;
    provenanceNote: string;
  } | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

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
      const res = await fetch('/api/ai/chat', {
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
      const res = await fetch('/api/ai/generate-image', {
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
      className={`flex flex-col rounded-xl border border-[#222B3D] bg-[#101522] ${
        embedded ? 'p-5' : 'h-full max-h-[82vh] p-5'
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#222B3D] pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F3F6FF]">
            <MessageSquare className="h-4 w-4 text-[#5DE1D2]" aria-hidden="true" />
            <span>
              {mode === 'editorial_draft'
                ? 'Editorial AI Draft Studio (Human Review Required)'
                : locale === 'uz'
                ? 'O‘quv yordamchisi (Qoralama ko‘mak)'
                : 'Study Companion'}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-[#8994AA]">
            {mode === 'editorial_draft'
              ? 'AI output stays strictly in Draft status until human subject, language, and rights reviewers approve.'
              : 'Guided explanations for Economics, Mathematics, and Business. Never reveals assessment answer keys.'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Companion"
            className="rounded-lg p-1.5 text-[#8994AA] hover:bg-[#141B2B] hover:text-[#F3F6FF]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!aiConfigured && (
        <div
          role="status"
          className="mt-3 rounded-lg border border-[#FFC96B]/40 bg-[#0B0F19] px-3.5 py-2.5 text-xs leading-relaxed text-[#FFC96B]"
        >
          {locale === 'uz'
            ? 'Sun’iy intellekt funksiyalari AI Studio Settings > Secrets bo‘limida GEMINI_API_KEY sozlanmaguncha o‘chirilgan. Barcha asosiy darslar, testlar va sertifikatlar to‘liq ishlaydi.'
            : 'AI features are disabled until GEMINI_API_KEY is configured in AI Studio Settings > Secrets. All core courses, lessons, assessments, and certificates work without AI.'}
        </div>
      )}

      {/* Role & Model Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {isStaff && (
          <div className="flex items-center rounded-lg border border-[#222B3D] bg-[#0B0F19] p-0.5">
            <button
              type="button"
              onClick={() => setMode('study_tutor')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                mode === 'study_tutor' ? 'bg-[#141B2B] text-[#F3F6FF]' : 'text-[#8994AA]'
              }`}
            >
              Study Tutor
            </button>
            <button
              type="button"
              onClick={() => setMode('editorial_draft')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                mode === 'editorial_draft' ? 'bg-[#141B2B] text-[#5DE1D2]' : 'text-[#8994AA]'
              }`}
            >
              Editorial Draft
            </button>
          </div>
        )}

        <label className="flex items-center gap-1.5 text-[#8994AA]">
          <span>Model:</span>
          <select
            value={model}
            disabled={!aiConfigured}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-md border border-[#222B3D] bg-[#0B0F19] px-2 py-1 text-xs text-[#F3F6FF] disabled:opacity-50"
          >
            <option value="gemini-4-hydrogen">gemini-4-hydrogen (General)</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
            <option value="gemini-4-argon">gemini-4-argon (Complex Interactive)</option>
            <option value="gemini-4-carbon">gemini-4-carbon (Deep Reasoning)</option>
          </select>
        </label>
      </div>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div
        aria-label="Conversation history"
        className="mt-3 flex-1 min-h-[220px] max-h-[340px] space-y-3 overflow-y-auto rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3.5"
      >
        {history.length === 0 && (
          <p className="text-xs text-[#8994AA]">
            {mode === 'editorial_draft'
              ? 'Ask to outline a draft lesson or bilingual glossary note. Generated drafts must be reviewed before publishing.'
              : 'Ask a concept question about Supply & Demand, Derivatives, or Unit Economics.'}
          </p>
        )}
        {history.map((turn, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 text-xs leading-relaxed ${
              turn.role === 'user'
                ? 'ml-6 bg-[#141B2B] text-[#F3F6FF]'
                : 'mr-4 border border-[#222B3D] bg-[#101522] text-[#F3F6FF]'
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-[11px] text-[#8994AA]">
              <span>{turn.role === 'user' ? 'You' : 'ECONOVA Assistant'}</span>
              {turn.modelUsed && <span className="font-mono">{turn.modelUsed}</span>}
            </div>
            <div className="whitespace-pre-wrap">{turn.text}</div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-[#5DE1D2]">Generating response...</div>
        )}
      </div>

      {errorMsg && (
        <div role="alert" className="mt-2 rounded-lg border border-[#FFC96B]/40 bg-[#0B0F19] px-3 py-2 text-xs text-[#FFC96B]">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          disabled={!aiConfigured}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            !aiConfigured
              ? 'AI disabled until GEMINI_API_KEY is configured in Secrets...'
              : mode === 'editorial_draft'
              ? 'Draft an Economics lesson outline on price elasticity...'
              : 'Explain the difference between movement along a curve and a shift...'
          }
          className="min-h-[42px] flex-1 rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-2 text-xs text-[#F3F6FF] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!aiConfigured || loading || !input.trim()}
          aria-label="Send message"
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#9274FF] px-4 py-2 text-xs font-semibold text-[#080B14] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Send</span>
        </button>
      </form>

      {/* Staff-only 1K / 2K / 4K Lesson Visual Asset Draft Generator */}
      {isStaff && mode === 'editorial_draft' && (
        <form onSubmit={handleGenerateDiagram} className="mt-4 border-t border-[#222B3D] pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F3F6FF]">
              <ImageIcon className="h-3.5 w-3.5 text-[#5DE1D2]" aria-hidden="true" />
              <span>Draft Lesson Diagram Generator (gemini-3-pro-image-preview)</span>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[#8994AA]">
              <span>Resolution:</span>
              <select
                value={imgSize}
                disabled={!aiConfigured}
                onChange={(e) => setImgSize(e.target.value as '1K' | '2K' | '4K')}
                className="rounded-md border border-[#222B3D] bg-[#0B0F19] px-2 py-1 text-xs text-[#F3F6FF] disabled:opacity-50"
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
              placeholder="Clean isometric diagram of circular flow of income between households and firms..."
              className="min-h-[40px] flex-1 rounded-lg border border-[#222B3D] bg-[#0B0F19] px-3 py-1.5 text-xs text-[#F3F6FF] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!aiConfigured || imgLoading || imgPrompt.trim().length < 5}
              className="min-h-[40px] rounded-lg bg-[#5DE1D2] px-3.5 py-2 text-xs font-semibold text-[#080B14] disabled:opacity-50"
            >
              {imgLoading ? 'Generating...' : 'Generate Draft Visual'}
            </button>
          </div>
          {imgError && <p className="text-xs text-[#FFC96B]">{imgError}</p>}
          {imgResult && (
            <div className="rounded-lg border border-[#222B3D] bg-[#0B0F19] p-3">
              <img
                src={imgResult.imageDataUrl}
                alt="AI-generated draft lesson diagram pending human review"
                referrerPolicy="no-referrer"
                className="w-full rounded-md object-cover"
              />
              <p className="mt-2 text-[11px] text-[#8994AA]">{imgResult.provenanceNote}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
