// CONFORMANCE SUITE — rajgoodman.com
//
// The checks live in builder/conformance.js and are site-agnostic; this file
// only supplies the profile and this site's real content. The AIFM deployment
// runs an identical file with its own profile, so the two deployments are
// validated against the same contract instead of drifting apart.
//
// The contract, in order of severity:
//   1 SAFETY          decomposition is exact or refused — never a silent change
//   2 RENDER STABILITY stored content renders to the bytes it does today
//   3 SANITISER       the write path does not alter legitimate content
//   4 CSP COVERAGE    every browser resource load is allowed
//   5 ROUND-TRIP      documents serialise losslessly
//   6 BASELINE        recorded, so a regression shows up as the number falling
//
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  siteProfile, listPages, checkSafety, checkRenderStability,
  checkSanitiser, checkCspCoverage, checkRoundTrip, baseline,
} from '../builder/conformance.js';
import { renderBlocks } from '../api/_blocks.js';
import { sanitizeHtml } from '../api/_sanitize.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = siteProfile(ROOT, {
  pageDirs: ['.'],
  ignore: ['updated', 'node_modules', '_prototype'],
});

// The site's real stored content that ships in the repo.
const ABOUT = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/about-page-blocks.json', import.meta.url)), 'utf8'),
);
const STORED = [{ name: 'about', blocks: ABOUT }];

/* -- 0. the suite is actually looking at something ------------------------ */

test('conformance: the site profile resolves real pages', () => {
  const pages = listPages(SITE);
  assert.ok(pages.length >= 15, `expected the site's pages, found ${pages.length}`);
});

/* -- 1. SAFETY ------------------------------------------------------------ */

test('conformance/safety: no page is ever changed silently', () => {
  const { unsafe, exact, refused } = checkSafety(SITE);
  assert.deepEqual(
    unsafe.map((u) => `${u.page}: ${u.outcome}`), [],
    'a page neither reproduced exactly nor refused — that is a silent content change',
  );
  assert.ok(exact.length + refused.length > 0, 'no pages were checked');
});

/* -- 2. RENDER STABILITY -------------------------------------------------- */

test('conformance/render: stored content renders identically to the incumbent renderer', () => {
  const { mismatches, checked } = checkRenderStability(STORED, renderBlocks);
  assert.equal(checked, STORED.length);
  assert.deepEqual(
    mismatches.map((m) => `${m.name} diverges at ${m.at}: ${m.legacy} != ${m.current}`), [],
  );
});

/* -- 3. SANITISER --------------------------------------------------------- */

test('conformance/sanitiser: the write path does not alter this site\'s own markup', () => {
  const samples = ABOUT
    .filter((b) => b.type === 'raw-html')
    .map((b, i) => ({ name: `about raw-html #${i}`, html: b.html }));
  const faq = ABOUT.find((b) => b.type === 'faq');
  if (faq) faq.items.forEach((it, i) => samples.push({ name: `about faq #${i}`, html: it.answer_html }));
  const { changed, checked } = checkSanitiser(sanitizeHtml, samples);
  assert.ok(checked > 0);
  assert.deepEqual(changed.map((c) => `${c.name} (${c.delta} bytes at ${c.at})`), []);
});

test('conformance/sanitiser: every served page survives the write path unchanged', () => {
  // Guards the case where a page is later imported into the CMS: its markup
  // must pass through the sanitiser untouched, or importing it would edit it.
  const samples = listPages(SITE).map((p) => ({
    name: p,
    html: readFileSync(`${ROOT}${p}`, 'utf8').match(/<main>([\s\S]*?)<\/main>/)?.[1] || '',
  })).filter((s) => s.html);
  const { changed } = checkSanitiser(sanitizeHtml, samples);
  assert.deepEqual(changed.map((c) => `${c.name}: ${c.delta} bytes at ${c.at} — ${c.was}`), []);
});

/* -- 4. CSP COVERAGE ------------------------------------------------------ */

test('conformance/csp: every browser resource load is allowed by this site\'s CSP', () => {
  const { skipped, uncovered, checked } = checkCspCoverage(SITE, [
    'common.js', 'chrome.js', 'assets/cookie-consent.js', 'admin/index.html', 'admin/admin.js',
  ]);
  assert.equal(skipped, false, 'this site should have a CSP');
  assert.ok(checked > 0, 'no resource loads found — the scan is not working');
  assert.deepEqual(
    uncovered.map((u) => `${u.host} [${u.directive}] in ${u.files.slice(0, 2).join(', ')}`), [],
  );
});

/* -- 5. ROUND-TRIP -------------------------------------------------------- */

test('conformance/round-trip: stored documents serialise losslessly', () => {
  const { broken, checked } = checkRoundTrip(STORED);
  assert.equal(checked, STORED.length);
  assert.deepEqual(broken, []);
});

/* -- 6. BASELINE ---------------------------------------------------------- */

test('conformance/baseline: recorded coverage for rajgoodman.com', () => {
  const b = baseline(SITE);
  // Recorded, not aspirational. Raise these when coverage genuinely improves;
  // a fall means something regressed.
  assert.ok(b.pages >= 15, `page count fell to ${b.pages}`);
  assert.ok(b.exact >= 1, `no page decomposes exactly (was 1) — regression`);
  assert.equal(b.exact + b.refused, b.pages, 'every page must be exact or refused');
});
