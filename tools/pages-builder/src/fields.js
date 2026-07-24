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
  'el-split': {
    src: { type: 'text', label: 'Image URL' },
    alt: { type: 'text', label: 'Alt text' },
    heading: { type: 'text', label: 'Heading' },
    html: { type: 'textarea', label: 'Text (HTML)' },
    flip: { type: 'radio', label: 'Image side', options: [{ label: 'Left', value: false }, { label: 'Right', value: true }] },
  },
  'el-stats': {
    stats: {
      type: 'array', label: 'Stats',
      arrayFields: { value: { type: 'text', label: 'Number' }, suffix: { type: 'text', label: 'Suffix' }, label: { type: 'text', label: 'Label' } },
      defaultItemProps: { value: '100', suffix: '+', label: 'Metric' },
      getItemSummary: (i) => (i && i.label) || 'Stat',
    },
  },
  'el-testimonial': {
    quote: { type: 'textarea', label: 'Quote' },
    name: { type: 'text', label: 'Name' },
    role: { type: 'text', label: 'Role' },
    org: { type: 'text', label: 'Organisation' },
  },
  'el-logos': {
    logos: {
      type: 'array', label: 'Logos',
      arrayFields: { src: { type: 'text', label: 'Image URL' }, alt: { type: 'text', label: 'Alt text' } },
      defaultItemProps: { src: '', alt: '' },
      getItemSummary: (i) => (i && i.alt) || 'Logo',
    },
  },
  'el-features': {
    items: {
      type: 'array', label: 'Cards',
      arrayFields: { title: { type: 'text', label: 'Title' }, text: { type: 'textarea', label: 'Text' } },
      defaultItemProps: { title: 'Feature', text: 'Describe it here.' },
      getItemSummary: (i) => (i && i.title) || 'Card',
    },
  },
  'el-spacer': {
    size: { type: 'select', label: 'Size', options: [{ label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }] },
    line: { type: 'radio', label: 'Divider line', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }] },
  },
};

// Inserter categories (Avada-style element library grouping).
export const CATEGORIES = {
  Layout: { title: 'Layout', components: ['columns', 'el-spacer'] },
  Content: { title: 'Content', components: ['section-heading', 'el-heading', 'rich-text', 'el-text', 'el-button'] },
  Media: { title: 'Media', components: ['el-image', 'el-split', 'el-logos', 'raw-html'] },
  Marketing: { title: 'Marketing', components: ['cta', 'faq', 'el-testimonial', 'el-stats', 'el-features'] },
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
  'el-split': 'Image + Text',
  'el-stats': 'Stats',
  'el-testimonial': 'Testimonial',
  'el-logos': 'Logo strip',
  'el-features': 'Feature cards',
  'el-spacer': 'Spacer / Divider',
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
  'el-split': { src: '', alt: '', heading: 'A compelling heading', html: '<p>Supporting copy goes here.</p>', flip: false },
  'el-stats': { stats: [{ value: '300', suffix: '+', label: 'Workshops delivered' }, { value: '50', suffix: '+', label: 'Countries reached' }, { value: '20', suffix: 'K+', label: 'Leaders trained' }] },
  'el-testimonial': { quote: 'A genuinely great session — practical and immediately useful.', name: 'Client name', role: 'Title', org: 'EO' },
  'el-logos': { logos: [{ src: '', alt: 'Logo 1' }, { src: '', alt: 'Logo 2' }, { src: '', alt: 'Logo 3' }] },
  'el-features': { items: [{ title: 'First feature', text: 'Describe the feature here.' }, { title: 'Second feature', text: 'Describe the feature here.' }, { title: 'Third feature', text: 'Describe the feature here.' }] },
  'el-spacer': { size: 'medium', line: false },
};
