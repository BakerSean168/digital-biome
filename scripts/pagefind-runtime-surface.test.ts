import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertPagefindRuntimeSurface,
  PAGEFIND_GENERATED_UI_FILES,
  prunePagefindGeneratedUi,
} from './pagefind-runtime-surface';

function fixture(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-pagefind-'));
  for (const name of ['pagefind.js', 'pagefind-entry.json', 'wasm.unknown.pagefind', ...PAGEFIND_GENERATED_UI_FILES]) {
    fs.writeFileSync(path.join(directory, name), name);
  }
  fs.writeFileSync(path.join(directory, 'pagefind.zh_test.pf_meta'), 'index');
  return directory;
}

test('prunes only generated Pagefind UI/highlight artifacts', () => {
  const directory = fixture();
  try {
    const result = prunePagefindGeneratedUi(directory);
    assert.deepEqual(result.removedFiles, [...PAGEFIND_GENERATED_UI_FILES]);
    assert.ok(result.removedBytes > 0);
    assert.doesNotThrow(() => assertPagefindRuntimeSurface(directory));
    assert.equal(fs.existsSync(path.join(directory, 'pagefind.js')), true);
    assert.equal(fs.existsSync(path.join(directory, 'wasm.unknown.pagefind')), true);
    assert.equal(fs.existsSync(path.join(directory, 'pagefind.zh_test.pf_meta')), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('runtime surface fails closed when the search runtime is missing', () => {
  const directory = fixture();
  try {
    prunePagefindGeneratedUi(directory);
    fs.rmSync(path.join(directory, 'pagefind.js'));
    assert.throws(() => assertPagefindRuntimeSurface(directory), /Required Pagefind runtime file/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
