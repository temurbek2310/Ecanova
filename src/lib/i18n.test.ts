import assert from 'node:assert/strict';
import test from 'node:test';
import enMessages from '../messages/en.json';
import uzMessages from '../messages/uz.json';
import {
  formatCourseMetaSummary,
  formatTemplate,
  parseCookieLocale,
  parsePathnameOrSearchLocale,
  resolveInitialLocale,
  t,
  UI_STRINGS,
} from './i18n';

function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const nextPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeyPaths(v as Record<string, unknown>, nextPath));
    } else {
      keys.push(nextPath);
    }
  }
  return keys.sort();
}

test('en.json and uz.json have 100% identical key structures', () => {
  const enKeys = collectKeyPaths(enMessages as unknown as Record<string, unknown>);
  const uzKeys = collectKeyPaths(uzMessages as unknown as Record<string, unknown>);
  assert.deepEqual(uzKeys, enKeys);
  assert.ok(enKeys.length > 150, `Expected comprehensive dictionary (>150 keys), got ${enKeys.length}`);
});

test('uz.json translates core UI sections and creative component strings into Uzbek', () => {
  const uz = t('uz');
  const en = t('en');

  assert.equal(uz.nav.overview, 'Bosh sahifa');
  assert.equal(uz.nav.catalog, 'Kurslar');
  assert.equal(uz.kinetic.line1, 'TIZIMLI');
  assert.equal(uz.kinetic.line1Accent, 'MAHORAT.');
  assert.equal(uz.kinetic.line2Outline, 'MIQYOSLI');
  assert.equal(uz.kinetic.line2Solid, 'ANIQLIK');
  assert.equal(uz.kinetic.telemetry.activeCourses, 'Faol kurslar');
  assert.equal(uz.economics.cyanFlowField, 'Moviy oqim maydoni');
  assert.equal(uz.economics.equilibriumVector, 'Muvozanat vektori');
  assert.equal(uz.mathematics.badgeChalkSvg, 'Bo‘r chizmasi SVG');
  assert.equal(uz.business.badgeBentoGrid, '12 ustunli Bento to‘r');
  assert.notEqual(uz.profile.title, en.profile.title);
  assert.notEqual(uz.auth.signInTitle, en.auth.signInTitle);
  assert.notEqual(uz.certificates.verifyTitle, en.certificates.verifyTitle);
});

test('formatCourseMetaSummary and formatTemplate localize lesson/minute/pass metadata', () => {
  assert.equal(
    formatCourseMetaSummary(4, 45, 75, 'en'),
    '4 lessons · 45 min · Pass 75%'
  );
  assert.equal(
    formatCourseMetaSummary(4, 45, 75, 'uz'),
    '4 dars · 45 daq · O‘tish 75%'
  );
  assert.equal(
    formatTemplate(UI_STRINGS.uz.assessment.scoreSummary, {
      scorePercent: 85,
      correctCount: 17,
      totalQuestions: 20,
    }),
    'Natija: 85% (17/20 to‘g‘ri)'
  );
});

test('resolveInitialLocale prioritizes URL query/path, then localStorage, then cookies, then en', () => {
  assert.equal(
    resolveInitialLocale({
      pathname: '/uz/courses',
      search: '',
      storageValue: 'en',
      cookieString: 'NEXT_LOCALE=en',
    }),
    'uz'
  );

  assert.equal(
    resolveInitialLocale({
      pathname: '/',
      search: '?lang=uz',
      storageValue: 'en',
      cookieString: 'NEXT_LOCALE=en',
    }),
    'uz'
  );

  assert.equal(
    resolveInitialLocale({
      pathname: '/',
      search: '',
      storageValue: 'uz',
      cookieString: 'NEXT_LOCALE=en',
    }),
    'uz'
  );

  assert.equal(
    resolveInitialLocale({
      pathname: '/',
      search: '',
      storageValue: null,
      cookieString: 'foo=bar; NEXT_LOCALE=uz',
    }),
    'uz'
  );

  assert.equal(
    resolveInitialLocale({
      pathname: '/',
      search: '',
      storageValue: null,
      cookieString: '',
    }),
    'en'
  );

  assert.equal(parseCookieLocale('econova_locale=uz; theme=dark'), 'uz');
  assert.equal(parsePathnameOrSearchLocale('/en', ''), 'en');
});
