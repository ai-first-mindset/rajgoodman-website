// User-flow tests for the gated-download modal (common.js initDownloads):
// click an eBook button -> modal opens for that asset -> human verification
// gates submit -> the endpoint response unlocks the file in-page.
// Uses a small nested-DOM stub (the modal has real structure) — no jsdom.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initDownloads } = require('../common.js');

/* ---- minimal nested DOM stub ---- */
const VOID = new Set(['input', 'img', 'br', 'hr']);
class El {
  constructor(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.children = []; this.parentNode = null;
    this._attrs = {}; this._text = ''; this._handlers = {};
    this.style = {}; this.disabled = false; this.value = '';
  }
  get id() { return this._attrs.id || ''; }
  get className() { return this._attrs['class'] || ''; }
  set className(v) { this._attrs['class'] = v; }
  getAttribute(n) { return n in this._attrs ? this._attrs[n] : null; }
  setAttribute(n, v) { this._attrs[n] = String(v); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(html) { this._text = ''; this.children = []; parseInto(this, String(html)); }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); }
  _fire(type, ev) { (this._handlers[type] || []).forEach((fn) => fn(ev)); }
  click() { this._fire('click', { target: this, preventDefault() {} }); }
  requestSubmit() { this._fire('submit', { target: this, preventDefault() {} }); }
  focus() {}
  closest(sel) { let n = this; while (n) { if (n._matchOne && n._matchOne(sel)) return n; n = n.parentNode; } return null; }
  _matchOne(sel) {
    if (sel[0] === '.') return (' ' + this.className + ' ').includes(' ' + sel.slice(1) + ' ');
    if (sel[0] === '#') return this.id === sel.slice(1);
    if (sel[0] === '[') return this.getAttribute(sel.slice(1, -1)) !== null;
    return this.tagName === sel.toUpperCase();
  }
  _descendants() {
    const out = [];
    (function walk(n) {
      (n.children || []).forEach((c) => { if (c instanceof El) { out.push(c); walk(c); } });
    })(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/); // descendant combinator only
    let set = this._descendants().filter((el) => el._matchOne(parts[0]));
    for (const p of parts.slice(1)) {
      const next = [];
      set.forEach((anc) => anc._descendants().forEach((el) => { if (el._matchOne(p) && !next.includes(el)) next.push(el); }));
      set = next;
    }
    return set;
  }
}
class TextNode { constructor(t) { this.nodeText = t; this.parentNode = null; } get textContent() { return this.nodeText; } }
function parseInto(root, html) {
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g;
  const stack = [root]; let m;
  while ((m = re.exec(html))) {
    if (m[4] != null) { const t = m[4]; if (t.trim()) stack[stack.length - 1].appendChild(new TextNode(t)); continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; } // closing tag
    const el = new El(m[2]);
    const attrRe = /([\w-]+)(?:="([^"]*)")?/g; let a;
    while ((a = attrRe.exec(m[3] || ''))) el._attrs[a[1]] = a[2] == null ? '' : a[2];
    stack[stack.length - 1].appendChild(el);
    if (!VOID.has(m[2].toLowerCase())) stack.push(el);
  }
}

