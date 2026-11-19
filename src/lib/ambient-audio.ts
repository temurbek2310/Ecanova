export type AmbientAudioPresetId =
  | 'glacial-drift'
  | 'deep-monolith'
  | 'crystalline-harmonics';

export interface AmbientAudioSettings {
  preset: AmbientAudioPresetId;
  /** Master output level (0.05 to 1.0) */
  volume: number;
  /** Low-pass harmonic brightness / filter warmth (0.0 darker to 1.0 airier) */
  warmth: number;
  /** Generative swell density & atmospheric texture depth (0.0 sparse to 1.0 lush) */
  density: number;
}

export interface AmbientPresetDefinition {
  id: AmbientAudioPresetId;
  /** Sub-harmonic drone voices in Hz (pure just / modal intervals) */
  droneFrequenciesHz: readonly [number, number, number];
  /** Consonant pitch pool for non-looping stochastic crystalline swells */
  swellScaleHz: readonly number[];
  /** Low-pass cutoff range in Hz mapped logarithmically by `warmth` */
  filterRangeHz: readonly [number, number];
  /** Center frequency for atmospheric glacial air bandpass filter */
  textureBandHz: number;
  /** Relative noise texture amplitude multiplier */
  textureGainScale: number;
  /** Relative drone bed gain multiplier */
  droneGainScale: number;
  /** Relative crystalline swell gain multiplier */
  swellGainScale: number;
  /** Base interval range in ms between generative swells [minMs, maxMs] at medium density */
  baseIntervalMs: readonly [number, number];
}

export interface GeneratedGlacialSwell {
  frequencyHz: number;
  overtoneMultiplier: number;
  detuneCents: number;
  attackSec: number;
  holdSec: number;
  releaseSec: number;
  pan: number;
  gain: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const AMBIENT_AUDIO_STORAGE_KEY = 'econova:ambient-audio-settings:v1';
export const AMBIENT_AUDIO_VOLUME_STORAGE_KEY = 'econova:ambient-audio-volume:v1';

export const DEFAULT_AMBIENT_AUDIO_SETTINGS: AmbientAudioSettings = {
  preset: 'glacial-drift',
  volume: 0.42,
  warmth: 0.48,
  density: 0.5,
};

export const AMBIENT_AUDIO_PRESETS: Record<AmbientAudioPresetId, AmbientPresetDefinition> = {
  'glacial-drift': {
    id: 'glacial-drift',
    // D2, A2, E3 open modal fifths — wide, calm, academic stillness
    droneFrequenciesHz: [73.42, 110.0, 164.81],
    // D Lydian / suspended crystalline pitch pool
    swellScaleHz: [220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33],
    filterRangeHz: [190, 920],
    textureBandHz: 340,
    textureGainScale: 0.14,
    droneGainScale: 0.34,
    swellGainScale: 0.22,
    baseIntervalMs: [5200, 11500],
  },
  'deep-monolith': {
    id: 'deep-monolith',
    // C2, G2, D3 warm dark architectural drone
    droneFrequenciesHz: [65.41, 98.0, 146.83],
    // Low-mid resonant fifths & ninths
    swellScaleHz: [146.83, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0],
    filterRangeHz: [140, 620],
    textureBandHz: 220,
    textureGainScale: 0.16,
    droneGainScale: 0.4,
    swellGainScale: 0.16,
    baseIntervalMs: [6800, 14500],
  },
  'crystalline-harmonics': {
    id: 'crystalline-harmonics',
    // D2, A2, F#3 luminous glass-harmonic triad
    droneFrequenciesHz: [73.42, 110.0, 185.0],
    // Airy upper crystalline overtones
    swellScaleHz: [293.66, 369.99, 440.0, 493.88, 554.37, 587.33, 659.25, 739.99],
    filterRangeHz: [260, 1280],
    textureBandHz: 520,
    textureGainScale: 0.11,
    droneGainScale: 0.26,
    swellGainScale: 0.26,
    baseIntervalMs: [4400, 9800],
  },
};

export const AMBIENT_PRESET_ORDER: readonly AmbientAudioPresetId[] = [
  'glacial-drift',
  'deep-monolith',
  'crystalline-harmonics',
];

export function isAmbientAudioPresetId(value: unknown): value is AmbientAudioPresetId {
  return (
    value === 'glacial-drift' ||
    value === 'deep-monolith' ||
    value === 'crystalline-harmonics'
  );
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeAmbientAudioSettings(
  raw: Partial<AmbientAudioSettings> | null | undefined
): AmbientAudioSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AMBIENT_AUDIO_SETTINGS };
  }

  return {
    preset: isAmbientAudioPresetId(raw.preset)
      ? raw.preset
      : DEFAULT_AMBIENT_AUDIO_SETTINGS.preset,
    volume:
      typeof raw.volume === 'number' && Number.isFinite(raw.volume)
        ? Number(clampNumber(raw.volume, 0, 1).toFixed(2))
        : DEFAULT_AMBIENT_AUDIO_SETTINGS.volume,
    warmth:
      typeof raw.warmth === 'number' && Number.isFinite(raw.warmth)
        ? clampNumber(raw.warmth, 0, 1)
        : DEFAULT_AMBIENT_AUDIO_SETTINGS.warmth,
    density:
      typeof raw.density === 'number' && Number.isFinite(raw.density)
        ? clampNumber(raw.density, 0, 1)
        : DEFAULT_AMBIENT_AUDIO_SETTINGS.density,
  };
}

