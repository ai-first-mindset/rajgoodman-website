// The Puck config: one component per block type, built from the field manifest.
// LEAF blocks render through BlockPreview (→ api/_blocks.js, single source of
// truth). LAYOUT blocks (columns) render real React structure with Puck slot
// components inside, so their children are editable drop-zones — matching the
// server markup class-for-class (renderColumns in api/_blocks.js).
import { PUCK_FIELDS, LABELS, DEFAULT_PROPS, CATEGORIES } from './fields.js';
import { BlockPreview } from './canvas.jsx';

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
const LAYOUT_RENDER = { columns: ColumnsRender };

const components = {};
for (const type of Object.keys(PUCK_FIELDS)) {
  components[type] = {
    label: LABELS[type] || type,
    fields: PUCK_FIELDS[type],
    defaultProps: DEFAULT_PROPS[type],
    render: LAYOUT_RENDER[type] || ((props) => <BlockPreview type={type} {...props} />),
  };
}

export const config = {
  components,
  categories: CATEGORIES,
  root: {},
};
