import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTIFACT_BORDER_STROKE,
  ARTIFACT_SURFACE_FILL,
  BENTO_HOVER_PHYSICS,
  clampNormalizedPointer,
  computeArtifactParallaxOffset,
  normalizeViewportPointer,
  PRIMARY_ARTIFACT_ACCENT_COLORS,
  resolveArtifactShadowStyle,
  resolveBusinessModuleWatermark,
  resolveCourseWatermarkArtifact,
  SUBJECT_ARTIFACT_SPECS,
} from './subject-artifacts';

test('SUBJECT_ARTIFACT_SPECS covers Mathematics, Economics, and Business with required artifact kinds', () => {
  const subjects = new Set(SUBJECT_ARTIFACT_SPECS.map((s) => s.subject));
  assert.deepEqual(subjects, new Set(['Mathematics', 'Economics', 'Business']));

  const kinds = new Set(SUBJECT_ARTIFACT_SPECS.map((s) => s.kind));
  const expectedKinds = [
    'icosahedron',
    'sigma-symbol',
    'integral-symbol',
    'drafting-compass',
    'candlesticks',
    'line-graph',
    'network-nodes',
    'chess-knight',
    'bento-grid',
    'briefcase',
  ];
  for (const kind of expectedKinds) {
    assert.ok(kinds.has(kind as (typeof SUBJECT_ARTIFACT_SPECS)[number]['kind']), `Missing kind ${kind}`);
  }
});

test('computeArtifactParallaxOffset moves near-depth items farther than far-depth items', () => {
  const nearOffset = computeArtifactParallaxOffset({
    normalizedPointerX: 0.8,
    normalizedPointerY: -0.5,
    depth: 0.96,
  });
  const farOffset = computeArtifactParallaxOffset({
    normalizedPointerX: 0.8,
    normalizedPointerY: -0.5,
    depth: 0.24,
  });

  assert.ok(Math.abs(nearOffset.x) > Math.abs(farOffset.x) * 3);
  assert.ok(Math.abs(nearOffset.y) > Math.abs(farOffset.y) * 3);
  assert.ok(nearOffset.x > 0 && nearOffset.y < 0);
});

test('normalizeViewportPointer and clampNormalizedPointer stay within [-1, 1]', () => {
  assert.equal(clampNormalizedPointer(5), 1);
  assert.equal(clampNormalizedPointer(-4), -1);
  assert.equal(clampNormalizedPointer(Number.NaN), 0);

  assert.deepEqual(normalizeViewportPointer(720, 450, 1440, 900), { x: 0, y: 0 });
  assert.deepEqual(normalizeViewportPointer(1440, 0, 1440, 900), { x: 1, y: -1 });
});

test('resolveArtifactShadowStyle uses dynamic Neobrutalist theme tokens with unblurred drop shadows', () => {
  assert.equal(ARTIFACT_SURFACE_FILL, 'var(--econova-surface)');
  assert.equal(ARTIFACT_BORDER_STROKE, 'var(--econova-line)');

  const mathShadow = resolveArtifactShadowStyle({ depth: 0.9, accentToken: 'accent' });
  assert.equal(mathShadow.shadowOffsetPx, 6);
  assert.equal(mathShadow.accentColorVar, 'var(--econova-accent)');
  assert.equal(mathShadow.dropShadowFilter, 'drop-shadow(6px 6px 0px var(--econova-accent))');

  const econShadow = resolveArtifactShadowStyle({ depth: 0.5, accentToken: 'teal' });
  assert.equal(econShadow.shadowOffsetPx, 4);
  assert.equal(econShadow.dropShadowFilter, 'drop-shadow(4px 4px 0px var(--econova-teal))');

  const bizShadow = resolveArtifactShadowStyle({ depth: 0.25, accentToken: 'success' });
  assert.equal(bizShadow.shadowOffsetPx, 3);
  assert.equal(bizShadow.dropShadowFilter, 'drop-shadow(3px 3px 0px var(--econova-success))');
});

test('embedded card watermark resolvers map modules and courses to primary accent colors', () => {
  const mod1 = resolveBusinessModuleWatermark('unit-economics', 0);
  assert.equal(mod1.kind, 'chess-knight');
  assert.equal(mod1.accentColor, PRIMARY_ARTIFACT_ACCENT_COLORS.purple);

  const mod2 = resolveBusinessModuleWatermark('cash-conversion', 1);
  assert.equal(mod2.kind, 'bento-grid');
  assert.equal(mod2.accentColor, PRIMARY_ARTIFACT_ACCENT_COLORS.cyan);

  const mod3 = resolveBusinessModuleWatermark('capital-allocation', 2);
  assert.equal(mod3.kind, 'briefcase');
  assert.equal(mod3.accentColor, PRIMARY_ARTIFACT_ACCENT_COLORS.green);

  const math0 = resolveCourseWatermarkArtifact('Mathematics', 0);
  assert.equal(math0.kind, 'icosahedron');
  assert.equal(math0.accentColor, PRIMARY_ARTIFACT_ACCENT_COLORS.purple);

  const econ0 = resolveCourseWatermarkArtifact('Economics', 0);
  assert.equal(econ0.kind, 'candlesticks');
  assert.equal(econ0.accentColor, PRIMARY_ARTIFACT_ACCENT_COLORS.cyan);

  assert.equal(BENTO_HOVER_PHYSICS.hover.scale, 1.02);
  assert.equal(BENTO_HOVER_PHYSICS.hover.y, -5);
  assert.equal(BENTO_HOVER_PHYSICS.hover.boxShadow, '14px 14px 0px #000000');
  assert.equal(BENTO_HOVER_PHYSICS.hover.svgRotation, 15);
  assert.equal(BENTO_HOVER_PHYSICS.hover.svgScale, 1.1);
  assert.equal(BENTO_HOVER_PHYSICS.hover.ease, 'power2.out');
});

