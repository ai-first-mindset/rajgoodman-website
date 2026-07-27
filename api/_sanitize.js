// Single sanitisation boundary for admin-authored HTML (posts + pages CMS).
// One source of truth so the two admin endpoints can't drift. Defence-in-depth:
// content already comes from format-constrained editors (TipTap / builder
// fields); this strips the dangerous surface on write. Escaping of plain-text
// fields happens at render time in the builder (esc).

import { htmlFieldsByType } from '../builder/seo.js';

// Strip <script>/<style>, inline event handlers, and javascript:/vbscript: URLs.
export function sanitizeHtml(html) {
  if (typeof html !== 'string') return html;
  return html
    .replace(/<\s*script\b[\s\S]*?<\/\s*script\s*>/gi, '')
    .replace(/<\s*script\b[^>]*>/gi, '')
    .replace(/<\s*style\b[\s\S]*?<\/\s*style\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(?:javascript|vbscript):[^"']*\2/gi, '$1=$2#$2');
}

// Which props are HTML is DERIVED FROM THE SCHEMAS (every field whose control is
// `html`), so an element added to the registry is sanitised without anyone
// remembering to update this file.
const HTML_FIELDS = htmlFieldsByType();

// Any prop literally named `html` is also treated as HTML, which keeps unknown
// or newer element types covered (they are preserved, never dropped).
function sanitizeProps(type, props) {
  if (!props || typeof props !== 'object') return props;
  const names = new Set([...(HTML_FIELDS[type] || []), ...('html' in props ? ['html'] : [])]);
  if (!names.size) return props;
  const out = { ...props };
  for (const name of names) out[name] = sanitizeHtml(out[name]);
  return out;
}

function sanitizeNode(node) {
  if (!node || typeof node !== 'object') return node;
  return {
    ...node,
    props: sanitizeProps(node.type, node.props),
    children: Array.isArray(node.children) ? node.children.map(sanitizeNode) : node.children,
  };
}

// Legacy v1 blocks[]: containment lived in slot fields and repeats in array
// props, so those are walked explicitly. Stored documents in this shape are
// still accepted (the renderer migrates them on read).
const LEGACY_SLOTS = { container: ['content'], columns: ['col0', 'col1', 'col2', 'col3'] };

function sanitizeLegacyBlock(b) {
  if (!b || typeof b !== 'object') return b;
  const out = { ...b };
  if (typeof out.html === 'string') out.html = sanitizeHtml(out.html);
  if (out.type === 'faq' && Array.isArray(out.items)) {
    out.items = out.items.map((it) => (it && typeof it === 'object'
      ? { ...it, answer_html: sanitizeHtml(it.answer_html) }
      : it));
  }
  for (const slot of LEGACY_SLOTS[out.type] || []) {
    if (Array.isArray(out[slot])) out[slot] = out[slot].map(sanitizeLegacyBlock);
  }
  return out;
}

// Accepts either shape the `pages.blocks` column may hold: a v2 builder document
// or the legacy flat array. Unknown shapes pass through untouched (anti-fragile:
// never drop stored data).
export function sanitizeBlocks(stored) {
  if (Array.isArray(stored)) return stored.map(sanitizeLegacyBlock);
  if (stored && typeof stored === 'object' && stored.root) {
    return { ...stored, root: sanitizeNode(stored.root) };
  }
  return stored;
}
