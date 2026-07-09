// Unit tests for the admin upload compressor (admin.js compressImage).
// The actual WebP re-encoding needs a browser canvas; here we prove the safety
// branches: non-raster types pass through untouched, and with no canvas
// available (Node) every file is returned unchanged so an upload never breaks.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compressImage } = require('../admin/admin.js');

const fakeFile = (type, name = 'x', size = 1000) => ({ type, name, size });

test('passes non-raster types through untouched (gif/svg/pdf)', async () => {
  for (const type of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain']) {
    const f = fakeFile(type);
    assert.equal(await compressImage(f), f, type);
  }
});

test('null / undefined file is returned as-is (no throw)', async () => {
  assert.equal(await compressImage(null), null);
  assert.equal(await compressImage(undefined), undefined);
});

test('raster types are left unchanged when no canvas is available (Node fallback)', async () => {
  // createImageBitmap/document are absent under Node, so the guard returns the
  // original file rather than attempting (and failing) to encode.
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    const f = fakeFile(type);
    assert.equal(await compressImage(f), f, type);
  }
});

test('exported for the browser upload path', () => {
  assert.equal(typeof compressImage, 'function');
});
