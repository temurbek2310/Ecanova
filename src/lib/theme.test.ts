import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextTheme, resolveInitialTheme } from './theme';

test('resolveInitialTheme defaults to dark mode unless light is stored', () => {
  assert.equal(resolveInitialTheme(null), 'dark');
  assert.equal(resolveInitialTheme(undefined), 'dark');
  assert.equal(resolveInitialTheme('dark'), 'dark');
  assert.equal(resolveInitialTheme('invalid'), 'dark');
  assert.equal(resolveInitialTheme('light'), 'light');
});

test('getNextTheme toggles cleanly between dark and high-contrast light', () => {
  assert.equal(getNextTheme('dark'), 'light');
  assert.equal(getNextTheme('light'), 'dark');
});
