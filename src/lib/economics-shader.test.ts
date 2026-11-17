import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECONOMICS_LIQUID_FRAGMENT_SHADER,
  ECONOMICS_LIQUID_VERTEX_SHADER,
  ECONOMICS_SHADER_PALETTE,
  getEconomicsShaderPaletteForTheme,
  hexToNormalizedRgb,
  interpolateRgbTuple,
} from './economics-shader';

test('hexToNormalizedRgb converts ECONOVA dark slate, cyan, and green hex tokens accurately', () => {
  const slate = hexToNormalizedRgb('#080B14');
  assert.equal(slate.r, Number((8 / 255).toFixed(4)));
  assert.equal(slate.g, Number((11 / 255).toFixed(4)));
  assert.equal(slate.b, Number((20 / 255).toFixed(4)));

  const cyan = hexToNormalizedRgb('#5DE1D2');
  assert.equal(cyan.r, Number((93 / 255).toFixed(4)));
  assert.equal(cyan.g, Number((225 / 255).toFixed(4)));
  assert.equal(cyan.b, Number((210 / 255).toFixed(4)));

  const green = hexToNormalizedRgb('#6FE0A1');
  assert.equal(green.r, Number((111 / 255).toFixed(4)));
  assert.equal(green.g, Number((224 / 255).toFixed(4)));
  assert.equal(green.b, Number((161 / 255).toFixed(4)));
});

test('ECONOMICS_SHADER_PALETTE and GLSL shaders include 2D Simplex Noise and dynamic theme uniforms', () => {
  assert.equal(ECONOMICS_SHADER_PALETTE.baseSlateHex, '#080B14');
  assert.equal(ECONOMICS_SHADER_PALETTE.cyanAccentHex, '#5DE1D2');
  assert.equal(ECONOMICS_SHADER_PALETTE.greenAccentHex, '#6FE0A1');

  const lightPalette = getEconomicsShaderPaletteForTheme('light');
  assert.equal(lightPalette.baseSlateHex, '#F8FAFC');
  assert.equal(lightPalette.cyanAccentHex, '#0F766E');
  assert.equal(lightPalette.greenAccentHex, '#047857');

  const mid = interpolateRgbTuple(ECONOMICS_SHADER_PALETTE.baseSlateRgb, lightPalette.baseSlateRgb, 0.5);
  assert.ok(mid.r > ECONOMICS_SHADER_PALETTE.baseSlateRgb.r && mid.r < lightPalette.baseSlateRgb.r);

  assert.ok(ECONOMICS_LIQUID_VERTEX_SHADER.includes('varying vec2 vUv'));
  assert.ok(ECONOMICS_LIQUID_FRAGMENT_SHADER.includes('float snoise(vec2 v)'));
  assert.ok(ECONOMICS_LIQUID_FRAGMENT_SHADER.includes('uniform vec3 u_colorA'));
  assert.ok(ECONOMICS_LIQUID_FRAGMENT_SHADER.includes('uniform vec3 u_colorB'));
  assert.ok(ECONOMICS_LIQUID_FRAGMENT_SHADER.includes('uniform vec3 u_colorC'));
  assert.ok(ECONOMICS_LIQUID_FRAGMENT_SHADER.includes('uniform vec3 uColorBase'));
  assert.ok(ECONOMICS_LIQUID_FRAGMENT_SHADER.includes('uniform vec3 uColorCyan'));
  assert.ok(ECONOMICS_LIQUID_FRAGMENT_SHADER.includes('uniform vec3 uColorGreen'));
});
