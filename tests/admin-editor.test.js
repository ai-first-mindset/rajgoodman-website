// Tests for the admin app (admin/admin.js, extracted from admin/index.html):
// the category checkbox picker, the inline image alt-text bar, and the pure
// helpers (slugify, esc, parseHash, collect). Requires the real module —
// under Node its DOM wiring (wireAdmin) is skipped and functions + test
// hooks are exported instead, so the file is fully instrumented.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const admin = require('../admin/admin.js');
const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'admin', 'admin.js'), 'utf8');
const HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'admin', 'index.html'), 'utf8');

/* ---- stub DOM: the exported functions resolve document at call time ---- */
const els = {};
function stubEl() { return { innerHTML: '', value: '', style: { display: 'none' }, checked: false }; }
function resetEls(ids) {
  for (const k of Object.keys(els)) delete els[k];
  ids.forEach((id) => { els[id] = stubEl(); });
}
function stubEditor({ onImage = false, attrs = {} } = {}) {
  const calls = [];
  return {
    calls,
    isActive: (name) => (name === 'image' ? onImage : false),
    getAttributes: () => attrs,
    getHTML: () => '<p>the body</p>',
    chain() { return this; },
    focus() { return this; },
    updateAttributes(type, a) { calls.push([type, a]); return this; },
    run() {},
  };
}
beforeEach(() => {
  global.document = {
    getElementById: (id) => els[id],
    querySelectorAll: () => [],
    activeElement: null,
  };
  admin.__test.setEditor(stubEditor());
});
afterEach(() => { delete global.document; delete global.location; });

/* ---- pure helpers ---- */
test('slugify: lowercases, strips accents/punctuation, collapses dashes', () => {
  assert.equal(admin.slugify('  Hello,  World!  '), 'hello-world');
  assert.equal(admin.slugify('AI --- Strategy'), 'ai-strategy');
  assert.equal(admin.slugify(''), '');
  assert.equal(admin.slugify(null), '');
});

test('esc: HTML-escapes the ampersand/brackets/quotes set', () => {
  assert.equal(admin.esc('<b a="x & y">'), '&lt;b a=&quot;x &amp; y&quot;&gt;');
  assert.equal(admin.esc(null), '');
});

test('parseHash: invite tokens, error links, and empty hashes', () => {
  global.location = { hash: '#access_token=at1&refresh_token=rt1&type=invite' };
  assert.deepEqual(admin.parseHash(), { access_token: 'at1', refresh_token: 'rt1', type: 'invite' });
  global.location = { hash: '#error=access_denied&error_code=otp_expired' };
  assert.deepEqual(admin.parseHash(), { error: 'otp_expired' });
  global.location = { hash: '' };
  assert.equal(admin.parseHash(), null);
});

test('collect: trims fields, applies defaults, categories come from the picker', () => {
  const ids = ['f_slug', 'f_title', 'f_seo_title', 'f_meta_description', 'f_excerpt', 'f_featured_image',
    'f_featured_image_alt', 'f_author', 'f_canonical_url', 'f_robots', 'f_focus_keyphrase',
    'f_og_title', 'f_og_description', 'f_og_image'];
  resetEls(ids);
  els.f_slug.value = ' my-post '; els.f_title.value = ' My Post ';
  els.f_author.value = ''; els.f_robots.value = '';
  admin.__test.setCats(['AI Strategy'], ['AI Strategy']);
  admin.__test.setEditor(stubEditor());
  const row = admin.collect();
  assert.equal(row.slug, 'my-post');
  assert.equal(row.title, 'My Post');
  assert.equal(row.author, 'Raj Goodman Anand', 'author defaults');
  assert.match(row.robots, /^index, follow/, 'robots defaults');
  assert.equal(row.seo_title, null, 'empty optionals become null');
  assert.equal(row.body_html, '<p>the body</p>');
  assert.deepEqual(row.categories, ['AI Strategy']);
});

