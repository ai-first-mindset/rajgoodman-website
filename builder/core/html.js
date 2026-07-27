// HTML text helpers shared by every element's render. Kept in the engine so
// escaping is uniform: elements never hand-roll it.

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Text-node escaping. Only &, < and > are significant in element content --
// quotes are not, and escaping them (as esc() does, correctly, for attribute
// values) would rewrite every apostrophe in the site's copy as &#39; and break
// byte-parity with the hand-authored markup. Use esc() inside attributes and
// escText() between tags.
export function escText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Attribute escaping for DOUBLE-quoted attributes: quotes matter, apostrophes
// do not. esc() also escapes ' (needed if a value were single-quoted), which
// would rewrite every apostrophe in the site's alt text as &#39;.
export function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripTags(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;|&#8217;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Attribute helper: emits ` name="value"` or nothing when the value is empty.
export function attr(name, value) {
  return value == null || value === '' ? '' : ` ${name}="${esc(value)}"`;
}

// --- URL safety -------------------------------------------------------------
//
// esc() makes a value safe to sit inside an attribute, but it does NOT stop
// `javascript:` — no quotes are needed to write a scheme. Any value that becomes
// an href/src/action must go through safeUrl().

// Schemes are compared after decoding entities and stripping the whitespace and
// control characters browsers ignore, so `java&#09;script:` cannot slip past.
function decodeForScheme(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&tab;|&newline;/gi, ' ')
    .replace(/&colon;/gi, ':')
    .replace(/[\u0000-\u0020\u00a0\u1680\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff]/g, '');
}

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'ftp:']);
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon);/i;

// True for relative URLs, anchors, and the schemes above. data: is allowed only
// for raster images (never image/svg+xml, which can carry script).
export function isSafeUrl(value, { allowDataImage = false } = {}) {
  const v = decodeForScheme(value == null ? '' : value);
  if (v === '') return true;
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) return true;                       // relative, #anchor, //host
  if (allowDataImage && SAFE_DATA_IMAGE.test(v)) return true;
  return SAFE_SCHEMES.has(scheme[0].toLowerCase());
}

// The value to actually emit: the original when safe, otherwise a dead link.
export function safeUrl(value, opts) {
  return isSafeUrl(value, opts) ? String(value == null ? '' : value) : '#';
}
