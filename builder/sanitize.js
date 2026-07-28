// Allowlist HTML sanitiser.
//
// Replaces the previous regex denylist, which could only strip the patterns it
// knew about and missed <iframe srcdoc>, <form action="javascript:">,
// <meta http-equiv="refresh"> and <base href>. Here everything is removed
// unless it is explicitly permitted.
//
// LOSSLESS BY DESIGN. The site's pages hold large blocks of hand-authored
// markup (the /about/ hero and its real contact form), and re-saving a page
// re-sanitises it. So this scanner never re-serialises: a tag whose attributes
// are all acceptable is emitted as the EXACT original substring, and only a tag
// that actually needs an attribute removed is rebuilt. Clean input therefore
// comes out byte-identical, which tests/builder-sanitize.test.js asserts
// against the real published /about/ document.

import { isSafeUrl } from './core/html.js';

// Elements that may appear. The form controls are here because the site's
// contact form is authored markup, not a component.
const ALLOWED_TAGS = new Set([
  'div', 'span', 'p', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  'figure', 'figcaption', 'blockquote', 'hr', 'br', 'wbr',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'small', 'sub', 'sup',
  'code', 'pre', 'kbd', 'samp', 'var', 'mark', 'abbr', 'time', 'q', 'cite', 'address',
  'a', 'img', 'picture', 'source', 'video', 'audio', 'track',
  'details', 'summary', 'button', 'progress', 'meter',
  'form', 'input', 'select', 'option', 'optgroup', 'textarea', 'label', 'fieldset', 'legend', 'datalist',
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g', 'defs',
  'use', 'symbol', 'title', 'desc', 'tspan', 'clippath', 'mask', 'pattern',
  'lineargradient', 'radialgradient', 'stop', 'filter', 'fegaussianblur', 'femerge', 'femergenode',
  // SMIL animation. Declarative and script-free, but see ANIMATABLE below:
  // animating an href is a documented XSS vector and is blocked.
  'animate', 'animatetransform', 'animatemotion', 'set', 'mpath',
  'text', 'textpath', 'marker', 'image', 'switch', 'metadata', 'view', 'foreignobject',
]);

// Removed along with everything inside them: unwrapping their content would
// either be meaningless or would release the payload.
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'noscript', 'template', 'base', 'meta', 'link', 'head', 'html', 'body',
  'portal', 'xmp', 'plaintext', 'listing', 'math', 'annotation-xml',
]);

// Attributes allowed on any element.
const GLOBAL_ATTRS = new Set([
  'class', 'id', 'style', 'title', 'role', 'lang', 'dir', 'hidden', 'tabindex',
  'translate', 'slot', 'itemprop', 'itemscope', 'itemtype',
]);

const TAG_ATTRS = {
  a: ['href', 'target', 'rel', 'download', 'hreflang', 'type', 'name'],
  img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding', 'fetchpriority', 'referrerpolicy', 'usemap'],
  source: ['src', 'srcset', 'sizes', 'type', 'media', 'width', 'height'],
  video: ['src', 'poster', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'playsinline', 'preload'],
  audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload'],
  track: ['src', 'kind', 'srclang', 'label', 'default'],
  form: ['action', 'method', 'enctype', 'target', 'novalidate', 'autocomplete', 'name', 'accept-charset'],
  input: ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'readonly', 'checked',
    'min', 'max', 'step', 'pattern', 'minlength', 'maxlength', 'autocomplete', 'accept', 'multiple', 'list', 'size'],
  select: ['name', 'required', 'disabled', 'multiple', 'size', 'autocomplete'],
  option: ['value', 'selected', 'disabled', 'label'],
  optgroup: ['label', 'disabled'],
  textarea: ['name', 'required', 'disabled', 'readonly', 'rows', 'cols', 'placeholder', 'maxlength', 'minlength', 'autocomplete', 'wrap'],
  label: ['for'],
  fieldset: ['disabled', 'name'],
  button: ['type', 'name', 'value', 'disabled'],
  details: ['open'],
  th: ['colspan', 'rowspan', 'headers', 'scope', 'abbr'],
  td: ['colspan', 'rowspan', 'headers'],
  col: ['span'], colgroup: ['span'],
  time: ['datetime'],
  q: ['cite'], blockquote: ['cite'], del: ['cite', 'datetime'], ins: ['cite', 'datetime'],
  progress: ['value', 'max'], meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
  ol: ['start', 'reversed', 'type'], li: ['value'],
};

