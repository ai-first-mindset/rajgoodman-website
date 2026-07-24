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

// Which block types carry a numbered section heading (participate in autonumber).
const NUMBERED = new Set(['section-heading', 'faq', 'cta']);

// Metadata for the admin UI (labels + editable field names). The admin builds
// its field forms from this; a drift test asserts admin fields ⊆ these.
export const BLOCK_TYPES = {
  'rich-text': { label: 'Rich text', fields: ['html'] },
  'section-heading': { label: 'Section heading', fields: ['idx', 'kicker', 'heading', 'showLine'] },
  cta: { label: 'Call to action', fields: ['idx', 'kicker', 'heading', 'text', 'label', 'url'] },
  faq: { label: 'FAQ accordion', fields: ['idx', 'kicker', 'heading', 'items'] },
  'raw-html': { label: 'Raw HTML', fields: ['html'] },
};

export function renderBlock(block, autoNo) {
  if (!block || typeof block !== 'object') return '';
  switch (block.type) {
    case 'faq': return renderFaq(block, autoNo);
    case 'section-heading': return renderHeading(block, autoNo);
    case 'rich-text': return renderRichText(block);
    case 'cta': return renderCta(block, autoNo);
    case 'raw-html': return renderRaw(block);
    default: return '';
  }
}

export function renderBlocks(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  let n = 0;
  return list.map((b) => {
    const no = b && NUMBERED.has(b.type) ? ++n : null;
    return renderBlock(b, no);
  }).filter(Boolean).join('\n');
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
