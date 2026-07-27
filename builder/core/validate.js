// Validation: where domain meaning plugs in without forking the engine.
//
// Three injection points, all optional and all declarative:
//   childPolicy            structural legality (what may nest in what, arity)
//   Field.validate         field legality
//   definition.validate    cross-node rules, given the whole tree
//
// Issues are reported, never thrown: the editor surfaces them non-blockingly in
// the inspector and outline so an author is warned but not trapped.

import { accepts, arityOf } from './policy.js';
import { findNode, walk } from './node.js';
import { isBinding } from './bindings.js';

export function issue(level, message, extra = {}) {
  return { level, message, ...extra };
}

// May a node of `childType` be placed inside `parentId`?
export function canInsert(registry, root, parentId, childType) {
  const parent = findNode(root, parentId);
  if (!parent) return { ok: false, reason: 'parent not found' };
  const def = registry.get(parent.type);
  if (!def) return { ok: false, reason: `parent type "${parent.type}" is not registered` };
  if (!accepts(def, childType)) {
    return { ok: false, reason: `${def.label} does not accept ${childType}` };
  }
  const { max } = arityOf(def);
  if (parent.children.length >= max) {
    return { ok: false, reason: `${def.label} holds at most ${max} item(s)` };
  }
  return { ok: true };
}

export function canRemove(registry, root, nodeId) {
  const parent = findParentOf(root, nodeId);
  if (!parent) return { ok: false, reason: 'cannot remove the root' };
  const def = registry.get(parent.type);
  const { min } = arityOf(def);
  if (parent.children.length <= min) {
    return { ok: false, reason: `${def.label} needs at least ${min} item(s)` };
  }
  return { ok: true };
}

function findParentOf(root, id) {
  let found = null;
  walk(root, (n) => { if (n.children.some((c) => c.id === id)) found = n; });
  return found;
}

// Whole-tree pass. Bindings are left alone: an unresolved binding is a data
// concern at render time, not a document error.
export function validateTree(doc, registry) {
  const issues = [];
  walk(doc.root, (node, parent) => {
    const def = registry.get(node.type);
    if (!def) {
      issues.push(issue('warn', `unknown element "${node.type}" (preserved, rendered inert)`, { nodeId: node.id }));
      return;
    }

    if (parent) {
      const parentDef = registry.get(parent.type);
      if (parentDef && !accepts(parentDef, node.type)) {
        issues.push(issue('error', `${def.label} is not allowed inside ${parentDef.label}`, { nodeId: node.id }));
      }
    }

    const { min, max } = arityOf(def);
    if (node.children.length < min) {
      issues.push(issue('error', `${def.label} needs at least ${min} item(s)`, { nodeId: node.id }));
    }
    if (node.children.length > max) {
      issues.push(issue('error', `${def.label} holds at most ${max} item(s)`, { nodeId: node.id }));
    }

    for (const field of def.schema) {
      const value = node.props ? node.props[field.name] : undefined;
      if (isBinding(value) || !field.validate) continue;
      for (const found of field.validate(value) || []) {
        issues.push({ ...found, nodeId: node.id, field: field.name });
      }
    }

    if (def.validate) {
      for (const found of def.validate(node, doc.root) || []) {
        issues.push({ nodeId: node.id, ...found });
      }
    }
  });
  return issues;
}

// Fields whose visibleWhen currently holds, given a node's props. Drives the
// inspector's dependency rules; nothing element-specific lives in the editor.
export function visibleFields(def, props) {
  return def.schema.filter((f) => (f.visibleWhen ? Boolean(f.visibleWhen(props)) : true));
}
