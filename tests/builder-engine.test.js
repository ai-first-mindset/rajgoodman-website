// The engine's definition-of-done, asserted directly.
//
// Every test here is a property the architecture is supposed to guarantee, not
// a behaviour of any particular element.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createBuilderRegistry, registry } from '../builder/elements/index.js';
import { createNode, findNode, findParent, collect } from '../builder/core/node.js';
import { parse, serialize, normalize, createDocument, DOCUMENT_VERSION } from '../builder/core/document.js';
import { createEnv, renderDocument } from '../builder/core/render.js';
import { createTheme, SIGNAL_THEME } from '../builder/core/tokens.js';
import { createDataScope, binding, pageSources } from '../builder/core/bindings.js';
import { accepts, acceptedTypes, arityOf } from '../builder/core/policy.js';
import { validateTree, canInsert, visibleFields } from '../builder/core/validate.js';
import {
  createHistory, apply, InsertType, Insert, Remove, Move, SetProp, SetStyle, Duplicate,
} from '../builder/core/commands.js';

const env = (over = {}) => createEnv({ registry, ...over });
const ctx = { registry };
const docWith = (...children) => ({
  version: DOCUMENT_VERSION,
  root: { id: 'root', type: 'page-root', props: {}, children },
});

// ---------------------------------------------------------------------------
// A new element inherits the entire builder from one registration
// ---------------------------------------------------------------------------

const pricingTable = {
  type: 'pricing-table',
  label: 'Pricing table',
  category: 'Marketing',
  schema: [
    { name: 'currency', control: 'select', label: 'Currency', default: 'GBP', options: [{ label: 'GBP', value: 'GBP' }, { label: 'USD', value: 'USD' }] },
    { name: 'note', control: 'text', label: 'Footnote', default: '' },
  ],
  childPolicy: { kind: 'repeater', item: 'pricing-tier', min: 1, max: 3 },
  render: (c) => `<div class="pricing" data-currency="${c.props.currency}">${c.renderChildren({ separator: '' })}</div>`,
};
const pricingTier = {
  type: 'pricing-tier',
  label: 'Tier',
  category: 'Items',
  standalone: false,
  schema: [{ name: 'name', control: 'text', label: 'Name', default: 'Starter' }],
  childPolicy: { kind: 'none' },
  render: (c) => `<div class="tier">${c.props.name}</div>`,
};

test('registering one definition is the only step to add an element', () => {
  const reg = createBuilderRegistry([pricingTable, pricingTier]);
  const node = createNode(reg, 'pricing-table');

  // Defaults come from the schema, with no defaults() written by hand.
  assert.equal(node.props.currency, 'GBP');
  // The repeater minimum seeded a real child Node.
  assert.equal(node.children.length, 1);
  assert.equal(node.children[0].type, 'pricing-tier');
  // The inspector is derivable, the element is insertable, it renders.
  assert.deepEqual(visibleFields(reg.get('pricing-table'), node.props).map((f) => f.name), ['currency', 'note']);
  assert.ok(reg.categories().get('Marketing').some((d) => d.type === 'pricing-table'));
  const html = renderDocument(docWith(node), createEnv({ registry: reg }));
  assert.equal(html, '<div class="pricing" data-currency="GBP"><div class="tier">Starter</div></div>');
  // Serialization, undo and validation all work on it with no extra code.
  const doc = docWith(node);
  assert.deepEqual(parse(serialize(doc)).doc, doc);
  assert.deepEqual(validateTree(doc, reg), []);
});

test('an item type is only insertable where its repeater accepts it', () => {
  const reg = createBuilderRegistry([pricingTable, pricingTier]);
  assert.equal(accepts(reg.get('pricing-table'), 'pricing-tier'), true);
  assert.equal(accepts(reg.get('pricing-table'), 'el-button'), false);
  assert.equal(accepts(reg.get('pricing-tier'), 'el-button'), false); // leaf
  assert.deepEqual(acceptedTypes(reg.get('pricing-table'), reg), ['pricing-tier']);
});

// ---------------------------------------------------------------------------
// Composite: no algorithm branches on leaf-vs-container
// ---------------------------------------------------------------------------

