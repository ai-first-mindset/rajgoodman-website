// HTML text helpers shared by every element's render. Kept in the engine so
// escaping is uniform: elements never hand-roll it.

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
