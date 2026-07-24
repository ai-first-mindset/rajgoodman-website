// Drift guard: the admin's block field definitions (admin/blocks-ui.js) must
// stay a subset of the server registry (api/_blocks.js BLOCK_TYPES), since the
// two are hand-kept in sync (no bundler). Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOCK_TYPES } from '../api/_blocks.js';

function loadBlocksUi() {
  const src = readFileSync(new URL('../admin/blocks-ui.js', import.meta.url), 'utf8');
  const win = {};
  const doc = { createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {}, style: {} }) };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', src)(win, doc);
  return win.BLOCKS_UI;
}

test('admin block types match the api registry', () => {
  const UI = loadBlocksUi();
  assert.ok(UI && UI.TYPES, 'BLOCKS_UI.TYPES is defined');
  assert.deepEqual(Object.keys(UI.TYPES).sort(), Object.keys(BLOCK_TYPES).sort());
});

test('every admin field name exists in the api BLOCK_TYPES field list', () => {
  const UI = loadBlocksUi();
  for (const [type, def] of Object.entries(UI.TYPES)) {
    assert.ok(BLOCK_TYPES[type], `api registry knows type "${type}"`);
    for (const f of def.fields) {
      assert.ok(BLOCK_TYPES[type].fields.includes(f), `field "${type}.${f}" exists in api BLOCK_TYPES`);
    }
  }
});
