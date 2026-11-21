import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverFormatTargets, runFormatCheck } from './check-format';

test('format discovery covers code, root settings and workflows without generated bindings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'db-format-check-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
    for (const relative of [
      'src/live.ts',
      'src/worker-configuration.d.ts',
      'tsconfig.json',
      '.github/workflows/check.yml',
    ]) {
      fs.writeFileSync(path.join(root, relative), '{}\n');
    }
    assert.deepEqual(discoverFormatTargets(root), [
      '.github/workflows/check.yml',
      'src/live.ts',
      'tsconfig.json',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('empty project fails closed instead of silently skipping formatting', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'db-empty-format-'));
  try {
    assert.throws(() => runFormatCheck(root), /No formatting targets/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
