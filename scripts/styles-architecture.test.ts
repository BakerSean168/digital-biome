import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const cssRoot = path.join(root, 'src/styles');
const cssFile = (name: string) => fs.readFileSync(path.join(cssRoot, name), 'utf8');

test('global stylesheet composes scoped styles in the original cascade order', () => {
  const entrypoint = cssFile('global.css');
  const imports = [...entrypoint.matchAll(/^@import ['"]([^'"]+)['"];?$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(imports, [
    'tailwindcss',
    './theme.css',
    './base.css',
    './reading.css',
    './terminal.css',
    './gui.css',
    './workspace.css',
  ]);
  for (const name of imports.slice(1)) {
    assert.ok(fs.existsSync(path.join(cssRoot, name)), name + ' is missing');
  }
  assert.match(cssFile('theme.css'), /@theme\s*\{/);
  assert.match(cssFile('theme.css'), /@custom-variant dark/);
  assert.match(cssFile('theme.css'), /@plugin/);
});

test('retired Biome Tree style and static images cannot return', () => {
  for (const image of [
    'organic_biome_tree.png',
    'organic_biome_tree_transparent.png',
    'organic_biome_tree_transparent.webp',
  ]) {
    assert.equal(
      fs.existsSync(path.join(root, 'public/assets/images', image)),
      false,
      image + ' is retired',
    );
  }
  const css = fs.readdirSync(cssRoot).filter((file) => file.endsWith('.css'));
  const styles = css.map((file) => cssFile(file)).join('\n');
  assert.doesNotMatch(styles, /\.biome-(?:node|page|trunk|branch|hero|canopy|grid)\b/);
  assert.doesNotMatch(styles, /\.fruit-node\b|\.cyber-root-path\b|\.hud-connector-line\b/);
  assert.doesNotMatch(
    styles,
    /--(?:branch-dev|glow-root|tree-opacity|tree-shadow|cyber-grid-color)\b/,
  );
});

test('active reading, terminal, GUI and browser workspace styles are preserved', () => {
  assert.match(cssFile('reading.css'), /\.signal-decode\s*\{/);
  assert.match(cssFile('reading.css'), /@keyframes signal-sweep/);
  assert.match(cssFile('reading.css'), /\.prose table tbody td/);
  assert.match(cssFile('terminal.css'), /\.terminal-row\s*\{/);
  assert.match(cssFile('terminal.css'), /--font-mono: 'JetBrains Mono'/);
  assert.match(cssFile('gui.css'), /html\[data-ui='gui'\] \.terminal-site/);
  assert.match(cssFile('gui.css'), /\.gui-home-intro/);
  assert.match(cssFile('workspace.css'), /html\[data-browser-ready\]/);
  assert.match(cssFile('workspace.css'), /@view-transition/);
});
