// The Puck config: one component per block type, built from the plain-data field
// manifest. Each component's render delegates to BlockPreview (→ api/_blocks.js).
import { PUCK_FIELDS, LABELS, DEFAULT_PROPS } from './fields.js';
import { BlockPreview } from './canvas.jsx';

const components = {};
for (const type of Object.keys(PUCK_FIELDS)) {
  components[type] = {
    label: LABELS[type] || type,
    fields: PUCK_FIELDS[type],
    defaultProps: DEFAULT_PROPS[type],
    render: (props) => <BlockPreview type={type} {...props} />,
  };
}

// Group the inserter under one category in declared order.
export const config = {
  components,
  categories: {
    blocks: { title: 'Blocks', components: Object.keys(PUCK_FIELDS) },
  },
  root: {},
};