test('the engine core never branches on a node type', () => {
  // document.js is deliberately exempt: its v1 migration is a legacy-shape
  // adapter, which is exactly where type knowledge is allowed to live.
  const dir = fileURLToPath(new URL('../builder/core/', import.meta.url));
  const cores = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'document.js');
  const offenders = [];
  for (const file of cores) {
    const src = readFileSync(dir + file, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/\.type\s*===|\.type\s*==[^=]|switch\s*\(\s*\w+\.type/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `type branching found in the engine core:\n${offenders.join('\n')}`);
});

test('leaf and container share one shape, so one traversal serves both', () => {
  const doc = parse([
    { type: 'container', content: [{ type: 'el-heading', text: 'A', level: 2 }] },
    { type: 'el-button', label: 'B', url: '/b', style: 'y' },
  ]).doc;
  // collect() has no idea what a container is.
  assert.equal(collect(doc.root, (n) => n.type === 'el-heading').length, 1);
  assert.equal(findParent(doc.root, collect(doc.root, (n) => n.type === 'el-heading')[0].id).type, 'container');
  assert.equal(collect(doc.root, () => true).length, 4); // root + container + heading + button
});

// ---------------------------------------------------------------------------
// Document: round-trip, versioning, migration
// ---------------------------------------------------------------------------

test('a document round-trips losslessly through serialization', () => {
  const doc = createDocument(registry);
  const node = createNode(registry, 'el-testimonial', { props: { quote: 'Hi', name: 'X' } });
  node.style = { space: 'space.lg', align: 'align.center' };
  const full = { ...doc, root: { ...doc.root, children: [node] } };
  const reloaded = parse(JSON.parse(JSON.stringify(serialize(full)))).doc;
  assert.deepEqual(reloaded, full);
});

test('the legacy blocks[] array migrates to a v2 tree', () => {
  const { doc, issues } = parse([
    { type: 'columns', cols: 2, col0: [{ type: 'el-text', html: '<p>L</p>' }], col1: [], col2: [], col3: [] },
    { type: 'faq', kicker: 'FAQs', heading: 'Q', items: [{ question: 'a', answer_html: 'b', open: false }] },
    { type: 'el-testimonial', quote: 'q', name: 'n', d: { space: 'lg', bg: 'panel' } },
  ]);

  assert.equal(doc.version, DOCUMENT_VERSION);
  assert.deepEqual(issues, []);

  const [columns, faq, testimonial] = doc.root.children;
  // Slot fields became children; arity is now structural.
  assert.equal(columns.children.length, 2);
  assert.equal(columns.children[0].type, 'column');
  assert.equal(columns.children[0].children[0].type, 'el-text');
  assert.equal(columns.props.cols, undefined);
  // Array props became homogeneous item children.
  assert.equal(faq.children.length, 1);
  assert.equal(faq.children[0].type, 'faq-item');
  assert.equal(faq.props.items, undefined);
  // The implicit "first item open" rule was materialised onto the item.
  assert.equal(faq.children[0].props.open, true);
  // Literal design values became token references.
  assert.deepEqual(testimonial.style, { space: 'space.lg', surface: 'surface.panel' });
});

test('migration reports, rather than silently drops, content v1 never rendered', () => {
  const { issues } = parse([
    { type: 'columns', cols: 2, col0: [], col1: [], col2: [{ type: 'el-text', html: '<p>hidden</p>' }], col3: [] },
  ]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /col2/);
});

test('a document from a newer version keeps its unknown elements and warns', () => {
  const future = { version: DOCUMENT_VERSION + 1, root: { id: 'r', type: 'page-root', props: {}, children: [
    { id: 'x', type: 'timeline', props: { html: '<p>kept</p>' }, children: [] },
  ] } };
  const { doc, issues } = parse(future);
  assert.match(issues[0].message, /newer than this renderer/);
  assert.equal(renderDocument(doc, env()), '<p>kept</p>');
});

test('normalize fills missing props but is never applied on the render path', () => {
  const doc = docWith({ id: 'a', type: 'el-button', props: { label: 'Go' }, children: [] });
  assert.equal(normalize(doc, registry).root.children[0].props.style, 'y');
  assert.equal(doc.root.children[0].props.style, undefined); // untouched
});

// ---------------------------------------------------------------------------
// Commands: every mutation flows through the layer, and undo covers all of them
// ---------------------------------------------------------------------------

test('undo/redo covers every command', () => {
  const history = createHistory(createDocument(registry), ctx);
  const rootId = history.doc.root.id;

  const { selection: colsId } = history.dispatch(InsertType(rootId, 'columns'));
  const columns = findNode(history.doc.root, colsId);
  assert.equal(columns.children.length, 2); // repeater min seeded

  const { selection: btnId } = history.dispatch(InsertType(columns.children[0].id, 'el-button'));
  history.dispatch(SetProp(btnId, 'label', 'Book'));
  history.dispatch(SetStyle(btnId, 'align', 'align.center'));
  history.dispatch(Move(btnId, columns.children[1].id, 0));
  history.dispatch(Duplicate(btnId));

  const afterAll = history.doc;
  assert.equal(collect(afterAll.root, (n) => n.type === 'el-button').length, 2);

  // Walk all the way back, then all the way forward.
  let undos = 0;
  while (history.canUndo) { history.undo(); undos += 1; }
  assert.equal(undos, 6);
  assert.equal(collect(history.doc.root, (n) => n.type === 'el-button').length, 0);
  while (history.canRedo) history.redo();
  assert.deepEqual(history.doc, afterAll);
});

test('a command that breaches childPolicy is refused and changes nothing', () => {
  const doc = parse([{ type: 'el-button', label: 'x', url: '/', style: 'y' }]).doc;
  const btnId = doc.root.children[0].id;
  const { doc: after, issues } = apply(doc, Insert(btnId, createNode(registry, 'el-text')), ctx);
  assert.equal(after, doc); // same reference: nothing applied
  assert.match(issues[0].message, /does not accept/);
});

test('a repeater refuses to fall below its minimum', () => {
  const doc = parse([{ type: 'faq', items: [{ question: 'q', answer_html: 'a', open: true }] }]).doc;
  const itemId = doc.root.children[0].children[0].id;
  const { doc: after, issues } = apply(doc, Remove(itemId), ctx);
  assert.equal(after, doc);
  assert.match(issues[0].message, /at least 1/);
});

test('a node cannot be moved into its own subtree', () => {
  const doc = parse([{ type: 'container', content: [{ type: 'container', content: [] }] }]).doc;
  const outer = doc.root.children[0];
  const inner = outer.children[0];
  const { doc: after } = apply(doc, Move(outer.id, inner.id, 0), ctx);
  assert.equal(after.root.children[0].id, outer.id);
  assert.equal(after.root.children.length, 1);
});

test('commands never mutate the document they were given', () => {
  const doc = parse([{ type: 'el-heading', text: 'before', level: 2 }]).doc;
  const snapshot = JSON.stringify(doc);
  apply(doc, SetProp(doc.root.children[0].id, 'text', 'after'), ctx);
  assert.equal(JSON.stringify(doc), snapshot);
});

// ---------------------------------------------------------------------------
// Style tokens and content bindings
// ---------------------------------------------------------------------------

test('changing a theme token restyles the whole tree with no node edits', () => {
  const doc = parse([
    { type: 'el-heading', text: 'A', level: 2, d: { space: 'lg' } },
    { type: 'el-text', html: '<p>B</p>', d: { space: 'lg' } },
  ]).doc;
  const before = renderDocument(doc, env());
  assert.match(before, /pb-wrap pb-mt-lg/);

  const roomy = { ...SIGNAL_THEME, tokens: { ...SIGNAL_THEME.tokens, 'space.lg': 'pb-mt-xxl' } };
  const after = renderDocument(doc, env({ theme: createTheme(roomy) }));

  assert.equal((after.match(/pb-mt-xxl/g) || []).length, 2);
  assert.doesNotMatch(after, /pb-mt-lg/);
  // The document itself never changed: only the theme did.
  assert.equal(doc.root.children[0].style.space, 'space.lg');
});

test('a node stores a token reference, never a literal value', () => {
  const theme = createTheme();
  assert.equal(theme.resolve('surface.panel'), 'pb-bg-panel');
  assert.equal(theme.resolve('color.accent'), 'var(--yellow)');
  assert.equal(theme.resolve('nope.nope'), '');
  assert.ok(theme.options('space').some((o) => o.value === 'space.md' && o.label === 'Medium'));
});

test('a bound prop resolves from the data source without touching the element', () => {
  const doc = docWith({
    id: 'h', type: 'el-heading', children: [],
    props: { text: binding('page.title'), level: 2 },
  });
  const withPage = renderDocument(doc, env({ data: pageSources({ title: 'About Raj' }) }));
  assert.equal(withPage, '<h2 data-reveal>About Raj</h2>');
  // Same tree, different source: the element is untouched.
  const other = renderDocument(doc, env({ data: pageSources({ title: 'Keynotes' }) }));
  assert.equal(other, '<h2 data-reveal>Keynotes</h2>');
});

test('a binding falls back when its source is empty, and bindings survive serialization', () => {
  const doc = docWith({
    id: 'h', type: 'el-heading', children: [],
    props: { text: binding('page.missing', 'Untitled'), level: 2 },
  });
  assert.match(renderDocument(doc, env({ data: createDataScope({ page: {} }) })), />Untitled</);
  assert.deepEqual(parse(serialize(doc)).doc, doc);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('validateTree reports structural, field and cross-node issues together', () => {
  const doc = docWith(
    { id: 'b', type: 'el-button', props: { label: 'No link', url: '' }, children: [] },
    { id: 'i', type: 'el-image', props: { src: '/x.png', alt: '' }, children: [] },
    { id: 'f', type: 'faq', props: {}, children: [] },
    { id: 'u', type: 'mystery', props: {}, children: [] },
  );
  const messages = validateTree(doc, registry).map((i) => i.message);
  assert.ok(messages.some((m) => /no URL/.test(m)));
  assert.ok(messages.some((m) => /no alt text/.test(m)));
  assert.ok(messages.some((m) => /at least 1/.test(m)));
  assert.ok(messages.some((m) => /unknown element/.test(m)));
});

test('canInsert enforces the whole childPolicy table', () => {
  const doc = parse([{ type: 'columns', cols: 4, col0: [], col1: [], col2: [], col3: [] }]).doc;
  const cols = doc.root.children[0];
  assert.equal(canInsert(registry, doc.root, cols.id, 'el-text').ok, false);   // whitelist of one
  assert.equal(canInsert(registry, doc.root, cols.id, 'column').ok, false);    // max arity reached
  assert.equal(canInsert(registry, doc.root, cols.children[0].id, 'el-text').ok, true);
  assert.equal(arityOf(registry.get('columns')).max, 4);
  assert.equal(arityOf(registry.get('el-text')).max, 0);
});
