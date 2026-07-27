// Media elements. The logo strip is a repeater: its children are logo-item
// nodes, so each logo gets selection, reordering and undo for free.

import { esc, safeUrl } from '../core/html.js';
import { ICONS, text, html, media, toggle } from './shared.js';

export const elImage = {
  type: 'el-image',
  label: 'Image',
  category: 'Media',
  icon: ICONS.image,
  schema: [media('src', 'Image URL'), text('alt', 'Alt text')],
  childPolicy: { kind: 'none' },
  validate: (node) => (node.props.src && !node.props.alt
    ? [{ level: 'warn', field: 'alt', message: 'Image has no alt text' }]
    : []),
  render: (ctx) => {
    const { src, alt } = ctx.props;
    if (!src) return '';
    return `<div data-reveal><img src="${esc(safeUrl(src, { allowDataImage: true }))}" alt="${esc(alt || '')}" loading="lazy" style="width:100%;height:auto;border-radius:8px" /></div>`;
  },
};

export const elSplit = {
  type: 'el-split',
  label: 'Image + Text',
  category: 'Media',
  icon: ICONS.split,
  schema: [
    media('src', 'Image URL'),
    text('alt', 'Alt text'),
    text('heading', 'Heading'),
    html('html', 'Text (HTML)', ''),
    toggle('flip', 'Image on the right', false),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const { src, alt, heading, html: body, flip } = ctx.props;
    const mediaEl = src ? `<div class="pb-split-media"><img src="${esc(safeUrl(src, { allowDataImage: true }))}" alt="${esc(alt || '')}" loading="lazy" /></div>` : '';
    const head = heading ? `<h3>${esc(heading)}</h3>` : '';
    const bodyEl = `<div class="pb-split-body">${head}<div class="prose">${body || ''}</div></div>`;
    return `<div class="pb-split${flip ? ' pb-split-flip' : ''}" data-reveal>${mediaEl}${bodyEl}</div>`;
  },
};

export const logoItem = {
  type: 'logo-item',
  label: 'Logo',
  category: 'Items',
  icon: ICONS.image,
  standalone: false,
  schema: [media('src', 'Image URL'), text('alt', 'Alt text')],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const { src, alt } = ctx.props;
    if (!src) return '';
    return `<div class="cell"><img src="${esc(safeUrl(src, { allowDataImage: true }))}" alt="${esc(alt || '')}" loading="lazy" /></div>`;
  },
};

export const elLogos = {
  type: 'el-logos',
  label: 'Logo strip',
  category: 'Media',
  icon: ICONS.logos,
  schema: [],
  childPolicy: { kind: 'repeater', item: 'logo-item' },
  render: (ctx) => `<div class="logowall" data-reveal>${ctx.renderChildren({ separator: '' })}</div>`,
};

export const rawHtml = {
  type: 'raw-html',
  label: 'Raw HTML',
  category: 'Media',
  icon: ICONS.code,
  schema: [html('html', 'HTML (verbatim)', '')],
  childPolicy: { kind: 'none' },
  render: (ctx) => ctx.props.html || '',
};

export default [elImage, elSplit, logoItem, elLogos, rawHtml];
