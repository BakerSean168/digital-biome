import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGovernancePilotLabel } from './governance-pilot.ts';

test('governance pilot labels are canonical lower-case values', () => {
  assert.equal(normalizeGovernancePilotLabel('  Pixel-Agent  '), 'pixel-agent');
});
