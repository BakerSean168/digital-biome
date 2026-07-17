import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeNextPath, normalizeAccessTeamDomain } from './access';
import { parsePrivateInfrastructure } from './private-infrastructure';
import { buildPrivateLinkRefs, redactProtectedLinks } from './private-refs';
import {
  redactIPv4Addresses,
  redactProtectedInfrastructureUrls,
} from '../scripts/sync/markdown-transform';

test('normalizes a Cloudflare Access team domain', () => {
  assert.equal(
    normalizeAccessTeamDomain('example.cloudflareaccess.com'),
    'https://example.cloudflareaccess.com',
  );
  assert.throws(() => normalizeAccessTeamDomain('https://example.com'));
  assert.throws(() => normalizeAccessTeamDomain('https://example.cloudflareaccess.com/path'));
});

test('accepts only same-origin redirect paths', () => {
  assert.equal(getSafeNextPath('/infrastructure?view=fleet#node'), '/infrastructure?view=fleet#node');
  assert.equal(getSafeNextPath('https://example.com'), '/');
  assert.equal(getSafeNextPath('//example.com'), '/');
  assert.equal(getSafeNextPath('/api/private/enter'), '/');
});

test('validates private infrastructure values and link protocols', () => {
  const payload = parsePrivateInfrastructure(JSON.stringify({
    version: 1,
    values: { 'vps.example.ip': '192.0.2.10' },
    links: { 'host-example.links.ssh': 'ssh://admin@192.0.2.10' },
  }));

  assert.equal(payload.values['vps.example.ip'], '192.0.2.10');
  assert.throws(() => parsePrivateInfrastructure(JSON.stringify({
    version: 1,
    values: {},
    links: { 'host-example.links.ssh': 'javascript:alert(1)' },
  })));
});

test('redacts full IPv4 addresses in every synchronized Markdown source', () => {
  assert.equal(
    redactIPv4Addresses('HostName 192.0.2.10\nssh://admin@203.0.113.8'),
    'HostName 192.0.x.x\nssh://admin@203.0.x.x',
  );
});

test('redacts URLs marked private by the upstream asset index', () => {
  const internalUrl = 'https://internal.example.test:8443';
  assert.equal(
    redactProtectedInfrastructureUrls(
      `[Admin](${internalUrl})\nurl: ${internalUrl}`,
      new Set([internalUrl]),
    ),
    '[Admin](private://redacted)\nurl: private://redacted',
  );
});

test('uses one deterministic key scheme while removing protected URLs from public indexes', () => {
  const links = [
    { label: 'SSH', kind: 'ssh', visibility: 'private', url: 'ssh://admin@192.0.2.10' },
    { label: 'Admin', kind: 'admin', visibility: 'internal', url: 'https://192.0.2.10:8006' },
    { label: 'Docs', kind: 'docs', visibility: 'public', url: 'https://example.com/docs' },
  ] as const;

  assert.deepEqual(
    buildPrivateLinkRefs('host-example', [...links]).map(item => item.privateRef),
    ['host-example.links.ssh', 'host-example.links.admin', null],
  );

  const publicLinks = redactProtectedLinks('host-example', [...links]);
  assert.equal(publicLinks[0].url, undefined);
  assert.equal(publicLinks[0].private_ref, 'host-example.links.ssh');
  assert.equal(publicLinks[1].url, undefined);
  assert.equal(publicLinks[2].url, 'https://example.com/docs');
});
