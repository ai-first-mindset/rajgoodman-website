// Child policy: the ONE mechanism by which containment is expressed.
//
// Leaf, container, restricted container and repeater are four rows of one table,
// not four code paths. Every algorithm that needs to know "can this go in there"
// asks `accepts()`; nothing anywhere asks whether a node is a container, and
// nothing special-cases the repeater.
//
//   { kind: 'none' }                              leaf
//   { kind: 'any' }                               container, any registered type
//   { kind: 'whitelist', types: [...] }           container, restricted
//   { kind: 'repeater', item, min?, max? }        homogeneous children of one type
//
// NOTE on the repeater's `item`: it names a REGISTERED ELEMENT TYPE rather than
// carrying an inline field schema. Repeater items must be real Nodes, otherwise
// they cannot inherit selection, drag-and-drop, undo or the generated inspector
// -- which would require the very special-case code path this design forbids.
// A repeater is therefore literally "a whitelist of one type, with arity rules".

const POLICIES = {
  none: {
    accepts: () => false,
    seed: () => [],
    arity: () => ({ min: 0, max: 0 }),
  },
  any: {
    accepts: () => true,
    seed: () => [],
    arity: () => ({ min: 0, max: Infinity }),
  },
  whitelist: {
    accepts: (p, type) => Array.isArray(p.types) && p.types.includes(type),
    seed: () => [],
    arity: () => ({ min: 0, max: Infinity }),
  },
  repeater: {
    accepts: (p, type) => type === p.item,
    seed: (p, make) => Array.from({ length: p.min || 0 }, () => make(p.item)),
    arity: (p) => ({ min: p.min == null ? 0 : p.min, max: p.max == null ? Infinity : p.max }),
  },
};

export function policyImpl(childPolicy) {
  const impl = childPolicy && POLICIES[childPolicy.kind];
  if (!impl) throw new Error(`unknown childPolicy kind: ${childPolicy && childPolicy.kind}`);
  return impl;
}

export function assertPolicy(childPolicy) {
  policyImpl(childPolicy);
  if (childPolicy.kind === 'whitelist' && !Array.isArray(childPolicy.types)) {
    throw new Error('whitelist childPolicy needs a types array');
  }
  if (childPolicy.kind === 'repeater' && typeof childPolicy.item !== 'string') {
    throw new Error('repeater childPolicy needs an item element type');
  }
  return childPolicy;
}

// Can a node of `childType` be placed inside an element with this definition?
export function accepts(def, childType) {
  if (!def) return false;
  return policyImpl(def.childPolicy).accepts(def.childPolicy, childType);
}

// Children a freshly-created node of this definition starts with.
export function seedChildren(def, makeNode) {
  return policyImpl(def.childPolicy).seed(def.childPolicy, makeNode);
}

export function arityOf(def) {
  return policyImpl(def.childPolicy).arity(def.childPolicy);
}

// Which registered types may be inserted here (drives the inserter and DnD).
export function acceptedTypes(def, registry) {
  return registry.types().filter((t) => accepts(def, t));
}
