// Editor logic that can be exercised without a DOM: the canvas stamp (the only
// place the editor touches rendered markup) and the control registry's coercion.
// The panes themselves are verified in a browser.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampId } from '../builder/editor/canvas.js';
import { CONTROLS, createControlRegistry } from '../builder/editor/controls.js';

const node = (id) => ({ id });

test('stampId adds an attribute and nothing else', () => {
  assert.equal(
    stampId('<section class="sec tight">\n  <div class="wrap">x</div>\n</section>', node('n1')),
    '<section data-pb-id="n1" class="sec tight">\n  <div class="wrap">x</div>\n</section>',
  );
});

test('stampId skips a tag that already belongs to a child node', () => {
  // page-root renders exactly its children: stamping again would emit a
  // duplicate attribute and steal the child's identity.
  const childOutput = '<section data-pb-id="child" class="sec">x</section>';
  assert.equal(stampId(childOutput, node('root')), childOutput);
});

test('stampId looks past leading comments (raw-html payloads)', () => {
  assert.equal(
    stampId('<!-- HERO -->\n<section class="hero">x</section>', node('n2')),
    '<!-- HERO -->\n<section data-pb-id="n2" class="hero">x</section>',
  );
});

test('stampId falls back to a hidden marker when there is no tag', () => {
  assert.equal(stampId('just text', node('n3')), '<span data-pb-id="n3" data-pb-shim></span>just text');
});

test('stampId handles self-closing and attribute-less tags', () => {
  assert.equal(stampId('<hr class="pb-divider" />', node('a')), '<hr data-pb-id="a" class="pb-divider" />');
  assert.equal(stampId('<div>x</div>', node('b')), '<div data-pb-id="b">x</div>');
});

test('stampId leaves empty output alone', () => {
  assert.equal(stampId('', node('n4')), '');
});

test('controls coerce values to the type their field expects', () => {
  assert.equal(CONTROLS.text.coerce(null), '');
  assert.equal(CONTROLS.text.coerce(42), '42');
  assert.equal(CONTROLS.toggle.coerce('yes'), true);
  assert.equal(CONTROLS.toggle.coerce(''), false);
  assert.equal(CONTROLS.number.coerce(''), 0);
  assert.equal(CONTROLS.number.coerce('7'), 7);
});

test('the control registry covers every control our schemas reference', async () => {
  const { registry } = await import('../builder/elements/index.js');
  const controls = createControlRegistry();
  const used = new Set(registry.list().flatMap((d) => d.schema.map((f) => f.control)));
  const missing = [...used].filter((name) => !controls.has(name));
  assert.deepEqual(missing, [], `schemas reference controls that do not exist: ${missing.join(', ')}`);
});

test('an unknown control falls back to text rather than crashing the inspector', () => {
  assert.equal(createControlRegistry().get('not-a-control'), CONTROLS.text);
});
