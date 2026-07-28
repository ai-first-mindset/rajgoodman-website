// The allowlist HTML sanitiser. Two obligations pull against each other:
// it must neutralise anything executable, and it must leave the site's real
// hand-authored markup (the /about/ hero and its contact form) byte-identical,
// because re-saving a page re-sanitises it.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sanitizeHtml } from '../builder/sanitize.js';
import { isSafeUrl, safeUrl } from '../builder/core/html.js';

const ABOUT = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/about-page-blocks.json', import.meta.url)), 'utf8'),
);

/* ---- losslessness on real content ---- */

test('the real /about/ markup survives sanitisation byte-for-byte', () => {
  for (const block of ABOUT.filter((b) => b.type === 'raw-html')) {
    assert.equal(sanitizeHtml(block.html), block.html);
  }
});

test('the real /about/ FAQ answers survive byte-for-byte', () => {
  for (const item of ABOUT.find((b) => b.type === 'faq').items) {
    assert.equal(sanitizeHtml(item.answer_html), item.answer_html);
  }
});

test('sanitisation is idempotent', () => {
  const nasty = '<p onclick="x()">a</p><script>b()</script><iframe srcdoc="c"></iframe>';
  const once = sanitizeHtml(nasty);
  assert.equal(sanitizeHtml(once), once);
});

test('the site\'s real form controls and svg are preserved', () => {
  const form = '<form data-form="contact" action="/api/contact" method="post">'
    + '<label for="n">Name</label><input id="n" type="text" name="name" required autocomplete="name" />'
    + '<select name="service"><option value="">Pick</option></select>'
    + '<textarea name="message" rows="4"></textarea><button type="submit">Send</button></form>';
  assert.equal(sanitizeHtml(form), form);
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 12h13" stroke-width="1.6" /></svg>';
  assert.equal(sanitizeHtml(svg), svg);
});

/* ---- the four gaps the old denylist missed ---- */

test('iframe srcdoc is removed with its payload', () => {
  const out = sanitizeHtml('<p>a</p><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe><p>b</p>');
  assert.equal(out, '<p>a</p><p>b</p>');
});

test('a javascript: form action is dropped, the form is kept', () => {
  const out = sanitizeHtml('<form action="javascript:alert(1)"><button>go</button></form>');
  assert.doesNotMatch(out, /javascript:/);
  assert.match(out, /<form><button>go<\/button><\/form>/);
});

test('meta refresh and base are removed entirely', () => {
  assert.equal(sanitizeHtml('<meta http-equiv="refresh" content="0;url=javascript:alert(1)">x'), 'x');
  assert.equal(sanitizeHtml('<base href="https://evil.example/">x'), 'x');
});

/* ---- the classics ---- */

const PAYLOADS = [
  ['script tag', '<script>alert(1)</script>'],
  ['nested script', '<scr<script>ipt>alert(1)</script>'],
  ['svg onload', '<svg onload=alert(1)></svg>'],
  ['img onerror unquoted', '<img src=x onerror=alert(1)>'],
  ['body onload', '<body onload=alert(1)>'],
  ['style expression', '<div style="width:expression(alert(1))">x</div>'],
  ['css import', '<div style="@import url(evil.css)">x</div>'],
  ['moz binding', '<div style="-moz-binding:url(evil.xml)">x</div>'],
  ['a javascript href', '<a href="javascript:alert(1)">x</a>'],
  ['a entity-encoded scheme', '<a href="java&#09;script:alert(1)">x</a>'],
  ['a uppercase scheme', '<a href="JaVaScRiPt:alert(1)">x</a>'],
  ['object data', '<object data="javascript:alert(1)"></object>'],
  ['embed src', '<embed src="javascript:alert(1)">'],
  ['style tag', '<style>body{background:url(javascript:alert(1))}</style>'],
  ['xlink href', '<svg><use xlink:href="javascript:alert(1)"></use></svg>'],
  ['formaction', '<button formaction="javascript:alert(1)">x</button>'],
  ['ping', '<a href="/x" ping="https://evil.example">x</a>'],
  ['handler with newline', '<img src=x\nonerror=alert(1)>'],
  ['data html src', '<img src="data:text/html,<script>alert(1)</script>">'],
  ['svg data image', '<img src="data:image/svg+xml;base64,PHN2Zz4=">'],
];

