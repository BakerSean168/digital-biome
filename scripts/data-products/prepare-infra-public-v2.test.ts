import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareInfraPublicV2 } from './prepare-infra-public-v2';
import { infraReleaseFixture } from './fixtures/infra-release';
import { parseInfraPublicV2 } from '../../src/domain/infrastructure/infra-public-v2';
import { semanticSha256, sha256 } from './semantic-digest';

test('infra curation contract accepts old records and validates optional metadata', () => {
  const { projection } = infraReleaseFixture();
  const parse = (extra: Record<string, unknown>) => {
    const copy = structuredClone(projection);
    Object.assign(copy.payload.resources[0], extra);
    return parseInfraPublicV2(JSON.stringify(copy));
  };
  assert.equal(parse({}).payload.resources[0].usagePriority, undefined);
  assert.equal(
    parse({ usagePriority: 1, homepage: { enabled: true, featured: true, order: 0 } }).payload
      .resources[0].usagePriority,
    1,
  );
  for (const usagePriority of [0, -1, 1.5, '1', true]) {
    assert.throws(() => parse({ usagePriority }), /usagePriority/);
  }
  for (const homepage of [
    null,
    [],
    { enabled: 'true' },
    { featured: 1 },
    { order: -1 },
    { order: true },
    { label: 3 },
    { unknown: true },
  ]) {
    assert.throws(() => parse({ homepage }), /homepage/);
  }
});

test('infra prepare uses verified immutable bytes and preserves the existing owner materialization and privateRefs', async () => {
  const f = infraReleaseFixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-infra-'));
  const runtime = path.join(root, 'runtime');
  const output = path.join(root, 'output.json');
  try {
    const result = await prepareInfraPublicV2(JSON.stringify(f.lock), runtime, f.transport, output);
    assert.deepEqual(result.identity, f.lock);
    assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.artifact.name)), f.artifact);
    assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.manifest.name)), f.manifest);
    const accepted = fs.readFileSync(output, 'utf8');
    assert.equal(
      accepted,
      `${JSON.stringify(parseInfraPublicV2(f.artifact.toString('utf8')), null, 2)}\n`,
    );
    assert.match(accepted, /historical.url/);
    assert.doesNotMatch(accepted, /"url":/);
    await prepareInfraPublicV2(JSON.stringify(f.lock), runtime, f.transport, output);
    assert.equal(fs.readFileSync(output, 'utf8'), accepted);
    assert.deepEqual(fs.readdirSync(root).sort(), ['output.json', 'runtime']);
    assert.ok(f.calls.every((call) => !call.includes('main') && !call.includes('contents')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('infra verification and owner failures leave accepted runtime and output untouched', async () => {
  for (const fault of ['manifest', 'domain', 'semantic', 'source'] as const) {
    const f = infraReleaseFixture();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-infra-fail-'));
    const runtime = path.join(root, 'runtime');
    const output = path.join(root, 'output.json');
    try {
      await prepareInfraPublicV2(JSON.stringify(f.lock), runtime, f.transport, output);
      const accepted = fs.readFileSync(output);
      if (fault === 'manifest') f.downloads.set(12, Buffer.alloc(f.manifest.length));
      if (fault === 'semantic') f.lock.semanticSha256 = `sha256:${'0'.repeat(64)}`;
      if (fault === 'domain' || fault === 'source') {
        if (fault === 'domain')
          f.projection.payload.connections.push({
            from: 'svc-missing',
            to: 'svc-historical',
            kind: 'invalid',
          });
        else f.projection.source.revision = 'f'.repeat(40);
        const bytes = Buffer.from(JSON.stringify(f.projection));
        f.lock.artifact.sha256 = sha256(bytes);
        f.lock.semanticSha256 = semanticSha256(f.projection);
        f.release.assets[0].size = bytes.length;
        f.release.assets[0].digest = sha256(bytes);
        f.downloads.set(11, bytes);
      }
      await assert.rejects(
        prepareInfraPublicV2(JSON.stringify(f.lock), runtime, f.transport, output),
      );
      assert.deepEqual(fs.readFileSync(output), accepted);
      assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.artifact.name)), f.artifact);
      assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.manifest.name)), f.manifest);
      assert.deepEqual(fs.readdirSync(root).sort(), ['output.json', 'runtime']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('infra output installation failure restores the accepted runtime and retry converges', async () => {
  const f = infraReleaseFixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-infra-retry-'));
  const runtime = path.join(root, 'runtime');
  const output = path.join(root, 'output.json');
  try {
    fs.mkdirSync(runtime);
    fs.writeFileSync(path.join(runtime, 'accepted'), 'previous runtime');
    fs.mkdirSync(output); // Cannot atomically replace a directory with the output file.
    await assert.rejects(
      prepareInfraPublicV2(JSON.stringify(f.lock), runtime, f.transport, output),
    );
    assert.equal(fs.readFileSync(path.join(runtime, 'accepted'), 'utf8'), 'previous runtime');
    assert.deepEqual(fs.readdirSync(root).sort(), ['output.json', 'runtime']);
    fs.rmdirSync(output);
    await prepareInfraPublicV2(JSON.stringify(f.lock), runtime, f.transport, output);
    assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.artifact.name)), f.artifact);
    assert.equal(fs.existsSync(path.join(runtime, 'accepted')), false);
    assert.equal(
      parseInfraPublicV2(fs.readFileSync(output, 'utf8')).source.revision,
      f.lock.sourceRevision,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('infra fetch-only compatibility path verifies without writing consumer output', async () => {
  const f = infraReleaseFixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-infra-'));
  try {
    await prepareInfraPublicV2(
      JSON.stringify(f.lock),
      path.join(root, 'runtime'),
      f.transport,
      false,
    );
    assert.deepEqual(fs.readdirSync(root), ['runtime']);
    assert.deepEqual(fs.readFileSync(path.join(root, 'runtime', f.lock.artifact.name)), f.artifact);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
