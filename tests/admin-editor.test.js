// Tests for the admin editor's category checkbox picker and inline image
// alt-text bar (Arif SEO P1/P2). The admin JS is an inline classic script in
// admin/index.html, so we slice the relevant functions out of the HTML and
// evaluate them in a vm sandbox against a tiny DOM/editor stub — no jsdom,
// no dependencies. If the functions move or are renamed, the extraction
// asserts fail loudly rather than silently testing nothing.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'admin', 'index.html'), 'utf8');

/* ---- extract the code under test from the inline script ---- */
function slice(startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker, s);
  assert.ok(s >= 0 && e > s, `could not extract [${startMarker}] .. [${endMarker}] from admin/index.html`);
  return html.slice(s, e);
}
const escSrc = html.match(/function esc\(s\)\{[^\n]*\}/)?.[0];
assert.ok(escSrc, 'esc() not found');
const catSrc = slice('// --- Category picker', 'async function openEditor');
const altSrc = slice('function updateToolbarActive', '// --- Image upload');
const changeHandler = html.match(/\$\('f_catbox'\)\.addEventListener\('change', (e=>\{[^\n]*\})\);/)?.[1];
assert.ok(changeHandler, 'f_catbox change handler not found');

/* ---- sandbox with stub DOM + stub TipTap editor ---- */
const els = {};
function resetEls() {
  els.f_catbox = { innerHTML: '' };
  els.f_catnew = { value: '' };
  els['tt-altbar'] = { style: { display: 'none' } };
  els['tt-altinput'] = { value: '' };
}
function stubEditor({ onImage = false, attrs = {} } = {}) {
  const calls = [];
  return {
    calls,
    isActive: (name) => (name === 'image' ? onImage : false),
    getAttributes: () => attrs,
    chain() { return this; },
    focus() { return this; },
    updateAttributes(type, a) { calls.push([type, a]); return this; },
    run() {},
  };
}
const sandbox = {
  $: (id) => els[id],
  document: { querySelectorAll: () => [], activeElement: null },
  editor: null,
};
vm.createContext(sandbox);
vm.runInContext(
  `${escSrc}\n${catSrc}\n${altSrc}\n` +
  `this.__t = { renderCats, addNewCat, updateToolbarActive, applyImageAlt,
     catChange: ${changeHandler},
     get: () => ({ all: CAT_ALL, sel: CAT_SEL }),
     set: (all, sel) => { CAT_ALL = all; CAT_SEL = new Set(sel); } };`,
  sandbox,
);
const t = sandbox.__t;

beforeEach(() => { resetEls(); sandbox.document.activeElement = null; sandbox.editor = stubEditor(); });

/* ---- category picker ---- */
test('renderCats: empty state shows a hint instead of checkboxes', () => {
  t.set([], []);
  t.renderCats();
  assert.match(els.f_catbox.innerHTML, /No categories yet/);
  assert.doesNotMatch(els.f_catbox.innerHTML, /checkbox/);
});

test('renderCats: one checkbox per category, checked matches the selection', () => {
  t.set(['AI Ethics', 'AI Governance', 'AI Strategy'], ['AI Strategy']);
  t.renderCats();
  const boxes = els.f_catbox.innerHTML.match(/type="checkbox"/g) || [];
  assert.equal(boxes.length, 3);
  assert.match(els.f_catbox.innerHTML, /data-cat="AI Strategy" checked/);
  assert.doesNotMatch(els.f_catbox.innerHTML, /data-cat="AI Ethics" checked/);
});

test('renderCats: category names are HTML-escaped in the attribute', () => {
  t.set(['Q&A "quotes"'], []);
  t.renderCats();
  assert.match(els.f_catbox.innerHTML, /data-cat="Q&amp;A &quot;quotes&quot;"/);
});

test('addNewCat: adds, selects, sorts, and clears the input', () => {
  t.set(['B-Cat'], []);
  els.f_catnew.value = '  A-Cat  ';
  t.addNewCat();
  assert.deepEqual(t.get().all, ['A-Cat', 'B-Cat']);
  assert.deepEqual([...t.get().sel], ['A-Cat']);
  assert.equal(els.f_catnew.value, '');
});