/* ---- category picker ---- */
test('renderCats: empty state shows a hint instead of checkboxes', () => {
  resetEls(['f_catbox']);
  admin.__test.setCats([], []);
  admin.renderCats();
  assert.match(els.f_catbox.innerHTML, /No categories yet/);
  assert.doesNotMatch(els.f_catbox.innerHTML, /checkbox/);
});

test('renderCats: one checkbox per category, checked matches the selection, names escaped', () => {
  resetEls(['f_catbox']);
  admin.__test.setCats(['AI Ethics', 'Q&A "quotes"'], ['AI Ethics']);
  admin.renderCats();
  assert.equal((els.f_catbox.innerHTML.match(/type="checkbox"/g) || []).length, 2);
  assert.match(els.f_catbox.innerHTML, /data-cat="AI Ethics" checked/);
  assert.match(els.f_catbox.innerHTML, /data-cat="Q&amp;A &quot;quotes&quot;"/);
});

test('addNewCat: adds, selects, sorts, clears; case-insensitive dupes select the original', () => {
  resetEls(['f_catbox', 'f_catnew']);
  admin.__test.setCats(['B-Cat'], []);
  els.f_catnew.value = '  A-Cat  ';
  admin.addNewCat();
  assert.deepEqual(admin.__test.getCats().all, ['A-Cat', 'B-Cat']);
  assert.deepEqual([...admin.__test.getCats().sel], ['A-Cat']);
  assert.equal(els.f_catnew.value, '');

  els.f_catnew.value = 'b-cat'; // near-dupe
  admin.addNewCat();
  assert.deepEqual(admin.__test.getCats().all, ['A-Cat', 'B-Cat'], 'no near-dupe minted');
  assert.ok(admin.__test.getCats().sel.has('B-Cat'), 'canonical casing selected');

  els.f_catnew.value = '   '; // blank no-op
  admin.addNewCat();
  assert.deepEqual(admin.__test.getCats().all, ['A-Cat', 'B-Cat']);
});

test('wiring: checkbox changes update CAT_SEL and collect() reads the picker (source guards)', () => {
  assert.match(SRC, /\$\('f_catbox'\)\.addEventListener\('change'/);
  assert.match(SRC, /categories:Array\.from\(CAT_SEL\)/);
  assert.doesNotMatch(SRC, /f_categories/);
});

/* ---- inline alt-text bar ---- */
test('selecting an image shows the alt bar prefilled with its current alt', () => {
  resetEls(['tt-altbar', 'tt-altinput']);
  admin.__test.setEditor(stubEditor({ onImage: true, attrs: { alt: 'existing alt' } }));
  admin.updateToolbarActive();
  assert.equal(els['tt-altbar'].style.display, 'flex');
  assert.equal(els['tt-altinput'].value, 'existing alt');
});

test('no-alt image shows an empty input; leaving the image hides the bar', () => {
  resetEls(['tt-altbar', 'tt-altinput']);
  els['tt-altinput'].value = 'stale';
  admin.__test.setEditor(stubEditor({ onImage: true, attrs: {} }));
  admin.updateToolbarActive();
  assert.equal(els['tt-altinput'].value, '');
  admin.__test.setEditor(stubEditor({ onImage: false }));
  admin.updateToolbarActive();
  assert.equal(els['tt-altbar'].style.display, 'none');
});

test('typing in the alt input is not clobbered by editor transactions', () => {
  resetEls(['tt-altbar', 'tt-altinput']);
  admin.__test.setEditor(stubEditor({ onImage: true, attrs: { alt: 'old' } }));
  els['tt-altinput'].value = 'half-typed new alt';
  global.document.activeElement = els['tt-altinput'];
  admin.updateToolbarActive();
  assert.equal(els['tt-altinput'].value, 'half-typed new alt');
});

test('applyImageAlt writes the trimmed alt onto the image node; no-op off-image', () => {
  resetEls(['tt-altbar', 'tt-altinput']);
  const ed = stubEditor({ onImage: true });
  admin.__test.setEditor(ed);
  els['tt-altinput'].value = '  a better alt  ';
  admin.applyImageAlt();
  assert.equal(JSON.stringify(ed.calls), JSON.stringify([['image', { alt: 'a better alt' }]]));

  const ed2 = stubEditor({ onImage: false });
  admin.__test.setEditor(ed2);
  admin.applyImageAlt();
  assert.deepEqual(ed2.calls, []);
});

test('the alt bar markup lives in the page and its wiring in the app', () => {
  assert.match(HTML, /id="tt-altbar"/);
  assert.match(HTML, /id="tt-altinput"/);
  assert.match(SRC, /\$\('tt-altapply'\)\.addEventListener\('click', applyImageAlt\)/);
});

/* ---- honest failure states ---- */
test('api(): a network throw becomes a normal error result, not an unhandled rejection', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const r = await admin.api('/api/admin/posts/');
    assert.deepEqual(r, { status: 0, ok: false, body: null, netError: true });
  } finally { globalThis.fetch = realFetch; }
});

