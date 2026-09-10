import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkPrivateRouteBoundary } from './private-route-boundary';

function fixtureIndex(privateFlag: boolean) {
  return {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    entries: [{
      id: 'obsidian/private-fixture',
      title: 'private fixture',
      tags: [],
      draft: false,
      private: privateFlag,
      visibility: privateFlag ? 'private' : 'public',
      type: 'note',
      aliases: [],
      isAsset: false,
      filePath: 'private-fixture.md',
    }],
  };
}

test('rejects a generated route for a protected knowledge note', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-route-boundary-'));
  const indexPath = path.join(root, 'notes-index.json');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'notes', 'obsidian', 'private-fixture'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'notes', 'obsidian', 'private-fixture', 'index.html'), '<html></html>');
  fs.writeFileSync(indexPath, JSON.stringify(fixtureIndex(true)));

  assert.throws(() => checkPrivateRouteBoundary(indexPath, dist), /1 protected note route/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('allows the same route when the note is public', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-route-boundary-'));
  const indexPath = path.join(root, 'notes-index.json');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'notes', 'obsidian', 'private-fixture'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'notes', 'obsidian', 'private-fixture', 'index.html'), '<html></html>');
  fs.writeFileSync(indexPath, JSON.stringify(fixtureIndex(false)));

  assert.deepEqual(checkPrivateRouteBoundary(indexPath, dist), { protectedKnowledgeNotes: 0, leakedRoutes: 0 });
  fs.rmSync(root, { recursive: true, force: true });
});
