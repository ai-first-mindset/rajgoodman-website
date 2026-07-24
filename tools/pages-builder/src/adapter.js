// Bidirectional adapter between our blocks[] (the DB / api/_blocks.js shape) and
// Puck's data ({content:[{type,props}], root, zones}). Plain ESM (no React) so it
// is node-importable for the round-trip test. Converts ONLY at the editor
// boundary — the DB shape and the server renderer stay unchanged.

function newId() {
  return 'b_' + Math.random().toString(36).slice(2, 9);
}

// blocks[] → Puck data. Each block's fields become the Puck component props; the
// stable id rides along in props.id (Puck uses it as the instance key).
export function toPuck(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  return {
    content: list.map((b) => ({ type: b.type, props: { ...b } })),
    root: { props: {} },
    zones: {},
  };
}

// Puck data → blocks[]. props already equal the block shape; re-assert type from
// the component key, and mint an id for blocks the Puck inserter created without one.
export function toBlocks(data) {
  const content = (data && Array.isArray(data.content)) ? data.content : [];
  return content.map((item) => {
    const props = (item && item.props) || {};
    const block = { ...props, type: item.type };
    if (!block.id) block.id = newId();
    return block;
  });
}
