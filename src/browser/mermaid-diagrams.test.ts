import assert from 'node:assert/strict';
import test from 'node:test';
import { createMermaidConfig } from './mermaid-diagrams';

test('mermaid config renders on demand, strictly, without error diagrams', () => {
  const config = createMermaidConfig();
  assert.equal(config.startOnLoad, false);
  assert.equal(config.securityLevel, 'strict');
  assert.equal(config.suppressErrorRendering, true);
  assert.equal(config.theme, 'base');
});

test('mermaid config uses the site palette on a transparent background', () => {
  const variables = createMermaidConfig().themeVariables;
  assert.equal(variables?.background, 'transparent');
  assert.equal(variables?.primaryTextColor, '#E8E6DF');
  assert.equal(variables?.lineColor, '#8F9779');
});
