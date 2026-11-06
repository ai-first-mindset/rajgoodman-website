// Blog listing search + author filter (api/_blog-filter.js). The filter works
// on the server-rendered list, so these tests cover the markup it renders and
// run its browser script against a stub page.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAttrs, filterBar, noMatches, authorsOf, PER_PAGE } from '../api/_blog-filter.js';

const posts = [
  { slug: 'a', title: 'AI in Manufacturing', excerpt: 'Shop floor training', categories: ['Industry'], author: 'Raj Goodman Anand' },
  { slug: 'b', title: 'Retail AI', excerpt: 'Store teams', categories: [], author: 'Guest Writer' },
];

test('each item carries its author and lower-cased search text, escaped', () => {
  const attrs = filterAttrs({ title: 'Say "Hi" <b>', excerpt: 'X', categories: ['Cat'], author: 'A&B' });
  assert.match(attrs, / data-author="A&amp;B"/);
  assert.match(attrs, / data-search="say &quot;hi&quot; &lt;b&gt; x cat a&amp;b"/);
});

test('the author menu appears only with two or more authors', () => {
  assert.match(filterBar(posts), /<select id="ba"[^>]*><option value="">All authors<\/option><option value="Guest Writer">Guest Writer<\/option><option value="Raj Goodman Anand">/);
  assert.doesNotMatch(filterBar([posts[0]]), /<select/, 'a menu of one author is noise');
  assert.match(filterBar([posts[0]]), /<input id="bq" type="search"/, 'search shows regardless');
  assert.equal(filterBar([]), '', 'nothing to filter on an empty blog');
  assert.deepEqual(authorsOf(posts), ['Guest Writer', 'Raj Goodman Anand']);
});

function stubPage(withAuthorMenu, list = posts) {
  const els = list.map((p) => {
    const attrs = Object.fromEntries([...filterAttrs(p).matchAll(/data-(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, '&')]));
    const cls = new Set();
    return { slug: p.slug, style: { display: '' }, classList: { add: (c) => cls.add(c), has: (c) => cls.has(c) },
      getAttribute: (k) => attrs[k.replace('data-', '')] };
  });
  const handlers = {};
  const input = { value: '', addEventListener: (ev, fn) => { handlers.q = fn; } };
  const select = { value: '', addEventListener: (ev, fn) => { handlers.a = fn; } };
  const none = { hidden: true };
  const pager = { hidden: true, innerHTML: '', addEventListener: (ev, fn) => { handlers.pager = fn; } };
  const document = {
    getElementById: (id) => ({ bq: input, ba: withAuthorMenu ? select : null, bnone: none, bpager: pager })[id],
    querySelectorAll: () => els,
    querySelector: () => null,
  };
  const src = noMatches().match(/<script>([\s\S]*)<\/script>/)[1];
  new Function('document', src)(document);
  const visible = () => els.filter((e) => e.style.display !== 'none').map((e) => e.slug);
  // Click a pager button by its data-p value, as the delegated handler sees it.
  const go = (n) => handlers.pager({ target: { closest: () => ({ getAttribute: () => String(n) }) } });
  return { input, select, none, pager, handlers, visible, els, go };
}

test('typing filters by every word, in any order; no match shows the message', () => {
  const page = stubPage(true);
  page.input.value = 'training manufacturing'; page.handlers.q();
  assert.deepEqual(page.visible(), ['a']);
  assert.equal(page.none.hidden, true);
  assert.ok(page.els[0].classList.has('is-in'), 'matched items are revealed');
  page.input.value = 'blockchain'; page.handlers.q();
  assert.deepEqual(page.visible(), []);
  assert.equal(page.none.hidden, false);
  page.input.value = ''; page.handlers.q();
  assert.deepEqual(page.visible(), ['a', 'b'], 'clearing the box shows everything again');
});

test('the author menu narrows the list, and combines with search', () => {
  const page = stubPage(true);
  page.select.value = 'Guest Writer'; page.handlers.a();
  assert.deepEqual(page.visible(), ['b']);
  page.input.value = 'manufacturing'; page.handlers.q();
  assert.deepEqual(page.visible(), []);
});

test('the script works without an author menu (single-author blog)', () => {
  const page = stubPage(false);
  page.input.value = 'retail'; page.handlers.q();
  assert.deepEqual(page.visible(), ['b']);
});

const many = Array.from({ length: 30 }, (_, i) => ({
  slug: `p${i + 1}`, title: `Post ${i + 1}`, excerpt: i % 2 ? 'retail' : 'factory', categories: [], author: 'Raj Goodman Anand',
}));

test(`long lists are paged ${PER_PAGE} at a time, with numbered pages`, () => {
  const page = stubPage(false, many);
  assert.deepEqual(page.visible(), many.slice(0, PER_PAGE).map((p) => p.slug), 'page 1 on load');
  assert.equal(page.pager.hidden, false);
  assert.match(page.pager.innerHTML, /aria-current="page">1</);
  assert.match(page.pager.innerHTML, /data-p="3"[^>]*>3</);
  assert.match(page.pager.innerHTML, /Next/);
  assert.doesNotMatch(page.pager.innerHTML, /Previous/, 'no Previous on page 1');
  page.go(3);
  assert.deepEqual(page.visible(), many.slice(24).map((p) => p.slug), 'last page holds the remainder');
  assert.ok(page.els[29].classList.has('is-in'), 'paged-in items are revealed');
  assert.match(page.pager.innerHTML, /Previous/);
  assert.doesNotMatch(page.pager.innerHTML, /Next/, 'no Next on the last page');
});

test('searching goes back to page 1 and pages the matches; short results hide the pager', () => {
  const page = stubPage(false, many);
  page.go(2);
  page.input.value = 'retail'; page.handlers.q();
  assert.deepEqual(page.visible(), many.filter((p) => p.excerpt === 'retail').slice(0, PER_PAGE).map((p) => p.slug));
  assert.equal(page.pager.hidden, false, '15 matches still need two pages');
  page.input.value = 'post 30'; page.handlers.q();
  assert.deepEqual(page.visible(), ['p30']);
  assert.equal(page.pager.hidden, true);
  assert.equal(page.pager.innerHTML, '');
});

test('a short blog shows no pager at all', () => {
  const page = stubPage(true);
  assert.equal(page.pager.hidden, true);
  assert.match(noMatches(), /<nav id="bpager" class="bpager" aria-label="Blog pages" hidden><\/nav>/);
});
