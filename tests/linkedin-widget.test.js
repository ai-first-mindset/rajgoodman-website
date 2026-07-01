// DOM tests for the homepage "On LinkedIn" widget render (common.js initLinkedIn).
// Uses a tiny hand-rolled DOM stub — no jsdom, no dependencies.
// Run: node --test 'tests/**/*.test.js'
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// common.js is a classic-script IIFE; require it as CommonJS. Its auto-init is
// guarded on `typeof document`, so requiring it here (no global.document yet)
// only exposes initLinkedIn without running the page bootstrap.
const require = createRequire(import.meta.url);
const { initLinkedIn } = require('../common.js');

/* ---- minimal DOM stub ---- */
class ClassList {
  constructor() { this._set = new Set(); }
  add(c) { this._set.add(c); }
  contains(c) { return this._set.has(c); }
  _reset(str) { this._set = new Set(String(str || '').split(/\s+/).filter(Boolean)); }
}
class El {
  constructor(tag) { this.tagName = String(tag || '').toUpperCase(); this.children = []; this.parentNode = null; this.classList = new ClassList(); this._a = {}; this._html = ''; }
  get className() { return [...this.classList._set].join(' '); }
  set className(v) { this.classList._reset(v); }
  set target(v) { this._a.target = v; } set rel(v) { this._a.rel = v; }
  get href() { return this._a.href; } set href(v) { this._a.href = v; }
  get src() { return this._a.src; } set src(v) { this._a.src = v; }
  get alt() { return this._a.alt; } set alt(v) { this._a.alt = v; }
  set innerHTML(html) { this._html = String(html); this.children = parseChildren(this._html); this.children.forEach(c => { c.parentNode = this; }); }
  get innerHTML() { return this._html; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  _descendants() { const out = []; (function walk(n) { n.children.forEach(c => { out.push(c); walk(c); }); })(this); return out; }
  _match(el, sel) { return sel === 'img' ? el.tagName === 'IMG' : (sel[0] === '.' ? el.classList.contains(sel.slice(1)) : false); }
  querySelector(sel) { return this._descendants().find(el => this._match(el, sel)) || null; }
  querySelectorAll(sel) { return this._descendants().filter(el => this._match(el, sel)); }
}
function parseChildren(html) {
  const els = []; const re = /<([a-zA-Z]+)([^>]*)>/g; let m;
  while ((m = re.exec(html))) { const el = new El(m[1]); const cls = /class=["']([^"']*)["']/.exec(m[2]); if (cls) el.className = cls[1]; els.push(el); }
  return els;
}
function makeGrid(n) {
  const grid = new El('div'); grid.className = 'li-grid';
  for (let i = 0; i < n; i++) {
    const a = new El('a'); a.className = 'li-card'; a.href = 'OLD' + i;
    const img = new El('img'); img.src = 'OLDIMG' + i; img.alt = 'OLDALT' + i; a.appendChild(img);
    grid.appendChild(a);
  }
  return grid;
}
function installDom(grid) {
  global.document = { querySelector: (sel) => (sel === '[data-li-grid]' ? (grid || null) : null), createElement: (tag) => new El(tag) };
}
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete global.document; });
const tick = () => new Promise((r) => setTimeout(r, 20)); // flush fetch().then() chain
function post(n) { return { url: 'U' + n, title: 'T' + n, image_url: 'IMG' + n }; }
function serve(body, opts = {}) { globalThis.fetch = async () => (opts.ok === false ? { ok: false, text: async () => 'err' } : { ok: true, json: async () => body }); }

test('updates the 4 cards in place (count unchanged, layout undisturbed)', async () => {
  const grid = makeGrid(4);
  installDom(grid); serve({ ok: true, posts: [post(1), post(2), post(3), post(4)] });
  initLinkedIn(); await tick();
  const cards = grid.querySelectorAll('.li-card');
  assert.equal(cards.length, 4);
  cards.forEach((a, i) => {
    assert.equal(a.href, 'U' + (i + 1));
    const img = a.querySelector('img');
    assert.equal(img.src, 'IMG' + (i + 1));
    assert.equal(img.alt, 'T' + (i + 1));
  });
});

test('caps at 4 even if the API returns more', async () => {
  const grid = makeGrid(4);
  installDom(grid); serve({ ok: true, posts: [post(1), post(2), post(3), post(4), post(5), post(6)] });
  initLinkedIn(); await tick();
  const cards = grid.querySelectorAll('.li-card');
  assert.equal(cards.length, 4);
  assert.equal(cards[3].href, 'U4');
});

test('appends new cards when the DB has more than the hard-coded ones', async () => {
  const grid = makeGrid(2);
  installDom(grid); serve({ ok: true, posts: [post(1), post(2), post(3), post(4)] });
  initLinkedIn(); await tick();
  const cards = grid.querySelectorAll('.li-card');
  assert.equal(cards.length, 4);
  const appended = cards[3];
  assert.equal(appended.href, 'U4');
  assert.ok(appended.classList.contains('is-in'));
  assert.equal(appended.querySelector('img').src, 'IMG4');
});

test('removes surplus cards when the DB has fewer', async () => {
  const grid = makeGrid(4);
  installDom(grid); serve({ ok: true, posts: [post(1), post(2)] });
  initLinkedIn(); await tick();
  assert.equal(grid.querySelectorAll('.li-card').length, 2);
});

test('keeps the static fallback when the API returns no posts', async () => {
  const grid = makeGrid(4);
  installDom(grid); serve({ ok: true, posts: [] });
  initLinkedIn(); await tick();
  const cards = grid.querySelectorAll('.li-card');
  assert.equal(cards.length, 4);
  assert.equal(cards[0].href, 'OLD0'); // untouched
});

test('keeps the fallback on a non-OK response', async () => {
  const grid = makeGrid(4);
  installDom(grid); serve(null, { ok: false });
  initLinkedIn(); await tick();
  assert.equal(grid.querySelectorAll('.li-card')[0].href, 'OLD0');
});

test('keeps the fallback when fetch throws', async () => {
  const grid = makeGrid(4);
  installDom(grid); globalThis.fetch = async () => { throw new Error('network'); };
  initLinkedIn(); await tick();
  assert.equal(grid.querySelectorAll('.li-card')[0].href, 'OLD0');
});

test('is a no-op when the page has no widget grid', async () => {
  installDom(null);
  let fetched = false; globalThis.fetch = async () => { fetched = true; return { ok: true, json: async () => ({ posts: [] }) }; };
  initLinkedIn(); await tick();
  assert.equal(fetched, false); // returns before fetching
});
