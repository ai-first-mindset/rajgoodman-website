// Site-agnostic conformance checks for the page builder.
//
// The same checks run against any site that adopts the builder; only the
// SiteProfile differs. That is what makes cross-deployment validation real
// rather than two sets of tests that drift apart.
//
// Each check answers one question about a DEPLOYMENT, not about the engine:
//
//   safety          does decomposition ever change a page silently?   (must be no)
//   renderStability does the renderer reproduce stored content exactly?
//   sanitiser       does the write path alter content it should not?
//   cspCoverage     is every browser resource load allowed by this site's CSP?
//   baseline        how many pages decompose exactly (regression detector)
//
// Nothing here imports site-specific content: pass it in.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decomposeHtml, verifyDecomposition } from './decompose.js';
import { renderDocument, createEnv } from './core/render.js';
import { registry } from './elements/index.js';
import { parse, serialize } from './core/document.js';

// A SiteProfile describes where a deployment keeps its things.
//   root        repo root
//   pageDirs    directories holding served .html pages, relative to root
//   vercelJson  path to vercel.json, relative to root
//   ignore      filename substrings to skip (drafts, scratch copies)
export function siteProfile(root, over = {}) {
  return {
    root,
    pageDirs: ['.'],
    vercelJson: 'vercel.json',
    ignore: ['updated', 'node_modules'],
    ...over,
  };
}

const env = createEnv({ registry });
const render = (doc) => renderDocument(doc, env);
const asDoc = (children) => ({ version: 2, root: { id: 'r', type: 'page-root', props: {}, children } });
const rawDoc = (html) => asDoc([{ id: 'raw', type: 'raw-html', props: { html }, children: [] }]);

export function listPages(profile) {
  const out = [];
  for (const dir of profile.pageDirs) {
    const abs = join(profile.root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!f.endsWith('.html')) continue;
      if (profile.ignore.some((s) => f.includes(s))) continue;
      out.push(join(dir, f));
    }
  }
  return out.sort();
}

// The <main> content of a page, line-endings normalised. Returns null when the
// file has no <main> (login shells, redirects).
export function mainOf(profile, relPath) {
  const m = readFileSync(join(profile.root, relPath), 'utf8').match(/<main>([\s\S]*?)<\/main>/);
  return m ? m[1].replace(/\r\n/g, '\n').replace(/^\n/, '').replace(/\s+$/, '') : null;
}

// --- 1. SAFETY -------------------------------------------------------------
// The property everything else rests on: decomposition is exact, or refused.
// A third outcome -- changed but accepted -- would be a silent content edit.
export function checkSafety(profile) {
  const results = [];
  for (const page of listPages(profile)) {
    const original = mainOf(profile, page);
    if (original === null) continue;
    let outcome;
    try {
      const check = verifyDecomposition(rawDoc(original), asDoc(decomposeHtml(original)), render);
      outcome = check.ok ? 'exact' : 'refused';
    } catch (e) {
      outcome = `threw: ${e.message}`;
    }
    results.push({ page, outcome });
  }
  return {
    results,
    unsafe: results.filter((r) => r.outcome !== 'exact' && r.outcome !== 'refused'),
    exact: results.filter((r) => r.outcome === 'exact'),
    refused: results.filter((r) => r.outcome === 'refused'),
  };
}

// --- 2. RENDER STABILITY ---------------------------------------------------
// Stored content must render to the same bytes it does today. `legacyRender`
// is the site's incumbent renderer (RG has one; a site with no Pages CMS yet
// passes null and this check is skipped).
export function checkRenderStability(storedRecords, legacyRender) {
  if (!legacyRender) return { skipped: true, mismatches: [] };
  const mismatches = [];
  for (const { name, blocks } of storedRecords) {
    const legacy = legacyRender(blocks);
    const current = render(parse(blocks).doc);
    if (legacy !== current) {
      let at = 0;
      while (at < Math.min(legacy.length, current.length) && legacy[at] === current[at]) at += 1;
      mismatches.push({ name, at, legacy: legacy.slice(at, at + 90), current: current.slice(at, at + 90) });
    }
  }
  return { skipped: false, mismatches, checked: storedRecords.length };
}

