// Block registry for the Pages CMS: the single source of truth that turns a
// page's ordered `blocks` array (see the `pages` table) into the site's exact
// interior-page markup. Imported by the serverless renderer (_page-template.js)
// and mirrored for field metadata by the admin (admin/blocks-ui.js).
//
// Every block renders its own top-level <section> (or verbatim markup), so the
// blocks array is flat and reordering is trivial. Rich fields are sanitised on
// write (api/admin/pages.js); plain-text fields are escaped here at render time.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function stripTags(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;|&#8217;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Section heading (kicker row + H2). `idx` is the literal bracketed label shown
// on the site (e.g. "[ 01 ]"); if empty, the caller may pass an auto-number.
function shead(b, autoNo) {
  const idxText = b.idx != null && String(b.idx).trim() !== ''
    ? String(b.idx)
    : (autoNo != null ? `[ ${String(autoNo).padStart(2, '0')} ]` : '');
  const idx = idxText ? `<span class="idx">${esc(idxText)}</span>` : '';
  const kick = b.kicker ? `<span class="kick">${esc(b.kicker)}</span>` : '';
  const line = b.showLine === false ? '' : '<span class="ln"></span>';
  const row = (idx || kick || line) ? `<div class="shead" data-reveal>${idx}${kick}${line}</div>` : '';
  const h2 = b.heading ? `<h2 data-reveal>${esc(b.heading)}</h2>` : '';
  return [row, h2].filter(Boolean).join('\n    ');
}

// The FAQ accordion — the driver block. Emits the exact site markup so
// site.css (.faq/.pm-ic/.ans) and common.js initFaq() work untouched, and the
// server FAQPage schema extractor sees real <details><summary> pairs.
function renderFaq(b, autoNo) {
  const items = Array.isArray(b.items) ? b.items : [];
  const anyOpen = items.some((it) => it && it.open);
  const rows = items.map((it, i) => {
    const open = (it && it.open) || (!anyOpen && i === 0) ? ' open' : '';
    return `<details${open}><summary>${esc(it && it.question)}<span class="pm-ic"></span></summary><div class="ans">${(it && it.answer_html) || ''}</div></details>`;
  }).join('\n      ');
  const head = shead(b, autoNo);
  return `<section class="sec tight">
  <div class="wrap">
    ${head}
    <div class="faq" data-reveal>
      ${rows}
    </div>
  </div>
</section>`;
}

function renderHeading(b, autoNo) {
  return `<section class="sec tight">
  <div class="wrap">
    ${shead(b, autoNo)}
  </div>
</section>`;
}

function renderRichText(b) {
  return `<section class="sec tight">
  <div class="wrap">
    <div class="prose" data-reveal>${b.html || ''}</div>
  </div>
</section>`;
}

function renderCta(b, autoNo) {
  const head = shead({ ...b, showLine: false }, autoNo);
  const sub = b.text ? `\n    <p class="sub" style="margin:1rem auto 0">${esc(b.text)}</p>` : '';
  const btn = b.label ? `\n    <a href="${esc(b.url || '#')}" class="btn btn-y">${esc(b.label)} <span class="ar">&rarr;</span></a>` : '';
  const h2 = b.heading ? `` : ''; // heading already emitted by shead when present
  return `<section class="sec reach">
  <div class="wrap" data-reveal>
    ${head}${sub}${btn}
  </div>
</section>`;
}

function renderRaw(b) {
  return b.html || '';
}

// ---- Layout + bare content elements (the container/columns/element hierarchy) ----
// Which fields on a block hold nested child blocks (Puck slots). Shared with the
// editor adapter so nesting round-trips generically.
export const SLOT_FIELDS = { columns: ['col0', 'col1', 'col2', 'col3'], container: ['content'] };

// Columns: a self-contained section whose wrap holds a responsive N-column grid;
// each column is an array of child blocks rendered recursively.
function renderColumns(b) {
  const n = Math.min(Math.max(parseInt(b.cols, 10) || 2, 2), 4);
  const cells = [];
  for (let i = 0; i < n; i += 1) {
    cells.push(`<div class="pb-col">${renderBlocks(b['col' + i])}</div>`);
  }
  return `<section class="sec tight">
  <div class="wrap">
    <div class="pb-cols pb-cols-${n}" data-reveal>
      ${cells.join('\n      ')}
    </div>
  </div>
</section>`;
}

// Bare elements: no <section> wrapper, meant to sit inside a column/container.
function renderElHeading(b) {
  const tag = String(b.level) === '3' ? 'h3' : 'h2';
  return `<${tag} data-reveal>${esc(b.text)}</${tag}>`;
}
function renderElText(b) {
  return `<div class="prose" data-reveal>${b.html || ''}</div>`;
}
function renderElButton(b) {
  const cls = b.style === 'line' ? 'btn btn-line' : 'btn btn-y';
  return `<div data-reveal><a href="${esc(b.url || '#')}" class="${cls}">${esc(b.label)} <span class="ar">&rarr;</span></a></div>`;
}
function renderElImage(b) {
  if (!b.src) return '';
  return `<div data-reveal><img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy" style="width:100%;height:auto;border-radius:8px" /></div>`;
}

