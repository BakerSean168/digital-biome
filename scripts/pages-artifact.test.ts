import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';

test('Candidate compilation preserves the exact public/private invocation boundary', () => {
  const repo = fileURLToPath(new URL('../', import.meta.url));
  const workflow = parse(
    fs.readFileSync(path.join(repo, '.github/workflows/candidate-publish.yml'), 'utf8'),
  );
  const compile = workflow.jobs['build-candidate'].steps.find(
    (step: { name?: string }) =>
      step.name === 'Compile Pages Functions into the deployable artifact',
  );
  assert.equal(typeof compile?.run, 'string');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'biome-pages-artifact-'));
  try {
    fs.symlinkSync(path.join(repo, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    fs.mkdirSync(path.join(root, 'functions/notes/obsidian'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'functions/notes/obsidian/[[path]].js'),
      "export const onRequest = () => new Response('Not Found', { status: 404 });",
    );
    fs.mkdirSync(path.join(root, 'dist/notes/obsidian/public-note'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'dist/notes/obsidian/public-note/index.html'),
      '<h1>Public note</h1>',
    );
    const routes = JSON.stringify({
      version: 1,
      include: ['/api/*', '/notes/obsidian/protected-note*'],
      exclude: [],
    });
    fs.writeFileSync(path.join(root, 'dist/_routes.json'), routes);

    // Execute the real packaging step with the installed Wrangler: its default
    // manifest includes the broad tombstone handler and must never replace ours.
    execFileSync('bash', ['-c', compile.run], {
      cwd: root,
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdio: 'pipe',
    });
    assert.equal(fs.readFileSync(path.join(root, 'dist/_routes.json'), 'utf8'), routes);
    assert.ok(fs.statSync(path.join(root, 'dist/_worker.js')).size > 0);
    assert.equal(
      fs.readFileSync(path.join(root, 'dist/notes/obsidian/public-note/index.html'), 'utf8'),
      '<h1>Public note</h1>',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
