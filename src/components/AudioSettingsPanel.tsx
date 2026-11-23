import React, { useEffect, useId, useRef, useState } from 'react';
import gsap from 'gsap';
import { RotateCcw, Timer, Volume1, Volume2, VolumeX, Waves } from 'lucide-react';
import type { LocaleCode } from '../shared/types';
import type { AmbientFocusAudioController } from '../hooks/useAmbientFocusAudio';
import type { FocusTimerController } from '../hooks/useFocusTimer';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import { notificationCopy } from '../lib/notification-copy';
import { notify } from '../lib/notifications';
import { FocusTimerPanel } from './FocusTimerPanel';
import {
  AMBIENT_PRESET_ORDER,
  computeFilterCutoffHz,
  type AmbientAudioPresetId,
} from '../lib/ambient-audio';

interface AudioCopy {
  title: string;
  subtitle: string;
  headerButtonLabel: string;
  switchLabel: string;
  stateOn: string;
  stateOff: string;
  profileLabel: string;
  volumeLabel: string;
  warmthLabel: string;
  densityLabel: string;
  resetLabel: string;
  spectrumLabel: string;
  standbyReadout: string;
  unsupportedNotice: string;
  presets: Record<AmbientAudioPresetId, { name: string; description: string }>;
  densityTier: (density: number) => string;
}

function getAudioCopy(locale: LocaleCode): AudioCopy {
  if (locale === 'uz') {
    return {
      title: 'Fokus akustik muhiti',
      subtitle:
        'Web Audio API yordamida real vaqtda sintez qilinadigan, takrorlanmaydigan sokin muzlik tovush maydoni.',
      headerButtonLabel: 'Fokus audio sozlamalari',
      switchLabel: 'Ambient fokus tovushi',
      stateOn: 'FAOL',
      stateOff: 'O‘CHIQ',
      profileLabel: 'Akustik profil',
      volumeLabel: 'Asosiy ovoz balandligi',
      warmthLabel: 'Filtr iliqligi (LPF)',
      densityLabel: 'Garmonik zichlik',
      resetLabel: 'Standart',
      spectrumLabel: 'Real vaqt spektri',
      standbyReadout: 'KUTISH',
      unsupportedNotice: 'Ushbu brauzerda Web Audio API qo‘llab-quvvatlanmaydi.',
      presets: {
        'glacial-drift': {
          name: 'Muzlik oqimi',
          description: 'Sokin sub-garmonik qatlam va siyrak kristall akkordlar.',
        },
        'deep-monolith': {
          name: 'Chuqur monolit',
          description: 'Matematika va chuqur mutolaa uchun iliq past chastotali fon.',
        },
        'crystalline-harmonics': {
          name: 'Kristall garmoniya',
          description: 'Shaffof yuqori obertonlar va yengil atmosfera to‘lqini.',
        },
      },
      densityTier: (d: number) => (d < 0.34 ? 'Siyrak' : d < 0.68 ? 'Muvozanatli' : 'To‘yingan'),
    };
  }

  return {
    title: 'Ambient Focus Soundscape',
    subtitle:
      'Generative, non-looping Web Audio synthesis tuned to the glacial cadence of ECONOVA’s background field.',
    headerButtonLabel: 'Ambient focus audio settings',
    switchLabel: 'Focus Soundscape',
    stateOn: 'ACTIVE',
    stateOff: 'OFF',
    profileLabel: 'Acoustic Profile',
    volumeLabel: 'Master Volume',
    warmthLabel: 'Filter Warmth (LPF)',
    densityLabel: 'Harmonic Density',
    resetLabel: 'Reset',
    spectrumLabel: 'Live Acoustic Field',
    standbyReadout: 'STANDBY',
    unsupportedNotice: 'Web Audio API synthesis is unavailable in this browser.',
    presets: {
      'glacial-drift': {
        name: 'Glacial Drift',
        description: 'Open modal fifths with sparse crystalline swells and distant ice air.',
      },
      'deep-monolith': {
        name: 'Deep Monolith',
        description: 'Dark, warm low-passed sub-harmonics for quantitative problem sets.',
      },
      'crystalline-harmonics': {
        name: 'Crystalline',
        description: 'Luminous upper harmonic overtones with delicate airy sweeps.',
      },
    },
    densityTier: (d: number) => (d < 0.34 ? 'Sparse' : d < 0.68 ? 'Balanced' : 'Lush'),
  };
}

interface AudioSettingsPanelProps {
  locale: LocaleCode;
  audio: AmbientFocusAudioController;
  variant?: 'section' | 'popover';
}

