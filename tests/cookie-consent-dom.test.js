// DOM tests for the cookie-consent banner/panel (assets/cookie-consent.js
// boot path): Consent Mode v2 defaults before any choice, banner lifecycle,
// accept/reject/preferences flows, storage record, returning-visitor path,
// and the footer reopen link. The pure helpers are covered by
// cookie-consent.test.js; this file exercises the browser wiring.
// Run: node --test 'tests/**/*.test.js'
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MODULE = require.resolve('../assets/cookie-consent.js');

/* ---- DOM stub with parsing + attr-aware checked/disabled ---- */
const VOID = new Set(['input', 'img', 'br', 'hr', 'link']);
class TextNode { constructor(t) { this.nodeText = t; this.parentNode = null; } get textContent() { return this.nodeText; } }
class El {
  constructor(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.children = []; this.parentNode = null;
    this._attrs = {}; this._text = ''; this._handlers = {}; this.style = {};
  }
  get id() { return this._attrs.id || ''; }
  get className() { return this._attrs['class'] || ''; }
  set className(v) { this._attrs['class'] = v; }
  getAttribute(n) { return n in this._attrs ? this._attrs[n] : null; }
  setAttribute(n, v) { this._attrs[n] = String(v); }
  get checked() { return this._checked !== undefined ? this._checked : this.getAttribute('checked') !== null; }
  set checked(v) { this._checked = !!v; }
  get disabled() { return this._disabled !== undefined ? this._disabled : this.getAttribute('disabled') !== null; }
  set disabled(v) { this._disabled = !!v; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(html) { this._text = ''; this.children = []; parseInto(this, String(html)); }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); }
  _fire(type, ev) { (this._handlers[type] || []).forEach((fn) => fn(ev)); }
  focus() { lastFocused = this; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) { return this._desc().filter((el) => el._match(sel)); }
  _desc() { const out = []; (function w(n) { (n.children || []).forEach((c) => { if (c instanceof El) { out.push(c); w(c); } }); })(this); return out; }
  _match(sel) {
    if (sel.includes(',')) return sel.split(',').some((s) => this._match(s.trim()));
    let mustBeEnabled = false;
    sel = sel.replace(/:not\(\[disabled\]\)/, () => { mustBeEnabled = true; return ''; });
    if (mustBeEnabled && this.getAttribute('disabled') !== null) return false;
    const m = /^([a-zA-Z][a-zA-Z0-9]*)?(#[\w-]+)?((?:\.[\w-]+)*)((?:\[[\w-]+(?:="[^"]*")?\])*)$/.exec(sel);
    if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && this.id !== m[2].slice(1)) return false;
    if (m[3]) for (const c of m[3].split('.').filter(Boolean)) { if (!(' ' + this.className + ' ').includes(' ' + c + ' ')) return false; }
    if (m[4]) { const re = /\[([\w-]+)(?:="([^"]*)")?\]/g; let a; while ((a = re.exec(m[4]))) { const v = this.getAttribute(a[1]); if (v === null) return false; if (a[2] != null && v !== a[2]) return false; } }
    return true;
  }
}
function parseInto(root, html) {
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g;
  const stack = [root]; let m;
  while ((m = re.exec(html))) {
    if (m[4] != null) { if (m[4].trim()) stack[stack.length - 1].appendChild(new TextNode(m[4])); continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const el = new El(m[2]);
    const attrRe = /([\w-]+)(?:="([^"]*)")?/g; let a;
    while ((a = attrRe.exec(m[3] || ''))) el._attrs[a[1]] = a[2] == null ? '' : a[2];
    stack[stack.length - 1].appendChild(el);
    if (!VOID.has(m[2].toLowerCase())) stack.push(el);
  }
}

/* ---- environment + fresh module load per scenario ---- */
let body, head, store, docHandlers, lastFocused;
function boot(storedRaw, { withFooter = true } = {}) {
  body = new El('body'); head = new El('head'); docHandlers = {}; lastFocused = null;
  if (withFooter) { const f = new El('div'); f.className = 'f-bot'; body.appendChild(f); }
  store = new Map();
  if (storedRaw) store.set('rg_cookie_consent', storedRaw);
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  global.document = {
    body, head, documentElement: head, readyState: 'complete', activeElement: null,
    createElement: (t) => new El(t),
    querySelector: (s) => body.querySelector(s) || head.querySelector(s),
    addEventListener: (type, fn) => { (docHandlers[type] = docHandlers[type] || []).push(fn); },
    removeEventListener: (type, fn) => { docHandlers[type] = (docHandlers[type] || []).filter((f) => f !== fn); },
    _fire: (type, ev) => (docHandlers[type] || []).slice().forEach((fn) => fn(ev)),
  };
  global.window = { dataLayer: [] };
  delete require.cache[MODULE];
  require(MODULE);
  return global.window.dataLayer;
}
afterEach(() => { delete global.document; delete global.window; delete global.localStorage; });

