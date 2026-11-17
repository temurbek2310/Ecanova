import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonShareData, buildProgressShareData } from './share-progress';

test('buildProgressShareData formats daily XP and streak without exposing PII', () => {
  const both = buildProgressShareData({
    xpToday: 75,
    currentStreak: 4,
    locale: 'en',
    url: 'https://econova.example',
  });
  assert.equal(both.title, 'ECONOVA · My Study Progress');
  assert.match(both.text, /\+75 non-cash XP today/);
  assert.match(both.text, /4-day study streak/);
  assert.equal(both.url, 'https://econova.example');

  const xpOnly = buildProgressShareData({
    xpToday: 25,
    currentStreak: 0,
    locale: 'en',
    url: 'https://econova.example',
  });
  assert.match(xpOnly.text, /\+25 non-cash XP today/);
  assert.doesNotMatch(xpOnly.text, /streak/);

  const streakOnly = buildProgressShareData({
    xpToday: 0,
    currentStreak: 5,
    locale: 'en',
    url: 'https://econova.example',
  });
  assert.match(streakOnly.text, /5-day study streak/);
});

test('buildProgressShareData supports Uzbek localization and clamps negative values', () => {
  const uz = buildProgressShareData({
    xpToday: -10,
    currentStreak: 3,
    locale: 'uz',
    url: 'https://econova.example',
  });
  assert.equal(uz.title, 'ECONOVA · O‘quv natijam');
  assert.match(uz.text, /3 kunlik/);
  assert.doesNotMatch(uz.text, /-/);
});

test('buildLessonShareData includes course name and lesson title in EN and UZ', () => {
  const en = buildLessonShareData({
    courseTitle: 'Foundations of Supply, Demand & Market Equilibrium',
    lessonTitle: 'Why Prices Move: Willingness to Pay & Demand',
    locale: 'en',
    url: 'https://econova.example/',
  });
  assert.equal(
    en.title,
    'Foundations of Supply, Demand & Market Equilibrium — Why Prices Move: Willingness to Pay & Demand'
  );
  assert.match(en.text, /Foundations of Supply, Demand & Market Equilibrium/);
  assert.match(en.text, /Why Prices Move: Willingness to Pay & Demand/);
  assert.equal(en.url, 'https://econova.example/');

  const uz = buildLessonShareData({
    courseTitle: 'Talab va taklif asoslari',
    lessonTitle: 'Narxlar nega o‘zgaradi',
    locale: 'uz',
    url: 'https://econova.example/',
  });
  assert.match(uz.text, /Talab va taklif asoslari/);
  assert.match(uz.text, /Narxlar nega o‘zgaradi/);
});