/**
 * Perceptual master gain curve mapping normalized volume (0..1) into
 * comfortable Web Audio gain levels, reaching smooth near-silence at 0.
 */
export function computeMasterGainForVolume(volume: number): number {
  const v = clampNumber(volume, 0, 1);
  if (v <= 0.001) return 0.0001;
  return Number((0.015 + Math.pow(v, 1.55) * 0.565).toFixed(4));
}

/**
 * Logarithmically maps the normalized warmth slider (0..1) into the preset's
 * low-pass filter cutoff frequency in Hz.
 */
export function computeFilterCutoffHz(
  warmth: number,
  presetId: AmbientAudioPresetId
): number {
  const preset = AMBIENT_AUDIO_PRESETS[presetId];
  const [minHz, maxHz] = preset.filterRangeHz;
  const w = clampNumber(warmth, 0, 1);
  return Math.round(minHz * Math.pow(maxHz / minHz, w));
}

/**
 * Computes a non-looping stochastic delay (ms) until the next generative swell.
 * Higher density shortens the pause; lower density widens glacial silence.
 */
export function computeSwellIntervalMs(
  density: number,
  presetId: AmbientAudioPresetId,
  rng: () => number = Math.random
): number {
  const preset = AMBIENT_AUDIO_PRESETS[presetId];
  const d = clampNumber(density, 0, 1);
  // Density 0 => 1.55x slower; Density 1 => 0.58x faster
  const densityScale = 1.55 - d * 0.97;
  const [baseMin, baseMax] = preset.baseIntervalMs;
  const minMs = baseMin * densityScale;
  const maxMs = baseMax * densityScale;
  const u = clampNumber(rng(), 0, 1);
  return Math.round(minMs + (maxMs - minMs) * u);
}

/**
 * Generates the next crystalline harmonic swell event from the preset's pitch pool.
 * Guarantees non-repetition of the immediately preceding pitch and slow glacial envelopes.
 */
