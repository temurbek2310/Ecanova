import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getShortcutLabelForTab,
  isEditableElementTarget,
  resolveNavigationShortcut,
} from './keyboard-shortcuts';

test('resolveNavigationShortcut maps section keys case-insensitively', () => {
  assert.equal(resolveNavigationShortcut({ key: 'g' }), 'overview');
  assert.equal(resolveNavigationShortcut({ key: 'G' }), 'overview');
  assert.equal(resolveNavigationShortcut({ key: 'c' }), 'catalog');
  assert.equal(resolveNavigationShortcut({ key: 'C' }), 'catalog');
  assert.equal(resolveNavigationShortcut({ key: 'x' }), 'achievements');
  assert.equal(resolveNavigationShortcut({ key: 'l' }), 'community');
  assert.equal(resolveNavigationShortcut({ key: 'v' }), 'certificates');
  assert.equal(resolveNavigationShortcut({ key: 'p' }), 'profile');
  assert.equal(resolveNavigationShortcut({ key: 'P' }), 'profile');
  assert.equal(resolveNavigationShortcut({ key: 'a', isStaff: false }), null);
  assert.equal(resolveNavigationShortcut({ key: 'a', isStaff: true }), 'admin');
  assert.equal(resolveNavigationShortcut({ key: 'q' }), null);
});

test('resolveNavigationShortcut ignores modified, repeated, input-focused, and dialog events', () => {
  assert.equal(resolveNavigationShortcut({ key: 'c', ctrlKey: true }), null);
  assert.equal(resolveNavigationShortcut({ key: 'g', metaKey: true }), null);
  assert.equal(resolveNavigationShortcut({ key: 'p', altKey: true }), null);
  assert.equal(resolveNavigationShortcut({ key: 'g', repeat: true }), null);
  assert.equal(resolveNavigationShortcut({ key: 'c', defaultPrevented: true }), null);
  assert.equal(resolveNavigationShortcut({ key: 'p', isEditableTarget: true }), null);
  assert.equal(resolveNavigationShortcut({ key: 'g', hasOpenDialog: true }), null);
});

test('isEditableElementTarget and getShortcutLabelForTab handle DOM targets and tab labels cleanly', () => {
  assert.equal(isEditableElementTarget({ tagName: 'INPUT' }), true);
  assert.equal(isEditableElementTarget({ tagName: 'textarea' }), true);
  assert.equal(isEditableElementTarget({ tagName: 'SELECT' }), true);
  assert.equal(isEditableElementTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableElementTarget({ tagName: 'BUTTON', isContentEditable: false }), false);
  assert.equal(getShortcutLabelForTab('overview'), 'G');
  assert.equal(getShortcutLabelForTab('catalog'), 'C');
  assert.equal(getShortcutLabelForTab('profile'), 'P');
  assert.equal(getShortcutLabelForTab('course'), null);
});
