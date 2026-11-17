import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSectionDividerMeta } from './section-divider';

test('buildSectionDividerMeta maps Economics, Mathematics, and Business in EN and UZ', () => {
  const econ = buildSectionDividerMeta({ subject: 'Economics', locale: 'en' });
  assert.equal(econ.badgeLabel, 'Economics');
  assert.equal(econ.sectionCode, '01');
  assert.equal(econ.accentDotClass, 'bg-theme-cyan');

  const math = buildSectionDividerMeta({ subject: 'Mathematics', locale: 'en' });
  assert.equal(math.badgeLabel, 'Mathematics');
  assert.equal(math.sectionCode, '02');
  assert.equal(math.accentDotClass, 'bg-theme-accent');

  const bizUz = buildSectionDividerMeta({
    subject: 'Business',
    locale: 'uz',
    indexLabel: '03',
  });
  assert.equal(bizUz.badgeLabel, 'Biznes');
  assert.equal(bizUz.sectionCode, '03');
  assert.equal(bizUz.accentDotClass, 'bg-theme-emerald');
  assert.ok(bizUz.ariaLabel.includes('Biznes'));
});