// SVG presentation/geometry attributes, allowed on any svg element.
const SVG_ATTRS = new Set([
  // `href` on <use> is how SVG references a symbol/def. It is still checked as
  // a URL below, so href="javascript:..." is rejected; only xlink:href (which
  // predates that checking and is easy to smuggle) stays banned outright.
  'href',
  'viewbox', 'xmlns', 'xmlns:xlink', 'version', 'preserveaspectratio', 'focusable',
  'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity',
  'd', 'points', 'transform', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform',
  'clip-path', 'clip-rule', 'mask', 'marker-end', 'marker-start', 'vector-effect',
  'stddeviation', 'result', 'in', 'in2', 'patternunits', 'maskunits',
  // SMIL timing/animation attributes
  'attributename', 'attributetype', 'values', 'keytimes', 'keysplines', 'dur',
  'begin', 'end', 'repeatcount', 'repeatdur', 'from', 'to', 'by', 'calcmode',
  'additive', 'accumulate', 'restart', 'type', 'path', 'rotate',
  // typography + geometry used by <text>/<marker>/<image>
  'dx', 'dy', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift',
  'font-size', 'font-family', 'font-weight', 'font-style', 'letter-spacing', 'word-spacing',
  'writing-mode', 'textlength', 'lengthadjust', 'startoffset', 'xml:space',
  'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'markerunits', 'spreadmethod',
  'pathlength', 'shape-rendering', 'paint-order', 'mix-blend-mode', 'isolation',
]);

// An <animate> may not target a URL-bearing attribute:
//   <a><animate attributeName="href" to="javascript:..."/></a>
// is a real bypass. Dropping attributeName leaves the animation inert.
const NON_ANIMATABLE = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'srcdoc']);
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'g', 'defs', 'use', 'symbol', 'title', 'desc', 'tspan', 'clippath', 'mask', 'pattern',
  'lineargradient', 'radialgradient', 'stop', 'filter', 'fegaussianblur', 'femerge', 'femergenode',
  'animate', 'animatetransform', 'animatemotion', 'set', 'mpath',
  'text', 'textpath', 'marker', 'image', 'switch', 'metadata', 'view', 'foreignobject']);

// Void elements have no closing tag, so a dropped one must remove only itself.
// Scanning for a close tag that can never appear would swallow the rest of the
// document (base, meta, link and embed are all void AND dropped).
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

// Attributes whose value is a URL, and must clear isSafeUrl().
// SMIL's to/from/by/values carry the value being animated INTO an attribute, so
// they can smuggle a scheme. Legitimate animation values ("660;0", "5", a
// transform) contain no scheme and pass untouched.
const URL_ATTRS = new Set(['href', 'src', 'action', 'poster', 'cite', 'formaction', 'data', 'xlink:href',
  'to', 'from', 'by', 'values']);

// Never permitted regardless of element: srcdoc smuggles a whole document,
// http-equiv drives meta refresh, and every on* is an event handler.
const NEVER = new Set(['srcdoc', 'http-equiv', 'formaction', 'xlink:href', 'ping', 'background', 'dynsrc', 'lowsrc']);

function attrAllowed(tag, name) {
  if (NEVER.has(name)) return false;
  if (name.startsWith('on')) return false;
  if (name.startsWith('data-') || name.startsWith('aria-')) return true;
  if (GLOBAL_ATTRS.has(name)) return true;
  if (SVG_TAGS.has(tag) && SVG_ATTRS.has(name)) return true;
  return (TAG_ATTRS[tag] || []).includes(name);
}

