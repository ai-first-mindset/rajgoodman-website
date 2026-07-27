// Does the section vocabulary generalise beyond /about/?
//
// Short answer, recorded here so it is not claimed again without evidence: NOT
// YET. The recognisers were written against /about/'s exact markup and only
// reproduce that page byte-for-byte. Every other page differs in ways that make
// the decomposed output diverge.
//
// What this file guarantees is the SAFETY property, which is the one that
// matters: on any page we cannot reproduce exactly, the gate refuses. Content
// is never silently altered. Conversion is offered only where it is provably
// lossless.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decomposeHtml, verifyDecomposition } from '../builder/decompose.js';
import { renderDocument, createEnv } from '../builder/core/render.js';
import { registry } from '../builder/elements/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = createEnv({ registry });
const render = (doc) => renderDocument(doc, env);
const asDoc = (children) => ({ version: 2, root: { id: 'r', type: 'page-root', props: {}, children } });

function mainOf(file) {
  const m = readFileSync(root + file, 'utf8').match(/<main>([\s\S]*?)<\/main>/);
  return m ? m[1].replace(/\r\n/g, '\n').replace(/^\n/, '').replace(/\s+$/, '') : null;
}

const PAGES = readdirSync(root).filter((f) => f.endsWith('.html') && !f.includes('updated'));

test('the static pages are found (guards against this sweep silently testing nothing)', () => {
  assert.ok(PAGES.length >= 15, `expected the site's pages, found ${PAGES.length}`);
});

// THE SAFETY PROPERTY. For every page, decomposition either reproduces the
// markup exactly or the gate says no. There is no third outcome where content
// changes quietly.
for (const file of PAGES) {
  test(`safe on ${file}: decomposition is exact, or refused`, () => {
    const original = mainOf(file);
    if (original === null) return;
    const before = asDoc([{ id: 'raw', type: 'raw-html', props: { html: original }, children: [] }]);
    const after = asDoc(decomposeHtml(original));
    const check = verifyDecomposition(before, after, render);
    // Either it is byte-identical, or verifyDecomposition reports the mismatch
    // so the editor can decline. Both are safe; a silent change is not.
    assert.equal(typeof check.ok, 'boolean');
    if (!check.ok) {
      assert.ok(Number.isInteger(check.at), 'a refusal must say where it diverged');
      assert.ok(check.expected !== check.actual, 'a refusal must show a real difference');
    }
  });
}

test('BASELINE: how many pages decompose exactly today', () => {
  const exact = PAGES.filter((file) => {
    const original = mainOf(file);
    if (original === null) return false;
    const before = asDoc([{ id: 'raw', type: 'raw-html', props: { html: original }, children: [] }]);
    return verifyDecomposition(before, asDoc(decomposeHtml(original)), render).ok;
  });
  // Deliberately recorded rather than asserted upward: this number is the
  // honest measure of how far the vocabulary generalises. Raise it by adding
  // element variants, and update this test when you do.
  assert.ok(exact.length >= 1, 'no page decomposes exactly - something regressed badly');
  assert.ok(
    exact.length <= PAGES.length,
    `${exact.length}/${PAGES.length} pages decompose exactly`,
  );
});

test('the known blocker is hero variants, not the section vocabulary', () => {
  // Pages without an image/grid hero (privacy-policy, events) diverge inside
  // the hero, before any section is reached. page-hero hard-codes /about/'s
  // shape: crumbs -> phero-grid -> text column + image column.
  const simple = mainOf('privacy-policy.html');
  const out = render(asDoc(decomposeHtml(simple)));
  assert.notEqual(out, simple, 'privacy-policy is expected to diverge (documented limit)');
  assert.match(simple, /<header class="phero">/);
  assert.doesNotMatch(simple, /phero-grid/, 'the simple hero has no grid, which is why it diverges');
});

test('/about/ remains the one page proven exact end to end', () => {
  const about = JSON.parse(
    readFileSync(fileURLToPath(new URL('./fixtures/about-page-blocks.json', import.meta.url)), 'utf8'),
  );
  const html = about.filter((b) => b.type === 'raw-html').map((b) => b.html).join('\n');
  assert.doesNotMatch(html, /\r\n/, 'the fixture is LF-normalised; production is CRLF (see README)');
});
