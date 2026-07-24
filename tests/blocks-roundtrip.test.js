// Round-trip + FAQ schema extraction for the block registry.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlock, extractFaqItems } from '../api/_blocks.js';

test('extractFaqItems returns Q/A across faq blocks (tags stripped)', () => {
  const blocks = [
    { type: 'raw-html', html: '<p>x</p>' },
    { type: 'faq', items: [
      { question: 'What is X?', answer_html: 'X is <a href="/y/">this</a>.', open: true },
      { question: 'Why?', answer_html: '<em>Because.</em>' },
    ] },
    { type: 'faq', items: [{ question: 'More?', answer_html: 'Yes.' }] },
  ];
  const faqs = extractFaqItems(blocks);
  assert.deepEqual(faqs, [
    { q: 'What is X?', a: 'X is this .' },
    { q: 'Why?', a: 'Because.' },
    { q: 'More?', a: 'Yes.' },
  ]);
});

test('faq items with empty question or answer are dropped from schema', () => {
  const faqs = extractFaqItems([{ type: 'faq', items: [
    { question: '', answer_html: 'orphan' },
    { question: 'ok', answer_html: '' },
    { question: 'good', answer_html: 'answer' },
  ] }]);
  assert.deepEqual(faqs, [{ q: 'good', a: 'answer' }]);
});

test('a rendered faq block re-extracts to the same questions', () => {
  const items = [
    { question: 'One?', answer_html: 'First.', open: true },
    { question: 'Two?', answer_html: 'Second.' },
  ];
  renderBlock({ type: 'faq', items }); // render must not mutate input
  const faqs = extractFaqItems([{ type: 'faq', items }]);
  assert.deepEqual(faqs.map((f) => f.q), ['One?', 'Two?']);
  assert.deepEqual(faqs.map((f) => f.a), ['First.', 'Second.']);
});
