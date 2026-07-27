// Content elements: section-level blocks that emit their own <section>, and the
// bare elements meant to sit inside a Container or Column.

import { esc } from '../core/html.js';
import { ICONS, sectionHead, HEAD_FIELDS, text, html, select, toggle } from './shared.js';

export const sectionHeading = {
  type: 'section-heading',
  label: 'Section heading',
  category: 'Content',
  icon: ICONS.heading,
  autoNumber: true,
  schema: [...HEAD_FIELDS, toggle('showLine', 'Divider line', true)],
  childPolicy: { kind: 'none' },
  render: (ctx) => `<section class="sec tight">
  <div class="wrap">
    ${sectionHead(ctx.props, ctx.ordinal)}
  </div>
</section>`,
};

export const richText = {
  type: 'rich-text',
  label: 'Rich text',
  category: 'Content',
  icon: ICONS.paragraph,
  schema: [html('html', 'Content (HTML)', '')],
  childPolicy: { kind: 'none' },
  render: (ctx) => `<section class="sec tight">
  <div class="wrap">
    <div class="prose" data-reveal>${ctx.props.html || ''}</div>
  </div>
</section>`,
};

export const elHeading = {
  type: 'el-heading',
  label: 'Heading',
  category: 'Content',
  icon: ICONS.heading,
  schema: [
    text('text', 'Heading text'),
    select('level', 'Level', [{ label: 'H2', value: 2 }, { label: 'H3', value: 3 }], 2),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const tag = String(ctx.props.level) === '3' ? 'h3' : 'h2';
    return `<${tag} data-reveal>${esc(ctx.props.text)}</${tag}>`;
  },
};

export const elText = {
  type: 'el-text',
  label: 'Text',
  category: 'Content',
  icon: ICONS.paragraph,
  schema: [html('html', 'Text (HTML)', '')],
  childPolicy: { kind: 'none' },
  render: (ctx) => `<div class="prose" data-reveal>${ctx.props.html || ''}</div>`,
};

export const elButton = {
  type: 'el-button',
  label: 'Button',
  category: 'Content',
  icon: ICONS.button,
  schema: [
    text('label', 'Button label'),
    text('url', 'Button URL'),
    select('style', 'Style', [{ label: 'Solid', value: 'y' }, { label: 'Outline', value: 'line' }], 'y'),
  ],
  childPolicy: { kind: 'none' },
  validate: (node) => (node.props.label && !node.props.url
    ? [{ level: 'warn', field: 'url', message: 'Button has no URL' }]
    : []),
  render: (ctx) => {
    const { style, url, label } = ctx.props;
    const cls = style === 'line' ? 'btn btn-line' : 'btn btn-y';
    return `<div data-reveal><a href="${esc(url || '#')}" class="${cls}">${esc(label)} <span class="ar">&rarr;</span></a></div>`;
  },
};

export default [sectionHeading, richText, elHeading, elText, elButton];
