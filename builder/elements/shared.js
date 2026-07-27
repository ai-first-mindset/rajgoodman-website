// Helpers shared by element definitions. Nothing here is engine behaviour --
// these are just markup fragments and field shorthands the site's elements
// happen to have in common.

import { esc } from '../core/html.js';

// Field shorthands. A Field is { name, control, label, default, ... }.
export const text = (name, label, def = '') => ({ name, control: 'text', label, default: def });
export const area = (name, label, def = '') => ({ name, control: 'textarea', label, default: def });
export const html = (name, label, def = '') => ({ name, control: 'html', label, default: def });
export const media = (name, label, def = '') => ({ name, control: 'media', label, default: def });
export const toggle = (name, label, def = false) => ({ name, control: 'toggle', label, default: def });
export const select = (name, label, options, def) => ({ name, control: 'select', label, options, default: def });

// The kicker row + H2 that opens most sections. `ordinal` is the auto-number the
// fold assigns to numbered elements; an explicit `idx` always wins.
export function sectionHead({ idx, kicker, heading, showLine }, ordinal) {
  const idxText = idx != null && String(idx).trim() !== ''
    ? String(idx)
    : (ordinal != null ? `[ ${String(ordinal).padStart(2, '0')} ]` : '');
  const idxEl = idxText ? `<span class="idx">${esc(idxText)}</span>` : '';
  const kick = kicker ? `<span class="kick">${esc(kicker)}</span>` : '';
  const line = showLine === false ? '' : '<span class="ln"></span>';
  const row = (idxEl || kick || line) ? `<div class="shead" data-reveal>${idxEl}${kick}${line}</div>` : '';
  const h2 = heading ? `<h2 data-reveal>${esc(heading)}</h2>` : '';
  return [row, h2].filter(Boolean).join('\n    ');
}

// The shared head fields, so the three section elements declare them once.
export const HEAD_FIELDS = [
  text('idx', 'Index label (e.g. [ 01 ])'),
  text('kicker', 'Kicker'),
  text('heading', 'Heading'),
];

// Inserter glyphs, keyed by name so definitions stay free of markup.
export const ICONS = {
  container: '<rect x="3" y="4" width="18" height="16" rx="2"/>',
  columns: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
  column: '<rect x="7" y="4" width="10" height="16" rx="1"/>',
  heading: '<path d="M5 5v14M15 5v14M5 12h10"/>',
  paragraph: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  button: '<rect x="3" y="8" width="18" height="8" rx="4"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
  split: '<rect x="3" y="5" width="8" height="14" rx="1"/><path d="M14 8h7M14 12h7M14 16h5"/>',
  stats: '<path d="M5 19V9M12 19V5M19 19v-7"/>',
  quote: '<path d="M8 7H5v5h3l-2 5M18 7h-3v5h3l-2 5"/>',
  logos: '<rect x="3" y="6" width="7" height="5" rx="1"/><rect x="14" y="6" width="7" height="5" rx="1"/><rect x="3" y="14" width="7" height="5" rx="1"/><rect x="14" y="14" width="7" height="5" rx="1"/>',
  features: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  spacer: '<path d="M4 8h16M4 16h16"/>',
  faq: '<path d="M9 9a3 3 0 1 1 4 3l-1 1v2"/><circle cx="12" cy="19" r=".6"/>',
  cta: '<path d="M4 12h13M13 7l5 5-5 5"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
};
