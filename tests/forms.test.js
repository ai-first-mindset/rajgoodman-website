// User-flow tests for the generic Turnstile form handler (common.js initForms)
// — the path every contact + newsletter submission takes: widget render,
// ad-block fallback, verification gating, exact payload, success/error states.
// Uses the same hand-rolled DOM stub style as download-modal.test.js.
// Run: node --test 'tests/**/*.test.js'
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initForms } = require('../common.js');

/* ---- DOM stub (selector matcher handles tag/.class/#id/[attr]/commas) ---- */
class TextNode { constructor(t) { this.nodeText = t; this.parentNode = null; } get textContent() { return this.nodeText; } }
class El {
  constructor(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.children = []; this.parentNode = null;
    this._attrs = {}; this._text = ''; this._handlers = {};
    this.style = {}; this.disabled = false; this.value = ''; this.name = '';
  }
  get id() { return this._attrs.id || ''; }
  get className() { return this._attrs['class'] || ''; }
  set className(v) { this._attrs['class'] = v; }
  getAttribute(n) { return n in this._attrs ? this._attrs[n] : null; }
  setAttribute(n, v) { this._attrs[n] = String(v); if (n === 'name') this.name = String(v); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(html) { this._text = String(html); this.children = []; }
  get innerHTML() { return this._text; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); }
  _fire(type, ev) { (this._handlers[type] || []).forEach((fn) => fn(ev)); }
  requestSubmit() { this._fire('submit', { target: this, preventDefault() {} }); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) { return this._desc().filter((el) => el._match(sel)); }
  _desc() { const out = []; (function w(n) { (n.children || []).forEach((c) => { if (c instanceof El) { out.push(c); w(c); } }); })(this); return out; }
  _match(sel) {
    if (sel.includes(',')) return sel.split(',').some((s) => this._match(s.trim()));
    const m = /^([a-zA-Z][a-zA-Z0-9]*)?((?:\.[\w-]+)*)((?:\[[\w-]+(?:="[^"]*")?\])*)$/.exec(sel);
    if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    if (m[2]) for (const c of m[2].split('.').filter(Boolean)) { if (!(' ' + this.className + ' ').includes(' ' + c + ' ')) return false; }
    if (m[3]) { const re = /\[([\w-]+)(?:="([^"]*)")?\]/g; let a; while ((a = re.exec(m[3]))) { const v = this.getAttribute(a[1]); if (v === null) return false; if (a[2] != null && v !== a[2]) return false; } }
    return true;
  }
}

let body, head, fetchCalls, fetchImpl;
function installEnv() {
  body = new El('body'); head = new El('head');
  global.document = {
    body, head,
    createElement: (t) => new El(t),
    createTextNode: (t) => new TextNode(t),
    querySelectorAll: (s) => body.querySelectorAll(s),
    querySelector: (s) => body.querySelector(s),
  };
  global.window = {};
  global.location = { host: 'rajgoodman.com', pathname: '/about/' };
  fetchCalls = [];
  fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true }) });
  globalThis.fetch = (url, opts) => { fetchCalls.push({ url, body: JSON.parse(opts.body) }); return fetchImpl(url, opts); };
}
function makeForm(type, fields) {
  const form = new El('form'); form.setAttribute('data-form', type);
  const mount = new El('div'); mount.setAttribute('data-turnstile', ''); form.appendChild(mount);
  for (const [name, value] of Object.entries(fields || {})) {
    const i = new El('input'); i.setAttribute('name', name); i.value = value; form.appendChild(i);
  }
  const btn = new El('button'); btn.className = 'btn'; btn.textContent = 'Send'; form.appendChild(btn);
  body.appendChild(form);
  return form;
}
function loadTurnstile(token = 'tok-1') {
  global.window.turnstile = {
    token, rendered: [], resets: 0,
    render(mount, opts) { this.rendered.push({ mount, sitekey: opts.sitekey, theme: opts.theme }); return this.rendered.length; },
    getResponse() { return this.token; },
    reset() { this.resets++; },
  };
  global.window.onTurnstileLoad();
  return global.window.turnstile;
}
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete global.document; delete global.window; delete global.location; });
const tick = () => new Promise((r) => setTimeout(r, 10));
const btnOf = (form) => form.querySelector('.btn');

test('no [data-form] on the page: no Turnstile script is injected', () => {
  installEnv();
  initForms();
  assert.equal(head.children.length, 0);
});

