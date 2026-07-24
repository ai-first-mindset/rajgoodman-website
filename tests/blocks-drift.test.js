// Drift guard: the Puck editor's field manifest (tools/pages-builder/src/fields.js)
// must stay a subset of the server registry (api/_blocks.js BLOCK_TYPES), since the
// editor and renderer are hand-kept in sync. fields.js is plain data (no React), so
// it imports cleanly under node. Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK_TYPES } from '../api/_blocks.js';
import { PUCK_FIELDS } from '../tools/pages-builder/src/fields.js';

test('Puck component types match the api registry', () => {
  assert.deepEqual(Object.keys(PUCK_FIELDS).sort(), Object.keys(BLOCK_TYPES).sort());
});

test('every Puck field name exists in the api BLOCK_TYPES field list', () => {
  for (const [type, fields] of Object.entries(PUCK_FIELDS)) {
    assert.ok(BLOCK_TYPES[type], `api registry knows type "${type}"`);
    for (const name of Object.keys(fields)) {
      assert.ok(BLOCK_TYPES[type].fields.includes(name), `field "${type}.${name}" exists in api BLOCK_TYPES`);
    }
  }
});

test('FAQ array item fields are limited to the block item shape', () => {
  const itemFields = Object.keys(PUCK_FIELDS.faq.items.arrayFields);
  const allowed = ['question', 'answer_html', 'open'];
  for (const f of itemFields) assert.ok(allowed.includes(f), `faq item field "${f}" is allowed`);
});
