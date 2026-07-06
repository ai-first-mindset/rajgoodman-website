// Regenerates the admin "Coverage" tab snapshot in admin/index.html.
// Runs the unit suite with Node's built-in coverage (lcov reporter), walks the
// repo for the runtime-file inventory (so new files appear automatically —
// never imported by a test => an honest hatched "not exercised" row), and
// rewrites the block between the BEGIN/END GENERATED COVERAGE markers.
//
//   node scripts/update-coverage.mjs
//
// CI runs this on every push to main and commits the refreshed snapshot.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = join(ROOT, 'admin', 'index.html');
const LCOV = join(ROOT, 'coverage.lcov');

// Hand-maintained annotations; anything unlisted gets a sensible fallback.
const NOTES = {
  'api/contact.js': 'contact-api',
  'api/subscribe.js': 'subscribe-api',
  'api/download.js': 'download-api',
  'api/linkedin.js': 'linkedin-api',
  'api/blog-index.js': 'render-handlers',
  'api/render-post.js': 'render-handlers',
  'api/render-category.js': 'render-handlers',
  'api/feed.js': 'parity-surfaces',
  'api/sitemap.js': 'route checked textually in parity tests only',
  'api/admin/posts.js': 'admin-posts-api',
  'api/admin/fetch-meta.js': 'fetch-meta · extraction only, handler unexercised',
  'api/_body.js': 'read-body',
  'api/_turnstile.js': 'turnstile',
  'api/_auth.js': 'admin-posts-api',
  'api/_blog-data.js': 'render-handlers',
  'api/_post-template.js': 'post-template, parity-surfaces',
  'api/_blog-index-template.js': 'via blog-index',
  'api/_media.js': 'media-library listing glue',
  'common.js': 'linkedin-widget, download-modal · forms/nav/reveal untested',
  'assets/cookie-consent.js': 'cookie-consent · banner DOM + GTM wiring untested',
  'chrome.js': 'nav/footer chrome injection',
  'scripts/sync-linkedin-fallback.mjs': 'LinkedIn fallback-card generator',
  'scripts/update-coverage.mjs': 'this generator (tooling)',
};

// 1) Run the suite with lcov coverage output.
rmSync(LCOV, { force: true });
const run = spawnSync(process.execPath, [
  '--test', '--experimental-test-coverage',
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', `--test-reporter-destination=${LCOV}`,
  'tests/**/*.test.js',
], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SKIP_NET_TESTS: '1' }, maxBuffer: 64 * 1024 * 1024 });

const out = (run.stdout || '') + (run.stderr || '');
const stat = (name) => { const m = out.match(new RegExp(`\\b${name} (\\d+)`)); return m ? Number(m[1]) : null; };
const tests = stat('tests'), pass = stat('pass'), skipped = stat('skipped'), fail = stat('fail');
if (tests == null || pass == null) { console.error(out.slice(-3000)); throw new Error('could not parse test summary'); }
if (fail) { console.error(out.slice(-3000)); throw new Error(`${fail} test(s) failing — fix the suite before regenerating the snapshot`); }

// 2) Parse lcov into per-file percentages.
const cov = new Map();
if (existsSync(LCOV)) {
  for (const rec of readFileSync(LCOV, 'utf8').split('end_of_record')) {
    const sf = rec.match(/SF:(.+)/);
    if (!sf) continue;
    const file = relative(ROOT, sf[1].trim()).replaceAll('\\', '/');
    const n = (k) => { const m = rec.match(new RegExp(`${k}:(\\d+)`)); return m ? Number(m[1]) : 0; };
    const pct = (hit, found) => (found === 0 ? 100 : Math.round((hit / found) * 1000) / 10);
    cov.set(file, {
      l: pct(n('LH'), n('LF')), b: pct(n('BRH'), n('BRF')), fn: pct(n('FNH'), n('FNF')),
      lh: n('LH'), lf: n('LF'),
    });
  }
  rmSync(LCOV, { force: true });
}

// 3) Repo inventory of runtime files (vendored tiptap bundle excluded by policy).
const js = (dir, ext = '.js') => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith(ext)).map((d) => `${dir}/${d.name}`).sort();
const groups = [
  ['Public API (serverless)', js('api').filter((f) => !f.includes('/_'))],
  ['Admin API (auth-gated)', js('api/admin')],
  ['Shared helpers', js('api').filter((f) => f.includes('/_'))],
  ['Front-end', ['common.js', 'chrome.js', 'assets/cookie-consent.js']],
  ['Scripts', js('scripts', '.mjs')],
];

// 4) Build the rows + aggregate stats.
const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
let lh = 0, lf = 0, notExercised = 0;
const rows = [];
for (const [g, files] of groups) {
  rows.push(`    { g:'${q(g)}' },`);
  for (const f of files) {
    const c = cov.get(f);
    const note = NOTES[f] || '';
    if (!c) {
      notExercised++;
      rows.push(`    { f:'${q(f)}', none:true, n:'${q(note)}' },`);
    } else {
      lh += c.lh; lf += c.lf;
      rows.push(`    { f:'${q(f)}', l:${c.l}, b:${c.b}, fn:${c.fn}, n:'${q(note)}' },`);
    }
  }
  if (g === 'Front-end') {
    rows.push(`    { f:'admin/index.html (app)', partial:true, n:'admin-editor · category picker + alt bar only; rest untested' },`);
  }
}
const suites = readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).length;
const overall = lf ? (Math.round((lh / lf) * 1000) / 10).toFixed(1) : '0.0';

const block = `// --- BEGIN GENERATED COVERAGE (scripts/update-coverage.mjs — do not edit by hand) ---
const COVERAGE = {
  stats: [['${tests}','Tests'],['${pass}','Passed'],['${skipped}','Env-gated skips'],['${suites}','Suites'],['${overall}%','Lines, instrumented'],['${notExercised}','Files not exercised']],
  files: [
${rows.join('\n')}
  ],
};
// --- END GENERATED COVERAGE ---`;

// 5) Splice into admin/index.html and refresh the run date in the card header.
let html = readFileSync(ADMIN, 'utf8');
const re = /\/\/ --- BEGIN GENERATED COVERAGE[\s\S]*?\/\/ --- END GENERATED COVERAGE ---/;
if (!re.test(html)) throw new Error('GENERATED COVERAGE markers not found in admin/index.html');
html = html.replace(re, () => block);
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
html = html.replace(/suite run [^,<]+,/, `suite run ${today},`);
writeFileSync(ADMIN, html);

console.log(`Coverage tab updated: ${tests} tests (${pass} pass, ${skipped} skipped), ${suites} suites, ${overall}% lines, ${notExercised} files not exercised.`);