// CSS can execute in legacy engines (expression) and can pull in remote
// documents (@import, -moz-binding). Reject style values containing them.
// NOTE: deliberately no /g flag -- a global regex carries lastIndex between
// .test() calls and would pass every other check.
const CSS_DANGER = /(expression\s*\(|javascript\s*:|vbscript\s*:|@import|-moz-binding|behaviou?r\s*:)/i;
function styleIsClean(value) {
  return !CSS_DANGER.test(String(value));
}

function valueAllowed(tag, name, value) {
  if (value == null) return true;                       // boolean attribute
  if (name === 'attributename') return !NON_ANIMATABLE.has(String(value).toLowerCase().trim());
  if (name === 'style') return styleIsClean(value);
  if (name === 'srcset') {
    return String(value).split(',').every((part) => isSafeUrl(part.trim().split(/\s+/)[0], { allowDataImage: true }));
  }
  if (URL_ATTRS.has(name)) return isSafeUrl(value, { allowDataImage: tag === 'img' || tag === 'source' });
  return true;
}

const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseAttrs(source) {
  const out = [];
  ATTR_RE.lastIndex = 0;
  let m = ATTR_RE.exec(source);
  while (m) {
    const raw = m[0];
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    if (name !== '/') out.push({ raw, name, value });
    m = ATTR_RE.exec(source);
  }
  return out;
}

export function sanitizeHtml(html) {
  if (typeof html !== 'string' || html === '') return html;

  let out = '';
  let i = 0;
  const n = html.length;

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { out += html.slice(i); break; }
    out += html.slice(i, lt);

    // Comment: kept verbatim (inert, and the site's markup uses them as markers).
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end < 0) { i = n; break; }
      out += html.slice(lt, end + 3);
      i = end + 3;
      continue;
    }
    // Doctype / bogus declaration: drop.
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt);
      i = end < 0 ? n : end + 1;
      continue;
    }

    const closing = html.startsWith('</', lt);
    const nameMatch = /^([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt + (closing ? 2 : 1)));
    if (!nameMatch) { out += '&lt;'; i = lt + 1; continue; }   // a stray "<" is text

    const tag = nameMatch[1].toLowerCase();
    const tagEnd = findTagEnd(html, lt);
    if (tagEnd < 0) { out += '&lt;'; i = lt + 1; continue; }

    if (DROP_WITH_CONTENT.has(tag)) {
      i = (closing || VOID_TAGS.has(tag)) ? tagEnd + 1 : skipElement(html, tag, tagEnd + 1);
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) { i = tagEnd + 1; continue; }  // unwrap: keep children
    if (closing) { out += html.slice(lt, tagEnd + 1); i = tagEnd + 1; continue; }

    const original = html.slice(lt, tagEnd + 1);
    const inner = html.slice(lt + 1 + tag.length, tagEnd);
    const selfClosing = /\/\s*$/.test(inner);
    const attrs = parseAttrs(inner);
    const kept = attrs.filter((a) => attrAllowed(tag, a.name) && valueAllowed(tag, a.name, a.value));

    // Byte-identical when nothing had to go — the whole point of this scanner.
    out += kept.length === attrs.length
      ? original
      : rebuildTag(tag, kept, selfClosing);
    i = tagEnd + 1;
  }
  return out;
}

function rebuildTag(tag, attrs, selfClosing) {
  const parts = attrs.map((a) => a.raw.trim());
  return `<${tag}${parts.length ? ' ' + parts.join(' ') : ''}${selfClosing ? ' /' : ''}>`;
}

// The index of the '>' that closes this tag, honouring quoted attribute values
// so a '>' inside an attribute cannot end it early.
function findTagEnd(html, start) {
  let quote = null;
  for (let j = start + 1; j < html.length; j += 1) {
    const c = html[j];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '>') return j;
  }
  return -1;
}

// Skip to just past the matching close tag (used for script/style/iframe...).
function skipElement(html, tag, from) {
  const close = new RegExp(`</\\s*${tag}\\b[^>]*>`, 'i');
  const rest = html.slice(from);
  const m = close.exec(rest);
  return m ? from + m.index + m[0].length : html.length;
}
