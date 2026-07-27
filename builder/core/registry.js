// The element registry: type -> ElementDefinition, and the single source of
// truth for what the builder can do. Registering a definition is the ONLY step
// required to introduce an element -- inspector, serialization, drag-and-drop,
// undo and theming are implemented once over this interface, never per type.
//
// An ElementDefinition is a plain object conforming to:
//   { type, label, category, schema: Field[], childPolicy, icon?,
//     defaults?(), render(ctx), validate?(node, tree), autoNumber?, standalone? }
// There is no base class: elements CONFORM to the interface, they do not extend
// anything that carries behaviour.

import { assertPolicy } from './policy.js';

const REQUIRED = ['type', 'label', 'category', 'schema', 'childPolicy', 'render'];

// A Field's `default` is cloned per instance so shared definition objects can
// never leak mutable state between nodes.
function cloneValue(v) {
  if (Array.isArray(v)) return v.map(cloneValue);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cloneValue(x)]));
  }
  return v;
}

// The schema drives BOTH the inspector and defaults(); a definition only needs
// to supply defaults() when a default cannot be expressed as a field literal.
export function defaultsFromSchema(schema) {
  const out = {};
  for (const f of schema) {
    out[f.name] = typeof f.default === 'function' ? f.default() : cloneValue(f.default);
  }
  return out;
}

function assertField(f, type) {
  if (!f || typeof f.name !== 'string') throw new Error(`${type}: field needs a name`);
  if (typeof f.control !== 'string') throw new Error(`${type}.${f.name}: field needs a control`);
  if (!('default' in f)) throw new Error(`${type}.${f.name}: field needs a default`);
}

export function createRegistry() {
  const defs = new Map();

  return {
    register(def) {
      for (const k of REQUIRED) {
        if (def[k] == null) throw new Error(`element definition missing "${k}"`);
      }
      if (defs.has(def.type)) throw new Error(`element "${def.type}" is already registered`);
      if (!Array.isArray(def.schema)) throw new Error(`${def.type}: schema must be an array`);
      def.schema.forEach((f) => assertField(f, def.type));
      assertPolicy(def.childPolicy);

      const full = def.defaults
        ? def
        : { ...def, defaults: () => defaultsFromSchema(def.schema) };
      defs.set(def.type, full);
      return full;
    },

    registerAll(list) { list.forEach((d) => this.register(d)); return this; },

    get(type) { return defs.get(type); },
    has(type) { return defs.has(type); },
    types() { return [...defs.keys()]; },
    list() { return [...defs.values()]; },

    // Inserter grouping: category -> definitions the author may place directly.
    categories() {
      const out = new Map();
      for (const def of defs.values()) {
        if (def.standalone === false) continue;
        if (!out.has(def.category)) out.set(def.category, []);
        out.get(def.category).push(def);
      }
      return out;
    },

    fieldOf(type, name) {
      const def = defs.get(type);
      return def ? def.schema.find((f) => f.name === name) : undefined;
    },
  };
}
