import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
  scripts: Record<string, string>;
};
const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/check.yml', import.meta.url)), 'utf8');

test('verification discovers nested edge and infrastructure tests', () => {
  assert.equal(packageJson.scripts['test:edge'], "tsx --test 'edge/**/*.test.ts'");
  assert.equal(packageJson.scripts['test:infrastructure'], "tsx --test 'scripts/**/*.test.ts'");
});

test('the required check workflow runs for every pull request to main', () => {
  const pullRequestBlock = workflow.match(/  pull_request:\n[\s\S]*?(?=\n\nconcurrency:)/)?.[0];
  assert.ok(pullRequestBlock);
  assert.match(pullRequestBlock, /branches: \[main\]/);
  assert.doesNotMatch(pullRequestBlock, /paths:/);
});
