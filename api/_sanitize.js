// Single sanitisation boundary for admin-authored HTML (posts + pages CMS).
// One source of truth so the two admin endpoints can't drift. Defence-in-depth:
// content already comes from format-constrained editors (TipTap / Puck fields);
// this strips the dangerous surface on write. Escaping of plain-text fields
// happens at render time in api/_blocks.js (esc).

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

// Walk a blocks[] array and sanitise every HTML-bearing field. Unknown block
// shapes pass through untouched (anti-fragile: never drop stored data).
export function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => {
    if (!b || typeof b !== 'object') return b;
    const out = { ...b };
    if (typeof out.html === 'string') out.html = sanitizeHtml(out.html);
    if (out.type === 'faq' && Array.isArray(out.items)) {
      out.items = out.items.map((it) => (it && typeof it === 'object'
        ? { ...it, answer_html: sanitizeHtml(it.answer_html) }
        : it));
    }
    return out;
  });
}
