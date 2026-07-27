// The command layer. EVERY mutation is a command applied immutably to the
// document, which is what makes the document the single source of state and
// gives undo/redo for free. Nothing outside this module mutates a node.
//
// Handlers dispatch on the COMMAND kind (there are five commands) -- never on a
// node's type, which stays the invariant the whole engine is built on.

import {
  insertChild, removeChild, moveNode, setProps, setStyle,
  findNode, findParent, cloneWithNewIds, createNode,
} from './node.js';
import { canInsert, canRemove } from './validate.js';

export const Insert = (parentId, node, index) => ({ kind: 'insert', parentId, node, index });
export const InsertType = (parentId, type, index) => ({ kind: 'insertType', parentId, type, index });
export const Remove = (nodeId) => ({ kind: 'remove', nodeId });
export const Move = (nodeId, parentId, index) => ({ kind: 'move', nodeId, parentId, index });
export const SetProp = (nodeId, name, value) => ({ kind: 'setProp', nodeId, name, value });
export const SetStyle = (nodeId, slot, ref) => ({ kind: 'setStyle', nodeId, slot, ref });
export const Duplicate = (nodeId) => ({ kind: 'duplicate', nodeId });

const HANDLERS = {
  insert(root, cmd, { registry }) {
    const check = canInsert(registry, root, cmd.parentId, cmd.node.type);
    if (!check.ok) return { root, issues: [{ level: 'error', message: check.reason }] };
    return { root: insertChild(root, cmd.parentId, cmd.node, cmd.index), selection: cmd.node.id };
  },

  insertType(root, cmd, ctx) {
    const node = createNode(ctx.registry, cmd.type);
    return HANDLERS.insert(root, { ...cmd, node }, ctx);
  },

  remove(root, cmd, { registry }) {
    const check = canRemove(registry, root, cmd.nodeId);
    if (!check.ok) return { root, issues: [{ level: 'error', message: check.reason }] };
    const parent = findParent(root, cmd.nodeId);
    return { root: removeChild(root, cmd.nodeId), selection: parent ? parent.id : null };
  },

  move(root, cmd, { registry }) {
    const node = findNode(root, cmd.nodeId);
    if (!node) return { root, issues: [{ level: 'error', message: 'node not found' }] };
    const check = canInsert(registry, root, cmd.parentId, node.type);
    const sameParent = findParent(root, cmd.nodeId);
    // Reordering within the current parent cannot breach a max-arity rule.
    if (!check.ok && !(sameParent && sameParent.id === cmd.parentId)) {
      return { root, issues: [{ level: 'error', message: check.reason }] };
    }
    return { root: moveNode(root, cmd.nodeId, cmd.parentId, cmd.index), selection: cmd.nodeId };
  },

  setProp(root, cmd) {
    return { root: setProps(root, cmd.nodeId, { [cmd.name]: cmd.value }) };
  },

  setStyle(root, cmd) {
    return { root: setStyle(root, cmd.nodeId, { [cmd.slot]: cmd.ref }) };
  },

  duplicate(root, cmd, { registry }) {
    const node = findNode(root, cmd.nodeId);
    const parent = findParent(root, cmd.nodeId);
    if (!node || !parent) return { root, issues: [{ level: 'error', message: 'nothing to duplicate' }] };
    const check = canInsert(registry, root, parent.id, node.type);
    if (!check.ok) return { root, issues: [{ level: 'error', message: check.reason }] };
    const copy = cloneWithNewIds(node);
    const at = parent.children.findIndex((c) => c.id === cmd.nodeId) + 1;
    return { root: insertChild(root, parent.id, copy, at), selection: copy.id };
  },
};

// Apply one command. Returns the next document plus any issues; on refusal the
// document is returned unchanged (commands never partially apply).
export function apply(doc, cmd, ctx) {
  const handler = HANDLERS[cmd.kind];
  if (!handler) throw new Error(`unknown command: ${cmd.kind}`);
  const { root, issues = [], selection } = handler(doc.root, cmd, ctx);
  return { doc: root === doc.root ? doc : { ...doc, root }, issues, selection };
}

// Undo/redo over whole-document snapshots. Documents are immutable and share
// structure, so a snapshot costs a spine, not a copy.
export function createHistory(initialDoc, ctx, { limit = 100 } = {}) {
  let past = [];
  let present = initialDoc;
  let future = [];
  const listeners = new Set();

  const emit = (info) => listeners.forEach((fn) => fn(present, info));

  return {
    get doc() { return present; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    dispatch(cmd) {
      const { doc, issues, selection } = apply(present, cmd, ctx);
      if (doc === present) { emit({ issues, selection, changed: false }); return { issues, selection }; }
      past = past.concat([present]).slice(-limit);
      future = [];
      present = doc;
      emit({ issues, selection, changed: true, cmd });
      return { issues, selection };
    },

    undo() {
      if (!past.length) return false;
      future = [present, ...future];
      present = past[past.length - 1];
      past = past.slice(0, -1);
      emit({ changed: true, undo: true });
      return true;
    },

    redo() {
      if (!future.length) return false;
      past = past.concat([present]).slice(-limit);
      present = future[0];
      future = future.slice(1);
      emit({ changed: true, redo: true });
      return true;
    },

    // Load a document without making the swap undoable (opening a page).
    reset(doc) { past = []; future = []; present = doc; emit({ changed: true, reset: true }); },
  };
}
