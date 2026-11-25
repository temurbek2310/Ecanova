import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areSameTourSteps,
  clampTourStep,
  getPreferredTrack,
  getPreferredTrackKey,
  getTourCopy,
  getTourStorageKey,
  isTourCompleted,
  isTourTargetMeasurable,
  markTourCompleted,
  PREFERRED_TRACK_KEY,
  resetTour,
  resolveActiveSteps,
  resolveStepAfterRemoval,
  setPreferredTrack,
  shouldAutoStartTour,
  TOTAL_TOUR_STEPS,
  TOUR_COPY_EN,
  TOUR_STEPS,
  type TourCopy,
} from './product-tour';

// In-memory mock storage for node:test environment
const mockStorage = new Map<string, string>();
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, val: string) => mockStorage.set(key, String(val)),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    },
  };
}

test('product tour storage keys and persistence lifecycle', () => {
  mockStorage.clear();

  assert.equal(getTourStorageKey('user-123'), 'econova:product-tour:v1:user-123');
  assert.equal(getTourStorageKey(null), 'econova:product-tour:v1:guest');
  assert.equal(getTourStorageKey(''), 'econova:product-tour:v1:guest');

  assert.equal(isTourCompleted('user-123'), false);
  markTourCompleted('user-123');
  assert.equal(isTourCompleted('user-123'), true);

  resetTour('user-123');
  assert.equal(isTourCompleted('user-123'), false);
});

test('shouldAutoStartTour adheres to strict auto-launch conditions', () => {
  mockStorage.clear();
  const userId = 'user-456';

  // 1. Unauthenticated user should never auto-launch
  assert.equal(
    shouldAutoStartTour({
      isAuthenticated: false,
      activeTab: 'overview',
      userId,
      authModalOpen: false,
    }),
    false
  );

  // 2. Authenticated user on another tab (/catalog, /course) should not auto-launch
  assert.equal(
    shouldAutoStartTour({
      isAuthenticated: true,
      activeTab: 'catalog',
      userId,
      authModalOpen: false,
    }),
    false
  );

  // 3. Authenticated user on overview while auth modal is open should not auto-launch
  assert.equal(
    shouldAutoStartTour({
      isAuthenticated: true,
      activeTab: 'overview',
      userId,
      authModalOpen: true,
    }),
    false
  );

  // 4. Authenticated user on overview who has not completed the tour SHOULD auto-launch
  assert.equal(
    shouldAutoStartTour({
      isAuthenticated: true,
      activeTab: 'overview',
      userId,
      authModalOpen: false,
    }),
    true
  );

  // 5. Never stacks over another open overlay (cheat sheet, companion, level check)
  assert.equal(
    shouldAutoStartTour({
      isAuthenticated: true,
      activeTab: 'overview',
      userId,
      authModalOpen: false,
      otherOverlayOpen: true,
    }),
    false
  );

  // 6. Once marked completed, should never auto-launch again
  markTourCompleted(userId);
  assert.equal(
    shouldAutoStartTour({
      isAuthenticated: true,
      activeTab: 'overview',
      userId,
      authModalOpen: false,
    }),
    false
  );
});

test('clampTourStep clamps navigation within 1..5 bounds', () => {
  assert.equal(clampTourStep(0), 1);
  assert.equal(clampTourStep(-5), 1);
  assert.equal(clampTourStep(1), 1);
  assert.equal(clampTourStep(3), 3);
  assert.equal(clampTourStep(5), 5);
  assert.equal(clampTourStep(6), 5);
  assert.equal(clampTourStep(999), 5);
  assert.equal(clampTourStep(Number.NaN), 1);
  assert.equal(TOTAL_TOUR_STEPS, 5);
  assert.equal(TOUR_STEPS.length, 5);
  // Clamps to a smaller visible total when steps are skipped
  assert.equal(clampTourStep(5, 3), 3);
  assert.equal(clampTourStep(2, 3), 2);
  assert.equal(clampTourStep(4, 0), 1);
});

test('isTourTargetMeasurable rejects missing and zero-size (hidden) targets', () => {
  assert.equal(isTourTargetMeasurable(null), false);
  assert.equal(isTourTargetMeasurable(undefined), false);
  assert.equal(isTourTargetMeasurable({ width: 0, height: 0 }), false);
  assert.equal(isTourTargetMeasurable({ width: 120, height: 0 }), false);
  assert.equal(isTourTargetMeasurable({ width: 120, height: 40 }), true);
});

test('resolveActiveSteps keeps welcome and only steps whose targets are visible', () => {
  const all = resolveActiveSteps(() => true);
  assert.deepEqual(
    all.map((s) => s.id),
    ['welcome', 'daily-goal', 'catalog', 'toolkit', 'certificates']
  );

  // Mobile / empty catalog: catalog header and sidebar certificates are not rendered
  const mobile = resolveActiveSteps((s) => s.id !== 'catalog' && s.id !== 'certificates');
  assert.deepEqual(mobile.map((s) => s.id), ['welcome', 'daily-goal', 'toolkit']);

  // Nothing mounted: the welcome step still shows
  const none = resolveActiveSteps(() => false);
  assert.deepEqual(none.map((s) => s.id), ['welcome']);

  assert.equal(areSameTourSteps(all, resolveActiveSteps(() => true)), true);
  assert.equal(areSameTourSteps(all, mobile), false);
});