/* ---- environment ---- */
let body, turnstile, opened, fetchCalls, fetchImpl;
function makeBookCard(assetKey, title) {
  const card = new El('article'); card.className = 'book';
  const h3 = new El('h3'); h3.textContent = title; card.appendChild(h3);
  const a = new El('a'); a.className = 'p'; a.setAttribute('data-download', assetKey); card.appendChild(a);
  body.appendChild(card);
  return a;
}
function installEnv({ withTurnstile = true } = {}) {
  body = new El('body');
  const head = new El('head');
  const docHandlers = {};
  global.document = {
    body, head,
    createElement: (t) => new El(t),
    createTextNode: (t) => new TextNode(t),
    querySelector: (s) => body.querySelector(s),
    querySelectorAll: (s) => body.querySelectorAll(s),
    addEventListener: (type, fn) => { (docHandlers[type] = docHandlers[type] || []).push(fn); },
    _fire: (type, ev) => (docHandlers[type] || []).forEach((fn) => fn(ev)),
  };
  turnstile = withTurnstile ? {
    token: 'live-token', rendered: [], resets: 0,
    render(mount, opts) { this.rendered.push({ mount, sitekey: opts.sitekey }); return 7; },
    getResponse(id) { return id === 7 ? this.token : ''; },
    reset() { this.resets++; },
  } : undefined;
  opened = [];
  global.window = { turnstile, open: (url) => opened.push(url) };
  global.location = { host: 'rajgoodman.com', pathname: '/' };
  fetchCalls = [];
  fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, url: 'https://x/downloads/a.pdf', title: 'The Book', pending: false }) });
  globalThis.fetch = (url, opts) => { fetchCalls.push({ url, body: JSON.parse(opts.body) }); return fetchImpl(url, opts); };
}
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete global.document; delete global.window; delete global.location; });
const tick = () => new Promise((r) => setTimeout(r, 10));
const modal = () => body.querySelector('.dlm-overlay');

/* ---- the user flow ---- */

test('no download buttons on the page -> nothing is built', () => {
  installEnv();
  initDownloads();
  assert.equal(modal(), null);
});

test('clicking an eBook button opens the modal for that book', () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'The AI Era — Adapting & Thriving');
  initDownloads();
  btn.click();
  const o = modal();
  assert.ok(o, 'overlay exists');
  assert.equal(o.style.display, 'grid');
  assert.equal(o.querySelector('.dlm-asset').textContent, 'The AI Era — Adapting & Thriving');
  assert.ok(o.querySelector('#dlm-name'));
  assert.ok(o.querySelector('#dlm-email'));
  assert.equal(o.querySelector('.dlm-success').style.display, 'none');
});

test('the Turnstile widget is rendered into the modal on open, reset on reopen', () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  assert.equal(turnstile.rendered.length, 1);
  assert.ok(turnstile.rendered[0].sitekey, 'sitekey passed');
  modal().querySelector('.dlm-close').click();
  btn.click();
  assert.equal(turnstile.rendered.length, 1, 'widget not re-rendered');
  assert.equal(turnstile.resets, 1, 'widget reset instead');
});

test('submit without completing verification is blocked before any request', async () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  turnstile.token = ''; // human has not ticked the box
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  assert.equal(fetchCalls.length, 0);
  assert.match(modal().querySelector('.dlm-form .btn').textContent, /complete the verification/i);
});

test('ad-blocked Turnstile (no window.turnstile) shows the email fallback message', async () => {
  installEnv({ withTurnstile: false });
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  assert.equal(fetchCalls.length, 0);
  assert.match(modal().querySelector('.dlm-form .btn').textContent, /Verification blocked/i);
});

test('happy path: verified submit posts the exact payload and unlocks the file', async () => {
  installEnv();
  const btn = makeBookCard('ebook-building-trust', 'Building Trust');
  initDownloads();
  btn.click();
  const o = modal();
  o.querySelector('#dlm-name').value = '  Ada Lovelace  ';
  o.querySelector('#dlm-email').value = ' ada@example.com ';
  fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, url: 'https://sb/downloads/trust.pdf', title: 'Building Trust', pending: false }) });
  o.querySelector('.dlm-form').requestSubmit();
  await tick();
  // request contract
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/api/download/');
  assert.deepEqual(fetchCalls[0].body, {
    token: 'live-token', name: 'Ada Lovelace', email: 'ada@example.com',
    asset: 'ebook-building-trust', source_page: 'rajgoodman.com/',
  });
  // unlocked state
  const success = o.querySelector('.dlm-success');
  assert.equal(success.style.display, 'block');
  assert.equal(o.querySelector('.dlm-form').style.display, 'none');
  assert.equal(success.querySelector('a').getAttribute('href'), 'https://sb/downloads/trust.pdf');
  assert.deepEqual(opened, ['https://sb/downloads/trust.pdf'], 'download auto-opened');
  assert.equal(success.querySelector('.dlm-note'), null, 'no confirm note when not pending');
});

