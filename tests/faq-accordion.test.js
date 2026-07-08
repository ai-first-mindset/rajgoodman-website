// DOM test for the FAQ auto-collapse behaviour (common.js initFaq).
// Native <details> stay independent by default; initFaq makes each .faq group
// mutually exclusive. Tiny hand-rolled stub - no jsdom.
// Run: node --test 'tests/**/*.test.js'
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initFaq } = require('../common.js');

class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.open = false; this._cls = new Set(); this._h = {}; }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._cls].join(' '); }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this._h[t] = this._h[t] || []).push(fn); }
  _fire(t) { (this._h[t] || []).forEach((fn) => fn()); }
  matches(sel) { return sel[0] === '.' ? this._cls.has(sel.slice(1)) : this.tagName === sel.toUpperCase(); }
  _all(sel) { const out = []; (function walk(n) { n.children.forEach((c) => { if (c.matches && c.matches(sel)) out.push(c); walk(c); }); })(this); return out; }
  querySelectorAll(sel) { return this._all(sel); }
  // simulate a user opening a details: set open, fire the native toggle event
  userOpen() { this.open = true; this._fire('toggle'); }
}
function makeFaq(n) {
  const group = new El('div'); group.className = 'faq';
  const items = [];
  for (let i = 0; i < n; i++) { const d = new El('details'); group.appendChild(d); items.push(d); }
  return { group, items };
}
function installDoc(...groups) {
  const root = new El('root'); groups.forEach((g) => root.appendChild(g));
  global.document = { querySelectorAll: (sel) => root._all(sel) };
}
afterEach(() => { delete global.document; });

test('opening one item collapses the others in the same group', () => {
  const { group, items } = makeFaq(4);
  items[0].open = true; // first starts open (as in the markup)
  installDoc(group);
  initFaq();
  items[2].userOpen();
  assert.equal(items[2].open, true);
  assert.equal(items[0].open, false);
  assert.equal(items[1].open, false);
  assert.equal(items[3].open, false);
});

test('closing an item does not reopen or touch the others', () => {
  const { group, items } = makeFaq(3);
  installDoc(group);
  initFaq();
  items[1].userOpen();
  assert.equal(items[1].open, true);
  items[1].open = false; items[1]._fire('toggle'); // user closes it
  assert.equal(items.every((d) => d.open === false), true);
});

test('two independent .faq groups do not affect each other', () => {
  const a = makeFaq(2), b = makeFaq(2);
  installDoc(a.group, b.group);
  initFaq();
  a.items[0].userOpen();
  b.items[1].userOpen();
  assert.equal(a.items[0].open, true, 'group A item stays open');
  assert.equal(b.items[1].open, true, 'group B item stays open');
});

test('no .faq on the page -> no error', () => {
  installDoc(); // empty
  assert.doesNotThrow(() => initFaq());
});
