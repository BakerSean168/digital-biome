import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { clearAstroContentCache } from './astro-content-cache';

test('clears generated Astro content state after a manual sync', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-astro-cache-'));
  const cacheDir = path.join(root, '.astro');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'content.db'), 'stale');

  assert.equal(clearAstroContentCache(root), true);
  assert.equal(fs.existsSync(cacheDir), false);
  assert.equal(clearAstroContentCache(root), false);
});
