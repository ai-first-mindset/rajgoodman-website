// Decomposing a legacy raw-html page into typed sections.
//
// The gate is byte-parity: after a section is lifted out of the blob into a
// real node, the page must render to EXACTLY the same HTML. If that holds, the
// section became editable and the published page did not change.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../builder/core/document.js';
import { renderDocument, createEnv } from '../builder/core/render.js';
import { registry } from '../builder/elements/index.js';
import { decomposeHtml, decomposeDocument, verifyDecomposition } from '../builder/decompose.js';

const ABOUT = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/about-page-blocks.json', import.meta.url)), 'utf8'),
);
const render = (doc) => renderDocument(doc, createEnv({ registry }));

test('the Global Reach section is lifted out of the /about/ blob', () => {
  const { doc } = parse(ABOUT);
  const after = decomposeDocument(doc);
  const types = after.root.children.map((c) => c.type);

  assert.ok(types.includes('stat-band'), `no stat-band produced, got: ${types.join(', ')}`);
  // The single 31KB blob became raw-html + stat-band + raw-html.
  assert.ok(after.root.children.length > doc.root.children.length);

  const band = after.root.children.find((c) => c.type === 'stat-band');
  assert.equal(band.props.idx, '[ 09 ]');
  assert.equal(band.props.kicker, "Raj's Global Reach");
  assert.equal(band.props.heading, 'From Silicon Valley boardrooms to Mumbai startups');
  assert.match(band.props.text, /^Raj's influence now spans 5 continents/);
  assert.equal(band.props.label, 'Connect with Raj');
  assert.equal(band.props.url, '#work');
});

test('its counters became individually editable stat-item children', () => {
  const band = decomposeDocument(parse(ABOUT).doc).root.children.find((c) => c.type === 'stat-band');
  assert.deepEqual(band.children.map((c) => c.type), ['stat-item', 'stat-item', 'stat-item']);
  assert.deepEqual(band.children.map((c) => c.props), [
    { value: '300', suffix: '+', label: 'Workshops Delivered' },
    { value: '50', suffix: '+', label: 'Countries Reached' },
    { value: '20', suffix: 'K+', label: 'Leaders Trained' },
  ]);
});

test('THE GATE: the decomposed page renders byte-identically', () => {
  const { doc } = parse(ABOUT);
  const after = decomposeDocument(doc);
  const check = verifyDecomposition(doc, after, render);
  assert.ok(check.ok, check.ok ? '' : `first difference at ${check.at}:\n  was: ${check.expected}\n  now: ${check.actual}`);
});

test('the decomposed document round-trips and survives a re-decompose', () => {
  const once = decomposeDocument(parse(ABOUT).doc);
  assert.deepEqual(parse(serialize(once)).doc, once);
  // Running it again finds nothing new and changes nothing.
  const twice = decomposeDocument(once);
  assert.equal(render(twice), render(once));
  assert.equal(twice.root.children.filter((c) => c.type === 'stat-band').length, 1);
});

test('editing a lifted stat now changes the page (it was frozen in the blob before)', () => {
  const after = decomposeDocument(parse(ABOUT).doc);
  const band = after.root.children.find((c) => c.type === 'stat-band');
  band.children[1].props.value = '75';
  const html = render(after);
  assert.match(html, /<span data-count="75">0<\/span>\+<\/div><div class="l">Countries Reached/);
  assert.doesNotMatch(html, /data-count="50"/);
});

test('markup with no recognised section is returned untouched, as one blob', () => {
  const html = '<section class="sec tight">\n  <div class="wrap">nothing typed here</div>\n</section>';
  const nodes = decomposeHtml(html);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, 'raw-html');
  assert.equal(nodes[0].props.html, html);
});

test('a sec-reach section WITHOUT a counter row is left alone', () => {
  // The CTA at the foot of /about/ is also `sec reach`; only the counter
  // variant is claimed, so the recogniser must not swallow it.
  const cta = '<section class="sec reach">\n  <div class="wrap" data-reveal>\n    <h2>Let us talk</h2>\n  </div>\n</section>';
  assert.deepEqual(decomposeHtml(cta).map((n) => n.type), ['raw-html']);
});

test('the stat band renders nothing unexpected when optional props are empty', () => {
  const { doc } = parse([{ type: 'stat-band' }]);
  doc.root.children[0].children = [
    { id: 's', type: 'stat-item', props: { value: '9', suffix: '', label: 'Nine' }, children: [] },
  ];
  const html = render(doc);
  assert.doesNotMatch(html, /shead|<h2|class="sub"|btn-y/);
  assert.match(html, /<div class="big">\n {6}<div class="cell">/);
});
