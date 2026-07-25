// Membership promo (founding rate ends 15 Sept 2026): the site-wide
// announcement bar + founding/standard copy switch in common.js, and the
// end-of-post CTA in api/_post-template.js.
// Tiny hand-rolled DOM stub in the style of back-to-top.test.js - no jsdom.
// Run: node --test 'tests/**/*.test.js'
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { renderPost, membershipCta } from '../api/_post-template.js';

const require = createRequire(import.meta.url);
const { initPromoBar, initFoundingCopy, promoDaysLeft, initHashScroll } = require('../common.js');

const BEFORE = new Date('2026-07-25T12:00:00Z');            // founding window open
const AFTER = new Date('2026-09-16T12:00:00+04:00');        // offer over

class ClassList {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }
  contains(c) { return this.s.has(c); }
}
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.classList = new ClassList();
    this._a = {}; this.children = []; this._h = {}; this._q = {};
    this.parentNode = null; this.offsetHeight = 40; this.textContent = '';
    this._top = 0;
    const props = {};
    this.style = {
      _p: props, display: '',
      setProperty(k, v) { props[k] = v; },
      removeProperty(k) { delete props[k]; },
    };
  }
  getBoundingClientRect() { return { top: this._top }; }
  set className(v) { this.classList = new ClassList(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  get className() { return [...this.classList.s].join(' '); }
  set innerHTML(v) { this._a.html = v; }
  get innerHTML() { return this._a.html || ''; }
  setAttribute(k, v) { this._a[k] = v; } getAttribute(k) { return this._a[k]; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c) { c.parentNode = this; this.children.unshift(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  get firstChild() { return this.children[0] || null; }
  addEventListener(t, fn) { (this._h[t] = this._h[t] || []).push(fn); }
  _fire(t) { (this._h[t] || []).forEach((fn) => fn()); }
  /* Children set via innerHTML exist only as markup in this stub; hand back a
     cached synthetic element when the markup carries the queried class. */
  querySelector(sel) {
    const cls = sel.slice(1);
    if (this.innerHTML.indexOf('class="' + cls) !== -1) {
      if (!this._q[sel]) this._q[sel] = new El('button');
      return this._q[sel];
    }
    return null;
  }
}
function install({ dismissed = false, qsa = {}, qs = {}, hash = '' } = {}) {
  const head = new El('head'); const body = new El('body'); const docEl = new El('html');
  const store = {};
  if (dismissed) store.rg_promo_founding2026_dismissed = '1';
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  global.document = {
    head, body, documentElement: docEl,
    createElement: (t) => new El(t),
    querySelector: (sel) => {
      if (sel in qs) return qs[sel];
      return sel === '.pbar' ? body.children.find((c) => c.classList.contains('pbar')) || null : null;
    },
    querySelectorAll: (sel) => qsa[sel] || [],
  };
  const handlers = {};
  global.window = {
    pageYOffset: 0,
    location: { pathname: '/', hash },
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    removeEventListener: (t, fn) => { if (handlers[t]) handlers[t] = handlers[t].filter((f) => f !== fn); },
    scrollTo: (x, y) => { global.window._scrolledTo = y; global.window.pageYOffset = y; },
    _fire: (t) => (handlers[t] || []).forEach((fn) => fn()),
  };
  return { head, body, docEl, store };
}
afterEach(() => { delete global.document; delete global.window; delete global.localStorage; });

/* ---- promoDaysLeft ---- */

test('days remaining is positive before the deadline, zero/negative after', () => {
  assert.ok(promoDaysLeft(BEFORE) > 0);
  assert.ok(promoDaysLeft(AFTER) <= 0);
  assert.equal(promoDaysLeft(new Date('2026-09-15T11:59:00+04:00')), 1);
});

/* ---- initPromoBar ---- */

test('injects the bar once, styles into <head>, marks <html>, sets --pbar-h', () => {
  const { head, body, docEl } = install();
  initPromoBar(BEFORE);
  assert.equal(body.children.length, 1);
  const bar = body.firstChild;
  assert.ok(bar.classList.contains('pbar'));
  assert.match(bar.innerHTML, /resources\.aifirstmindset\.ai\/membership/);
  assert.match(bar.innerHTML, /utm_content=announcement-bar/);
  assert.match(bar.innerHTML, /\$3,000/);
  assert.match(bar.innerHTML, /days left/);
  assert.equal(head.children.length, 1, 'promo CSS <style> appended');
  assert.ok(docEl.classList.contains('has-pbar'));
  assert.equal(docEl.style._p['--pbar-h'], '40px');
  initPromoBar(BEFORE); // second call is a no-op
  assert.equal(body.children.length, 1);
});

test('not injected when previously dismissed', () => {
  const { body } = install({ dismissed: true });
  initPromoBar(BEFORE);
  assert.equal(body.children.length, 0);
});

test('not injected after the founding deadline', () => {
  const { body, docEl } = install();
  initPromoBar(AFTER);
  assert.equal(body.children.length, 0);
  assert.ok(!docEl.classList.contains('has-pbar'));
});

test('dismiss removes the bar, unmarks <html>, and persists the choice', () => {
  const { body, docEl, store } = install();
  initPromoBar(BEFORE);
  const bar = body.firstChild;
  bar.querySelector('.pbar-x')._fire('click');
  assert.equal(body.children.length, 0);
  assert.ok(!docEl.classList.contains('has-pbar'));
  assert.equal(store.rg_promo_founding2026_dismissed, '1');
  assert.equal(docEl.style._p['--pbar-h'], undefined);
});

test('bar slides away past 250px of scroll and returns at the top', () => {
  const { docEl } = install();
  initPromoBar(BEFORE);
  global.window.pageYOffset = 600;
  global.window._fire('scroll');
  assert.ok(docEl.classList.contains('pbar-hidden'));
  global.window.pageYOffset = 0;
  global.window._fire('scroll');
  assert.ok(!docEl.classList.contains('pbar-hidden'));
});

/* ---- initFoundingCopy ---- */

test('fills [data-founding-days] during the founding window, leaves copy alone', () => {
  const days = new El('span'); const foundingOnly = new El('span'); const standardOnly = new El('span');
  standardOnly.style.display = 'none';
  install({ qsa: { '[data-founding-days]': [days], '[data-founding-only]': [foundingOnly], '[data-standard-only]': [standardOnly] } });
  initFoundingCopy(BEFORE);
  assert.match(days.textContent, /^\d+ days left$/);
  assert.equal(foundingOnly.style.display, '');
  assert.equal(standardOnly.style.display, 'none');
});

test('after the deadline: founding copy hidden, standard copy shown, counter cleared', () => {
  const days = new El('span'); const foundingOnly = new El('span'); const standardOnly = new El('span');
  standardOnly.style.display = 'none';
  install({ qsa: { '[data-founding-days]': [days], '[data-founding-only]': [foundingOnly], '[data-standard-only]': [standardOnly] } });
  initFoundingCopy(AFTER);
  assert.equal(days.textContent, '');
  assert.equal(foundingOnly.style.display, 'none');
  assert.equal(standardOnly.style.display, '');
});

/* ---- initHashScroll (cross-page anchor fix) ---- */

test('scrolls the #hash target under the fixed nav (76px offset, no bar)', () => {
  const target = new El('section'); target._top = 3600;
  install({ hash: '#chapter-terms', qs: { '#chapter-terms': target } });
  initHashScroll();
  assert.equal(global.window._scrolledTo, 3600 - 76);
});

test('adds the promo bar height + gap to the anchor offset when the bar is shown', () => {
  const target = new El('section'); target._top = 3600;
  install({ hash: '#chapter-terms', qs: { '#chapter-terms': target } });
  initPromoBar(BEFORE); // injects a 40px-tall bar; 16px breathing gap below it
  initHashScroll();
  assert.equal(global.window._scrolledTo, 3600 - 76 - 40 - 16);
});

test('no hash or missing target: no scroll', () => {
  install({ hash: '' });
  initHashScroll();
  assert.equal(global.window._scrolledTo, undefined);
  install({ hash: '#nope' });
  initHashScroll();
  assert.equal(global.window._scrolledTo, undefined);
});

/* ---- blog end-of-post CTA ---- */

const base = {
  slug: 'test-post',
  title: 'Test Post',
  body_html: '<p>Hello</p>',
  published_at: '2026-07-01T00:00:00Z',
  author: 'Raj Goodman Anand',
};

test('founding window: CTA carries the founding rate and deadline', () => {
  const html = membershipCta(BEFORE.getTime());
  assert.match(html, /class="pcta"/);
  assert.match(html, /\$3,000/);
  assert.match(html, /ends 15 Sept/);
  assert.match(html, /utm_content=blog-post/);
});

test('after the deadline: CTA drops the founding rate, keeps the pitch', () => {
  const html = membershipCta(AFTER.getTime());
  assert.doesNotMatch(html, /\$3,000/);
  assert.doesNotMatch(html, /15 Sept/);
  assert.match(html, /three sprints/);
  assert.match(html, /utm_content=blog-post/);
});

test('renderPost places the CTA between the article and Work With Us', () => {
  const html = renderPost(base);
  const cta = html.indexOf('class="pcta"');
  assert.ok(cta !== -1, 'CTA present');
  assert.ok(html.indexOf('</article>') < cta, 'after the article');
  assert.ok(cta < html.indexOf('Work With Us'), 'before the Work With Us section');
});
