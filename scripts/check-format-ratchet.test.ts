import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyFormatTargets, hashFile, type FormatDebtBaseline } from './check-format-ratchet';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-format-ratchet-'));
}

test('grandfathers only the exact legacy bytes recorded in the baseline', () => {
  const root = tempRoot();
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'legacy.ts'), 'const  x=1\n');
    fs.writeFileSync(path.join(root, 'src', 'new.ts'), 'const x = 1;\n');
    const baseline: FormatDebtBaseline = {
      version: 1,
      files: { 'src/legacy.ts': hashFile(path.join(root, 'src', 'legacy.ts')) },
    };

    assert.deepEqual(classifyFormatTargets(root, ['src/legacy.ts', 'src/new.ts'], baseline), {
      grandfathered: ['src/legacy.ts'],
      changedLegacy: [],
      mustCheck: ['src/new.ts'],
      staleBaseline: [],
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('forces changed legacy files through formatting and baseline graduation', () => {
  const root = tempRoot();
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'legacy.ts'), 'const x = 2;\n');
    const baseline: FormatDebtBaseline = {
      version: 1,
      files: { 'src/legacy.ts': '0'.repeat(64) },
    };

    assert.deepEqual(classifyFormatTargets(root, ['src/legacy.ts'], baseline), {
      grandfathered: [],
      changedLegacy: ['src/legacy.ts'],
      mustCheck: ['src/legacy.ts'],
      staleBaseline: [],
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('project-pinned Oxfmt owns formatting while preserving the SHA format debt ratchet', () => {
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const configuration = JSON.parse(
    fs.readFileSync(path.join(projectRoot, '.oxfmtrc.json'), 'utf8'),
  ) as {
    printWidth: number;
    singleQuote: boolean;
    astro: object;
    sortPackageJson: boolean;
  };
  const ratchet = fs.readFileSync(
    path.join(projectRoot, 'scripts/check-format-ratchet.ts'),
    'utf8',
  );

  assert.equal(manifest.devDependencies.oxfmt, '0.75.0');
  assert.equal(manifest.devDependencies['@astrojs/compiler-rs'], '0.5.2');
  assert.equal(manifest.scripts['format:check'], 'tsx scripts/check-format-ratchet.ts');
  assert.equal(configuration.printWidth, 100);
  assert.equal(configuration.singleQuote, true);
  assert.equal(configuration.sortPackageJson, false);
  assert.ok(configuration.astro);
  assert.match(ratchet, /'oxfmt'/);
  assert.doesNotMatch(ratchet, /'prettier'/);
  assert.match(ratchet, /classifyFormatTargets/);
});