test('double opt-in pending -> the "confirm your inbox" note is shown', async () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  fillAndReturn({ pending: true });
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  assert.match(modal().querySelector('.dlm-note').textContent, /confirmation email/i);
});

test('server rejection re-enables the form and resets the widget', async () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  fillFields();
  fetchImpl = async () => ({ ok: false, json: async () => ({ ok: false, error: 'unknown-asset' }) });
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  const b = modal().querySelector('.dlm-form .btn');
  assert.match(b.textContent, /Something went wrong/i);
  assert.equal(b.disabled, false);
  assert.equal(turnstile.resets, 1);
  assert.equal(modal().querySelector('.dlm-success').style.display, 'none');
});

test('network failure shows the retry message and resets the widget', async () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  fillFields();
  fetchImpl = async () => { throw new Error('offline'); };
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  assert.match(modal().querySelector('.dlm-form .btn').textContent, /Network error/i);
  assert.equal(turnstile.resets, 1);
});

test('close via X, backdrop and Escape all hide the modal', () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  const o = modal();
  o.querySelector('.dlm-close').click();
  assert.equal(o.style.display, 'none');
  btn.click();
  o._fire('click', { target: o, preventDefault() {} }); // backdrop
  assert.equal(o.style.display, 'none');
  btn.click();
  global.document._fire('keydown', { key: 'Escape' });
  assert.equal(o.style.display, 'none');
});

test('reopening after success restores a fresh form', async () => {
  installEnv();
  const btn = makeBookCard('ebook-ai-era', 'AI Era');
  initDownloads();
  btn.click();
  fillFields();
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  assert.equal(modal().querySelector('.dlm-success').style.display, 'block');
  modal().querySelector('.dlm-close').click();
  btn.click();
  assert.equal(modal().querySelector('.dlm-form').style.display, '', 'form visible again');
  assert.equal(modal().querySelector('.dlm-success').style.display, 'none');
  const b = modal().querySelector('.dlm-form .btn');
  assert.match(b.textContent, /Get the eBook/);
  assert.equal(b.disabled, false);
});

test('two books on the page: each opens with its own title and posts its own asset key', async () => {
  installEnv();
  const b1 = makeBookCard('ebook-ai-era', 'AI Era');
  const b2 = makeBookCard('ebook-building-trust', 'Building Trust');
  initDownloads();
  b1.click();
  assert.equal(modal().querySelector('.dlm-asset').textContent, 'AI Era');
  modal().querySelector('.dlm-close').click();
  b2.click();
  assert.equal(modal().querySelector('.dlm-asset').textContent, 'Building Trust');
  fillFields();
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  assert.equal(fetchCalls[0].body.asset, 'ebook-building-trust');
});

test('audiobook button: modal copy says Audiobook and reverts for eBooks', async () => {
  installEnv();
  const eb = makeBookCard('ebook-ai-era', 'AI Era');
  const ab = makeBookCard('audiobook-ai-era', 'AI Era');
  initDownloads();
  ab.click();
  assert.equal(modal().querySelector('#dlm-title').textContent, 'Get the Audiobook');
  assert.match(modal().querySelector('.dlm-form .btn').textContent, /Get the Audiobook/);
  fillFields();
  modal().querySelector('.dlm-form').requestSubmit();
  await tick();
  assert.equal(fetchCalls[0].body.asset, 'audiobook-ai-era');
  assert.match(modal().querySelector('.dlm-success a').textContent, /Download Audiobook/);
  modal().querySelector('.dlm-close').click();
  eb.click();
  assert.equal(modal().querySelector('#dlm-title').textContent, 'Get the eBook');
  assert.match(modal().querySelector('.dlm-form .btn').textContent, /Get the eBook/);
});

/* helpers used by several tests */
function fillFields() {
  const o = modal();
  o.querySelector('#dlm-name').value = 'QA Test';
  o.querySelector('#dlm-email').value = 'qa@example.com';
}
function fillAndReturn(extra) {
  fillFields();
  fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, url: 'https://sb/d/x.pdf', title: 'T', ...extra }) });
}
