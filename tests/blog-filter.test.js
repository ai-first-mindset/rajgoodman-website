// Blog listing search + author filter (api/_blog-filter.js). The filter works
// on the server-rendered list, so these tests cover the markup it renders and
// run its browser script against a stub page.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAttrs, filterBar, noMatches, authorsOf } from '../api/_blog-filter.js';

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

function stubPage(withAuthorMenu) {
  const els = posts.map((p) => {
    const attrs = Object.fromEntries([...filterAttrs(p).matchAll(/data-(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, '&')]));
    const cls = new Set();
    return { slug: p.slug, style: { display: '' }, classList: { add: (c) => cls.add(c), has: (c) => cls.has(c) },
      getAttribute: (k) => attrs[k.replace('data-', '')] };
  });
  const handlers = {};
  const input = { value: '', addEventListener: (ev, fn) => { handlers.q = fn; } };
  const select = { value: '', addEventListener: (ev, fn) => { handlers.a = fn; } };
  const none = { hidden: true };
  const document = {
    getElementById: (id) => ({ bq: input, ba: withAuthorMenu ? select : null, bnone: none })[id],
    querySelectorAll: () => els,
  };
  const src = noMatches().match(/<script>([\s\S]*)<\/script>/)[1];
  new Function('document', src)(document);
  const visible = () => els.filter((e) => e.style.display !== 'none').map((e) => e.slug);
  return { input, select, none, handlers, visible, els };
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
