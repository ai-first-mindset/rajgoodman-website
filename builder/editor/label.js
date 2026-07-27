// A readable label for a node in the layer tree and child lists.
//
// Derived generically from the schema -- the first text-bearing field -- so no
// element supplies a summary function. Without this a page of imported markup
// reads as a stack of identical "Raw HTML" rows.

import { isBinding } from '../core/bindings.js';

const TEXTY = ['text', 'textarea', 'html'];
// Prefer the field a human would use to recognise the element. Purely by field
// NAME, so it stays generic -- nothing here knows about any element type.
const PREFERRED = ['heading', 'title', 'question', 'label', 'quote', 'text', 'alt', 'html'];

function labelField(def) {
  const texty = def.schema.filter((f) => TEXTY.includes(f.control));
  for (const name of PREFERRED) {
    const hit = texty.find((f) => f.name === name);
    if (hit) return hit;
  }
  return texty[0];
}

export function nodeLabel(node, def, max = 40) {
  if (!def) return `${node.type} (unknown)`;
  const field = labelField(def);
  const value = field ? node.props[field.name] : undefined;
  if (isBinding(value)) return `${def.label}: {${value.$bind}}`;
  if (typeof value !== 'string' || !value.trim()) return def.label;
  const text = value.replace(/\s+/g, ' ').trim();
  return `${def.label}: ${text.length > max ? `${text.slice(0, max)}…` : text}`;
}
