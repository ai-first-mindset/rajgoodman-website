// SEO round 1 (Nov 2026): the consulting and Fractional CAIO services are no
// longer offered, so their pages are gone and nothing on the site points at
// them. /fractional-chief-ai-officer/ 301s to /ai-for-business-leaders/; the
// two consulting pages answer 410 Gone via api/gone.js.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import gone, { GONE_HTML, GONE_PATHS } from '../api/gone.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const cfg = JSON.parse(read('vercel.json'));

const REDIRECTED = '/fractional-chief-ai-officer/';
const GONE = ['/ai-business-consultant/', '/organizational-transformation-consultant/'];
const REMOVED = [REDIRECTED, ...GONE];

// Every page, script and template that ships to the browser (tests excluded,
// they name the removed URLs on purpose).
function shipped(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'tests', '.vercel', '.github', 'assets', 'db'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) shipped(p, out);
    else if (/\.(html|js|mjs|txt|xml)$/.test(name)) out.push(relative(ROOT, p));
  }
  return out;
}

test('removed page files are deleted', () => {
  for (const f of ['fractional-chief-ai-officer.html', 'ai-business-consultant.html', 'organizational-transformation-consultant.html']) {
    assert.ok(!existsSync(join(ROOT, f)), `${f} should be deleted`);
  }
});

test('/fractional-chief-ai-officer/ is a permanent 301 to /ai-for-business-leaders/', () => {
  for (const source of [REDIRECTED, '/fractional-chief-ai-officer.html']) {
    const r = cfg.redirects.find((x) => x.source === source);
    assert.ok(r, `redirect for ${source}`);
    assert.equal(r.destination, '/ai-for-business-leaders/');
    assert.equal(r.statusCode, 301);
  }
});

test('the consulting pages rewrite to the 410 handler', () => {
  assert.deepEqual(GONE_PATHS, GONE);
  for (const source of GONE) {
    assert.equal(cfg.rewrites.find((x) => x.source === source)?.destination, '/api/gone/', `${source} -> /api/gone/`);
    assert.ok(!cfg.redirects.some((x) => x.source === source), `${source} must not also redirect`);
  }
});

test('no redirect chains: nothing redirects to a removed page or to another redirect source', () => {
  const sources = new Set(cfg.redirects.map((r) => r.source));
  for (const r of cfg.redirects) {
    assert.ok(!REMOVED.includes(r.destination), `${r.source} points at removed ${r.destination}`);
    assert.ok(!sources.has(r.destination), `${r.source} -> ${r.destination} is a chain`);
  }
});

test('api/gone answers 410 with a noindex page that links somewhere useful', () => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, send(b) { this.body = b; return this; } };
  gone({}, res);
  assert.equal(res.statusCode, 410);
  assert.equal(res.headers['X-Robots-Tag'], 'noindex');
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.equal(res.body, GONE_HTML);
  assert.match(GONE_HTML, /<meta name="robots" content="noindex"/);
  assert.match(GONE_HTML, /rel="icon"/);
  assert.match(GONE_HTML, /href="\/ai-for-business-leaders\/"/);
  assert.doesNotMatch(GONE_HTML, /—/, 'no em-dashes in visible copy');
});

test('no shipped page, script or template links to a removed page', () => {
  const hits = [];
  for (const f of shipped()) {
    if (f === join('api', 'gone.js')) continue; // documents the paths it serves
    const src = read(f);
    for (const url of REMOVED) if (src.includes(url)) hits.push(`${f} -> ${url}`);
  }
  assert.deepEqual(hits, []);
});

test('page sitemap and site-map page leave the removed pages out', () => {
  const sm = read(join('api', 'sitemap.js'));
  const page = read('site-map.html');
  for (const url of REMOVED) {
    assert.ok(!sm.includes(`'${url}'`), `sitemap.js still lists ${url}`);
    assert.ok(!page.includes(url), `site-map.html still links ${url}`);
  }
  assert.match(sm, /'\/ai-for-business-leaders\/'/);
});

test('every contact-form service dropdown offers only the training options', () => {
  const files = shipped().filter((f) => read(f).includes('name=\\"service\\"') || read(f).includes('name="service"'));
  assert.ok(files.length >= 14, `found ${files.length} forms`);
  for (const f of files) {
    const src = read(f).replace(/\\"/g, '"');
    for (const sel of src.match(/<select[^>]*name="service"[^>]*>[\s\S]*?<\/select>/g)) {
      const opts = [...sel.matchAll(/<option(?: value="[^"]*")?>([^<]*)<\/option>/g)].map((m) => m[1]).slice(1);
      assert.deepEqual(opts, ['AI for Business Leaders', 'AI Trainer', 'Executive Training'], f);
    }
  }
});

test('homepage: three service cards (Workshops, Speaking, Training), no Consulting or CAIO', () => {
  const html = read('index.html');
  const cards = [...html.matchAll(/<article class="svc"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(cards, ['Workshops', 'Speaking', 'Training']);
  assert.doesNotMatch(html, /fractional CAIO|Fractional Chief AI Officer/i);
});

test('homepage footer keeps Workshops + AI Training under Helping Through', () => {
  for (const src of [read('index.html'), read('chrome.js')]) {
    const col = src.match(/<h4>Helping Through<\/h4>[\s\S]*?<\/div>/)[0];
    const links = [...col.matchAll(/>([^<>]+)<\/a>/g)].map((m) => m[1]);
    assert.deepEqual(links, ['Workshops', 'AI Training']);
  }
});

test('Services menu keeps the five training/speaking pages', () => {
  for (const src of [read('index.html'), read('chrome.js')]) {
    for (const href of ['/keynote-speaker/', '/workshops/tech-workshop/', '/ai-training-for-executives/', '/ai-for-business-leaders/', '/ai-trainer/']) {
      assert.ok(src.includes(`href="${href}"`), href);
    }
  }
});
