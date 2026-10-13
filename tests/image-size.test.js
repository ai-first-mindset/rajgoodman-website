// Hero image dimensions: the size is read from the file header so the post page
// can reserve the space and not jump while the hero loads. Featured images come
// in several aspect ratios, so the real size must be read per image.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImageSize, imageSize } from '../api/_image-size.js';
import { renderPost, heroSize } from '../api/_post-template.js';

const pad = (arr, n = 64) => { const b = new Uint8Array(Math.max(n, arr.length)); b.set(arr); return b; };
const le16 = (v) => [v & 0xff, (v >> 8) & 0xff];
const le24 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff];
const be16 = (v) => [(v >> 8) & 0xff, v & 0xff];
const be32 = (v) => [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
const str = (s) => [...s].map((c) => c.charCodeAt(0));

test('PNG size comes from IHDR', () => {
  const b = pad([0x89, ...str('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...str('IHDR'), ...be32(1024), ...be32(768)]);
  assert.deepEqual(parseImageSize(b), { width: 1024, height: 768 });
});

test('GIF size comes from the logical screen descriptor', () => {
  assert.deepEqual(parseImageSize(pad([...str('GIF89a'), ...le16(640), ...le16(360)])), { width: 640, height: 360 });
});

test('WebP: lossy (VP8), lossless (VP8L) and extended (VP8X)', () => {
  const head = (kind) => [...str('RIFF'), 0, 0, 0, 0, ...str('WEBP'), ...str(kind), 0, 0, 0, 0];
  const vp8 = pad([...head('VP8 '), 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(1600), ...le16(900)]);
  assert.deepEqual(parseImageSize(vp8), { width: 1600, height: 900 });

  const n = ((1520 - 1) | ((780 - 1) << 14)) >>> 0;
  const vp8l = pad([...head('VP8L'), 0x2f, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);
  assert.deepEqual(parseImageSize(vp8l), { width: 1520, height: 780 });

  const vp8x = pad([...head('VP8X'), 0, 0, 0, 0, ...le24(2560 - 1), ...le24(1707 - 1)]);
  assert.deepEqual(parseImageSize(vp8x), { width: 2560, height: 1707 });
});

test('JPEG: skips segments (and fill bytes) to the first SOF', () => {
  const app0 = [0xff, 0xe0, ...be16(16), ...new Array(14).fill(0)];
  const sof0 = [0xff, 0xff, 0xc0, ...be16(17), 8, ...be16(630), ...be16(1200), 3];
  assert.deepEqual(parseImageSize(pad([0xff, 0xd8, ...app0, ...sof0])), { width: 1200, height: 630 });
});

test('unknown or truncated data returns null rather than a wrong size', () => {
  assert.equal(parseImageSize(pad(str('<!doctype html><html>'))), null);
  assert.equal(parseImageSize(new Uint8Array([0xff, 0xd8, 0xff])), null);
  assert.equal(parseImageSize(new Uint8Array(0)), null);
});

test('imageSize requests a byte range and fails soft', async () => {
  const gif = pad([...str('GIF89a'), ...le16(10), ...le16(20)]);
  let seen;
  const fake = async (url, opts) => { seen = opts.headers.Range; return { ok: true, arrayBuffer: async () => gif.buffer }; };
  assert.deepEqual(await imageSize('https://x.test/a.gif', fake), { width: 10, height: 20 });
  assert.match(seen, /^bytes=0-\d+$/);

  assert.equal(await imageSize('https://x.test/broken.gif', async () => { throw new Error('net'); }), null);
  assert.equal(await imageSize('https://x.test/404.gif', async () => ({ ok: false })), null);
  assert.equal(await imageSize('', fake), null);
  assert.equal(await imageSize('/relative.png', fake), null);
});

test('a failed read is not cached, so a later request can succeed', async () => {
  const url = 'https://x.test/flaky.gif';
  assert.equal(await imageSize(url, async () => { throw new Error('blip'); }), null);
  const gif = pad([...str('GIF89a'), ...le16(3), ...le16(4)]);
  assert.deepEqual(await imageSize(url, async () => ({ ok: true, arrayBuffer: async () => gif.buffer })), { width: 3, height: 4 });
});

const base = { slug: 'p', title: 'P', body_html: '<p>x</p>', published_at: '2026-07-01T00:00:00Z',
  featured_image: 'https://x.test/hero.webp' };

test('hero gets width/height, height:auto and high fetch priority when the size is known', () => {
  const html = renderPost({ ...base, featured_image_width: 1600, featured_image_height: 900 });
  const hero = html.match(/<img src="https:\/\/x\.test\/hero\.webp"[^>]*>/)[0];
  assert.match(hero, / width="1600" height="900"/);
  assert.match(hero, /height:auto/, 'without height:auto the height attribute would stretch the image');
  assert.match(hero, /fetchpriority="high"/);
});

test('hero omits width/height when the size could not be read', () => {
  const hero = renderPost(base).match(/<img src="https:\/\/x\.test\/hero\.webp"[^>]*>/)[0];
  assert.doesNotMatch(hero, /width="/);
  assert.match(hero, /height:auto/);
});

test('heroSize ignores anything that is not a positive integer', () => {
  assert.equal(heroSize({ featured_image_width: '1600" onload="x', featured_image_height: 900 }), '');
  assert.equal(heroSize({ featured_image_width: 0, featured_image_height: 900 }), '');
  assert.equal(heroSize({}), '');
});
