// The publish date typed in the editor must be the date the live site shows.
//
// The editor used to read the datetime box in the browser's timezone and save
// UTC, while the site prints the UTC date. An editor in UTC+8 who picked
// "3 Nov, 00:00" saved 2 Nov 16:00 UTC and saw the post dated 2 Nov. The box is
// now entered in UTC. These tests run the real editor functions in Manila time.
// Run: node --test 'tests/**/*.test.js'
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const read = (f) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', f), 'utf8');

const admin = read('admin/admin.js');
const fnSrc = (name) => {
  const m = admin.match(new RegExp(`function ${name}\\(v?i?s?o?\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${name} not found in admin.js`);
  return m[0];
};
const { toLocalInput, fromLocalInput } = new Function(
  `${fnSrc('toLocalInput')}\n${fnSrc('fromLocalInput')}\nreturn { toLocalInput, fromLocalInput };`)();

// What the site prints (api/_post-template.js, api/blog-index.js).
const shown = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

let tz;
before(() => { tz = process.env.TZ; process.env.TZ = 'Asia/Manila'; });
after(() => { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; });

test('a date picked near midnight in UTC+8 shows on that date', () => {
  for (const v of ['2026-11-03T00:00', '2026-11-03T03:27', '2026-11-03T23:59']) {
    assert.equal(shown(fromLocalInput(v)), 'November 3, 2026', `${v} must show as 3 Nov`);
  }
});

test('the box shows the stored date unchanged, whatever the browser timezone', () => {
  assert.equal(toLocalInput('2026-10-27T03:27:00+00:00'), '2026-10-27T03:27');
  assert.equal(toLocalInput('2026-10-26T19:27:00Z'), '2026-10-26T19:27');
});

test('open and save without touching the date leaves it unchanged', () => {
  const stored = '2026-10-27T03:27:00.000Z';
  assert.equal(fromLocalInput(toLocalInput(stored)), stored);
});

test('seconds in the box are accepted; blank and junk return null', () => {
  assert.equal(fromLocalInput('2026-11-03T00:00:00'), '2026-11-03T00:00:00.000Z');
  assert.equal(fromLocalInput(''), null);
  assert.equal(fromLocalInput('not a date'), null);
  assert.equal(toLocalInput(null), '');
});

test('the editor labels the publish date as UTC', () => {
  assert.match(read('admin/index.html'), /<label for="f_published_at">Publish date <span class="muted">\(UTC\)<\/span><\/label>/);
});
