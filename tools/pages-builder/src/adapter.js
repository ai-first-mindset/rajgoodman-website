// Bidirectional adapter between our blocks[] (the DB / api/_blocks.js shape) and
// Puck's data ({content:[{type,props}], root, zones}). Recursive: fields listed
// in SLOT_FIELDS hold nested child blocks and are converted at every depth, so
// Container/Columns layouts round-trip. Plain ESM (node-testable). Converts ONLY
// at the editor boundary — the DB shape and server renderer stay unchanged.
import { SLOT_FIELDS } from '../../../api/_blocks.js';

function newId() {
  return 'b_' + Math.random().toString(36).slice(2, 9);
}

// block {type, ...fields} -> Puck component {type, props}. Slot fields recurse.
function blockToComponent(b) {
  if (!b || typeof b !== 'object') return b;
  const slots = SLOT_FIELDS[b.type] || [];
  const props = {};
  for (const k of Object.keys(b)) {
    if (k === 'type') continue;
    props[k] = slots.includes(k) ? toPuckArray(b[k]) : b[k];
  }
  for (const s of slots) if (!Array.isArray(props[s])) props[s] = [];
  return { type: b.type, props };
}
function toPuckArray(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map(blockToComponent);
}
export function toPuck(blocks) {
  return { content: toPuckArray(blocks), root: { props: {} }, zones: {} };
}

// Puck component {type, props} -> block {type, ...fields}. Slot fields recurse;
// blocks the inserter created without an id get one.
function componentToBlock(item) {
  if (!item || typeof item !== 'object') return item;
  const props = item.props || {};
  const slots = SLOT_FIELDS[item.type] || [];
  const block = { type: item.type };
  for (const k of Object.keys(props)) {
    block[k] = slots.includes(k) ? toBlocksArray(props[k]) : props[k];
  }
  if (!block.id) block.id = newId();
  return block;
}
function toBlocksArray(content) {
  return (Array.isArray(content) ? content : []).map(componentToBlock);
}
export function toBlocks(data) {
  return toBlocksArray(data && data.content);
}
