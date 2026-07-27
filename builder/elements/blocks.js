// The remaining bespoke content blocks from the static pages: the page hero,
// alternating image/text rows, the YouTube shorts gallery and the testimonial
// marquee. Between them these are ~82% of the raw HTML left on /about/.
//
// Same rules as sections.js: emit the live markup byte-for-byte, escText() in
// text nodes, and the literal glyphs the pages use.

import { esc, escAttr, escText, safeUrl } from '../core/html.js';
import { ICONS, text, area, html, media } from './shared.js';

const ARROW = '→';
const STARS = '★★★★★';

// --- Page hero -------------------------------------------------------------

export const pageHero = {
  type: 'page-hero',
  label: 'Page hero',
  category: 'Sections',
  icon: ICONS.page,
  schema: [
    text('crumb', 'Breadcrumb label'),
    text('eyebrow', 'Eyebrow'),
    html('heading', 'Heading (HTML allowed)', ''),
    area('lede', 'Lede'),
    text('ctaLabel', 'Primary button'),
    text('ctaUrl', 'Primary button URL'),
    text('altLabel', 'Secondary button'),
    text('altUrl', 'Secondary button URL'),
    media('image', 'Image'),
    text('imageAlt', 'Image alt text'),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const p = ctx.props;
    const primary = p.ctaLabel
      ? `\n          <a href="${esc(safeUrl(p.ctaUrl) || '#')}" class="btn btn-y">${escText(p.ctaLabel)} <span class="ar">${ARROW}</span></a>` : '';
    const secondary = p.altLabel
      ? `\n          <a href="${esc(safeUrl(p.altUrl) || '#')}" class="btn btn-line">${escText(p.altLabel)}</a>` : '';
    return `<header class="phero">
  <div class="wrap">
    <div class="crumbs" data-reveal><a href="/">Home</a><span class="sep">/</span><span>${escText(p.crumb)}</span></div>
    <div class="phero-grid">
      <div>
        <span class="eyebrow" data-reveal><span class="live"></span>${escText(p.eyebrow)}</span>
        <h1 data-reveal data-delay="60">${p.heading || ''}</h1>
        <p class="lede" data-reveal data-delay="120">${escText(p.lede)}</p>
        <div class="cta" data-reveal data-delay="180">${primary}${secondary}
        </div>
      </div>
      <div class="hud" data-reveal data-delay="140" style="padding:12px">
        <div class="pic"><img src="${esc(safeUrl(p.image, { allowDataImage: true }))}" alt="${escAttr(p.imageAlt)}" loading="eager" style="object-fit:cover;object-position:left center" /></div>
      </div>
    </div>
  </div>
</header>`;
  },
};

// --- Alternating image / text rows -----------------------------------------

export const altRow = {
  type: 'alt-row',
  label: 'Image + text row',
  category: 'Sections',
  icon: ICONS.split,
  schema: [
    media('image', 'Image'),
    text('imageAlt', 'Image alt text'),
    text('tag', 'Tag'),
    text('heading', 'Heading'),
    html('body', 'Body (HTML)', ''),
    { name: 'flip', control: 'toggle', label: 'Image on the right', default: false },
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const p = ctx.props;
    const tag = p.tag ? `\n        <span class="tag">${escText(p.tag)}</span>` : '';
    const heading = p.heading ? `\n        <h3>${escText(p.heading)}</h3>` : '';
    // `trail` carries the blank line the source leaves between rows -- purely
    // mechanical, but needed for the decomposition to stay byte-exact.
    return `<div class="altrow${p.flip ? ' flip' : ''}" data-reveal>
      <div class="alt-media hud duo"><div class="pic"><img src="${esc(safeUrl(p.image, { allowDataImage: true }))}" alt="${escAttr(p.imageAlt)}" loading="lazy" /></div></div>
      <div class="alt-body">${tag}${heading}${p.body || ''}
      </div>
    </div>${p.trail || ''}`;
  },
};

// --- Shorts gallery --------------------------------------------------------

export const shortItem = {
  type: 'short-item',
  label: 'Short',
  category: 'Items',
  icon: ICONS.image,
  standalone: false,
  schema: [
    text('url', 'Video URL'),
    media('image', 'Thumbnail'),
    text('alt', 'Thumbnail alt text'),
    text('caption', 'Caption'),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const p = ctx.props;
    const delay = ctx.index ? ` data-delay="${ctx.index * 60}"` : '';
    return `<a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener" data-reveal${delay} style="grid-column:auto;grid-row:auto;aspect-ratio:9/16"><img src="${esc(safeUrl(p.image, { allowDataImage: true }))}" alt="${escAttr(p.alt)}" loading="lazy"/><span class="pl"><span></span></span><span class="gcap">${escText(p.caption)}</span></a>`;
  },
};

