import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_AMBIENT_AUDIO_SETTINGS,
  GlacialSoundscapeEngine,
  isWebAudioSupported,
  loadAmbientAudioSettings,
  sanitizeAmbientAudioSettings,
  saveAmbientAudioSettings,
  type AmbientAudioPresetId,
  type AmbientAudioSettings,
} from '../lib/ambient-audio';

const SPECTRUM_BAR_COUNT = 12;
const IDLE_SPECTRUM = Array.from({ length: SPECTRUM_BAR_COUNT }, () => 0);

export interface AmbientFocusAudioController {
  isSupported: boolean;
  isPlaying: boolean;
  settings: AmbientAudioSettings;
  activeSwellHz: number | null;
  spectrumBars: number[];
  errorMessage: string | null;
  togglePlay: () => Promise<void>;
  setPlaying: (nextPlaying: boolean) => Promise<void>;
  setPreset: (preset: AmbientAudioPresetId) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  updateSettings: (patch: Partial<AmbientAudioSettings>) => void;
  resetDefaults: () => void;
}

export function useAmbientFocusAudio(): AmbientFocusAudioController {
  const [isSupported] = useState<boolean>(() => isWebAudioSupported());
  const [settings, setSettings] = useState<AmbientAudioSettings>(() =>
    loadAmbientAudioSettings()
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSwellHz, setActiveSwellHz] = useState<number | null>(null);
  const [spectrumBars, setSpectrumBars] = useState<number[]>(IDLE_SPECTRUM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const engineRef = useRef<GlacialSoundscapeEngine | null>(null);
  const settingsRef = useRef<AmbientAudioSettings>(settings);
  const lastAudibleVolumeRef = useRef<number>(
    settings.volume > 0 ? settings.volume : DEFAULT_AMBIENT_AUDIO_SETTINGS.volume
  );
  settingsRef.current = settings;

  const getEngine = useCallback((): GlacialSoundscapeEngine => {
    if (!engineRef.current) {
      engineRef.current = new GlacialSoundscapeEngine();
    }
    return engineRef.current;
  }, []);

  // Subscribe to active harmonic note updates & dispose engine on unmount
  useEffect(() => {
    const engine = getEngine();
    const unsubscribe = engine.subscribeActiveSwell((hz) => {
      setActiveSwellHz(hz);
    });
    return () => {
      unsubscribe();
      engine.dispose();
      engineRef.current = null;
    };
  }, [getEngine]);

  // Real-time AnalyserNode spectrum sampling (only active while playing; respects reduced motion)
  useEffect(() => {
    if (!isPlaying) {
      setSpectrumBars(IDLE_SPECTRUM);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setSpectrumBars([0.28, 0.42, 0.36, 0.54, 0.48, 0.32, 0.44, 0.38, 0.26, 0.34, 0.22, 0.18]);
      return;
    }

    let intervalId: number | null = null;
    intervalId = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine || !engine.isRunning()) {
        setSpectrumBars(IDLE_SPECTRUM);
        return;
      }
      setSpectrumBars(engine.getSpectrumBars(SPECTRUM_BAR_COUNT));
    }, 90);

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [isPlaying]);

  const setPlaying = useCallback(
    async (nextPlaying: boolean) => {
      if (!isSupported) {
        setErrorMessage('Web Audio API is unavailable in this browser.');
        return;
      }
      setErrorMessage(null);
      const engine = getEngine();

      if (nextPlaying) {
        const started = await engine.start(settingsRef.current);
        if (started) {
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
          setErrorMessage('Could not initialize audio output. Click again to retry.');
        }
      } else {
        engine.stop();
        setIsPlaying(false);
      }
    },
    [getEngine, isSupported]
  );

  const togglePlay = useCallback(async () => {
    await setPlaying(!isPlaying);
  }, [isPlaying, setPlaying]);

  const updateSettings = useCallback((patch: Partial<AmbientAudioSettings>) => {
    setSettings((prev) => {
      const next = sanitizeAmbientAudioSettings({ ...prev, ...patch });
      if (next.volume > 0) {
        lastAudibleVolumeRef.current = next.volume;
      }
      saveAmbientAudioSettings(next);
      if (engineRef.current?.isRunning()) {
        engineRef.current.updateSettings(next);
      }
      return next;
    });
  }, []);

  const setVolume = useCallback(
    (volume: number) => {
      updateSettings({ volume });
    },
    [updateSettings]
  );

  const toggleMute = useCallback(() => {
    if (settingsRef.current.volume > 0) {
      lastAudibleVolumeRef.current = settingsRef.current.volume;
      updateSettings({ volume: 0 });
    } else {
      const restore =
        lastAudibleVolumeRef.current > 0
          ? lastAudibleVolumeRef.current
          : DEFAULT_AMBIENT_AUDIO_SETTINGS.volume;
      updateSettings({ volume: restore });
    }
  }, [updateSettings]);

  const setPreset = useCallback(
    (preset: AmbientAudioPresetId) => {
      updateSettings({ preset });
    },
    [updateSettings]
  );

  const resetDefaults = useCallback(() => {
    const clean = { ...DEFAULT_AMBIENT_AUDIO_SETTINGS };
    lastAudibleVolumeRef.current = clean.volume;
    setSettings(clean);
    saveAmbientAudioSettings(clean);
    if (engineRef.current?.isRunning()) {
      engineRef.current.updateSettings(clean);
    }
  }, []);

  return {
    isSupported,
    isPlaying,
    settings,
    activeSwellHz,
    spectrumBars,
    errorMessage,
    togglePlay,
    setPlaying,
    setPreset,
    setVolume,
    toggleMute,
    updateSettings,
    resetDefaults,
  };
}
