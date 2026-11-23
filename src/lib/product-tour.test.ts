import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTourStep,
  getPreferredTrack,
  getTourCopy,
  getTourStorageKey,
  isTourCompleted,
  markTourCompleted,
  resetTour,
  setPreferredTrack,
  shouldAutoStartTour,
  TOTAL_TOUR_STEPS,
  TOUR_STEPS,
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

  // 5. Once marked completed, should never auto-launch again
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
