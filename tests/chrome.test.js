// Smoke tests for chrome.js (injected nav + footer): both fragments land in
// the right positions, active-state follows data-page, and the footer carries
// the .f-bot bar the cookie-consent script hooks its settings link into.
// Run: node --test 'tests/**/*.test.js'
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MODULE = require.resolve('../chrome.js');

let inserted;
function boot(page) {
  inserted = {};
  global.document = {
    body: {
      getAttribute: (n) => (n === 'data-page' ? page : null),
      insertAdjacentHTML: (pos, html) => { inserted[pos] = html; },
    },
  };
  delete require.cache[MODULE];
  require(MODULE);
}
afterEach(() => { delete global.document; });

test('nav goes in first, footer last, both with their landmarks', () => {
  boot('');
  assert.match(inserted.afterbegin, /^<nav class="nav" data-nav>/);
  assert.match(inserted.afterbegin, /data-mobile-nav/);
  assert.match(inserted.beforeend, /^<footer>/);
  assert.match(inserted.beforeend, /class="f-bot"/); // cookie-consent hooks its settings link here
});

test('every major route is linked with the canonical trailing-slash form', () => {
  boot('');
  const all = inserted.afterbegin + inserted.beforeend;
  for (const href of ['/about/', '/eo-ypo-leadership/', '/keynote-speaker/', '/workshops/tech-workshop/',
    '/ai-training-for-executives/', '/ai-for-business-leaders/', '/ai-trainer/', '/ai-business-consultant/',
    '/organizational-transformation-consultant/', '/fractional-chief-ai-officer/', '/events/', '/blog/',
    '/media/', '/testimonials/']) {
    assert.ok(all.includes(`href="${href}"`), `missing link to ${href}`);
  }
});

test('data-page drives the active nav state (dropdown groups and flat links)', () => {
  boot('blog');
  assert.match(inserted.afterbegin, /nav-item active"><a>Resources<\/a>/);
  boot('keynote');
  assert.match(inserted.afterbegin, /nav-item active"><a>Services<\/a>/);
  boot('events');
  assert.match(inserted.afterbegin, /href="\/events\/" class="active"/);
  boot('');
  assert.doesNotMatch(inserted.afterbegin, /class="active"/);
});
