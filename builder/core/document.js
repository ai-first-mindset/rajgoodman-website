// The document: one serializable, versioned tree that the builder and the
// production renderer consume identically.
//
//   { version, root: Node }
//
// Backward compatibility: a stored document from an older schema is upgraded by
// a registered migration on load, so historical content keeps opening under new
// code. Forward compatibility: unknown element types and unknown props are
// PRESERVED, never stripped -- older code renders a newer document with inert
// markers instead of crashing (see renderUnknown in render.js).

import { createNode, newId } from './node.js';

export const DOCUMENT_VERSION = 2;

export const ROOT_TYPE = 'page-root';

export function createDocument(registry) {
  return { version: DOCUMENT_VERSION, root: createNode(registry, ROOT_TYPE) };
}

// Serialization is a pure projection: no ids are regenerated, no defaults are
// injected, so load(serialize(doc)) deep-equals doc.
export function serialize(doc) {
  return { version: doc.version, root: serializeNode(doc.root) };
}

function serializeNode(node) {
  const out = { id: node.id, type: node.type, props: node.props, children: node.children.map(serializeNode) };
  if (node.style && Object.keys(node.style).length) out.style = node.style;
  return out;
}

// ---------------------------------------------------------------------------
// Migrations: version -> (doc) => doc at version + 1.
// ---------------------------------------------------------------------------

// v1 is the legacy Pages CMS shape: a FLAT `blocks[]` array where containment
// lived in named slot fields (container.content, columns.col0..col3), repeated
// content lived in array props (faq.items, el-stats.stats, ...), and design
// lived in a literal `d` object.
//
// v2 makes all three uniform: containment is children, repeats are children of
// a single item type, and design is token references in `style`.
const LEGACY_SLOTS = { container: ['content'], columns: ['col0', 'col1', 'col2', 'col3'] };
const LEGACY_REPEATS = {
  faq: { prop: 'items', item: 'faq-item' },
  'el-stats': { prop: 'stats', item: 'stat-item' },
  'el-logos': { prop: 'logos', item: 'logo-item' },
  'el-features': { prop: 'items', item: 'feature-card' },
};
const LEGACY_STYLE = {
  space: (v) => `space.${v}`,
  align: (v) => (v === 'c' ? 'align.center' : v === 'r' ? 'align.right' : ''),
  bg: (v) => `surface.${v}`,
};

function migrateV1toV2(doc, ctx) {
  const issues = ctx.issues;
  const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
  return {
    version: 2,
    root: {
      id: newId('root'),
      type: ROOT_TYPE,
      props: {},
      children: blocks.map((b) => blockToNode(b, issues)),
    },
  };
}

function legacyStyle(d) {
  if (!d || typeof d !== 'object') return null;
  const style = {};
  for (const [k, toRef] of Object.entries(LEGACY_STYLE)) {
    if (!d[k]) continue;
    const ref = toRef(d[k]);
    if (ref) style[k === 'bg' ? 'surface' : k] = ref;
  }
  return Object.keys(style).length ? style : null;
}

function blockToNode(block, issues) {
  if (!block || typeof block !== 'object') return null;
  const { type } = block;
  const props = {};
  const children = [];

  const slots = LEGACY_SLOTS[type] || [];
  const repeat = LEGACY_REPEATS[type];

  for (const [k, v] of Object.entries(block)) {
    if (k === 'type' || k === 'id' || k === 'd') continue;
    if (slots.includes(k)) continue;          // handled below, in slot order
    if (repeat && k === repeat.prop) continue; // handled below
    props[k] = v;
  }

  // Containment: named slot fields become ordered children.
  if (type === 'columns') {
    // The v1 renderer clamped to 2..4 and rendered only the first N columns;
    // migrating more would make previously-invisible content appear, so the
    // extra columns are reported rather than silently promoted or dropped.
    const n = Math.min(Math.max(parseInt(block.cols, 10) || 2, 2), 4);
    for (let i = 0; i < n; i += 1) {
      children.push({
        id: newId('col'),
        type: 'column',
        props: {},
        children: (Array.isArray(block['col' + i]) ? block['col' + i] : []).map((c) => blockToNode(c, issues)).filter(Boolean),
      });
    }
    for (let i = n; i < 4; i += 1) {
      if (Array.isArray(block['col' + i]) && block['col' + i].length) {
        issues.push({
          level: 'warn',
          message: `columns block had content in col${i} beyond its ${n}-column setting; that content was not rendered in v1 and was not migrated`,
        });
      }
    }
    delete props.cols; // arity is now the child count
  } else {
    for (const slot of slots) {
      const kids = Array.isArray(block[slot]) ? block[slot] : [];
      kids.map((c) => blockToNode(c, issues)).filter(Boolean).forEach((c) => children.push(c));
    }
  }

  // Repeated content: array props become homogeneous item children.
  if (repeat) {
    const items = Array.isArray(block[repeat.prop]) ? block[repeat.prop] : [];
    const prepared = type === 'faq' ? materialiseFaqOpen(items) : items;
    prepared.forEach((it) => {
      children.push({ id: newId('it'), type: repeat.item, props: { ...(it || {}) }, children: [] });
    });
  }

  const node = { id: block.id || newId(), type, props, children };
  const style = legacyStyle(block.d);
  if (style) node.style = style;
  return node;
}

// v1's FAQ opened the first item when no item was explicitly open -- an implicit
// rule that required the parent to read its children's props. Migration makes it
// explicit on the item, so v2's parent never inspects a child's internals.
function materialiseFaqOpen(items) {
  const anyOpen = items.some((it) => it && it.open);
  return items.map((it, i) => ({ ...(it || {}), open: Boolean((it && it.open) || (!anyOpen && i === 0)) }));
}

const MIGRATIONS = { 1: migrateV1toV2 };

// Accepts a v2 document, a { version: 1, blocks } record, or the bare legacy
// blocks[] array as stored in the `pages` table today.
export function parse(raw) {
  const issues = [];
  let doc = Array.isArray(raw) ? { version: 1, blocks: raw } : raw;
  if (!doc || typeof doc !== 'object') return { doc: { version: DOCUMENT_VERSION, root: emptyRoot() }, issues };
  if (doc.version == null) doc = { ...doc, version: Array.isArray(doc.blocks) ? 1 : DOCUMENT_VERSION };

  while (doc.version < DOCUMENT_VERSION) {
    const migrate = MIGRATIONS[doc.version];
    if (!migrate) {
      issues.push({ level: 'error', message: `no migration from document version ${doc.version}` });
      break;
    }
    doc = migrate(doc, { issues });
  }

  if (doc.version > DOCUMENT_VERSION) {
    issues.push({
      level: 'warn',
      message: `document version ${doc.version} is newer than this renderer (${DOCUMENT_VERSION}); unknown elements will render as inert markers`,
    });
  }
  if (!doc.root) doc = { ...doc, root: emptyRoot() };
  return { doc, issues };
}

function emptyRoot() {
  return { id: newId('root'), type: ROOT_TYPE, props: {}, children: [] };
}

// Tolerate partial/older nodes by filling per-type defaults. Called on READ in
// the editor, deliberately NOT in the render path, so stored bytes are never
// silently rewritten by merely viewing a page.
export function normalize(doc, registry) {
  return { ...doc, root: normalizeNode(doc.root, registry) };
}

function normalizeNode(node, registry) {
  if (!node || typeof node !== 'object') return node;
  const def = registry.get(node.type);
  const children = (node.children || []).map((c) => normalizeNode(c, registry));
  if (!def) return { ...node, children };
  return { ...node, props: { ...def.defaults(), ...node.props }, children };
}