// Image + Text split (media on one side, heading + prose on the other).
function renderElSplit(b) {
  const media = b.src ? `<div class="pb-split-media"><img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy" /></div>` : '';
  const heading = b.heading ? `<h3>${esc(b.heading)}</h3>` : '';
  const body = `<div class="pb-split-body">${heading}<div class="prose">${b.html || ''}</div></div>`;
  return `<div class="pb-split${b.flip ? ' pb-split-flip' : ''}" data-reveal>${media}${body}</div>`;
}

// Animated stat/counter row (reuses the site .big counters + common.js initCounters).
function renderElStats(b) {
  const items = Array.isArray(b.stats) ? b.stats : [];
  const cells = items.map((s) => `<div class="cell"><div class="n"><span data-count="${esc(s && s.value)}">0</span>${esc((s && s.suffix) || '')}</div><div class="l">${esc(s && s.label)}</div></div>`).join('');
  return `<div class="big" data-reveal>${cells}</div>`;
}

// Single testimonial card.
function renderElTestimonial(b) {
  const org = b.org ? `<span>${esc(b.org)}</span>` : '';
  const role = b.role ? `<span>${esc(b.role)}</span>` : '';
  return `<div class="pb-testimonial" data-reveal><div class="top"><span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>${org}</div><p>${esc(b.quote)}</p><div class="who">${esc(b.name)}${role}</div></div>`;
}

// Logo strip (reuses the site .logowall grid, image cells).
function renderElLogos(b) {
  const items = Array.isArray(b.logos) ? b.logos : [];
  const cells = items.map((l) => (l && l.src ? `<div class="cell"><img src="${esc(l.src)}" alt="${esc(l.alt || '')}" loading="lazy" /></div>` : '')).join('');
  return `<div class="logowall" data-reveal>${cells}</div>`;
}

// Feature cards (reuses the site .feat-grid / .feat card).
function renderElFeatures(b) {
  const items = Array.isArray(b.items) ? b.items : [];
  const cards = items.map((it, i) => `<article class="feat" data-reveal${i ? ` data-delay="${i * 80}"` : ''}><span class="ct tl"></span><span class="ct br"></span><h3>${esc(it && it.title)}</h3><p>${esc(it && it.text)}</p></article>`).join('');
  return `<div class="feat-grid" data-reveal>${cards}</div>`;
}

// Spacer / optional divider line.
function renderElSpacer(b) {
  const h = b.size === 'large' ? 80 : b.size === 'small' ? 24 : 48;
  return b.line ? `<hr class="pb-divider" style="margin:${h}px 0" />` : `<div style="height:${h}px"></div>`;
}

// Container: a full-width section whose wrap holds child blocks (single column).
function renderContainer(b) {
  return `<section class="sec tight">
  <div class="wrap">
    ${renderBlocks(b.content)}
  </div>
</section>`;
}

// Token-driven per-element design controls. Applied generically by renderBlock:
// a block's optional `d` object (spacing / align / panel background) becomes a
// thin wrapper of token classes. Absent `d` → no wrapper (byte-parity preserved).
function designClasses(d) {
  if (!d || typeof d !== 'object') return '';
  const c = [];
  if (d.space) c.push('pb-mt-' + d.space);   // sm | md | lg
  if (d.align) c.push('pb-al-' + d.align);   // c | r
  if (d.bg) c.push('pb-bg-' + d.bg);         // panel
  return c.join(' ');
}
function applyDesign(html, block) {
  const cls = designClasses(block && block.d);
  return cls ? `<div class="pb-wrap ${cls}">${html}</div>` : html;
}

// ---------------------------------------------------------------------------
// Block registry: one entry per type co-locating label, editable fields,
// defaults, the autonumber flag, and the render fn. Single source of truth —
// BLOCK_TYPES, autonumbering, rendering, and defaults all derive from this, so
// adding a block is ONE entry and there is no multi-file drift to forget.
// ---------------------------------------------------------------------------
export const BLOCKS_SCHEMA_VERSION = 1;

