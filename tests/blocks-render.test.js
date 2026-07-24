// Block registry render contracts. The FAQ block must emit the exact site
// markup so site.css (.faq/.pm-ic/.ans) + common.js initFaq() keep working.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlock, renderBlocks } from '../api/_blocks.js';

test('faq block emits the exact site accordion contract', () => {
  const html = renderBlock({
    type: 'faq', idx: '[ 10 ]', kicker: 'FAQs', heading: 'Questions, answered',
    items: [
      { question: 'Q one?', answer_html: 'A one.', open: true },
      { question: 'Q two?', answer_html: 'A <a href="/x/">two</a>.', open: false },
    ],
  });
  assert.match(html, /<section class="sec tight">/);
  assert.match(html, /<div class="shead" data-reveal><span class="idx">\[ 10 \]<\/span><span class="kick">FAQs<\/span><span class="ln"><\/span><\/div>/);
  assert.match(html, /<h2 data-reveal>Questions, answered<\/h2>/);
  assert.match(html, /<div class="faq" data-reveal>/);
  assert.match(html, /<details open><summary>Q one\?<span class="pm-ic"><\/span><\/summary><div class="ans">A one\.<\/div><\/details>/);
  // second item not open; answer HTML preserved
  assert.match(html, /<details><summary>Q two\?<span class="pm-ic"><\/span><\/summary><div class="ans">A <a href="\/x\/">two<\/a>\.<\/div><\/details>/);
});

test('faq defaults the first item open when none flagged', () => {
  const html = renderBlock({ type: 'faq', items: [{ question: 'A', answer_html: 'x' }, { question: 'B', answer_html: 'y' }] });
  assert.match(html, /<details open><summary>A/);
  assert.match(html, /<details><summary>B/);
});

test('faq escapes question text but keeps answer HTML', () => {
  const html = renderBlock({ type: 'faq', items: [{ question: 'a & <b>', answer_html: '<em>ok</em>', open: true }] });
  assert.match(html, /<summary>a &amp; &lt;b&gt;<span/);
  assert.match(html, /<div class="ans"><em>ok<\/em><\/div>/);
});

test('section-heading renders shead + h2', () => {
  const html = renderBlock({ type: 'section-heading', idx: '[ 02 ]', kicker: 'Kick', heading: 'Hello' });
  assert.match(html, /<div class="shead" data-reveal><span class="idx">\[ 02 \]<\/span><span class="kick">Kick<\/span><span class="ln"><\/span><\/div>/);
  assert.match(html, /<h2 data-reveal>Hello<\/h2>/);
});

test('cta renders reach section with button', () => {
  const html = renderBlock({ type: 'cta', kicker: 'Talk', heading: 'Work with Raj', text: 'Reach out', label: 'Get in touch', url: '/#work' });
  assert.match(html, /<section class="sec reach">/);
  assert.match(html, /<a href="\/#work" class="btn btn-y">Get in touch <span class="ar">&rarr;<\/span><\/a>/);
  assert.match(html, /class="sub"[^>]*>Reach out</);
});

test('raw-html renders verbatim', () => {
  const html = renderBlock({ type: 'raw-html', html: '<section class="custom"><b>hi</b></section>' });
  assert.equal(html, '<section class="custom"><b>hi</b></section>');
});

test('unknown block type is preserved, never silently dropped', () => {
  // A raw payload from a newer editor bundle is kept verbatim.
  assert.equal(renderBlock({ type: 'nope', html: '<p>keep me</p>' }), '<p>keep me</p>');
  // No payload → an inert marker (data still round-trips), not an empty drop.
  assert.match(renderBlock({ type: 'nope' }), /<!-- unsupported-block:nope -->/);
  // Non-objects still yield nothing.
  assert.equal(renderBlock(null), '');
});

test('renderBlocks auto-numbers headings, explicit idx wins, raw-html does not count', () => {
  const out = renderBlocks([
    { type: 'raw-html', html: '<p>x</p>' },
    { type: 'section-heading', kicker: 'First' },          // auto → [ 01 ]
    { type: 'faq', idx: '[ 99 ]', items: [{ question: 'q', answer_html: 'a' }] }, // explicit wins
    { type: 'cta', kicker: 'Last', label: 'Go', url: '/' }, // auto → [ 03 ]
  ]);
  assert.match(out, /First<\/span>/);
  assert.match(out, /<span class="idx">\[ 01 \]<\/span><span class="kick">First/);
  assert.match(out, /<span class="idx">\[ 99 \]<\/span>/);
  assert.match(out, /<span class="idx">\[ 03 \]<\/span><span class="kick">Last/);
});
