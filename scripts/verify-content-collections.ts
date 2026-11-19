import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  materializeKnowledgePublicV1Source,
  parseKnowledgePublicV1,
} from './data-products/knowledge-public-v1';
import { findDefaultConflicts, selectResourceEntries } from '../src/domain/resource-collections';

/** Real producer → consumer integration, with isolated synthetic inputs, never published. */
async function main() {
  const producer = process.env.THOUGHT_FOREST_ROOT;
  if (!producer) throw new Error('Set THOUGHT_FOREST_ROOT to the producer checkout under review');
  const { buildKnowledgePublicProjection } = await import(
    pathToFileURL(path.resolve(producer, 'scripts/public-projection/export-knowledge-public.ts'))
      .href
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-integration-'));
  const vault = path.join(root, 'vault');
  const source = path.join(root, 'source');
  const site = path.join(root, 'site');
  const consumer = process.cwd();
  const put = (name: string, metadata: string, body: string) => {
    const file = path.join(vault, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\n${metadata}\n---\n${body}\n`);
  };
  const summary =
    'title: SECRET_PRIVATE_TITLE\nvisibility: private\nstatus: active\nasset_id: tool-secret-device\npublish_uses_summary: true\npublic_key: approved-device\npublic_title: Approved device\npublic_summary: Approved summary\npublic_group: INPUT';
  const website =
    'title: Public website\nvisibility: public\nbookmarked: true\nurl: https://example.org/\ntags: [blogroll]\nhomepage_order: 1';
  const tsx = path.join(consumer, 'node_modules/.bin/tsx');
  const read = (name: string) =>
    JSON.parse(fs.readFileSync(path.join(site, 'src/data/indexes', name), 'utf8'));
  const sync = async () => {
    const result = await buildKnowledgePublicProjection(vault);
    const parsed = parseKnowledgePublicV1(JSON.stringify(result));
    fs.rmSync(source, { recursive: true, force: true });
    materializeKnowledgePublicV1Source(parsed, source);
    execFileSync(
      tsx,
      [
        '--eval',
        `import { runSync } from ${JSON.stringify(path.join(consumer, 'scripts/sync/index.ts'))}; runSync().then(n => { if (n) process.exitCode = 1; });`,
      ],
      {
        cwd: site,
        env: {
          ...process.env,
          NOTES_VAULT_ROOT: source,
          NOTES_UPSTREAM_GENERATED: path.join(source, 'generated'),
        },
        stdio: 'pipe',
      },
    );
    return parsed;
  };
  try {
    fs.mkdirSync(site, { recursive: true });
    put('notes/plain.md', 'title: Plain knowledge\nurl: https://example.net/', 'Knowledge body.');
    put('uses/websites/website.md', website, 'Public recommendation.');
    put(
      'uses/software/editor.md',
      'title: Editor\nvisibility: public\nstatus: active\ndefault_for: [editing]',
      'Workflow.',
    );
    put(
      'uses/hardware/public.md',
      'title: Public hardware\nvisibility: public\nstatus: active\ntags: [carry]',
      'Public history.',
    );
    put(
      'uses/hardware/secret.md',
      summary,
      'SECRET_PRICE_REPAIR [[private-note]] http://192.168.4.2/',
    );
    put(
      'projects/project.md',
      'title: Public project\nvisibility: public\nasset_id: project-stable',
      '[[uses/websites/website]]',
    );
    execFileSync('git', ['init', '-q', vault]);
    execFileSync('git', ['-C', vault, 'add', '.']);
    execFileSync('git', [
      '-C',
      vault,
      '-c',
      'user.name=Integration',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ]);
    const first = await sync();
    let notes = read('notes-index.json').entries;
    assert.equal(selectResourceEntries(notes, 'bookmarks').length, 1);
    assert.equal(selectResourceEntries(notes, 'blogroll').length, 1);
    assert.equal(selectResourceEntries(notes, 'carry').length, 1);
    assert.equal(selectResourceEntries(notes, 'defaults').length, 1);
    assert.equal(
      notes.find((n: { homepageOrder?: number }) => n.homepageOrder === 1)?.id,
      'obsidian/website',
    );
    assert.deepEqual(read('uses-summaries.json'), first.payload.usesSummaries);
    assert.equal(
      read('asset-index.json').entries.find(
        (n: { asset_id: string }) => n.asset_id === 'tool-public',
      )?.asset_type,
      'tool',
    );
    for (const name of [
      'notes-index.json',
      'asset-index.json',
      'tag-index.json',
      'link-graph.json',
    ]) {
      const text = JSON.stringify(read(name));
      for (const secret of ['SECRET_', 'secret-device', 'Approved summary', 'approved-device'])
        assert.ok(!text.includes(secret), name + ': ' + secret);
    }
    const project = read('asset-index.json').entries.find(
      (n: { asset_id: string }) => n.asset_id === 'project-stable',
    );
    assert.equal(project.id, 'obsidian/projects/project');
    assert.equal(project.asset_type, 'project');
    // Neither side may silently accept a mixed-schema deployment.
    assert.throws(
      () => parseKnowledgePublicV1(JSON.stringify({ ...first, schemaVersion: 1 })),
      /envelope mismatch/,
    );
    const oldRoot = path.join(root, 'old-consumer');
    for (const file of [
      'scripts/data-products/knowledge-public-v1.ts',
      'src/domain/foundation/guards.ts',
      'src/domain/resource-order.ts',
    ]) {
      const destination = path.join(oldRoot, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(
        destination,
        execFileSync('git', ['show', 'b759c2f0c1f5a405d7d4ff6c6e9a682f51ea77ec:' + file], {
          cwd: consumer,
        }),
      );
    }
    const old = await import(
      pathToFileURL(path.join(oldRoot, 'scripts/data-products/knowledge-public-v1.ts')).href
    );
    assert.throws(() => old.parseKnowledgePublicV1(JSON.stringify(first)), /envelope mismatch/);
    const tampered = structuredClone(first);
    Object.assign(tampered.payload.usesSummaries[0], { sourcePath: 'PRIVATE_PATH' });
    assert.throws(
      () => parseKnowledgePublicV1(JSON.stringify(tampered)),
      /Unexpected uses summary field/,
    );
    // Revoke summary authorization, sell hardware, unbookmark/change URL, and clear defaults.
    put(
      'uses/hardware/secret.md',
      summary.replace('publish_uses_summary: true', 'publish_uses_summary: false'),
      'SECRET_REVOKED_BODY',
    );
    put(
      'uses/hardware/public.md',
      'title: Public hardware\nvisibility: public\nstatus: sold\ntags: [carry]',
      'Public history.',
    );
    put(
      'uses/websites/website.md',
      website
        .replace('bookmarked: true', 'bookmarked: false')
        .replace('example.org', 'changed.example.org'),
      'Updated.',
    );
    put(
      'uses/software/editor.md',
      'title: Editor\nvisibility: public\nstatus: active\ndefault_for: []',
      'Workflow.',
    );
    await sync();
    notes = read('notes-index.json').entries;
    assert.deepEqual(read('uses-summaries.json'), []);
    for (const view of ['bookmarks', 'blogroll', 'carry', 'defaults'] as const)
      assert.equal(selectResourceEntries(notes, view).length, 0, view);
    assert.equal(
      notes.find((n: { id: string }) => n.id === 'obsidian/website')?.url,
      'https://changed.example.org/',
    );
    assert.equal(
      notes.find((n: { id: string }) => n.id === 'obsidian/tools/public')?.status,
      'sold',
    );
    put(
      'uses/software/editor.md',
      'title: Editor\nvisibility: public\nstatus: active\ndefault_for: [editing]',
      'Workflow.',
    );
    put(
      'uses/software/other.md',
      'title: Other\nvisibility: public\nstatus: active\ndefault_for: [editing]',
      'Alternative.',
    );
    await sync();
    assert.deepEqual(findDefaultConflicts(read('notes-index.json').entries), ['editing']);
    // Delete a resource and make another private; stale Markdown and derived indexes disappear.
    fs.unlinkSync(path.join(vault, 'uses/websites/website.md'));
    put(
      'uses/software/editor.md',
      'title: Editor\nvisibility: private\nstatus: active\ndefault_for: [editing]',
      'SECRET_HIDDEN_EDITOR',
    );
    await sync();
    notes = read('notes-index.json').entries;
    assert.ok(
      !notes.some((n: { id: string }) =>
        ['obsidian/website', 'obsidian/uses/software/editor'].includes(n.id),
      ),
    );
    assert.ok(!fs.existsSync(path.join(site, 'src/data/obsidian/uses/websites/website.md')));
    assert.ok(!fs.existsSync(path.join(source, 'uses/software/editor.md')));
    console.log(
      'PASS: real producer → materializer → sync → final query indexes; status, defaults conflict, revoke/delete, summary tampering, stable IDs/URLs, and mixed-version rejection',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
