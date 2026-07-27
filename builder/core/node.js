// The Node: an instance in the page tree, and the immutable tree operations
// every algorithm shares. Leaf and container are the SAME shape -- nothing here
// asks what type a node is, so one implementation of each operation serves the
// whole tree. That absence of branching is the property to protect.
//
//   { id, type, props, children, style? }

import { seedChildren } from './policy.js';

let counter = 0;

export function newId(prefix = 'n') {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function createNode(registry, type, overrides = {}) {
  const def = registry.get(type);
  if (!def) throw new Error(`cannot create unregistered element "${type}"`);
  const node = {
    id: overrides.id || newId(),
    type,
    props: { ...def.defaults(), ...(overrides.props || {}) },
    children: overrides.children || seedChildren(def, (t) => createNode(registry, t)),
  };
  if (overrides.style) node.style = overrides.style;
  return node;
}

// --- Traversal -------------------------------------------------------------

export function walk(node, visit, parent = null, index = 0) {
  visit(node, parent, index);
  node.children.forEach((c, i) => walk(c, visit, node, i));
}

export function findNode(root, id) {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

export function findParent(root, id) {
  for (const c of root.children) {
    if (c.id === id) return root;
    const hit = findParent(c, id);
    if (hit) return hit;
  }
  return null;
}

// Root -> ... -> node. Empty when the id is not in the tree.
export function pathTo(root, id) {
  if (root.id === id) return [root];
  for (const c of root.children) {
    const sub = pathTo(c, id);
    if (sub.length) return [root, ...sub];
  }
  return [];
}

export function indexOf(root, id) {
  const parent = findParent(root, id);
  return parent ? parent.children.findIndex((c) => c.id === id) : -1;
}

export function collect(root, predicate) {
  const out = [];
  walk(root, (n) => { if (predicate(n)) out.push(n); });
  return out;
}

// --- Immutable edits (structural sharing; the original tree is never touched) -

export function updateNode(root, id, fn) {
  if (root.id === id) return fn(root);
  let changed = false;
  const children = root.children.map((c) => {
    const next = updateNode(c, id, fn);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export function insertChild(root, parentId, node, index) {
  return updateNode(root, parentId, (parent) => {
    const children = parent.children.slice();
    const at = index == null || index > children.length ? children.length : Math.max(0, index);
    children.splice(at, 0, node);
    return { ...parent, children };
  });
}

export function removeChild(root, id) {
  const parent = findParent(root, id);
  if (!parent) return root;
  return updateNode(root, parent.id, (p) => ({
    ...p,
    children: p.children.filter((c) => c.id !== id),
  }));
}

// Move within or across parents. Index is interpreted against the destination
// list AFTER the node has been lifted out, so dragging down behaves naturally.
export function moveNode(root, id, parentId, index) {
  const node = findNode(root, id);
  if (!node || id === parentId) return root;
  if (pathTo(node, parentId).length) return root; // refuse to move a node into itself
  const lifted = removeChild(root, id);
  return insertChild(lifted, parentId, node, index);
}

export function setProps(root, id, patch) {
  return updateNode(root, id, (n) => ({ ...n, props: { ...n.props, ...patch } }));
}

export function setStyle(root, id, patch) {
  return updateNode(root, id, (n) => {
    const style = { ...(n.style || {}), ...patch };
    for (const k of Object.keys(style)) if (style[k] == null || style[k] === '') delete style[k];
    const next = { ...n };
    if (Object.keys(style).length) next.style = style; else delete next.style;
    return next;
  });
}

// Deep copy with fresh ids throughout (Duplicate, and paste later).
export function cloneWithNewIds(node) {
  return {
    ...node,
    id: newId(),
    props: JSON.parse(JSON.stringify(node.props)),
    children: node.children.map(cloneWithNewIds),
  };
}
