import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const palettes = {
  tui: readFileSync(new URL('../src/styles/terminal.css', import.meta.url), 'utf8'),
  gui: readFileSync(new URL('../src/styles/gui.css', import.meta.url), 'utf8'),
};

function colorToken(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i'));
  assert.ok(match, `Missing token ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const [mode, css] of Object.entries(palettes)) {
  test(`${mode} readable color tokens achieve WCAG AA on every defined content surface`, () => {
    for (const surface of ['bg', 'card', 'pane']) {
      for (const token of ['text-main', 'text-muted', 'text-tertiary', 'primary']) {
        const ratio = contrastRatio(colorToken(css, token), colorToken(css, surface));
        assert.ok(
          ratio >= 4.5,
          `${mode} ${token} on ${surface} contrast ${ratio.toFixed(2)}:1 < 4.5:1`,
        );
      }
    }
  });
  test(`${mode} primary focus indication meets 3:1 non-text contrast`, () => {
    for (const surface of ['bg', 'card', 'pane']) {
      assert.ok(contrastRatio(colorToken(css, 'primary'), colorToken(css, surface)) >= 3);
    }
  });
}
