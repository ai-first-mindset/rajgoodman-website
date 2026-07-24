// Adapter round-trip: blocks[] -> Puck data -> blocks[] must be lossless, so
// Puck edits never alter the stored/rendered shape. Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPuck, toBlocks } from '../tools/pages-builder/src/adapter.js';

const fixtures = [
  { type: 'raw-html', id: 'b_raw1', html: '<section class="x">hi</section>' },
  { type: 'section-heading', id: 'b_sh1', idx: '', kicker: 'Kick', heading: 'Head', showLine: true },
  { type: 'cta', id: 'b_cta1', idx: '[ 05 ]', kicker: 'Talk', heading: 'Work', text: 'sub', label: 'Go', url: '/#work' },
  { type: 'faq', id: 'b_faq1', idx: '', kicker: 'FAQs', heading: 'Questions, answered', items: [
    { question: 'Q1?', answer_html: 'A1', open: true },
    { question: 'Q2?', answer_html: '<a href="/y/">A2</a>', open: false },
  ] },
  { type: 'rich-text', id: 'b_rt1', html: '<p>hello</p>' },
];

test('toBlocks(toPuck(blocks)) is lossless across all 5 types', () => {
  assert.deepEqual(toBlocks(toPuck(fixtures)), fixtures);
});

test('toPuck shape: content items are {type, props{...block}} with id in props', () => {
  const data = toPuck(fixtures);
  assert.equal(data.content.length, fixtures.length);
  assert.equal(data.content[0].type, 'raw-html');
  assert.equal(data.content[0].props.id, 'b_raw1');
  assert.deepEqual(data.root, { props: {} });
});

test('FAQ items survive the round-trip intact (incl. open flags + answer HTML)', () => {
  const back = toBlocks(toPuck(fixtures));
  const faq = back.find((b) => b.type === 'faq');
  assert.equal(faq.items.length, 2);
  assert.equal(faq.items[0].open, true);
  assert.equal(faq.items[1].answer_html, '<a href="/y/">A2</a>');
});

test('a Puck-inserted block with no id is assigned a stable b_ id', () => {
  const data = { content: [{ type: 'faq', props: { items: [] } }], root: { props: {} } };
  const [block] = toBlocks(data);
  assert.match(block.id, /^b_[a-z0-9]+$/);
  assert.equal(block.type, 'faq');
});

test('empty / malformed data yields an empty block list', () => {
  assert.deepEqual(toBlocks(null), []);
  assert.deepEqual(toBlocks({}), []);
  assert.deepEqual(toPuck(null), { content: [], root: { props: {} }, zones: {} });
});
