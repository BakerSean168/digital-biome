import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as getAiUsage } from '../functions/api/ai-usage';
import { onRequest as getServers } from '../functions/api/servers';
import { onRequest as getVisitorIp } from '../functions/api/visitor-ip';

test('AI usage reports missing configuration instead of returning sample telemetry', async () => {
  const response = await getAiUsage({ env: {} } as any);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'AI usage telemetry is not configured.' });
});

test('server monitoring reports missing credentials instead of marking sample hosts online', async () => {
  const response = await getServers({ env: {} } as any);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Server telemetry is not configured.' });
});

test('visitor telemetry uses an explicit local fallback without inventing a public identity', async () => {
  const response = await getVisitorIp({
    env: {},
    request: new Request('http://localhost/api/visitor-ip'),
  } as any);
  const payload = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(payload.ip, '127.0.*.*');
  assert.ok(!('rawIp' in payload), 'The public response must not expose the unmasked address.');
  assert.equal(payload.city, 'Local');
  assert.equal(payload.asn, 'AS--');
});