// --- 3. SANITISER ----------------------------------------------------------
// The write path must not alter content that is already legitimate. Run it
// over the site's REAL content, not synthetic samples.
export function checkSanitiser(sanitizeHtml, samples) {
  const changed = [];
  for (const { name, html } of samples) {
    const after = sanitizeHtml(html);
    if (after !== html) {
      let at = 0;
      while (at < Math.min(html.length, after.length) && html[at] === after[at]) at += 1;
      changed.push({ name, delta: after.length - html.length, at, was: html.slice(at, at + 80), now: after.slice(at, at + 80) });
    }
  }
  return { checked: samples.length, changed };
}

// --- 4. CSP COVERAGE -------------------------------------------------------
// Every RESOURCE the browser is asked to load must be allowed. Navigation
// (<a href>), canonical links and server-side fetches are not resource loads
// and are deliberately excluded -- CSP does not govern them.
const RESOURCE_PATTERNS = [
  [/<script[^>]+src=["']https:\/\/([a-z0-9.-]+)/gi, 'script-src'],
  [/<link[^>]+rel=["'](?:stylesheet|preload|preconnect)["'][^>]*href=["']https:\/\/([a-z0-9.-]+)/gi, 'style-src/font-src'],
  [/<link[^>]+href=["']https:\/\/([a-z0-9.-]+)[^>]*rel=["'](?:stylesheet|preload|preconnect)["']/gi, 'style-src/font-src'],
  [/<img[^>]+src=["']https:\/\/([a-z0-9.-]+)/gi, 'img-src'],
  [/<iframe[^>]+src=["']https:\/\/([a-z0-9.-]+)/gi, 'frame-src'],
  [/\.src\s*=\s*['"`]https:\/\/([a-z0-9.-]+)/gi, 'script-src (dynamic)'],
];

export function cspAllowlist(profile) {
  const cfg = JSON.parse(readFileSync(join(profile.root, profile.vercelJson), 'utf8'));
  const header = (cfg.headers || [])
    .flatMap((h) => h.headers || [])
    .find((h) => /content-security-policy/i.test(h.key));
  if (!header) return null;
  const hosts = new Set();
  header.value.split(';').forEach((d) => d.trim().split(/\s+/).slice(1)
    .forEach((v) => { if (v.startsWith('https://')) hosts.add(v.slice(8)); }));
  return hosts;
}

export function checkCspCoverage(profile, extraClientFiles = []) {
  const allow = cspAllowlist(profile);
  if (!allow) return { skipped: true, uncovered: [] };
  const files = [...listPages(profile), ...extraClientFiles];
  const found = new Map();
  for (const rel of files) {
    const abs = join(profile.root, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, 'utf8');
    for (const [re, directive] of RESOURCE_PATTERNS) {
      for (const m of src.matchAll(re)) {
        const key = `${m[1]}|${directive}`;
        if (!found.has(key)) found.set(key, { host: m[1], directive, files: [] });
        found.get(key).files.push(rel);
      }
    }
  }
  const covered = (host) => [...allow].some((a) => a === host || (a.startsWith('*.') && host.endsWith(a.slice(1))));
  const all = [...found.values()];
  return { skipped: false, checked: all.length, uncovered: all.filter((r) => !covered(r.host)), all };
}

// --- 5. ROUND-TRIP ---------------------------------------------------------
export function checkRoundTrip(storedRecords) {
  const broken = [];
  for (const { name, blocks } of storedRecords) {
    const doc = parse(blocks).doc;
    const again = parse(serialize(doc)).doc;
    if (JSON.stringify(again) !== JSON.stringify(doc)) broken.push(name);
  }
  return { checked: storedRecords.length, broken };
}

// --- 6. BASELINE -----------------------------------------------------------
// How much of the site the builder can currently type, so a regression shows
// up as the number falling.
export function baseline(profile) {
  const safety = checkSafety(profile);
  let typedPages = 0;
  let formBytes = 0;
  let rawBytes = 0;
  for (const page of listPages(profile)) {
    const original = mainOf(profile, page);
    if (original === null) continue;
    const nodes = decomposeHtml(original);
    let typed = 0;
    const walk = (list) => list.forEach((c) => {
      if (c.type === 'raw-html') rawBytes += (c.props.html || '').length;
      else {
        typed += 1;
        formBytes += Object.values(c.props || {}).filter((v) => typeof v === 'string').join('').length;
        walk(c.children || []);
      }
    });
    walk(nodes);
    if (typed) typedPages += 1;
  }
  return {
    pages: safety.results.length,
    exact: safety.exact.length,
    refused: safety.refused.length,
    typedPages,
    formShare: formBytes + rawBytes ? formBytes / (formBytes + rawBytes) : 0,
  };
}