const BLOCKS = {
  'rich-text': {
    label: 'Rich text', fields: ['html'], defaults: { html: '' },
    render: (b) => renderRichText(b),
  },
  'section-heading': {
    label: 'Section heading', fields: ['idx', 'kicker', 'heading', 'showLine'],
    defaults: { idx: '', kicker: '', heading: '', showLine: true }, numbered: true,
    render: (b, autoNo) => renderHeading(b, autoNo),
  },
  cta: {
    label: 'Call to action', fields: ['idx', 'kicker', 'heading', 'text', 'label', 'url'],
    defaults: { idx: '', kicker: '', heading: '', text: '', label: '', url: '' }, numbered: true,
    render: (b, autoNo) => renderCta(b, autoNo),
  },
  faq: {
    label: 'FAQ accordion', fields: ['idx', 'kicker', 'heading', 'items'],
    defaults: { idx: '', kicker: 'FAQs', heading: 'Questions, answered', items: [] }, numbered: true,
    render: (b, autoNo) => renderFaq(b, autoNo),
  },
  'raw-html': {
    label: 'Raw HTML', fields: ['html'], defaults: { html: '' },
    render: (b) => renderRaw(b),
  },
  // Layout
  container: {
    label: 'Container', fields: ['content'], defaults: { content: [] },
    render: (b) => renderContainer(b),
  },
  columns: {
    label: 'Columns', fields: ['cols', 'col0', 'col1', 'col2', 'col3'],
    defaults: { cols: 2, col0: [], col1: [], col2: [], col3: [] },
    render: (b) => renderColumns(b),
  },
  // Bare content elements (for use inside columns/containers)
  'el-heading': {
    label: 'Heading', fields: ['text', 'level'], defaults: { text: '', level: 2 },
    render: (b) => renderElHeading(b),
  },
  'el-text': {
    label: 'Text', fields: ['html'], defaults: { html: '' },
    render: (b) => renderElText(b),
  },
  'el-button': {
    label: 'Button', fields: ['label', 'url', 'style'], defaults: { label: '', url: '', style: 'y' },
    render: (b) => renderElButton(b),
  },
  'el-image': {
    label: 'Image', fields: ['src', 'alt'], defaults: { src: '', alt: '' },
    render: (b) => renderElImage(b),
  },
  'el-split': {
    label: 'Image + Text', fields: ['src', 'alt', 'heading', 'html', 'flip'],
    defaults: { src: '', alt: '', heading: '', html: '', flip: false },
    render: (b) => renderElSplit(b),
  },
  'el-stats': {
    label: 'Stats', fields: ['stats'], defaults: { stats: [] },
    render: (b) => renderElStats(b),
  },
  'el-testimonial': {
    label: 'Testimonial', fields: ['quote', 'name', 'role', 'org'],
    defaults: { quote: '', name: '', role: '', org: '' },
    render: (b) => renderElTestimonial(b),
  },
  'el-logos': {
    label: 'Logo strip', fields: ['logos'], defaults: { logos: [] },
    render: (b) => renderElLogos(b),
  },
  'el-features': {
    label: 'Feature cards', fields: ['items'], defaults: { items: [] },
    render: (b) => renderElFeatures(b),
  },
  'el-spacer': {
    label: 'Spacer / Divider', fields: ['size', 'line'],
    defaults: { size: 'medium', line: false },
    render: (b) => renderElSpacer(b),
  },
};

// Metadata for the admin UI (labels + editable field names), derived from the
// registry; a drift test asserts the editor's fields ⊆ these.
export const BLOCK_TYPES = Object.fromEntries(
  Object.entries(BLOCKS).map(([type, def]) => [type, { label: def.label, fields: def.fields }]),
);

// Which block types carry a numbered section heading (participate in autonumber).
const NUMBERED = new Set(Object.keys(BLOCKS).filter((t) => BLOCKS[t].numbered));

// Anti-fragile: an unrecognised block type (e.g. authored by a newer editor
// bundle than this renderer) is NEVER silently dropped. Preserve any raw HTML
// payload; otherwise emit an inert marker so the block still round-trips through
// render without its content vanishing from the page.
function renderUnknown(block) {
  if (typeof block.html === 'string' && block.html) return block.html;
  return `<!-- unsupported-block:${esc(block.type || 'unknown')} -->`;
}

export function renderBlock(block, autoNo) {
  if (!block || typeof block !== 'object') return '';
  const def = BLOCKS[block.type];
  const html = def ? def.render(block, autoNo) : renderUnknown(block);
  return applyDesign(html, block);
}

export function renderBlocks(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  let n = 0;
  return list.map((b) => {
    const no = b && NUMBERED.has(b.type) ? ++n : null;
    return renderBlock(b, no);
  }).filter(Boolean).join('\n');
}

// Migration/normalise seam: fill missing fields with per-type defaults so render
// tolerates partial/older-schema blocks; unknown types pass through untouched.
// Call on read (editor load) — kept OUT of the server render path to preserve
// exact byte-parity. Bump BLOCKS_SCHEMA_VERSION + add cases here when a stored
// block shape changes, so content survives schema evolution.
export function normalizeBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((b) => {
    if (!b || typeof b !== 'object') return b;
    const def = BLOCKS[b.type];
    return def ? { ...def.defaults, ...b } : b;
  });
}

// FAQ Q&A across all faq blocks → [{q,a}] for FAQPage JSON-LD.
export function extractFaqItems(blocks) {
  const out = [];
  (Array.isArray(blocks) ? blocks : []).forEach((b) => {
    if (b && b.type === 'faq' && Array.isArray(b.items)) {
      b.items.forEach((it) => {
        const q = stripTags(it && it.question);
        const a = stripTags(it && it.answer_html);
        if (q && a) out.push({ q, a });
      });
    }
  });
  return out;
}

// Exposed for reuse/testing.
export { esc, stripTags };