test('resolveStepAfterRemoval advances to the next remaining step, else the last one', () => {
  const withoutCatalog = resolveActiveSteps((s) => s.id !== 'catalog');
  assert.equal(resolveStepAfterRemoval(withoutCatalog, 'catalog'), 'toolkit');
  assert.equal(resolveStepAfterRemoval(withoutCatalog, 'daily-goal'), 'daily-goal');

  const onlyEarly = resolveActiveSteps((s) => s.id === 'daily-goal');
  assert.equal(resolveStepAfterRemoval(onlyEarly, 'certificates'), 'daily-goal');

  const none = resolveActiveSteps(() => false);
  assert.equal(resolveStepAfterRemoval(none, 'toolkit'), 'welcome');
});

test('preferred track selection persistence', () => {
  mockStorage.clear();
  assert.equal(getPreferredTrack(), null);

  setPreferredTrack('Economics');
  assert.equal(getPreferredTrack(), 'Economics');

  setPreferredTrack('Mathematics');
  assert.equal(getPreferredTrack(), 'Mathematics');

  setPreferredTrack('Business');
  assert.equal(getPreferredTrack(), 'Business');
});

test('preferred track is stored per user, with a one-way fallback to the legacy global key', () => {
  mockStorage.clear();
  assert.equal(getPreferredTrackKey('user-a'), `${PREFERRED_TRACK_KEY}:user-a`);
  assert.equal(getPreferredTrackKey(null), PREFERRED_TRACK_KEY);

  // Legacy value written by earlier builds is still honoured
  mockStorage.set(PREFERRED_TRACK_KEY, 'Mathematics');
  assert.equal(getPreferredTrack('user-a'), 'Mathematics');

  // Per-user choices no longer leak between accounts on the same browser
  setPreferredTrack('Business', 'user-a');
  setPreferredTrack('Economics', 'user-b');
  assert.equal(getPreferredTrack('user-a'), 'Business');
  assert.equal(getPreferredTrack('user-b'), 'Economics');
  assert.equal(mockStorage.get(PREFERRED_TRACK_KEY), 'Mathematics', 'legacy key is not overwritten');

  // Junk values are ignored
  mockStorage.set(getPreferredTrackKey('user-c'), 'Astrology');
  mockStorage.delete(PREFERRED_TRACK_KEY);
  assert.equal(getPreferredTrack('user-c'), null);
});

test('tour copy has identical keys in EN, UZ and RU, and mentions the Level Check', () => {
  const shape = (copy: TourCopy) => {
    const keys: string[] = [];
    const walk = (obj: unknown, prefix: string) => {
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) walk(v, prefix ? `${prefix}.${k}` : k);
      } else {
        keys.push(prefix);
      }
    };
    walk(copy, '');
    return keys.sort();
  };
  const enShape = shape(TOUR_COPY_EN);
  assert.deepEqual(shape(getTourCopy('uz')), enShape);
  assert.deepEqual(shape(getTourCopy('ru')), enShape);

  for (const copy of [getTourCopy('en'), getTourCopy('uz'), getTourCopy('ru')]) {
    for (const value of [copy.dialogLabel, copy.closeLabel, copy.keyHints, copy.openLabel, copy.launch]) {
      assert.ok(value.trim().length > 0);
    }
    assert.ok(copy.replayCard.title && copy.replayCard.description && copy.replayCard.button);
    // Telemetry tags no longer embed fixed step numbers (steps can be skipped)
    for (const step of Object.values(copy.steps)) {
      assert.doesNotMatch(step.telemetryTag, /\d/);
    }
  }

  assert.match(getTourCopy('en').steps.catalog.description, /2-minute Level Check/);
  assert.match(getTourCopy('uz').steps.catalog.description, /2 daqiqalik daraja testi/);
  assert.match(getTourCopy('ru').steps.catalog.description, /2-минутная проверка уровня/);
  assert.equal(getTourCopy('uz').targetActive, 'NISHON // FAOL');
});

test('getTourCopy returns localized copy for EN, UZ, and RU', () => {
  const en = getTourCopy('en');
  const uz = getTourCopy('uz');
  const ru = getTourCopy('ru');

  // English
  assert.equal(en.steps.welcome.title, 'Welcome to ECONOVA');
  assert.equal(en.tracks.Economics.label, 'Economics');
  assert.equal(en.finish, 'Start Learning');

  // Uzbek
  assert.equal(uz.steps.welcome.title, 'ECONOVA ga xush kelibsiz');
  assert.equal(uz.tracks.Economics.label, 'Iqtisodiyot');
  assert.equal(uz.finish, 'O‘qishni boshlash');

  // Russian
  assert.equal(ru.steps.welcome.title, 'Добро пожаловать в ECONOVA');
  assert.equal(ru.tracks.Economics.label, 'Экономика');
  assert.equal(ru.finish, 'Начать обучение');

  // All 5 steps exist in every language
  for (const copy of [en, uz, ru]) {
    assert.ok(copy.steps.welcome.description);
    assert.ok(copy.steps['daily-goal'].description);
    assert.ok(copy.steps.catalog.description);
    assert.ok(copy.steps.toolkit.description);
    assert.ok(copy.steps.certificates.description);
    assert.ok(copy.tracks.Economics);
    assert.ok(copy.tracks.Mathematics);
    assert.ok(copy.tracks.Business);
    assert.ok(copy.badgeTemplate.includes('{current}'));
    assert.ok(copy.badgeTemplate.includes('{total}'));
  }
});