export const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({
  locale,
  audio,
  variant = 'section',
}) => {
  const copy = getAudioCopy(locale);
  const switchLabelId = useId();
  const volId = useId();
  const warmthId = useId();
  const densityId = useId();

  const {
    isSupported,
    isPlaying,
    settings,
    activeSwellHz,
    spectrumBars,
    errorMessage,
    togglePlay,
    setPreset,
    updateSettings,
    resetDefaults,
  } = audio;

  const toastCopy = notificationCopy(locale);

  // Playback errors surface as HUD toasts rather than an inline box that shifts the panel.
  useEffect(() => {
    if (!errorMessage) return;
    notify.error(toastCopy.audio.failed, errorMessage, { id: 'ambient-audio-error' });
  }, [errorMessage, toastCopy]);

  const cutoffHz = computeFilterCutoffHz(settings.warmth, settings.preset);
  const volumePercent = Math.round(settings.volume * 100);
  const densityPercent = Math.round(settings.density * 100);

  const isPopover = variant === 'popover';

  const containerClasses = isPopover
    ? 'space-y-0'
    : 'space-y-4 rounded-xl border-2 border-slate-500 bg-white/25 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25';

  return (
    <section
      data-testid={isPopover ? 'header-audio-popover-panel' : 'profile-audio-settings-section'}
      aria-label={copy.title}
      className={containerClasses}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 border-b-2 border-slate-300/80 pb-3 dark:border-[#222B3D]">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <Waves
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                isPlaying ? 'text-[#5DE1D2]' : 'text-muted'
              }`}
              aria-hidden="true"
            />
            <h2
              className={`${
                isPopover ? 'text-sm' : 'text-lg leading-snug'
              } font-semibold tracking-tight text-ink`}
            >
              {copy.title}
            </h2>
          </div>
          {!isPopover && (
            <p className="mt-1 text-xs leading-relaxed text-muted">{copy.subtitle}</p>
          )}
        </div>

        {/* Master Toggle Switch with Explicit State Text */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            data-testid={isPopover ? 'popover-audio-state-label' : 'profile-audio-state-label'}
            className={`font-mono text-[11px] font-bold tracking-wider ${
              isPlaying ? 'text-[#0E7C70] dark:text-[#5DE1D2]' : 'text-muted'
            }`}
          >
            {isPlaying ? copy.stateOn : copy.stateOff}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isPlaying}
            aria-labelledby={switchLabelId}
            disabled={!isSupported}
            onClick={() => void togglePlay()}
            data-testid={isPopover ? 'popover-audio-toggle' : 'profile-audio-toggle'}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-md border-2 border-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5DE1D2] disabled:cursor-not-allowed disabled:opacity-50 ${
              isPlaying
                ? 'bg-[#5DE1D2] shadow-[2px_2px_0px_#000000]'
                : 'bg-slate-200 dark:bg-[#080B14]'
            }`}
          >
            <span id={switchLabelId} className="sr-only">
              {copy.switchLabel}
            </span>
            <span
              aria-hidden="true"
              className={`inline-block h-4 w-4 rounded-sm border border-black transition-transform duration-200 ${
                isPlaying
                  ? 'translate-x-6 bg-[#080B14]'
                  : 'translate-x-1 bg-slate-500 dark:bg-slate-400'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Subtle Real-Time Acoustic Field Strip */}
      <div
        className={`${
          isPopover ? 'mt-3' : ''
        } flex items-center justify-between gap-3 rounded-lg border-2 border-slate-400/70 bg-slate-100/70 px-3 py-2.5 dark:border-[#222B3D] dark:bg-[#080B14]/85`}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {copy.spectrumLabel}
          </div>
          <div
            data-testid={isPopover ? 'popover-audio-frequency' : 'profile-audio-frequency'}
            className="mt-0.5 font-mono text-xs font-bold tabular-nums text-ink"
          >
            {isPlaying && activeSwellHz
              ? `${activeSwellHz.toFixed(1)} Hz · LPF ${cutoffHz} Hz`
              : copy.standbyReadout}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="flex h-7 items-end gap-[3px] shrink-0"
        >
          {spectrumBars.map((level, idx) => {
            const heightPx = isPlaying ? Math.max(4, Math.round(level * 26)) : 3;
            const barColor =
              !isPlaying
                ? 'bg-slate-400/50 dark:bg-slate-700'
                : idx % 3 === 0
                ? 'bg-[#9274FF]'
                : 'bg-[#5DE1D2]';
            return (
              <span
                key={idx}
                style={{ height: `${heightPx}px` }}
                className={`w-[4px] rounded-[1px] transition-[height] duration-150 ease-out ${barColor}`}
              />
            );
          })}
        </div>
      </div>

      {/* Soundscape Profile Selector */}
      <div className={isPopover ? 'mt-3 space-y-2' : 'space-y-2'}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink">{copy.profileLabel}</span>
          <button
            type="button"
            onClick={resetDefaults}
            data-testid={isPopover ? 'popover-audio-reset' : 'profile-audio-reset'}
            className="inline-flex items-center gap-1 rounded-md border border-slate-400/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted transition-colors hover:border-[#5DE1D2] hover:text-ink dark:border-[#222B3D]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>{copy.resetLabel}</span>
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label={copy.profileLabel}
          className={`grid gap-2 ${isPopover ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}
        >
          {AMBIENT_PRESET_ORDER.map((presetId) => {
            const active = settings.preset === presetId;
            const meta = copy.presets[presetId];
            return (
              <button
                key={presetId}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreset(presetId)}
                data-testid={`${isPopover ? 'popover' : 'profile'}-audio-preset-${presetId}`}
                className={`flex flex-col items-start rounded-lg border-2 text-left transition-all ${
                  isPopover ? 'px-2.5 py-2' : 'p-3'
                } ${
                  active
                    ? 'border-black bg-[#5DE1D2]/20 text-ink shadow-[3px_3px_0px_#000000] dark:border-[#5DE1D2] dark:bg-[#5DE1D2]/15'
                    : 'border-slate-400/70 bg-white/60 text-muted hover:border-slate-600 hover:text-ink dark:border-[#222B3D] dark:bg-[#080B14]/70 dark:hover:border-[#5DE1D2]/60'
                }`}
              >
                <span className="text-xs font-bold leading-snug text-ink">{meta.name}</span>
                {!isPopover && (
                  <span className="mt-1 text-[11px] leading-snug text-muted">
                    {meta.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantitative Sliders */}
      <div
        className={`${
          isPopover ? 'mt-3 space-y-3' : 'grid gap-4 sm:grid-cols-3'
        } rounded-lg border-2 border-slate-400/70 bg-white/50 p-3.5 dark:border-[#222B3D] dark:bg-[#080B14]/65`}
      >
        {/* Master Volume (in Profile section; Header popover renders the persistent global bar) */}
        {!isPopover && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={volId} className="text-xs font-semibold text-ink">
                {copy.volumeLabel}
              </label>
              <span
                data-testid="profile-audio-volume-value"
                className="font-mono text-xs font-bold tabular-nums text-[#0E7C70] dark:text-[#5DE1D2]"
              >
                {volumePercent}%
              </span>
            </div>
            <input
              id={volId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              onChange={(e) => audio.setVolume(Number(e.target.value) / 100)}
              data-testid="profile-audio-volume-slider"
              className="h-2 w-full cursor-pointer appearance-none rounded-sm border border-black bg-slate-200 accent-[#5DE1D2] dark:bg-[#101522]"
            />
          </div>
        )}

        {/* Filter Warmth */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={warmthId} className="text-xs font-semibold text-ink">
              {copy.warmthLabel}
            </label>
            <span className="font-mono text-xs font-bold tabular-nums text-[#5D3FD3] dark:text-[#9274FF]">
              {cutoffHz} Hz
            </span>
          </div>
          <input
            id={warmthId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(settings.warmth * 100)}
            onChange={(e) =>
              updateSettings({ warmth: Number(e.target.value) / 100 })
            }
            data-testid={isPopover ? 'popover-audio-warmth-slider' : 'profile-audio-warmth-slider'}
            className="h-2 w-full cursor-pointer appearance-none rounded-sm border border-black bg-slate-200 accent-[#9274FF] dark:bg-[#101522]"
          />
        </div>

        {/* Harmonic Density */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={densityId} className="text-xs font-semibold text-ink">
              {copy.densityLabel}
            </label>
            <span className="font-mono text-xs font-bold tabular-nums text-emerald-700 dark:text-[#6FE0A1]">
              {copy.densityTier(settings.density)} ({densityPercent}%)
            </span>
          </div>
          <input
            id={densityId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={densityPercent}
            onChange={(e) =>
              updateSettings({ density: Number(e.target.value) / 100 })
            }
            data-testid={isPopover ? 'popover-audio-density-slider' : 'profile-audio-density-slider'}
            className="h-2 w-full cursor-pointer appearance-none rounded-sm border border-black bg-slate-200 accent-[#6FE0A1] dark:bg-[#101522]"
          />
        </div>
      </div>
    </section>
  );
};

interface HeaderAudioControlProps {
  locale: LocaleCode;
  audio: AmbientFocusAudioController;
  timer?: FocusTimerController;
  className?: string;
}

/**
 * Compact Glass-Brutalist Header Focus Hub trigger + animated popover
 * combining the Pomodoro Focus Timer (25m / 50m) and Ambient Audio Soundscape.
 */
export const HeaderAudioControl: React.FC<HeaderAudioControlProps> = ({
  locale,
  audio,
  timer,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [activePopoverTab, setActivePopoverTab] = useState<'timer' | 'audio'>('timer');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const copy = getAudioCopy(locale);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEconovaGSAP(
    popoverRef,
    () => {
      if (!open || !popoverRef.current) return;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        gsap.set(popoverRef.current, { opacity: 1, y: 0, scale: 1 });
        return;
      }

      gsap.fromTo(
        popoverRef.current,
        { opacity: 0, y: -10, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.24,
          ease: 'power3.out',
          overwrite: 'auto',
        }
      );
    },
    [open]
  );

  const timerActive = Boolean(timer && (timer.status === 'running' || timer.status === 'paused'));
  const isHighlighted = audio.isPlaying || timerActive;
  const volumePercent = Math.round(audio.settings.volume * 100);
  const isMutedLevel = volumePercent === 0;
  const globalVolInputId = useId();
  const popoverVolInputId = useId();

  const triggerAriaLabel = timer
    ? locale === 'uz'
      ? 'Fokus taymeri va ambient audio'
      : 'Focus timer and ambient audio'
    : copy.headerButtonLabel;

  const volumeAriaLabel =
    locale === 'uz' ? 'Global fokus ovoz balandligi' : 'Global ambient focus volume';
  const muteAriaLabel = isMutedLevel
    ? locale === 'uz'
      ? 'Ovozni qayta yoqish'
      : 'Unmute ambient soundscape'
    : locale === 'uz'
    ? 'Ovozni o‘chirish (0%)'
    : 'Mute ambient soundscape (0%)';

  const renderVolumeGlyph = (sizeClass: string) => {
    if (isMutedLevel || !audio.isPlaying) {
      return (
        <VolumeX
          className={`${sizeClass} ${isMutedLevel ? 'text-rose-500 dark:text-rose-400' : 'text-muted'} shrink-0`}
          aria-hidden="true"
        />
      );
    }
    if (volumePercent < 55) {
      return <Volume1 className={`${sizeClass} shrink-0`} aria-hidden="true" />;
    }
    return <Volume2 className={`${sizeClass} shrink-0`} aria-hidden="true" />;
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Unified Glass-Brutalist Header Capsule: Focus Hub Trigger + Inline Global Volume Slider (xl+) */}
      <div
        data-testid="header-audio-capsule"
        className={`inline-flex h-9 sm:min-h-[38px] items-center rounded-lg border-2 shadow-brutal-sm backdrop-blur-md transition-colors shrink-0 ${
          isHighlighted
            ? 'border-black bg-[#5DE1D2]/15 text-ink dark:border-[#5DE1D2] dark:bg-[#101522]/90'
            : 'border-slate-500 bg-white/55 text-ink dark:border-[#222B3D] dark:bg-[#080B14]/60'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={triggerAriaLabel}
          title={triggerAriaLabel}
          data-testid="header-audio-trigger"
          className={`inline-flex h-full min-w-[36px] items-center justify-center gap-1.5 rounded-l-[6px] xl:rounded-r-none rounded-r-[6px] px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            isHighlighted
              ? 'bg-[#5DE1D2] text-black dark:bg-[#5DE1D2]/20 dark:text-[#5DE1D2]'
              : 'text-ink hover:text-theme-accent'
          }`}
        >
          {timerActive ? (
            <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            renderVolumeGlyph('h-3.5 w-3.5')
          )}
          {timerActive && timer ? (
            <span
              data-testid="header-timer-badge"
              className="font-mono text-[11px] font-bold tabular-nums"
            >
              {timer.formattedClock}
            </span>
          ) : audio.isPlaying ? (
            <span className="xl:hidden font-mono text-[10px] font-bold tabular-nums">
              {volumePercent}%
            </span>
          ) : null}
        </button>

        {/* Inline Global Volume Control (xl+ desktop top bar) */}
        <div
          data-testid="header-global-volume-control"
          className="hidden xl:flex items-center gap-1.5 border-l-2 border-theme-border/80 px-2 h-full dark:border-[#222B3D]"
        >
          <button
            type="button"
            onClick={audio.toggleMute}
            aria-label={muteAriaLabel}
            title={muteAriaLabel}
            aria-pressed={isMutedLevel}
            data-testid="header-global-mute-btn"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-ink transition-colors hover:text-[#0E7C70] dark:hover:text-[#5DE1D2]"
          >
            {renderVolumeGlyph('h-3.5 w-3.5')}
          </button>
          <label htmlFor={globalVolInputId} className="sr-only">
            {volumeAriaLabel}
          </label>
          <input
            id={globalVolInputId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={volumePercent}
            aria-label={volumeAriaLabel}
            aria-valuetext={`${volumePercent}%`}
            onChange={(e) => audio.setVolume(Number(e.target.value) / 100)}
            data-testid="header-global-volume-slider"
            className="h-1.5 w-14 cursor-pointer appearance-none rounded-sm border border-black bg-slate-200 accent-[#5DE1D2] dark:bg-[#080B14]"
          />
          <span
            data-testid="header-global-volume-value"
            className="w-[30px] text-right font-mono text-[10px] font-bold tabular-nums text-[#0E7C70] dark:text-[#5DE1D2]"
          >
            {volumePercent}%
          </span>
        </div>
      </div>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={triggerAriaLabel}
          className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[332px] sm:w-[368px] origin-top-right rounded-xl border-2 border-slate-600 bg-white/95 p-4 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/95"
        >
          {timer && (
            <div
              role="tablist"
              aria-label="Focus Hub Views"
              className="mb-3 grid grid-cols-2 gap-1 rounded-lg border-2 border-theme-border bg-slate-100/80 p-1 dark:bg-[#080B14]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activePopoverTab === 'timer'}
                onClick={() => setActivePopoverTab('timer')}
                data-testid="header-hub-tab-timer"
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  activePopoverTab === 'timer'
                    ? 'border border-black bg-[#5DE1D2] text-black shadow-[2px_2px_0px_#000000]'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{locale === 'uz' ? 'Fokus taymeri' : 'Focus Timer'}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePopoverTab === 'audio'}
                onClick={() => setActivePopoverTab('audio')}
                data-testid="header-hub-tab-audio"
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  activePopoverTab === 'audio'
                    ? 'border border-black bg-[#9274FF] text-black shadow-[2px_2px_0px_#000000]'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Waves className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{locale === 'uz' ? 'Ambient audio' : 'Ambient Audio'}</span>
              </button>
            </div>
          )}

          {/* Persistent Global Soundscape Volume Bar (Accessible on both Timer & Audio tabs) */}
          <div
            data-testid="header-popover-global-volume"
            className="mb-3.5 rounded-lg border-2 border-slate-400/75 bg-slate-100/75 px-3 py-2.5 dark:border-[#222B3D] dark:bg-[#080B14]/85"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={audio.toggleMute}
                  aria-label={muteAriaLabel}
                  title={muteAriaLabel}
                  aria-pressed={isMutedLevel}
                  data-testid="popover-global-mute-btn"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-400/70 bg-white/80 text-ink transition-colors hover:border-[#5DE1D2] dark:border-[#222B3D] dark:bg-[#101522]"
                >
                  {renderVolumeGlyph('h-3.5 w-3.5')}
                </button>
                <label
                  htmlFor={popoverVolInputId}
                  className="text-xs font-semibold text-ink"
                >
                  {copy.volumeLabel}
                </label>
              </div>
              <span
                data-testid="popover-audio-volume-value"
                className={`font-mono text-xs font-bold tabular-nums ${
                  isMutedLevel
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-[#0E7C70] dark:text-[#5DE1D2]'
                }`}
              >
                {volumePercent}%
              </span>
            </div>
            <input
              id={popoverVolInputId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              aria-label={volumeAriaLabel}
              aria-valuetext={`${volumePercent}%`}
              onChange={(e) => audio.setVolume(Number(e.target.value) / 100)}
              data-testid="popover-audio-volume-slider"
              className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-sm border border-black bg-slate-200 accent-[#5DE1D2] dark:bg-[#101522]"
            />
          </div>

          {timer && activePopoverTab === 'timer' ? (
            <FocusTimerPanel
              locale={locale}
              timer={timer}
              audio={audio}
              variant="popover"
              onOpenAudioTab={() => setActivePopoverTab('audio')}
            />
          ) : (
            <AudioSettingsPanel locale={locale} audio={audio} variant="popover" />
          )}
        </div>
      )}
    </div>
  );
};