test('script injected once; onload renders a dark-theme widget into every form mount', () => {
  installEnv();
  makeForm('contact'); makeForm('newsletter');
  initForms();
  const scripts = head.children.filter((c) => c.tagName === 'SCRIPT');
  assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /challenges\.cloudflare\.com\/turnstile/);
  const ts = loadTurnstile();
  assert.equal(ts.rendered.length, 2);
  assert.equal(ts.rendered[0].theme, 'dark');
  assert.ok(ts.rendered[0].sitekey);
});

test('ad-blocked script: mounts get the email fallback, submit never fetches', async () => {
  installEnv();
  const form = makeForm('contact', { name: 'A', email: 'a@b.cc', message: 'hi' });
  initForms();
  const script = head.children.find((c) => c.tagName === 'SCRIPT');
  script.onerror();
  assert.match(form.querySelector('[data-turnstile]').innerHTML, /blocked by a browser extension/);
  form.requestSubmit();
  await tick();
  assert.equal(fetchCalls.length, 0);
  assert.match(btnOf(form).textContent, /Verification blocked/);
});

test('unticked verification blocks the submit before any request', async () => {
  installEnv();
  const form = makeForm('contact', { name: 'A', email: 'a@b.cc', message: 'hi' });
  initForms();
  loadTurnstile(''); // widget rendered, box not ticked
  form.requestSubmit();
  await tick();
  assert.equal(fetchCalls.length, 0);
  assert.match(btnOf(form).textContent, /complete the verification/i);
});

test('contact happy path: exact payload, sending state, success, controls disabled', async () => {
  installEnv();
  const form = makeForm('contact', { name: 'Ada', email: 'ada@x.com', service: 'Keynote', message: 'Hi Raj' });
  initForms();
  loadTurnstile('tok-9');
  form.requestSubmit();
  assert.match(btnOf(form).textContent, /Sending/);
  await tick();
  assert.equal(fetchCalls[0].url, '/api/contact/');
  assert.deepEqual(fetchCalls[0].body, {
    token: 'tok-9', name: 'Ada', email: 'ada@x.com', service: 'Keynote', message: 'Hi Raj',
    source_page: 'rajgoodman.com/about/',
  });
  assert.match(btnOf(form).textContent, /Thank you - we/);
  assert.ok(form.querySelectorAll('input,select,textarea,button').every((el) => el.disabled), 'controls disabled after success');
});

test('newsletter: pending flag switches the success copy to check-your-inbox', async () => {
  installEnv();
  const form = makeForm('newsletter', { email: 'a@b.cc' });
  initForms();
  loadTurnstile();
  fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, pending: true }) });
  form.requestSubmit();
  await tick();
  assert.equal(fetchCalls[0].url, '/api/subscribe/');
  assert.match(btnOf(form).textContent, /check your inbox to confirm/);

  installEnv();
  const f2 = makeForm('newsletter', { email: 'a@b.cc' });
  initForms();
  loadTurnstile();
  fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, pending: false }) });
  f2.requestSubmit();
  await tick();
  assert.match(btnOf(f2).textContent, /you're subscribed/);
});

test('server rejection: retry message, widget reset, controls stay enabled', async () => {
  installEnv();
  const form = makeForm('contact', { name: 'A', email: 'a@b.cc', message: 'hi' });
  initForms();
  const ts = loadTurnstile();
  fetchImpl = async () => ({ ok: false, json: async () => ({ ok: false, error: 'turnstile-failed' }) });
  form.requestSubmit();
  await tick();
  assert.match(btnOf(form).textContent, /Something went wrong/);
  assert.equal(ts.resets, 1);
  assert.equal(form.querySelector('input').disabled, false);
});

test('network failure: network-error message and widget reset', async () => {
  installEnv();
  const form = makeForm('newsletter', { email: 'a@b.cc' });
  initForms();
  const ts = loadTurnstile();
  fetchImpl = async () => { throw new Error('offline'); };
  form.requestSubmit();
  await tick();
  assert.match(btnOf(form).textContent, /Network error/);
  assert.equal(ts.resets, 1);
});

test('unknown data-form type: submit is ignored entirely', async () => {
  installEnv();
  const form = makeForm('mystery', { email: 'a@b.cc' });
  initForms();
  loadTurnstile();
  form.requestSubmit();
  await tick();
  assert.equal(fetchCalls.length, 0);
});
