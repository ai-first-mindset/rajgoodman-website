// YouTube embeds in post bodies: portrait videos (Shorts) are tagged so they
// play as a centred 9:16 frame, and every YouTube iframe is lazy-loaded.
// The editor keeps the iframe's width/height through a re-save but drops other
// attributes, which is why this happens at render time.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prepVideos, renderPost } from '../api/_post-template.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const embed = (w, h, extra = '') =>
  `<div data-youtube-video=""><iframe width="${w}" height="${h}" allowfullscreen="true"${extra} src="https://www.youtube-nocookie.com/embed/abc123"></iframe></div>`;

test('a portrait embed (YouTube Short) is tagged yt-portrait', () => {
  const out = prepVideos(embed(360, 640));
  assert.match(out, /<div class="yt-portrait" data-youtube-video="">/);
});

test('a landscape embed keeps the default 16:9 box', () => {
  assert.doesNotMatch(prepVideos(embed(640, 360)), /yt-portrait/);
});

test('every YouTube iframe is lazy-loaded, without duplicating an existing loading attribute', () => {
  assert.match(prepVideos(embed(640, 360)), /<iframe[^>]* loading="lazy">/);
  const already = prepVideos(embed(640, 360, ' loading="eager"'));
  assert.equal((already.match(/loading=/g) || []).length, 1);
});

test('running it twice changes nothing more (no doubled class or attribute)', () => {
  const once = prepVideos(embed(360, 640));
  assert.equal(prepVideos(once), once);
});

test('other markup and empty bodies pass through untouched', () => {
  const other = '<p>Hi</p><iframe width="10" height="20" src="https://example.test/x"></iframe>';
  assert.equal(prepVideos(other), other);
  assert.equal(prepVideos(null), '');
  assert.equal(prepVideos(''), '');
});

test('renderPost applies it to the post body', () => {
  const html = renderPost({ slug: 's', title: 'T', published_at: '2026-07-01T00:00:00Z', body_html: embed(360, 640) });
  assert.match(html, /class="yt-portrait" data-youtube-video/);
});

test('blog-content.css styles .yt-portrait as a centred 9:16 frame', () => {
  const css = readFileSync(join(ROOT, 'blog-content.css'), 'utf8');
  const rule = css.match(/\.post-body div\.yt-portrait\[data-youtube-video\]\s*\{([^}]*)\}/);
  assert.ok(rule, '.yt-portrait rule missing');
  assert.match(rule[1], /aspect-ratio:\s*9\s*\/\s*16/);
  assert.match(rule[1], /margin-left:\s*auto/);
});
