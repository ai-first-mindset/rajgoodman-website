// Composite sections: elements that model the site's OWN recurring sections,
// as opposed to the generic kit in content.js / marketing.js.
//
// These exist so a page stops being an opaque raw-html blob. Each one has to
// emit its section's live markup byte-for-byte, because the pages already
// exist and must not change when they are decomposed -- so the renders here
// look fussy on purpose (exact indentation, the literal arrow glyph, escText()
// rather than esc() in text nodes). tests/builder-sections.test.js checks each
// against the real published markup.

import { esc, escText, safeUrl } from '../core/html.js';
import { ICONS, text, area, html } from './shared.js';

const ARROW = '→'; // the literal glyph the pages use, not &rarr;

// The site's standard section: a numbered head, a heading, then a body. Eight
// of the ten sections on /about/ share exactly this shape, so typing it makes
// the headings editable and whole sections reorderable in one step.
//
// The body is CHILDREN, not props: whatever we have a typed element for becomes
// one, and the rest stays as a raw-html child the author can edit in the Code
// view. That is the deliberate trade -- modelling every bespoke inner style
// attribute as a form field would cost far more than it is worth.
export const pageSection = {
  type: 'page-section',
  label: 'Section',
  category: 'Sections',
  icon: ICONS.container,
  schema: [
    text('idx', 'Index label (e.g. [ 01 ])'),
    text('kicker', 'Kicker'),
    text('heading', 'Heading'),
    { name: 'showLine', control: 'toggle', label: 'Divider line', default: true },
    text('anchor', 'Anchor id (optional)'),
    text('headingStyle', 'Heading style (advanced)'),
  ],
  childPolicy: { kind: 'any' },
  render: (ctx) => {
    const p = ctx.props;
    const idx = p.idx ? `<span class="idx">${escText(p.idx)}</span>` : '';
    const kick = p.kicker ? `<span class="kick">${escText(p.kicker)}</span>` : '';
    const ln = p.showLine === false ? '' : '<span class="ln"></span>';
    const head = (idx || kick || ln) ? `<div class="shead" data-reveal>${idx}${kick}${ln}</div>` : '';
    const hStyle = p.headingStyle ? ` style="${esc(p.headingStyle)}"` : '';
    const h2 = p.heading ? `${head ? '\n    ' : ''}<h2 data-reveal${hStyle}>${escText(p.heading)}</h2>` : '';
    // Every child sits on its own indented line. `lead` carries any extra blank
    // line a migrated section had before its body -- mechanical formatting the
    // author never needs to see, kept so decomposition stays byte-exact.
    const body = ctx.childCount
      ? `${p.lead || ''}\n    ${ctx.renderChildren({ separator: '\n    ' })}`
      : '';
    const anchor = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    return `<section class="sec tight"${anchor}>
  <div class="wrap">
    ${head}${h2}${body}
  </div>
</section>`;
  },
};

// "Global Reach": a centred heading band wrapping an animated counter row.
// Present on 11 of the 16 pages, which makes it the cheapest section to type.
export const statBand = {
  type: 'stat-band',
  label: 'Stat band',
  category: 'Sections',
  icon: ICONS.stats,
  schema: [
    text('idx', 'Index label (e.g. [ 09 ])'),
    text('kicker', 'Kicker'),
    text('heading', 'Heading'),
    area('text', 'Sub text'),
    text('label', 'Button label'),
    text('url', 'Button URL'),
  ],
  childPolicy: { kind: 'repeater', item: 'stat-item', min: 1 },
  render: (ctx) => {
    const p = ctx.props;
    const idx = p.idx ? `<span class="idx">${escText(p.idx)}</span>` : '';
    const kick = p.kicker ? `<span class="kick">${escText(p.kicker)}</span>` : '';
    const head = (idx || kick)
      ? `<div class="shead" style="justify-content:center">${idx}${kick}</div>\n    ` : '';
    const h2 = p.heading ? `<h2>${escText(p.heading)}</h2>\n    ` : '';
    const sub = p.text
      ? `<p class="sub" style="margin:1rem auto 0">${escText(p.text)}</p>\n    ` : '';
    const btn = p.label
      ? `\n    <a href="${esc(safeUrl(p.url) || '#')}" class="btn btn-y">${escText(p.label)} <span class="ar">${ARROW}</span></a>`
      : '';
    return `<section class="sec reach">
  <div class="wrap" data-reveal>
    ${head}${h2}${sub}<div class="big">
      ${ctx.renderChildren({ separator: '\n      ' })}
    </div>${btn}
  </div>
</section>`;
  },
};

// --- Section bodies --------------------------------------------------------
// The pieces that sit inside a section. Splitting a body into these is what
// makes the CONTENT editable rather than just the heading above it.

// The standing paragraph under a section heading. Rich text, because several
// carry inline links.
export const subText = {
  type: 'sub-text',
  label: 'Sub text',
  category: 'Sections',
  icon: ICONS.paragraph,
  schema: [html('html', 'Text (HTML)', ''), text('style', 'Inline style (advanced)')],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const style = ctx.props.style ? ` style="${esc(ctx.props.style)}"` : '';
    return `<p class="sub" data-reveal${style}>${ctx.props.html || ''}</p>`;
  },
};

// A body copy block. data-delay and margin tweaks vary per instance, so they
// are props rather than being baked in.
export const proseBlock = {
  type: 'prose-block',
  label: 'Prose',
  category: 'Sections',
  icon: ICONS.paragraph,
  schema: [
    html('html', 'Content (HTML)', ''),
    text('delay', 'Reveal delay (ms)'),
    text('style', 'Inline style (advanced)'),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const p = ctx.props;
    const delay = p.delay ? ` data-delay="${esc(p.delay)}"` : '';
    const style = p.style ? ` style="${esc(p.style)}"` : '';
    return `<div class="prose" data-reveal${delay}${style}>${p.html || ''}</div>`;
  },
};

// A standalone call-to-action link under a section body.
export const buttonRow = {
  type: 'button-row',
  label: 'Button row',
  category: 'Sections',
  icon: ICONS.button,
  schema: [
    text('label', 'Button label'),
    text('url', 'Button URL'),
    { name: 'style', control: 'select', label: 'Style', default: 'line', options: [{ label: 'Outline', value: 'line' }, { label: 'Solid', value: 'y' }] },
    { name: 'newTab', control: 'toggle', label: 'Open in a new tab', default: false },
    text('wrapStyle', 'Inline style (advanced)'),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const p = ctx.props;
    const wrap = p.wrapStyle ? ` style="${esc(p.wrapStyle)}"` : '';
    const cls = p.style === 'y' ? 'btn btn-y' : 'btn btn-line';
    const target = p.newTab ? ' target="_blank" rel="noopener"' : '';
    return `<div${wrap} data-reveal><a href="${esc(safeUrl(p.url) || '#')}"${target} class="${cls}">${escText(p.label)} <span class="ar">${ARROW}</span></a></div>`;
  },
};

export default [pageSection, statBand, subText, proseBlock, buttonRow];