export function pickNextGlacialSwell(
  presetId: AmbientAudioPresetId,
  previousFrequencyHz: number | null,
  density: number,
  rng: () => number = Math.random
): GeneratedGlacialSwell {
  const preset = AMBIENT_AUDIO_PRESETS[presetId];
  const pool =
    preset.swellScaleHz.length > 1 && previousFrequencyHz !== null
      ? preset.swellScaleHz.filter((hz) => Math.abs(hz - previousFrequencyHz) > 0.5)
      : [...preset.swellScaleHz];

  const safePool = pool.length > 0 ? pool : [...preset.swellScaleHz];
  const index = Math.min(safePool.length - 1, Math.floor(clampNumber(rng(), 0, 0.999999) * safePool.length));
  const frequencyHz = safePool[index];

  // Subtle natural overtone interval: mostly octave (2.0) or pure fifth (1.5)
  const overtoneMultiplier = rng() > 0.38 ? 2.0 : 1.5;
  const detuneCents = (clampNumber(rng(), 0, 1) * 2 - 1) * 6.5;

  // Glacial slow attack & release envelopes (total duration 10.5s – 21s)
  const attackSec = Number((3.6 + clampNumber(rng(), 0, 1) * 3.8).toFixed(2));
  const holdSec = Number((0.9 + clampNumber(rng(), 0, 1) * 2.2).toFixed(2));
  const releaseSec = Number((6.2 + clampNumber(rng(), 0, 1) * 6.4).toFixed(2));
  const pan = Number(((clampNumber(rng(), 0, 1) * 2 - 1) * 0.62).toFixed(2));
  const d = clampNumber(density, 0, 1);
  const gain = Number(
    (preset.swellGainScale * (0.65 + d * 0.45) * (0.78 + clampNumber(rng(), 0, 1) * 0.34)).toFixed(3)
  );

  return {
    frequencyHz,
    overtoneMultiplier,
    detuneCents: Number(detuneCents.toFixed(2)),
    attackSec,
    holdSec,
    releaseSec,
    pan,
    gain,
  };
}

export function loadAmbientAudioVolume(
  storage?: StorageLike | null
): number | null {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return null;

  try {
    const raw = store.getItem(AMBIENT_AUDIO_VOLUME_STORAGE_KEY);
    if (raw === null || raw.trim() === '') return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Number(clampNumber(parsed, 0, 1).toFixed(2));
  } catch {
    return null;
  }
}

