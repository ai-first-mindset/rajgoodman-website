// Guard the image-optimization standard (Arif P4). Keeps committed /assets
// images small and in a next-gen format so a heavy PNG/JPG can't sneak back in.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(process.cwd(), 'assets');
// Favicons must stay PNG (apple-touch-icon / legacy favicon compatibility).
const ALLOWED_PNG = new Set(['favicon-32.png', 'favicon-192.png', 'apple-touch-icon.png']);
const MAX_KB = 350; // current heaviest legit asset is ~221KB; over this = almost certainly un-optimized

const raster = readdirSync(ASSETS).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

test('content images are WebP - no stray PNG/JPG in /assets (favicons excepted)', () => {
  const offenders = raster.filter((f) => /\.(png|jpe?g)$/i.test(f) && !ALLOWED_PNG.has(f));
  assert.deepEqual(offenders, [],
    `These must be converted to WebP (q85) before committing: ${offenders.join(', ')}`);
});

test(`no /assets image exceeds ${MAX_KB} KB`, () => {
  const heavy = raster
    .map((f) => ({ f, kb: Math.round(statSync(join(ASSETS, f)).size / 1024) }))
    .filter((x) => x.kb > MAX_KB);
  assert.deepEqual(heavy, [],
    `Over ${MAX_KB}KB - re-compress (WebP q85 / downscale): ${heavy.map((h) => `${h.f} (${h.kb}KB)`).join(', ')}`);
});

test('the WebP conversion left no orphaned PNG/JPG next to a WebP of the same name', () => {
  const webpBases = new Set(raster.filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/i, '')));
  const dupes = raster.filter((f) => /\.(png|jpe?g)$/i.test(f) && webpBases.has(f.replace(/\.(png|jpe?g)$/i, '')));
  assert.deepEqual(dupes, [], `Delete these originals (a WebP already exists): ${dupes.join(', ')}`);
});
