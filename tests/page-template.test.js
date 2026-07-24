// renderPage: interior-page SSR — head/SEO, standard + custom JSON-LD, auto
// FAQPage, and injected chrome. Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, renderNotFound } from '../api/_page-template.js';

const rec = {
  slug: 'about', title: 'About Raj', seo_title: 'About Raj | SEO',
  meta_description: 'desc here', canonical_url: 'https://rajgoodman.com/about/',
  robots: 'index, follow',
  blocks: [
    { type: 'raw-html', html: '<section class="x">body</section>' },
    { type: 'faq', items: [{ question: 'Q?', answer_html: 'A.', open: true }] },
  ],
  json_ld: { '@type': 'Person', name: 'Raj', sameAs: ['https://example.com/raj'] },
  modified_at: '2025-01-01T00:00:00Z',
};

test('head carries title/description/canonical/og/robots', () => {
  const html = renderPage(rec);
  assert.match(html, /<title>About Raj \| SEO<\/title>/);
  assert.match(html, /name="description" content="desc here"/);
  assert.match(html, /rel="canonical" href="https:\/\/rajgoodman.com\/about\/"/);
  assert.match(html, /og:title" content="About Raj \| SEO"/);
  assert.match(html, /og:type" content="website"/);
  assert.match(html, /name="robots" content="index, follow"/);
});

test('emits interior chrome (data-page, bg-grid, site.css, chrome+common)', () => {
  const html = renderPage(rec);
  assert.match(html, /<body data-page="about">/);
  assert.match(html, /<div class="bg-grid"><\/div>/);
  assert.match(html, /rel="stylesheet" href="\/site.css"/);
  assert.match(html, /<script src="\/chrome.js"><\/script>/);
  assert.match(html, /<script src="\/common.js"><\/script>/);
});

test('renders blocks and a standard @graph incl. FAQPage', () => {
  const html = renderPage(rec);
  assert.match(html, /<section class="x">body<\/section>/);
  assert.match(html, /<div class="faq" data-reveal>/);
  const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  const graph = JSON.parse(m[1])['@graph'];
  assert.ok(graph.find((n) => n['@type'] === 'WebPage'), 'WebPage node');
  assert.ok(graph.find((n) => n['@type'] === 'BreadcrumbList'), 'BreadcrumbList node');
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  assert.ok(faq, 'FAQPage node');
  assert.equal(faq.mainEntity[0].name, 'Q?');
});

test('custom json_ld preserved as a second ld+json block', () => {
  const html = renderPage(rec);
  const scripts = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
  assert.equal(scripts.length, 2);
  assert.match(scripts[1], /example\.com\/raj/);
});

test('no FAQPage when there are no faq blocks', () => {
  const html = renderPage({ ...rec, blocks: [{ type: 'raw-html', html: '<p>x</p>' }] });
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
  assert.ok(!graph.find((n) => n['@type'] === 'FAQPage'));
});

test('renderNotFound is noindex with chrome', () => {
  const html = renderNotFound();
  assert.match(html, /name="robots" content="noindex"/);
  assert.match(html, /<script src="\/chrome.js"><\/script>/);
});
