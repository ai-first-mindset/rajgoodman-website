// The Puck config: one component per block type, built from the field manifest.
// LEAF blocks render through BlockPreview (→ api/_blocks.js, single source of
// truth). LAYOUT blocks (container, columns) render real React structure with
// Puck slot components inside, so their children are editable drop-zones —
// matching the server markup. Every element also gets a shared token-driven
// "Design" group (spacing / align / panel background) applied by renderBlock.
import { PUCK_FIELDS, LABELS, DEFAULT_PROPS, CATEGORIES } from './fields.js';
import { BlockPreview } from './canvas.jsx';

// Token-scoped design controls, grouped under one collapsible "Design" panel so
// element settings read as Content + Design (not one flat list). Values map to
// site.css .pb-* classes via applyDesign() in api/_blocks.js — nothing free-form,
// so pages stay on-brand.
const DESIGN_FIELD = {
  d: {
    type: 'object',
    label: 'Design',
    objectFields: {
      space: { type: 'select', label: 'Top spacing', options: [{ label: 'None', value: '' }, { label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }] },
      align: { type: 'select', label: 'Align', options: [{ label: 'Left', value: '' }, { label: 'Center', value: 'c' }, { label: 'Right', value: 'r' }] },
      bg: { type: 'radio', label: 'Panel background', options: [{ label: 'None', value: '' }, { label: 'Panel', value: 'panel' }] },
    },
  },
};

function ContainerRender(props) {
  const Content = props.content;
  return (
    <section className="sec tight">
      <div className="wrap">{Content ? <Content /> : null}</div>
    </section>
  );
}

function ColumnsRender(props) {
  const n = Math.min(Math.max(parseInt(props.cols, 10) || 2, 2), 4);
  const slots = [props.col0, props.col1, props.col2, props.col3];
  return (
    <section className="sec tight">
      <div className="wrap">
        <div className={'pb-cols pb-cols-' + n} data-reveal="">
          {Array.from({ length: n }).map((_, i) => {
            const Slot = slots[i];
            return (
              <div className="pb-col" key={i}>{Slot ? <Slot /> : null}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Types whose render is real React (editable slots), not a static preview.
const LAYOUT_RENDER = { container: ContainerRender, columns: ColumnsRender };

const components = {};
for (const type of Object.keys(PUCK_FIELDS)) {
  components[type] = {
    label: LABELS[type] || type,
    fields: { ...PUCK_FIELDS[type], ...DESIGN_FIELD },
    defaultProps: DEFAULT_PROPS[type],
    render: LAYOUT_RENDER[type] || ((props) => <BlockPreview type={type} {...props} />),
  };
}

export const config = {
  components,
  categories: CATEGORIES,
  root: {},
};
