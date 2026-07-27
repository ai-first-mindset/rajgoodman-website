// Layout elements. Note that Container and Columns differ ONLY in their
// childPolicy and their markup -- neither carries any containment machinery,
// because containment is the engine's, not the element's.

import { ICONS, select } from './shared.js';

export const pageRoot = {
  type: 'page-root',
  label: 'Page',
  category: 'System',
  icon: ICONS.page,
  standalone: false,
  schema: [],
  childPolicy: { kind: 'any' },
  render: (ctx) => ctx.renderChildren(),
};

export const container = {
  type: 'container',
  label: 'Container',
  category: 'Layout',
  icon: ICONS.container,
  schema: [],
  childPolicy: { kind: 'any' },
  render: (ctx) => `<section class="sec tight">
  <div class="wrap">
    ${ctx.renderChildren()}
  </div>
</section>`,
};

// A repeater of Columns: the children ARE the columns, so the grid's arity is
// structural rather than a number stored in a prop.
export const columns = {
  type: 'columns',
  label: 'Columns',
  category: 'Layout',
  icon: ICONS.columns,
  schema: [],
  childPolicy: { kind: 'repeater', item: 'column', min: 2, max: 4 },
  render: (ctx) => {
    const n = Math.min(Math.max(ctx.childCount, 2), 4);
    return `<section class="sec tight">
  <div class="wrap">
    <div class="pb-cols pb-cols-${n}" data-reveal>
      ${ctx.renderChildren({ separator: '\n      ' })}
    </div>
  </div>
</section>`;
  },
};

export const column = {
  type: 'column',
  label: 'Column',
  category: 'Layout',
  icon: ICONS.column,
  standalone: false,
  schema: [],
  childPolicy: { kind: 'any' },
  render: (ctx) => `<div class="pb-col">${ctx.renderChildren()}</div>`,
};

export const spacer = {
  type: 'el-spacer',
  label: 'Spacer / Divider',
  category: 'Layout',
  icon: ICONS.spacer,
  schema: [
    select('size', 'Size', [
      { label: 'Small', value: 'small' },
      { label: 'Medium', value: 'medium' },
      { label: 'Large', value: 'large' },
    ], 'medium'),
    { name: 'line', control: 'toggle', label: 'Divider line', default: false },
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const { size, line } = ctx.props;
    const h = size === 'large' ? 80 : size === 'small' ? 24 : 48;
    return line ? `<hr class="pb-divider" style="margin:${h}px 0" />` : `<div style="height:${h}px"></div>`;
  },
};

export default [pageRoot, container, columns, column, spacer];
