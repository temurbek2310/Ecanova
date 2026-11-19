import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIENT_AUDIO_PRESETS,
  AMBIENT_AUDIO_STORAGE_KEY,
  AMBIENT_AUDIO_VOLUME_STORAGE_KEY,
  AMBIENT_PRESET_ORDER,
  DEFAULT_AMBIENT_AUDIO_SETTINGS,
  computeFilterCutoffHz,
  computeMasterGainForVolume,
  computeSwellIntervalMs,
  loadAmbientAudioSettings,
  loadAmbientAudioVolume,
  pickNextGlacialSwell,
  sanitizeAmbientAudioSettings,
  saveAmbientAudioSettings,
  saveAmbientAudioVolume,
  type StorageLike,
} from './ambient-audio.ts';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('ambient-audio pure generative logic', () => {
  it('defines all three glacial presets with valid drone and swell frequency pools', () => {
    assert.deepEqual(AMBIENT_PRESET_ORDER, [
      'glacial-drift',
      'deep-monolith',
      'crystalline-harmonics',
    ]);

    for (const presetId of AMBIENT_PRESET_ORDER) {
      const preset = AMBIENT_AUDIO_PRESETS[presetId];
      assert.equal(preset.droneFrequenciesHz.length, 3);
      assert.ok(preset.swellScaleHz.length >= 6);
      assert.ok(preset.filterRangeHz[0] < preset.filterRangeHz[1]);
      for (const hz of preset.droneFrequenciesHz) {
        assert.ok(hz >= 50 && hz <= 300, `drone ${hz}Hz should sit in warm sub-harmonic range`);
      }
    }
  });

  it('sanitizes out-of-range and malformed settings safely', () => {
    const sanitized = sanitizeAmbientAudioSettings({
      preset: 'unknown-preset' as never,
      volume: 99,
      warmth: -4,
      density: Number.NaN,
    });

    assert.equal(sanitized.preset, DEFAULT_AMBIENT_AUDIO_SETTINGS.preset);
    assert.equal(sanitized.volume, 1);
    assert.equal(sanitized.warmth, 0);
    assert.equal(sanitized.density, DEFAULT_AMBIENT_AUDIO_SETTINGS.density);

    const minVol = sanitizeAmbientAudioSettings({ volume: 0 });
    assert.equal(minVol.volume, 0);

    const fineVol = sanitizeAmbientAudioSettings({ volume: 0.37 });
    assert.equal(fineVol.volume, 0.37);
  });

  it('computes monotonic perceptual master gain reaching smooth silence at 0%', () => {
    const silent = computeMasterGainForVolume(0);
    const quiet = computeMasterGainForVolume(0.1);
    const mid = computeMasterGainForVolume(0.5);
    const full = computeMasterGainForVolume(1);

    assert.equal(silent, 0.0001);
    assert.ok(silent < quiet && quiet < mid && mid < full);
    assert.ok(full <= 0.6);
  });

  it('maps warmth logarithmically into each preset filter cutoff range', () => {
    for (const presetId of AMBIENT_PRESET_ORDER) {
      const [minHz, maxHz] = AMBIENT_AUDIO_PRESETS[presetId].filterRangeHz;
      const dark = computeFilterCutoffHz(0, presetId);
      const mid = computeFilterCutoffHz(0.5, presetId);
      const bright = computeFilterCutoffHz(1, presetId);

      assert.equal(dark, minHz);
      assert.equal(bright, maxHz);
      assert.ok(mid > dark && mid < bright);
      assert.ok(mid < (minHz + maxHz) / 2);
    }
  });

  it('shortens stochastic swell intervals as density rises', () => {
    const fixedRng = () => 0.5;
    const sparse = computeSwellIntervalMs(0, 'glacial-drift', fixedRng);
    const balanced = computeSwellIntervalMs(0.5, 'glacial-drift', fixedRng);
    const lush = computeSwellIntervalMs(1, 'glacial-drift', fixedRng);

    assert.ok(sparse > balanced && balanced > lush);
    assert.ok(lush >= 2500, 'even lush swells remain unhurried and glacial');
  });

  it('picks non-repeating, scale-accurate glacial swells with long envelopes and bounded pan', () => {
    let seed = 0.13;
    const deterministicRng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    let prevHz: number | null = null;
    const seen = new Set<number>();
    const scale = AMBIENT_AUDIO_PRESETS['glacial-drift'].swellScaleHz;

    for (let i = 0; i < 24; i += 1) {
      const swell = pickNextGlacialSwell('glacial-drift', prevHz, 0.55, deterministicRng);
      assert.ok(scale.includes(swell.frequencyHz), 'pitch must belong to preset scale');
      if (prevHz !== null) {
        assert.notEqual(swell.frequencyHz, prevHz, 'consecutive swells must not repeat immediately');
      }
      assert.ok(swell.attackSec >= 3.6 && swell.attackSec <= 7.5);
      assert.ok(swell.releaseSec >= 6.2 && swell.releaseSec <= 12.6);
      assert.ok(swell.pan >= -0.62 && swell.pan <= 0.62);
      assert.ok(swell.gain > 0 && swell.gain < 0.6);
      seen.add(swell.frequencyHz);
      prevHz = swell.frequencyHz;
    }

    assert.ok(seen.size >= 4, 'generative stream should explore multiple harmonic pitches');
  });

  it('persists and reloads settings cleanly and handles corrupt storage JSON', () => {
    const store = createMemoryStorage();
    saveAmbientAudioSettings(
      {
        preset: 'deep-monolith',
        volume: 0.68,
        warmth: 0.25,
        density: 0.8,
      },
      store
    );

    const loaded = loadAmbientAudioSettings(store);
    assert.deepEqual(loaded, {
      preset: 'deep-monolith',
      volume: 0.68,
      warmth: 0.25,
      density: 0.8,
    });

    assert.equal(loadAmbientAudioVolume(store), 0.68);

    // Dedicated volume preference update overrides persisted settings cleanly
    saveAmbientAudioVolume(0.23, store);
    assert.equal(loadAmbientAudioVolume(store), 0.23);
    assert.equal(loadAmbientAudioSettings(store).volume, 0.23);

    store.setItem(AMBIENT_AUDIO_STORAGE_KEY, '{corrupt-json');
    store.setItem(AMBIENT_AUDIO_VOLUME_STORAGE_KEY, 'not-a-number');
    const fallback = loadAmbientAudioSettings(store);
    assert.deepEqual(fallback, DEFAULT_AMBIENT_AUDIO_SETTINGS);
  });
});