for (const [name, payload] of PAYLOADS) {
  test(`neutralised: ${name}`, () => {
    const out = sanitizeHtml(payload);
    assert.doesNotMatch(out, /<script/i, 'script tag survived');
    assert.doesNotMatch(out, /\son[a-z]+\s*=/i, 'event handler survived');
    assert.doesNotMatch(out, /javascript:|vbscript:/i, 'script scheme survived');
    assert.doesNotMatch(out, /expression\s*\(|@import|-moz-binding/i, 'css vector survived');
    assert.doesNotMatch(out, /srcdoc|http-equiv|<base|\sping=/i, 'document-level vector survived');
    assert.doesNotMatch(out, /data:text\/html|data:image\/svg/i, 'dangerous data: URL survived');
  });
}

/* ---- SVG surface widened for the AIFM deployment: prove it stayed safe ---- */

test('SVG drawing, text and SMIL animation survive (needed by aifirstmindset.ai)', () => {
  const svg = '<svg viewBox="0 0 10 10"><defs><path id="sw" d="M0 0"/></defs>'
    + '<use href="#sw" class="swirl" transform="translate(1,2) scale(1.5)"/>'
    + '<text class="lbl" x="9" y="3" text-anchor="middle" font-size="4">HELLO</text>'
    + '<animate attributeName="stroke-dashoffset" values="660;0" dur="2s" repeatCount="indefinite"/>'
    + '</svg>';
  assert.equal(sanitizeHtml(svg), svg);
});

test('SMIL cannot be used to animate an href into a javascript: URL', () => {
  // <a><animate attributeName="href" to="javascript:..."/></a> is a real bypass.
  const evil = '<svg><a href="/safe"><animate attributeName="href" to="javascript:alert(1)" dur="1s"/></a></svg>';
  const out = sanitizeHtml(evil);
  assert.doesNotMatch(out, /attributeName="href"/i, 'href must not be animatable');
  assert.doesNotMatch(out, /javascript:/i);
  assert.match(out, /href="\/safe"/, 'the legitimate href is kept');
});

test('SMIL cannot animate any other URL-bearing attribute either', () => {
  for (const attr of ['src', 'action', 'formaction', 'xlink:href', 'srcdoc']) {
    const out = sanitizeHtml(`<svg><animate attributeName="${attr}" to="javascript:alert(1)"/></svg>`);
    assert.doesNotMatch(out, new RegExp(`attributeName="${attr}"`, 'i'), `${attr} must not be animatable`);
  }
});

test('the widened SVG surface still refuses handlers and scripts', () => {
  const out = sanitizeHtml('<svg onload="alert(1)"><text onclick="alert(2)">x</text><script>alert(3)</script></svg>');
  assert.doesNotMatch(out, /onload|onclick|<script/i);
  assert.match(out, /<text>x<\/text>/);
});

test('foreignObject content is still sanitised, not trusted', () => {
  const out = sanitizeHtml('<svg><foreignObject><div onclick="alert(1)">hi</div><script>x()</script></foreignObject></svg>');
  assert.doesNotMatch(out, /onclick|<script/i);
  assert.match(out, /hi/);
});

test('a stray angle bracket in prose is escaped, not treated as a tag', () => {
  assert.equal(sanitizeHtml('5 < 6 and 7 > 4'), '5 &lt; 6 and 7 > 4');
});

test('an unknown element is unwrapped but its text is kept', () => {
  assert.equal(sanitizeHtml('<marquee>keep me</marquee>'), 'keep me');
  assert.equal(sanitizeHtml('<custom-widget data-x="1">text</custom-widget>'), 'text');
});

test('a > inside an attribute value does not end the tag early', () => {
  const html = '<a href="/x?a=1&amp;b=2" title="a > b">x</a>';
  assert.equal(sanitizeHtml(html), html);
});

test('non-strings pass through untouched', () => {
  assert.equal(sanitizeHtml(null), null);
  assert.equal(sanitizeHtml(undefined), undefined);
  assert.equal(sanitizeHtml(''), '');
});

/* ---- URL guard ---- */

test('safeUrl neutralises dangerous schemes and preserves everything else', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('vbscript:x'), '#');
  assert.equal(safeUrl('data:text/html,x'), '#');
  assert.equal(safeUrl('/about/'), '/about/');
  assert.equal(safeUrl('#top'), '#top');
  assert.equal(safeUrl('https://rajgoodman.com/x?a=1#b'), 'https://rajgoodman.com/x?a=1#b');
  assert.equal(safeUrl('mailto:hi@rajgoodman.com'), 'mailto:hi@rajgoodman.com');
  assert.equal(isSafeUrl(''), true);
});
