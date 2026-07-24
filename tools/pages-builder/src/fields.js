// Puck field manifest — PLAIN DATA (no React), so tests/blocks-drift.test.js can
// import it under node and assert its field names stay a subset of BLOCK_TYPES in
// api/_blocks.js. One entry per block type; field names mirror BLOCK_TYPES exactly.

const boolOpts = [{ label: 'Yes', value: true }, { label: 'No', value: false }];

export const PUCK_FIELDS = {
  'rich-text': {
    html: { type: 'textarea', label: 'Content (HTML)' },
  },
  'section-heading': {
    idx: { type: 'text', label: 'Index label (e.g. [ 01 ])' },
    kicker: { type: 'text', label: 'Kicker' },
    heading: { type: 'text', label: 'Heading' },
    showLine: { type: 'radio', label: 'Divider line', options: boolOpts },
  },
  cta: {
    idx: { type: 'text', label: 'Index label' },
    kicker: { type: 'text', label: 'Kicker' },
    heading: { type: 'text', label: 'Heading' },
    text: { type: 'textarea', label: 'Sub text' },
    label: { type: 'text', label: 'Button label' },
    url: { type: 'text', label: 'Button URL' },
  },
  faq: {
    idx: { type: 'text', label: 'Index label' },
    kicker: { type: 'text', label: 'Kicker' },
    heading: { type: 'text', label: 'Heading' },
    items: {
      type: 'array',
      label: 'Accordion items',
      arrayFields: {
        question: { type: 'text', label: 'Question' },
        answer_html: { type: 'textarea', label: 'Answer (HTML allowed)' },
        open: { type: 'radio', label: 'Open by default', options: boolOpts },
      },
      defaultItemProps: { question: '', answer_html: '', open: false },
      getItemSummary: (item) => (item && item.question) || 'Item',
    },
  },
  'raw-html': {
    html: { type: 'textarea', label: 'HTML (verbatim)' },
  },
  // --- Layout ---
  columns: {
    cols: { type: 'select', label: 'Columns', options: [{ label: '2 columns', value: 2 }, { label: '3 columns', value: 3 }, { label: '4 columns', value: 4 }] },
    col0: { type: 'slot' },
    col1: { type: 'slot' },
    col2: { type: 'slot' },
    col3: { type: 'slot' },
  },
  // --- Bare content elements (drop inside columns) ---
  'el-heading': {
    text: { type: 'text', label: 'Heading text' },
    level: { type: 'select', label: 'Level', options: [{ label: 'H2', value: 2 }, { label: 'H3', value: 3 }] },
  },
  'el-text': {
    html: { type: 'textarea', label: 'Text (HTML)' },
  },
  'el-button': {
    label: { type: 'text', label: 'Button label' },
    url: { type: 'text', label: 'Button URL' },
    style: { type: 'select', label: 'Style', options: [{ label: 'Solid', value: 'y' }, { label: 'Outline', value: 'line' }] },
  },
  'el-image': {
    src: { type: 'text', label: 'Image URL' },
    alt: { type: 'text', label: 'Alt text' },
  },
};

// Inserter categories (Avada-style element library grouping).
export const CATEGORIES = {
  Layout: { title: 'Layout', components: ['columns'] },
  Content: { title: 'Content', components: ['section-heading', 'el-heading', 'rich-text', 'el-text', 'el-button'] },
  Media: { title: 'Media', components: ['el-image', 'raw-html'] },
  Marketing: { title: 'Marketing', components: ['cta', 'faq'] },
};

export const LABELS = {
  'rich-text': 'Rich text',
  'section-heading': 'Section heading',
  cta: 'Call to action',
  faq: 'FAQ accordion',
  'raw-html': 'Raw HTML',
  columns: 'Columns',
  'el-heading': 'Heading',
  'el-text': 'Text',
  'el-button': 'Button',
  'el-image': 'Image',
};

// Defaults for newly-inserted blocks. Seeded with real placeholder content so a
// freshly-dropped block looks complete immediately (Avada-style ease of use) —
// the author edits in place rather than staring at an empty box.
export const DEFAULT_PROPS = {
  'rich-text': { html: '<p>Start writing…</p>' },
  'section-heading': { idx: '', kicker: 'Section', heading: 'New section heading', showLine: true },
  cta: { idx: '', kicker: 'Get in touch', heading: 'Ready to work with Raj?', text: 'Add a short supporting line here.', label: 'Contact', url: '/#contact' },
  faq: { idx: '', kicker: 'FAQs', heading: 'Questions, answered', items: [{ question: 'Your question here?', answer_html: 'Your answer here.', open: true }] },
  'raw-html': { html: '<!-- Paste custom HTML here -->' },
  columns: { cols: 2, col0: [], col1: [], col2: [], col3: [] },
  'el-heading': { text: 'New heading', level: 2 },
  'el-text': { html: '<p>Start writing…</p>' },
  'el-button': { label: 'Learn more', url: '/#contact', style: 'y' },
  'el-image': { src: '', alt: '' },
};
