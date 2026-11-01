import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverAstroFiles, lintAstroScripts } from './lint-astro-scripts';

test('Astro script extraction catches a real unused variable with the pinned Oxlint binary', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-astro-lint-test-'));
  try {
    const file = path.join(directory, 'invalid.astro');
    fs.writeFileSync(
      file,
      '---\nconst heading = "test";\n---\n<div>{heading}</div>\n<script lang="ts">\n  const unusedDiagnosticProbe = 7;\n</script>\n',
    );
    assert.throws(() => lintAstroScripts([file]), /unusedDiagnosticProbe/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Astro script extraction accepts valid inline scripts and does not lint markup text', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-astro-lint-test-'));
  try {
    const file = path.join(directory, 'valid.astro');
    fs.writeFileSync(
      file,
      '---\nconst heading = "test";\n---\n<p>{heading}</p>\n<script is:inline>\n  const value = 3;\n  console.log(value);\n</script>\n',
    );
    assert.equal(lintAstroScripts([file]), 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Astro lint always discovers the current production script surface', () => {
  const scripts = lintAstroScripts(discoverAstroFiles(process.cwd()));
  assert.ok(scripts >= 10, 'expected existing interactive Astro script blocks');
});