export function saveAmbientAudioVolume(
  volume: number,
  storage?: StorageLike | null
): void {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return;

  try {
    const clamped = Number(clampNumber(volume, 0, 1).toFixed(2));
    store.setItem(AMBIENT_AUDIO_VOLUME_STORAGE_KEY, String(clamped));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function loadAmbientAudioSettings(
  storage?: StorageLike | null
): AmbientAudioSettings {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return { ...DEFAULT_AMBIENT_AUDIO_SETTINGS };

  const persistedVolume = loadAmbientAudioVolume(store);

  try {
    const raw = store.getItem(AMBIENT_AUDIO_STORAGE_KEY);
    if (!raw) {
      return sanitizeAmbientAudioSettings(
        persistedVolume !== null ? { volume: persistedVolume } : undefined
      );
    }
    const parsed = JSON.parse(raw) as Partial<AmbientAudioSettings>;
    return sanitizeAmbientAudioSettings({
      ...parsed,
      ...(persistedVolume !== null ? { volume: persistedVolume } : {}),
    });
  } catch {
    return sanitizeAmbientAudioSettings(
      persistedVolume !== null ? { volume: persistedVolume } : undefined
    );
  }
}

export function saveAmbientAudioSettings(
  settings: AmbientAudioSettings,
  storage?: StorageLike | null
): void {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return;

  try {
    const clean = sanitizeAmbientAudioSettings(settings);
    store.setItem(AMBIENT_AUDIO_STORAGE_KEY, JSON.stringify(clean));
    saveAmbientAudioVolume(clean.volume, store);
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function isWebAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  return typeof window.AudioContext === 'function' || typeof win.webkitAudioContext === 'function';
}

interface DroneVoiceNodes {
  osc: OscillatorNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

/**
 * Pure Web Audio API generative glacial soundscape engine.
 * Synthesizes an evolving, non-looping sound field from:
 *  1. Three prime-ratio LFO-modulated sub-harmonic drone oscillators
 *  2. Procedurally generated pink/brown noise through dual slow-sweeping filters
 *  3. A recursive stochastic crystalline harmonic swell scheduler
 */
export class GlacialSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bedFilter: BiquadFilterNode | null = null;
  private bedFilterLfo: OscillatorNode | null = null;
  private bedFilterLfoGain: GainNode | null = null;
  private droneVoices: DroneVoiceNodes[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseBandFilter: BiquadFilterNode | null = null;
  private noiseLowFilter: BiquadFilterNode | null = null;
  private noiseLfo: OscillatorNode | null = null;
  private noiseLfoGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;

  private running = false;
  private settings: AmbientAudioSettings = { ...DEFAULT_AMBIENT_AUDIO_SETTINGS };
  private swellTimerId: ReturnType<typeof setTimeout> | null = null;
  private stopCleanupTimerId: ReturnType<typeof setTimeout> | null = null;
  private lastSwellHz: number | null = null;
  private activeSwellHz: number | null = null;
  private frequencyScratch: Uint8Array<ArrayBuffer> | null = null;
  private swellListeners = new Set<(hz: number | null) => void>();

  public isRunning(): boolean {
    return this.running;
  }

  public getActiveSwellFrequencyHz(): number | null {
    return this.activeSwellHz;
  }

  public subscribeActiveSwell(listener: (hz: number | null) => void): () => void {
    this.swellListeners.add(listener);
    return () => {
      this.swellListeners.delete(listener);
    };
  }

  private emitActiveSwell(hz: number | null): void {
    this.activeSwellHz = hz;
    for (const listener of this.swellListeners) {
      listener(hz);
    }
  }

  private createAudioContext(): AudioContext | null {
    if (!isWebAudioSupported()) return null;
    const win = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  }

  private createPinkNoiseBuffer(ctx: AudioContext, durationSec = 7): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      // Paul Kellet pink-noise approximation for warm, natural glacial air
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
        // Seamless crossfade edges so underlying air texture never clicks
        const edgeSamples = Math.floor(sampleRate * 0.35);
        let env = 1;
        if (i < edgeSamples) {
          env = i / edgeSamples;
        } else if (i > length - edgeSamples) {
          env = (length - i) / edgeSamples;
        }
        data[i] = clampNumber(pink * env, -0.8, 0.8);
      }
    }
    return buffer;
  }

  private tearDownGraph(): void {
    if (this.swellTimerId !== null) {
      clearTimeout(this.swellTimerId);
      this.swellTimerId = null;
    }

    for (const voice of this.droneVoices) {
      try {
        voice.osc.stop();
        voice.lfo.stop();
      } catch {
        // Ignore already-stopped oscillator
      }
      voice.osc.disconnect();
      voice.gain.disconnect();
      voice.lfo.disconnect();
      voice.lfoGain.disconnect();
    }
    this.droneVoices = [];

    if (this.bedFilterLfo) {
      try {
        this.bedFilterLfo.stop();
      } catch {
        // ignore
      }
      this.bedFilterLfo.disconnect();
      this.bedFilterLfo = null;
    }
    if (this.bedFilterLfoGain) {
      this.bedFilterLfoGain.disconnect();
      this.bedFilterLfoGain = null;
    }
    if (this.bedFilter) {
      this.bedFilter.disconnect();
      this.bedFilter = null;
    }

    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
      } catch {
        // ignore
      }
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }
    if (this.noiseLfo) {
      try {
        this.noiseLfo.stop();
      } catch {
        // ignore
      }
      this.noiseLfo.disconnect();
      this.noiseLfo = null;
    }
    if (this.noiseLfoGain) {
      this.noiseLfoGain.disconnect();
      this.noiseLfoGain = null;
    }
    if (this.noiseBandFilter) {
      this.noiseBandFilter.disconnect();
      this.noiseBandFilter = null;
    }
    if (this.noiseLowFilter) {
      this.noiseLowFilter.disconnect();
      this.noiseLowFilter = null;
    }
    if (this.noiseGain) {
      this.noiseGain.disconnect();
      this.noiseGain = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    this.frequencyScratch = null;
  }

  public async start(initialSettings: AmbientAudioSettings): Promise<boolean> {
    this.settings = sanitizeAmbientAudioSettings(initialSettings);

    if (this.stopCleanupTimerId !== null) {
      clearTimeout(this.stopCleanupTimerId);
      this.stopCleanupTimerId = null;
    }

    if (!this.ctx) {
      this.ctx = this.createAudioContext();
    }
    if (!this.ctx) return false;

    try {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    } catch {
      return false;
    }

    if (this.running && this.masterGain) {
      this.updateSettings(this.settings);
      return true;
    }

    this.tearDownGraph();

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const preset = AMBIENT_AUDIO_PRESETS[this.settings.preset];
    const cutoffHz = computeFilterCutoffHz(this.settings.warmth, this.settings.preset);

    // Master chain: masterGain -> compressor -> analyser -> destination
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(this.computeMasterTargetGain(), now + 1.45);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, now);
    compressor.knee.setValueAtTime(24, now);
    compressor.ratio.setValueAtTime(3.2, now);
    compressor.attack.setValueAtTime(0.04, now);
    compressor.release.setValueAtTime(0.45, now);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.86;

    masterGain.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);

    this.masterGain = masterGain;
    this.compressor = compressor;
    this.analyser = analyser;
    this.frequencyScratch = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    // Glacial low-pass filter for sub-harmonic drone bed with ultra-slow ~28s LFO drift
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.setValueAtTime(cutoffHz, now);
    bedFilter.Q.setValueAtTime(0.85, now);
    bedFilter.connect(masterGain);

    const bedFilterLfo = ctx.createOscillator();
    bedFilterLfo.type = 'sine';
    bedFilterLfo.frequency.setValueAtTime(0.035, now); // ~28.5s glacial cycle
    const bedFilterLfoGain = ctx.createGain();
    bedFilterLfoGain.gain.setValueAtTime(Math.max(35, cutoffHz * 0.24), now);
    bedFilterLfo.connect(bedFilterLfoGain);
    bedFilterLfoGain.connect(bedFilter.frequency);
    bedFilterLfo.start(now);

    this.bedFilter = bedFilter;
    this.bedFilterLfo = bedFilterLfo;
    this.bedFilterLfoGain = bedFilterLfoGain;

    // 3 Unsynchronized drone voices with prime-ratio LFO rates so phase never loops
    const voiceWaveforms: OscillatorType[] = ['sine', 'sine', 'triangle'];
    const voiceLfoRates = [0.037, 0.053, 0.043];
    const voiceGainWeights = [0.46, 0.34, 0.2];
    const voiceDetunes = [-3.2, 2.4, -1.5];

    this.droneVoices = preset.droneFrequenciesHz.map((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = voiceWaveforms[idx] ?? 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(voiceDetunes[idx] ?? 0, now);

      const gain = ctx.createGain();
      const baseLevel = preset.droneGainScale * (voiceGainWeights[idx] ?? 0.25);
      gain.gain.setValueAtTime(baseLevel, now);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(voiceLfoRates[idx] ?? 0.04, now);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(baseLevel * 0.22, now);

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      osc.connect(gain);
      gain.connect(bedFilter);

      osc.start(now);
      lfo.start(now);
      return { osc, gain, lfo, lfoGain };
    });

    // Atmospheric glacial breeze (procedural pink noise + unsynchronized sweeping bandpass)
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.createPinkNoiseBuffer(ctx, 7);
    noiseSource.loop = true;

    const noiseBandFilter = ctx.createBiquadFilter();
    noiseBandFilter.type = 'bandpass';
    noiseBandFilter.frequency.setValueAtTime(preset.textureBandHz, now);
    noiseBandFilter.Q.setValueAtTime(1.1, now);

    const noiseLowFilter = ctx.createBiquadFilter();
    noiseLowFilter.type = 'lowpass';
    noiseLowFilter.frequency.setValueAtTime(Math.max(240, cutoffHz * 1.15), now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(
      preset.textureGainScale * (0.45 + this.settings.density * 0.75),
      now
    );

    const noiseLfo = ctx.createOscillator();
    noiseLfo.type = 'sine';
    noiseLfo.frequency.setValueAtTime(0.029, now); // ~34.5s slow ice-current drift
    const noiseLfoGain = ctx.createGain();
    noiseLfoGain.gain.setValueAtTime(preset.textureBandHz * 0.32, now);
    noiseLfo.connect(noiseLfoGain);
    noiseLfoGain.connect(noiseBandFilter.frequency);

    noiseSource.connect(noiseBandFilter);
    noiseBandFilter.connect(noiseLowFilter);
    noiseLowFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noiseSource.start(now);
    noiseLfo.start(now);

    this.noiseSource = noiseSource;
    this.noiseBandFilter = noiseBandFilter;
    this.noiseLowFilter = noiseLowFilter;
    this.noiseGain = noiseGain;
    this.noiseLfo = noiseLfo;
    this.noiseLfoGain = noiseLfoGain;

    this.running = true;
    this.emitActiveSwell(preset.droneFrequenciesHz[0]);

    // Trigger first gentle crystalline swell after a short calm breath
    this.scheduleNextSwell(1100);
    return true;
  }

  private computeMasterTargetGain(): number {
    return computeMasterGainForVolume(this.settings.volume);
  }

  private scheduleNextSwell(overrideDelayMs?: number): void {
    if (!this.running) return;
    if (this.swellTimerId !== null) {
      clearTimeout(this.swellTimerId);
    }

    const delayMs =
      overrideDelayMs ??
      computeSwellIntervalMs(this.settings.density, this.settings.preset);

    this.swellTimerId = setTimeout(() => {
      if (!this.running || !this.ctx || !this.masterGain) return;
      this.triggerGenerativeSwell();
      this.scheduleNextSwell();
    }, delayMs);
  }

  private triggerGenerativeSwell(): void {
    if (!this.ctx || !this.masterGain || !this.running) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const swell = pickNextGlacialSwell(
      this.settings.preset,
      this.lastSwellHz,
      this.settings.density
    );
    this.lastSwellHz = swell.frequencyHz;
    this.emitActiveSwell(swell.frequencyHz);

    const cutoffHz = computeFilterCutoffHz(this.settings.warmth, this.settings.preset);

    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(swell.frequencyHz, now);
    fundamental.detune.setValueAtTime(swell.detuneCents, now);

    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(
      swell.frequencyHz * swell.overtoneMultiplier,
      now
    );
    overtone.detune.setValueAtTime(-swell.detuneCents * 0.8, now);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.18, now);

    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = 'lowpass';
    swellFilter.frequency.setValueAtTime(Math.max(320, cutoffHz * 1.45), now);
    swellFilter.Q.setValueAtTime(0.7, now);

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(swell.gain, now + swell.attackSec);
    envGain.gain.setValueAtTime(swell.gain, now + swell.attackSec + swell.holdSec);
    const endTime = now + swell.attackSec + swell.holdSec + swell.releaseSec;
    envGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    fundamental.connect(swellFilter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(swellFilter);
    swellFilter.connect(envGain);

    let panner: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(swell.pan, now);
      envGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      envGain.connect(this.masterGain);
    }

    fundamental.start(now);
    overtone.start(now);

    const stopAt = endTime + 0.15;
    fundamental.stop(stopAt);
    overtone.stop(stopAt);

    fundamental.onended = () => {
      fundamental.disconnect();
      overtone.disconnect();
      overtoneGain.disconnect();
      swellFilter.disconnect();
      envGain.disconnect();
      panner?.disconnect();
    };
  }

  public updateSettings(nextSettings: AmbientAudioSettings): void {
    const clean = sanitizeAmbientAudioSettings(nextSettings);
    const presetChanged = clean.preset !== this.settings.preset;
    this.settings = clean;

    if (!this.running || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const preset = AMBIENT_AUDIO_PRESETS[clean.preset];
    const cutoffHz = computeFilterCutoffHz(clean.warmth, clean.preset);

    this.masterGain.gain.setTargetAtTime(this.computeMasterTargetGain(), now, 0.08);

    if (this.bedFilter) {
      this.bedFilter.frequency.setTargetAtTime(cutoffHz, now, 0.35);
    }
    if (this.bedFilterLfoGain) {
      this.bedFilterLfoGain.gain.setTargetAtTime(Math.max(35, cutoffHz * 0.24), now, 0.35);
    }

    const voiceGainWeights = [0.46, 0.34, 0.2];
    this.droneVoices.forEach((voice, idx) => {
      const targetFreq = preset.droneFrequenciesHz[idx] ?? preset.droneFrequenciesHz[0];
      const baseLevel = preset.droneGainScale * (voiceGainWeights[idx] ?? 0.25);
      voice.osc.frequency.setTargetAtTime(targetFreq, now, presetChanged ? 0.9 : 0.25);
      voice.gain.gain.setTargetAtTime(baseLevel, now, 0.45);
      voice.lfoGain.gain.setTargetAtTime(baseLevel * 0.22, now, 0.45);
    });

    if (this.noiseBandFilter) {
      this.noiseBandFilter.frequency.setTargetAtTime(preset.textureBandHz, now, 0.5);
    }
    if (this.noiseLowFilter) {
      this.noiseLowFilter.frequency.setTargetAtTime(Math.max(240, cutoffHz * 1.15), now, 0.4);
    }
    if (this.noiseGain) {
      this.noiseGain.gain.setTargetAtTime(
        preset.textureGainScale * (0.45 + clean.density * 0.75),
        now,
        0.35
      );
    }
    if (this.noiseLfoGain) {
      this.noiseLfoGain.gain.setTargetAtTime(preset.textureBandHz * 0.32, now, 0.5);
    }

    if (presetChanged) {
      this.lastSwellHz = null;
      this.scheduleNextSwell(850);
    }
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.emitActiveSwell(null);

    if (this.swellTimerId !== null) {
      clearTimeout(this.swellTimerId);
      this.swellTimerId = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(
        Math.max(0.0001, this.masterGain.gain.value),
        now
      );
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.75);

      this.stopCleanupTimerId = setTimeout(() => {
        if (!this.running) {
          this.tearDownGraph();
        }
        this.stopCleanupTimerId = null;
      }, 820);
    } else {
      this.tearDownGraph();
    }
  }

  /**
   * Returns normalized (0..1) acoustic energy bars from the live AnalyserNode.
   * Returns zeros when stopped.
   */
  public getSpectrumBars(barCount = 12): number[] {
    if (!this.running || !this.analyser || !this.frequencyScratch) {
      return Array.from({ length: barCount }, () => 0);
    }

    this.analyser.getByteFrequencyData(this.frequencyScratch);
    // At fftSize=1024 (~43 Hz/bin), bins 1..24 span ~43 Hz – 1035 Hz:
    // the exact sub-harmonic drone, glacial air, and crystalline swell range.
    const startBin = 1;
    const endBin = Math.min(25, this.frequencyScratch.length);
    const span = Math.max(1, endBin - startBin);
    const bars: number[] = [];

    for (let i = 0; i < barCount; i += 1) {
      const binPos = startBin + (i / Math.max(1, barCount - 1)) * (span - 1);
      const lowIdx = Math.floor(binPos);
      const highIdx = Math.min(this.frequencyScratch.length - 1, lowIdx + 1);
      const frac = binPos - lowIdx;
      const raw =
        this.frequencyScratch[lowIdx] * (1 - frac) +
        this.frequencyScratch[highIdx] * frac;
      // Gentle perceptual boost for upper harmonics so crystalline swells register clearly
      const highShelfBoost = 1 + (i / barCount) * 1.15;
      const normalized = Math.pow(raw / 255, 0.72) * highShelfBoost;
      bars.push(Number(clampNumber(normalized, 0.08, 1).toFixed(3)));
    }
    return bars;
  }

  public dispose(): void {
    this.running = false;
    if (this.stopCleanupTimerId !== null) {
      clearTimeout(this.stopCleanupTimerId);
      this.stopCleanupTimerId = null;
    }
    this.tearDownGraph();
    this.swellListeners.clear();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

/**
 * Plays a gentle, synthesized crystalline triad (D4 -> A4 -> F#5) using Web Audio API
 * to signal completion of a Pomodoro focus or break interval without external audio files.
 */
export function playGlacialCompletionChime(volume = 0.45): void {
  if (!isWebAudioSupported()) return;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const peakGain = clampNumber(volume, 0.08, 1) * 0.22;
    const notesHz = [293.66, 440.0, 739.99]; // D4, A4, F#5

    notesHz.forEach((hz, idx) => {
      const start = now + idx * 0.26;
      const osc = ctx.createOscillator();
      osc.type = idx === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, start);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peakGain * (idx === 2 ? 0.72 : 1), start + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 2.5);
    });

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 3600);
  } catch {
    // Ignore autoplay or audio hardware errors
  }
}

