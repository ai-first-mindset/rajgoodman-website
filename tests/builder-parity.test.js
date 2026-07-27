// THE PARITY GATE for the schema-driven builder.
//
// The new engine must render existing content BYTE-IDENTICALLY to the renderer
// the live site uses today (api/_blocks.js). Every legacy block type is covered
// here, plus the real published /about/ document rebuilt from about.html.
// If this file goes red, the cutover would change the live pages.
//
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderBlocks } from '../api/_blocks.js';
import { renderPageBlocks } from '../builder/index.js';

// The real published /about/ document, snapshotted from the record that
// scripts/migrate-about-page.mjs pushed to the `pages` table (about.html itself
// was retired once the route moved to the CMS).
const ABOUT_BLOCKS = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/about-page-blocks.json', import.meta.url)), 'utf8'),
);

// One fixture per legacy block type, with realistic content.
const FIXTURES = {
  'rich-text': { type: 'rich-text', html: '<p>Hello <strong>world</strong>.</p>' },
  'section-heading': { type: 'section-heading', idx: '', kicker: 'Approach', heading: 'How it works', showLine: true },
  'section-heading-noline': { type: 'section-heading', idx: '[ 07 ]', kicker: '', heading: 'Explicit index', showLine: false },
  cta: { type: 'cta', idx: '', kicker: 'Get in touch', heading: 'Ready?', text: 'A supporting line.', label: 'Contact', url: '/#contact' },
  'cta-bare': { type: 'cta', idx: '', kicker: '', heading: 'Just a heading', text: '', label: '', url: '' },
  faq: {
    type: 'faq', idx: '', kicker: 'FAQs', heading: 'Questions, answered',
    items: [
      { question: 'First question?', answer_html: '<p>First answer.</p>', open: false },
      { question: 'Second & "quoted"?', answer_html: '<p>Second answer.</p>', open: true },
    ],
  },
  'faq-none-open': {
    type: 'faq', idx: '', kicker: 'FAQs', heading: 'Defaults',
    items: [{ question: 'Only one?', answer_html: 'Yes.', open: false }],
  },
  'raw-html': { type: 'raw-html', html: '<section class="sec"><div class="wrap">verbatim</div></section>' },
  container: {
    type: 'container',
    content: [
      { type: 'el-heading', text: 'Inside a container', level: 2 },
      { type: 'el-text', html: '<p>Body copy.</p>' },
    ],
  },
  columns: {
    type: 'columns', cols: 3,
    col0: [{ type: 'el-heading', text: 'One', level: 3 }],
    col1: [{ type: 'el-button', label: 'Go', url: '/x', style: 'line' }],
    col2: [{ type: 'el-image', src: '/a.png', alt: 'A' }],
    col3: [],
  },
  'el-heading': { type: 'el-heading', text: 'Bare heading', level: 3 },
  'el-text': { type: 'el-text', html: '<p>Bare text.</p>' },
  'el-button': { type: 'el-button', label: 'Book a call', url: '/#contact', style: 'y' },
  'el-image': { type: 'el-image', src: '/img/x.jpg', alt: 'An "image"' },
  'el-image-empty': { type: 'el-image', src: '', alt: '' },
  'el-split': { type: 'el-split', src: '/img/s.jpg', alt: 'S', heading: 'Split', html: '<p>Copy.</p>', flip: true },
  'el-stats': { type: 'el-stats', stats: [{ value: '300', suffix: '+', label: 'Workshops' }, { value: '50', suffix: '', label: 'Countries' }] },
  'el-testimonial': { type: 'el-testimonial', quote: 'Great session.', name: 'A. Client', role: 'CEO', org: 'EO' },
  'el-testimonial-bare': { type: 'el-testimonial', quote: 'No org.', name: 'B. Client', role: '', org: '' },
  'el-logos': { type: 'el-logos', logos: [{ src: '/l1.png', alt: 'One' }, { src: '', alt: 'skipped' }, { src: '/l3.png', alt: 'Three' }] },
  'el-features': { type: 'el-features', items: [{ title: 'First', text: 'One.' }, { title: 'Second', text: 'Two.' }, { title: 'Third', text: 'Three.' }] },
  'el-spacer': { type: 'el-spacer', size: 'large', line: false },
  'el-spacer-line': { type: 'el-spacer', size: 'small', line: true },
};

for (const [name, block] of Object.entries(FIXTURES)) {
  test(`parity: ${name} renders identically through the new engine`, () => {
    assert.equal(renderPageBlocks([block]), renderBlocks([block]));
  });
}

test('parity: every legacy block type is covered by a fixture', async () => {
  const { BLOCK_TYPES } = await import('../api/_blocks.js');
  const covered = new Set(Object.values(FIXTURES).map((b) => b.type));
  const missing = Object.keys(BLOCK_TYPES).filter((t) => !covered.has(t));
  assert.deepEqual(missing, [], `uncovered block types: ${missing.join(', ')}`);
});

test('parity: a whole page of mixed blocks (auto-numbering across siblings)', () => {
  const page = [
    FIXTURES['section-heading'],
    FIXTURES['rich-text'],
    FIXTURES.cta,
    FIXTURES.faq,
    FIXTURES.columns,
  ];
  assert.equal(renderPageBlocks(page), renderBlocks(page));
});

test('parity: nested containers restart auto-numbering per child list', () => {
  const page = [
    FIXTURES['section-heading'],
    { type: 'container', content: [FIXTURES['section-heading'], FIXTURES.cta] },
    FIXTURES.cta,
  ];
  assert.equal(renderPageBlocks(page), renderBlocks(page));
});

test('parity: legacy design controls (`d`) become style tokens with the same classes', () => {
  const page = [
    { ...FIXTURES['el-testimonial'], d: { space: 'lg', align: 'c', bg: 'panel' } },
    { ...FIXTURES['el-heading'], d: { space: 'sm' } },
    { ...FIXTURES['el-text'], d: { align: 'r' } },
  ];
  assert.equal(renderPageBlocks(page), renderBlocks(page));
});

test('parity: deeply nested columns inside a column', () => {
  const page = [{
    type: 'columns', cols: 2,
    col0: [{ type: 'columns', cols: 2, col0: [FIXTURES['el-text']], col1: [FIXTURES['el-button']], col2: [], col3: [] }],
    col1: [FIXTURES['el-heading']],
    col2: [], col3: [],
  }];
  assert.equal(renderPageBlocks(page), renderBlocks(page));
});

test('parity: an unknown block type is preserved identically', () => {
  const page = [
    { type: 'from-the-future', html: '<p>payload kept</p>' },
    { type: 'also-unknown' },
  ];
  assert.equal(renderPageBlocks(page), renderBlocks(page));
});

test('parity: the real published /about/ document renders identically', () => {
  const next = renderPageBlocks(ABOUT_BLOCKS);
  assert.equal(next, renderBlocks(ABOUT_BLOCKS));
  assert.match(next, /<details open><summary>/); // the FAQ actually rendered
  assert.ok(next.length > 20000, 'the whole page rendered, not a fragment');
});
