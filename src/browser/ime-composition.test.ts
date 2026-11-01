import assert from 'node:assert/strict';
import test from 'node:test';
import { isImeComposition } from './ime-composition';

test('standard composing keydown is treated as IME input', () => {
  assert.equal(isImeComposition({ isComposing: true, keyCode: 13 }), true);
});

test('Safari composition-commit keydown (keyCode 229) is treated as IME input', () => {
  assert.equal(isImeComposition({ isComposing: false, keyCode: 229 }), true);
});

test('ordinary keydown is not treated as IME input', () => {
  assert.equal(isImeComposition({ isComposing: false, keyCode: 27 }), false);
});
