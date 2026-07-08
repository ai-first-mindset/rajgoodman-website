// DOM test for the site-wide back-to-top button (common.js initBackToTop).
// Tiny hand-rolled stub - no jsdom.
// Run: node --test 'tests/**/*.test.js'
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initBackToTop } = require('../common.js');

class ClassList {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }
  contains(c) { return this.s.has(c); }
}
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.classList = new ClassList(); this._a = {}; this.children = []; this._h = {}; }
  set className(v) { this.classList = new ClassList(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  get className() { return [...this.classList.s].join(' '); }
  set type(v) { this._a.type = v; } set innerHTML(v) { this._a.html = v; }
  setAttribute(k, v) { this._a[k] = v; } getAttribute(k) { return this._a[k]; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this._h[t] = this._h[t] || []).push(fn); }
  _fire(t) { (this._h[t] || []).forEach((fn) => fn()); }
}
function install({ reduce = false } = {}) {
  const body = new El('body');
  global.document = { body, createElement: (t) => new El(t) };
  const handlers = {};
  global.window = {
    pageYOffset: 0,
    matchMedia: () => ({ matches: reduce }),
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    _fire: (t) => (handlers[t] || []).forEach((fn) => fn()),
    scrollTo: (opts) => { global.window._scrolledTo = opts; },
  };
  return { body };
}
afterEach(() => { delete global.document; delete global.window; });

test('injects one back-to-top button into the body', () => {
  const { body } = install();
  initBackToTop();
  assert.equal(body.children.length, 1);
  const btn = body.children[0];
  assert.equal(btn.tagName, 'BUTTON');
  assert.equal(btn.className, 'to-top');
  assert.equal(btn.getAttribute('aria-label'), 'Back to top');
});

test('hidden near the top, shown after scrolling down past the threshold', () => {
  const { body } = install();
  initBackToTop();
  const btn = body.children[0];
  assert.equal(btn.classList.contains('show'), false); // pageYOffset 0
  global.window.pageYOffset = 800;
  global.window._fire('scroll');
  assert.equal(btn.classList.contains('show'), true);
  global.window.pageYOffset = 100;
  global.window._fire('scroll');
  assert.equal(btn.classList.contains('show'), false);
});

test('click smooth-scrolls to the top', () => {
  const { body } = install();
  initBackToTop();
  body.children[0]._fire('click');
  assert.deepEqual(global.window._scrolledTo, { top: 0, behavior: 'smooth' });
});

test('reduced-motion preference uses an instant jump', () => {
  const { body } = install({ reduce: true });
  initBackToTop();
  body.children[0]._fire('click');
  assert.equal(global.window._scrolledTo.behavior, 'auto');
});
