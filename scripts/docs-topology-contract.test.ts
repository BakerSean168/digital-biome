import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Keeps the hand-written developer docs honest: stack majors, layouts, component
// areas and the public route map must match `main`, and retired surfaces must not
// come back unnoticed. Docs are the human contract; this test only guards drift.
const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const agents = read('AGENTS.md');
const readme = read('README.md');
const readmeZh = read('docs/zh-CN/README.md');
const architecture = read('docs/architecture.md');
const topology = architecture.slice(
  architecture.indexOf('### 3.0 应用拓扑'),
  architecture.indexOf('### 3.1 '),
);
const ciWorkflow = read('.github/workflows/check.yml');

function major(name: string): string {
  const range = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  assert.ok(range, `${name} is not declared in package.json`);
  const match = range.match(/(\d+)\./);
  assert.ok(match, `${name} range ${range} has no major version`);
  return match[1];
}

function pageRoutes(directory = path.join(ROOT, 'src/pages')): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return pageRoutes(file);
    if (!/\.(astro|ts)$/.test(entry.name) || entry.name.endsWith('.test.ts')) return [];
    const route = path
      .relative(path.join(ROOT, 'src/pages'), file)
      .replaceAll(path.sep, '/')
      .replace(/\.(astro|ts)$/, '')
      .replace(/(^|\/)index$/, '');
    return ['/' + route];
  });
}

test('documented stack majors match package.json', () => {
  const expectations = [
    `Astro ${major('astro')}`,
    `TypeScript ${major('typescript')}`,
    `Tailwind CSS ${major('tailwindcss')}`,
  ];
  for (const [name, doc] of Object.entries({ agents, readme, readmeZh, topology })) {
    for (const expected of expectations) {
      assert.ok(doc.includes(expected), `${name} should state "${expected}"`);
    }
  }
});

test('documented layouts and component areas match src/', () => {
  const layouts = readdirSync(path.join(ROOT, 'src/layouts'))
    .filter((file) => file.endsWith('.astro'))
    .map((file) => file.replace(/\.astro$/, ''));
  for (const layout of layouts) {
    assert.ok(agents.includes(layout), `AGENTS.md should name ${layout}`);
    assert.ok(topology.includes(layout), `architecture §3.0 should name ${layout}`);
  }
  const areas = readdirSync(path.join(ROOT, 'src/components'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const area of areas) {
    assert.ok(
      agents.includes(`── ${area}/`),
      `AGENTS.md structure should list components/${area}/`,
    );
  }
  for (const retired of ['dashboard']) {
    assert.ok(!areas.includes(retired), `src/components/${retired}/ is retired`);
    assert.ok(!agents.includes(`── ${retired}/`), `AGENTS.md still lists retired ${retired}/`);
  }
  assert.doesNotMatch(readme, /Observability|dashboard UI/i);
  assert.doesNotMatch(readmeZh, /可观测信息|仪表盘/);
});

test('architecture route map matches src/pages exactly and retired routes stay absent', () => {
  const routes = pageRoutes();
  for (const route of routes) {
    assert.ok(topology.includes('`' + route + '`'), `architecture §3.0 is missing route ${route}`);
  }
  const documented = topology
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .flatMap((line) => [...line.matchAll(/`(\/[^`]*)`/g)].map((match) => match[1]));
  for (const route of documented) {
    assert.ok(routes.includes(route), `architecture §3.0 documents missing route ${route}`);
  }
  for (const retired of ['/dashboard', '/observability', '/discover', '/about/refactor']) {
    assert.ok(!routes.includes(retired), `${retired} is a retired route`);
    assert.ok(!existsSync(path.join(ROOT, 'src/pages', retired)), `${retired}/ is retired`);
  }
});

test('docs describe the verification preflight and CI watches doc changes', () => {
  assert.match(pkg.scripts.verify, /^pnpm preflight:data-products && /);
  assert.ok(topology.includes('preflight.ts'));
  assert.ok(agents.includes('preflight:data-products'));
  const pushPaths = ciWorkflow.slice(
    ciWorkflow.indexOf('  push:'),
    ciWorkflow.indexOf('  pull_request:'),
  );
  for (const watched of ["'docs/**'", "'AGENTS.md'", "'README.md'"]) {
    assert.ok(pushPaths.includes(watched), `CI push paths should include ${watched}`);
  }
});
