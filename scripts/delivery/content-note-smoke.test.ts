import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

test('content promotion fails on a public detail 404 even when indexes are healthy', () => {
  const workflow = parse(
    fs.readFileSync(new URL('../../.github/workflows/deploy-content.yml', import.meta.url), 'utf8'),
  );
  const steps = Object.values(workflow.jobs).flatMap(
    (job) => (job as { steps: { name?: string; run?: string }[] }).steps,
  );
  const script = steps.find(
    (step) => step.name === 'Verify public pages and protected boundary',
  )?.run;
  assert.ok(script);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'biome-content-smoke-'));
  try {
    fs.mkdirSync(path.join(root, 'bin'));
    fs.mkdirSync(path.join(root, 'release-package/dist/notes/obsidian/public-note'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, 'release-package/dist/notes/obsidian/public-note/index.html'),
      '<h1>Public note</h1>',
    );
    fs.writeFileSync(
      path.join(root, 'bin/curl'),
      `#!/bin/bash
set -eu
case "$*" in
  *api/private/infrastructure*) printf '401' ;;
  *notes/obsidian/public-note*) test "$NOTE_STATUS" = 200 || exit 22 ;;
esac
`,
      { mode: 0o755 },
    );
    const run = (status: string) =>
      execFileSync('bash', ['-c', script], {
        cwd: root,
        timeout: 10_000,
        maxBuffer: 64 * 1024,
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: `${path.join(root, 'bin')}:${process.env.PATH}`,
          RUNNER_TEMP: root,
          PRODUCTION_URL: 'https://biome.example.test',
          NOTE_STATUS: status,
        },
      });
    assert.throws(() => run('404'));
    assert.doesNotThrow(() => run('200'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
