import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (file: string): string => fs.readFileSync(path.resolve(file), 'utf8');

test('PersonalSystemsHub serves public-only markup with one lazy owner controller', () => {
  const shell = read('src/components/assets/PersonalSystemsHub.astro');
  assert.match(shell, /getPublicSystemDomains|data-systems-access-action/);
  assert.match(shell, /data-owner-domain-gate/);
  assert.match(shell, /initOwnerSystems\(\)/);
  assert.match(shell, /event\.persisted/);
  assert.doesNotMatch(shell, /fetch\(|OwnerSystemsPayload|ownerSystemDomains/);
  assert.doesNotMatch(shell, /api\/private\/(?:session|systems)/);
  assert.ok(shell.split('\n').length < 350);
});

test('protected catalog remains a separate Access-middleware guarded Pages Function', () => {
  const middleware = read('functions/api/private/_middleware.ts');
  const handler = read('functions/api/private/systems.ts');
  const session = read('functions/api/private/session.ts');
  assert.match(middleware, /verifyAccessRequest/);
  assert.match(middleware, /context\.next\(\)/);
  assert.match(handler, /ownerSystemDomains\(/);
  assert.match(handler, /'Cache-Control': 'private, no-store'/);
  assert.match(session, /authenticated: true/);
  assert.doesNotMatch(session, /accessIdentity\.(?:email|name)/);
});

test('owner controller does not place protected payloads into SSR, localStorage, logs or history', () => {
  const controller = read('src/browser/owner-systems.ts');
  const data = read('src/browser/owner-systems-data.ts');
  const view = read('src/browser/owner-systems-view.ts');
  assert.match(data, /redirect: 'manual'/);
  assert.match(data, /credentials: 'same-origin'/);
  assert.match(data, /cache: 'no-store'/);
  assert.match(data, /parseOwnerSystemsPayload/);
  assert.match(controller, /pagehide/);
  assert.match(controller, /clearOwnerSystems/);
  assert.match(view, /doc\.createElement/);
  assert.doesNotMatch(
    controller + data + view,
    /localStorage|sessionStorage|history\.replaceState|console\./,
  );
  assert.doesNotMatch(controller + data + view, /innerHTML\s*=/);
});