const banner = () => body.querySelector('.cc-banner');
const overlay = () => body.querySelector('.cc-overlay');
const clickBanner = (act) => banner()._fire('click', { target: banner().querySelector('[data-cc="' + act + '"]') });
const updates = (dl) => dl.filter((e) => Array.from(e || [])[0] === 'consent' && Array.from(e)[1] === 'update').map((e) => Array.from(e)[2]);

test('first visit: Consent Mode defaults deny all storage BEFORE any UI, banner shows, CSS injected', () => {
  const dl = boot(null);
  const def = Array.from(dl[0]);
  assert.deepEqual(def.slice(0, 2), ['consent', 'default']);
  assert.equal(def[2].ad_storage, 'denied');
  assert.equal(def[2].analytics_storage, 'denied');
  assert.equal(def[2].security_storage, 'granted');
  assert.ok(banner(), 'banner rendered');
  assert.ok(head.querySelector('link[data-cc-css]'), 'stylesheet injected once');
  assert.equal(updates(dl).length, 0, 'no update before a choice');
});

test('Accept all: full grant pushed, choice persisted with version+timestamp, banner removed', () => {
  const dl = boot(null);
  clickBanner('accept');
  const up = updates(dl)[0];
  assert.deepEqual(up, { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
  const rec = JSON.parse(store.get('rg_cookie_consent'));
  assert.equal(rec.version, 1);
  assert.ok(rec.ts > 0);
  assert.deepEqual(rec.consent, { analytics: true, marketing: true, necessary: true });
  assert.equal(banner(), null, 'banner gone');
  assert.ok(dl.some((e) => e && e.event === 'cookie_consent_update'), 'GTM event pushed');
});

test('Reject all: everything optional stays denied and is persisted that way', () => {
  const dl = boot(null);
  clickBanner('reject');
  const up = updates(dl)[0];
  assert.equal(up.analytics_storage, 'denied');
  assert.equal(up.ad_storage, 'denied');
  assert.deepEqual(JSON.parse(store.get('rg_cookie_consent')).consent, { analytics: false, marketing: false, necessary: true });
});

test('Preferences: panel lists the categories, necessary is locked on, granular save works', () => {
  const dl = boot(null);
  clickBanner('prefs');
  const panel = overlay().querySelector('.cc-panel');
  const inputs = panel.querySelectorAll('input[data-cat]');
  assert.deepEqual(inputs.map((i) => i.getAttribute('data-cat')), ['necessary', 'analytics', 'marketing']);
  assert.ok(inputs[0].checked && inputs[0].disabled, 'necessary locked on');
  inputs[1].checked = true; // allow analytics only
  panel._fire('click', { target: panel.querySelector('[data-cc="save"]') });
  const up = updates(dl)[0];
  assert.equal(up.analytics_storage, 'granted');
  assert.equal(up.ad_storage, 'denied');
  assert.equal(overlay(), null, 'panel closed');
  assert.equal(banner(), null, 'banner also dismissed');
});

test('Escape closes the panel without deciding anything', () => {
  boot(null);
  clickBanner('prefs');
  assert.ok(overlay());
  global.document._fire('keydown', { key: 'Escape' });
  assert.equal(overlay(), null);
  assert.equal(store.size, 0, 'nothing persisted');
  assert.ok(banner(), 'banner still up');
});

test('returning visitor with a valid stored choice: no banner, consent re-applied', () => {
  const stored = JSON.stringify({ version: 1, ts: Date.now(), consent: { analytics: true, marketing: false, necessary: true } });
  const dl = boot(stored);
  assert.equal(banner(), null);
  const up = updates(dl)[0];
  assert.equal(up.analytics_storage, 'granted');
  assert.equal(up.ad_storage, 'denied');
});

test('stale stored choice (old version) re-prompts with the banner', () => {
  const stored = JSON.stringify({ version: 0, ts: Date.now(), consent: { analytics: true } });
  boot(stored);
  assert.ok(banner(), 're-consent required');
});

test('footer gets a Cookie settings control that reopens the panel; RGCookieConsent.reset clears storage', () => {
  boot(JSON.stringify({ version: 1, ts: Date.now(), consent: { analytics: false, marketing: false, necessary: true } }));
  const link = body.querySelector('.cc-open');
  assert.equal(link.textContent, 'Cookie settings');
  link._fire('click', { target: link });
  assert.ok(overlay(), 'panel reopened from the footer');
  global.window.RGCookieConsent.reset();
  assert.equal(store.size, 0);
});
