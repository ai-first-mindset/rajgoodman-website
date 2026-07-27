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

test('the whole /about/ page decomposes into typed, editable sections', () => {
  const after = decomposeDocument(parse(ABOUT).doc);
  const typed = after.root.children.filter((c) => c.type !== 'raw-html');
  assert.deepEqual(typed.map((c) => c.type), [
    'page-hero', 'page-section', 'page-section', 'page-section', 'page-section',
    'marquee-section', 'page-section', 'page-section', 'page-section',
    'stat-band', 'faq', 'page-section',
  ]);
  // Every numbered section, including the CTA, carries an editable heading.
  for (const s of typed.filter((c) => c.type === 'page-section')) {
    assert.ok(s.props.heading, `section ${s.props.idx} has no heading`);
  }
  assert.equal(typed.find((c) => c.props.idx === '[ ✦ ]').props.anchor, 'work');
});

test('MOST OF THE PAGE is editable as form fields, not HTML', () => {
  // The number that actually matters: how much of the content an author can
  // reach without touching markup. Node counts flatter this; bytes do not.
  const after = decomposeDocument(parse(ABOUT).doc);
  let form = 0;
  let raw = 0;
  const walk = (n) => n.children.forEach((c) => {
    if (c.type === 'raw-html') raw += (c.props.html || '').length;
    else {
      form += Object.values(c.props || {}).filter((v) => typeof v === 'string').join('').length;
      walk(c);
    }
  });
  walk(after.root);
  const share = form / (form + raw);
  assert.ok(share > 0.7, `only ${(share * 100).toFixed(0)}% of content is form-editable`);
});

test('the page hero is typed, so its headline and CTAs are editable', () => {
  const hero = decomposeDocument(parse(ABOUT).doc).root.children
    .find((c) => c.type === 'page-hero');
  assert.ok(hero, 'no page-hero produced');
  assert.equal(hero.props.crumb, 'About');
  assert.equal(hero.props.eyebrow, 'About Raj Goodman');
  assert.match(hero.props.heading, /human-first/);
  assert.equal(hero.props.ctaLabel, 'Consult Raj for your event');
  assert.equal(hero.props.altLabel, 'EO & YPO impact');
  assert.match(hero.props.lede, /^Raj Goodman is a futurist keynote speaker/);
  assert.match(hero.props.image, /^\/assets\//);
});

test('the testimonial marquee became individually editable quotes', () => {
  const sec = decomposeDocument(parse(ABOUT).doc).root.children
    .find((c) => c.type === 'marquee-section');
  assert.ok(sec.children.length >= 8, `only ${sec.children.length} quotes lifted`);
  assert.ok(sec.children.every((c) => c.type === 'marquee-quote'));
  assert.equal(sec.children[0].props.name, 'Vijay Binwani');
  assert.equal(sec.children[0].props.org, 'EO');
  assert.equal(sec.props.footerLabel, 'See all testimonials');
});

test("section 03's alternating rows are typed image + text pairs", () => {
  const sec = decomposeDocument(parse(ABOUT).doc).root.children
    .find((c) => c.props.idx === '[ 03 ]');
  const rows = sec.children.filter((c) => c.type === 'alt-row');
  assert.equal(rows.length, 5);
  assert.equal(rows[0].props.tag, '01 - The Builder');
  assert.match(rows[0].props.heading, /Founder of Multiple Tech Ventures/);
  assert.equal(rows[1].props.flip, true);
});

test('the shorts gallery became typed video items', () => {
  const sec = decomposeDocument(parse(ABOUT).doc).root.children
    .find((c) => c.props.idx === '[ 04 ]');
  const gal = sec.children.find((c) => c.type === 'shorts-gallery');
  assert.equal(gal.children.length, 5);
  assert.match(gal.children[0].props.url, /youtube\.com\/shorts/);
  assert.ok(gal.children[0].props.caption);
});

test('the contact form and LinkedIn widget are deliberately left as HTML', () => {
  // Functional widgets managed elsewhere; typing them adds risk, not value.
  const after = decomposeDocument(parse(ABOUT).doc);
  const raws = [];
  const walk = (n) => n.children.forEach((c) => { if (c.type === 'raw-html') raws.push(c.props.html); else walk(c); });
  walk(after.root);
  assert.ok(raws.some((h) => h.includes('data-form="contact"')), 'contact form kept');
  assert.ok(raws.some((h) => h.includes('data-li-grid')), 'LinkedIn grid kept');
});

test('editing decomposed body content changes the page', () => {
  const after = decomposeDocument(parse(ABOUT).doc);
  const cards = after.root.children.find((c) => c.props.idx === '[ 02 ]').children[0];
  cards.children[1].props.title = 'Listening is the superpower';
  const html = render(after);
  assert.match(html, /<h3>Listening is the superpower<\/h3>/);
  assert.doesNotMatch(html, /Empathy is a superpower/);
});

test('editing a decomposed section heading changes the page', () => {
  const after = decomposeDocument(parse(ABOUT).doc);
  const section = after.root.children.find((c) => c.props.idx === '[ 01 ]');
  section.props.heading = 'A brand new heading';
  const html = render(after);
  assert.match(html, /<h2 data-reveal>A brand new heading<\/h2>/);
  assert.doesNotMatch(html, /Some organizations thrive/);
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