test('loadFailMsg: session expiry, network, and generic failures each get honest copy', () => {
  assert.match(admin.loadFailMsg({ status: 401 }), /session has expired/);
  assert.match(admin.loadFailMsg({ status: 0, netError: true }), /Network error/);
  assert.match(admin.loadFailMsg({ status: 500 }), /status 500/);
  assert.match(admin.loadFailMsg(undefined), /Could not load/);
});

test('fetchMedia: a failed load returns null (never an empty library) and is not cached', async () => {
  const realFetch = globalThis.fetch;
  let fail = true;
  globalThis.fetch = async () => (fail
    ? { ok: false, status: 500, json: async () => ({}) }
    : { ok: true, status: 200, json: async () => ({ ok: true, files: [{ path: 'a.png' }] }) });
  try {
    assert.equal(await admin.fetchMedia(true), null, 'failure signalled as null');
    fail = false;
    const files = await admin.fetchMedia(); // no force — failure must not have been cached
    assert.equal(files.length, 1, 'retry refetches after a failure');
  } finally { globalThis.fetch = realFetch; }
});

test('loaders render failure copy instead of lying empty states (source guards)', () => {
  assert.match(SRC, /if\(!r\.ok\)\{ const m=\$\('emptyMsg'\); m\.textContent=loadFailMsg\(r\)/, 'posts list');
  assert.match(SRC, /if\(!pr\.ok\)\{ g\.innerHTML=/, 'dashboard');
  assert.match(SRC, /liEmpty'\); e\.textContent=loadFailMsg\(r\)/, 'linkedin list');
  assert.match(SRC, /'<tr><td colspan="5" class="muted">'\+esc\(loadFailMsg\(r\)\)/, 'users table');
  assert.match(SRC, /failed \? \(files\.length-failed\)\+' uploaded, '\+failed\+' failed' : 'Uploaded'/, 'drag-drop counts failures');
});

/* ---- extraction invariants ---- */
test('index.html carries no inline app script — only external script tags', () => {
  assert.match(HTML, /<script src="\/assets\/tiptap\.bundle\.js"><\/script>\s*<script type="module" src="\/builder\/editor\/index\.js"><\/script>\s*<script src="\/admin\/admin\.js"><\/script>/);
  assert.doesNotMatch(HTML, /addEventListener/, 'no leftover inline wiring');
});

test('renderCoverage renders the generated snapshot into the Coverage tab', () => {
  resetEls(['covGlance', 'covTable']);
  const rows = [];
  els.covTable = { querySelector: () => ({ appendChild: (tr) => rows.push(tr) }) };
  global.document.createElement = () => { const el = { innerHTML: '' }; return el; };
  admin.renderCoverage();
  assert.equal(els.covGlance.innerHTML.includes('Tests'), true);
  assert.equal(rows.length, admin.COVERAGE.files.length);
  admin.renderCoverage(); // idempotent — second call must not double-render
  assert.equal(rows.length, admin.COVERAGE.files.length);
});