export const shortsGallery = {
  type: 'shorts-gallery',
  label: 'Shorts gallery',
  category: 'Sections',
  icon: ICONS.image,
  schema: [text('style', 'Inline style (advanced)')],
  childPolicy: { kind: 'repeater', item: 'short-item', min: 1 },
  render: (ctx) => {
    const style = ctx.props.style ? ` style="${escAttr(ctx.props.style)}"` : '';
    return `<div class="gal"${style}>
      ${ctx.renderChildren({ separator: '\n      ' })}
    </div>`;
  },
};

// --- Testimonial marquee ---------------------------------------------------

export const marqueeQuote = {
  type: 'marquee-quote',
  label: 'Quote',
  category: 'Items',
  icon: ICONS.quote,
  standalone: false,
  schema: [
    area('quote', 'Quote'),
    text('name', 'Name'),
    text('role', 'Role'),
    text('org', 'Organisation'),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const p = ctx.props;
    const org = p.org ? `<span>${escText(p.org)}</span>` : '';
    const role = p.role ? `<span>${escText(p.role)}</span>` : '';
    return `<div class="quote"><div class="top"><span class="stars">${STARS}</span>${org}</div><p>${escText(p.quote)}</p><div class="who">${escText(p.name)}${role}</div></div>`;
  },
};

export const testimonialMarquee = {
  type: 'testimonial-marquee',
  label: 'Testimonial marquee',
  category: 'Sections',
  icon: ICONS.quote,
  schema: [{ name: 'reverse', control: 'toggle', label: 'Scroll in reverse', default: false }],
  childPolicy: { kind: 'repeater', item: 'marquee-quote', min: 1 },
  render: (ctx) => `<div class="tst-row${ctx.props.reverse ? ' rev' : ''}" data-reveal>
    <div class="tst-track">
      ${ctx.renderChildren({ separator: '\n      ' })}
    </div>
  </div>`,
};

// The testimonial section is shaped differently from every other one: the
// marquee sits OUTSIDE the main wrap as a sibling, and a second wrap closes the
// section with a link. page-section models one wrap, so this gets its own type
// rather than bending that one out of shape.
export const marqueeSection = {
  type: 'marquee-section',
  label: 'Testimonial section',
  category: 'Sections',
  icon: ICONS.quote,
  schema: [
    text('idx', 'Index label (e.g. [ 05 ])'),
    text('kicker', 'Kicker'),
    text('heading', 'Heading'),
    html('sub', 'Sub text (HTML)', ''),
    { name: 'showLine', control: 'toggle', label: 'Divider line', default: true },
    text('footerLabel', 'Footer link label'),
    text('footerUrl', 'Footer link URL'),
    text('footerStyle', 'Footer style (advanced)'),
  ],
  childPolicy: { kind: 'repeater', item: 'marquee-quote', min: 1 },
  render: (ctx) => {
    const p = ctx.props;
    const idx = p.idx ? `<span class="idx">${escText(p.idx)}</span>` : '';
    const kick = p.kicker ? `<span class="kick">${escText(p.kicker)}</span>` : '';
    const ln = p.showLine === false ? '' : '<span class="ln"></span>';
    const head = (idx || kick || ln) ? `<div class="shead" data-reveal>${idx}${kick}${ln}</div>` : '';
    const h2 = p.heading ? `\n    <h2 data-reveal>${escText(p.heading)}</h2>` : '';
    const sub = p.sub ? `\n    <p class="sub" data-reveal>${p.sub}</p>` : '';
    const fStyle = p.footerStyle ? ` style="${escAttr(p.footerStyle)}"` : '';
    const footer = p.footerLabel
      ? `\n  <div class="wrap"${fStyle}><a href="${esc(safeUrl(p.footerUrl) || '#')}" class="btn btn-line" data-reveal>${escText(p.footerLabel)} <span class="ar">${ARROW}</span></a></div>`
      : '';
    return `<section class="sec tight">
  <div class="wrap">
    ${head}${h2}${sub}
  </div>
  <div class="tst-row" data-reveal>
    <div class="tst-track">
      ${ctx.renderChildren({ separator: '\n      ' })}
    </div>
  </div>${footer}
</section>`;
  },
};

export default [pageHero, altRow, shortItem, shortsGallery, marqueeQuote, testimonialMarquee, marqueeSection];