test('addNewCat: case-insensitive duplicate selects the existing category', () => {
  t.set(['AI Ethics'], []);
  els.f_catnew.value = 'ai ethics';
  t.addNewCat();
  assert.deepEqual(t.get().all, ['AI Ethics']);      // no near-dupe minted
  assert.deepEqual([...t.get().sel], ['AI Ethics']); // canonical casing selected
});

test('addNewCat: blank input is a no-op', () => {
  t.set(['X'], []);
  els.f_catnew.value = '   ';
  t.addNewCat();
  assert.deepEqual(t.get().all, ['X']);
  assert.equal(t.get().sel.size, 0);
});

test('checkbox change handler adds/removes from the selection', () => {
  t.set(['AI Ethics'], []);
  const cb = { checked: true, getAttribute: () => 'AI Ethics' };
  t.catChange({ target: { closest: () => cb } });
  assert.ok(t.get().sel.has('AI Ethics'));
  cb.checked = false;
  t.catChange({ target: { closest: () => cb } });
  assert.ok(!t.get().sel.has('AI Ethics'));
  t.catChange({ target: { closest: () => null } }); // click elsewhere: no crash
});

test('save path collects categories from the picker, not a text field', () => {
  assert.match(html, /categories:Array\.from\(CAT_SEL\)/);
  assert.doesNotMatch(html, /f_categories/);
});

/* ---- inline alt-text bar ---- */
test('selecting an image shows the alt bar prefilled with its current alt', () => {
  sandbox.editor = stubEditor({ onImage: true, attrs: { alt: 'existing alt' } });
  t.updateToolbarActive();
  assert.equal(els['tt-altbar'].style.display, 'flex');
  assert.equal(els['tt-altinput'].value, 'existing alt');
});

test('an image with no alt shows the bar with an empty input', () => {
  els['tt-altinput'].value = 'stale';
  sandbox.editor = stubEditor({ onImage: true, attrs: {} });
  t.updateToolbarActive();
  assert.equal(els['tt-altbar'].style.display, 'flex');
  assert.equal(els['tt-altinput'].value, '');
});

test('the bar hides when the selection leaves the image', () => {
  els['tt-altbar'].style.display = 'flex';
  sandbox.editor = stubEditor({ onImage: false });
  t.updateToolbarActive();
  assert.equal(els['tt-altbar'].style.display, 'none');
});

test('typing in the alt input is not clobbered by editor transactions', () => {
  sandbox.editor = stubEditor({ onImage: true, attrs: { alt: 'old' } });
  els['tt-altinput'].value = 'half-typed new alt';
  sandbox.document.activeElement = els['tt-altinput'];
  t.updateToolbarActive();
  assert.equal(els['tt-altinput'].value, 'half-typed new alt');
});

test('applyImageAlt writes the trimmed alt onto the image node', () => {
  const ed = stubEditor({ onImage: true });
  sandbox.editor = ed;
  els['tt-altinput'].value = '  a better alt  ';
  t.applyImageAlt();
  // JSON compare: the attrs object is created inside the vm realm, so
  // deepStrictEqual would fail on cross-realm prototype identity.
  assert.equal(JSON.stringify(ed.calls), JSON.stringify([['image', { alt: 'a better alt' }]]));
});

test('applyImageAlt is a no-op when no image is selected', () => {
  const ed = stubEditor({ onImage: false });
  sandbox.editor = ed;
  els['tt-altinput'].value = 'anything';
  t.applyImageAlt();
  assert.deepEqual(ed.calls, []);
});

test('the alt bar markup and wiring exist in the page', () => {
  assert.match(html, /id="tt-altbar"/);
  assert.match(html, /id="tt-altinput"/);
  assert.match(html, /\$\('tt-altapply'\)\.addEventListener\('click', applyImageAlt\)/);
});
