// The outline: the composite tree, navigable and reorderable. Drag-and-drop
// operates on the tree and consults childPolicy for every drop, so an illegal
// drop is impossible rather than merely discouraged.
//
// One row renderer serves leaf and container alike -- the only difference is
// whether a node happens to have children.

import { el, clear, icon } from './dom.js';
import { canInsert } from '../core/validate.js';
import { Move, InsertType } from '../core/commands.js';
import { findParent } from '../core/node.js';

// What is being dragged, in editor terms. dataTransfer alone cannot be read
// during dragover in every browser, so the intent is held here too.
let dragging = null; // { kind: 'node', id } | { kind: 'type', type }

export function beginTypeDrag(type) { dragging = { kind: 'type', type }; }
export function endDrag() { dragging = null; }

export function createOutline(host, editor) {
  const root = el('div', { class: 'pb-outline' });
  host.append(root);
  let marker = null;

  function render() {
    clear(root);
    root.append(el('div', { class: 'pb-outline-head', text: 'Layers' }));
    root.append(rowFor(editor.doc.root, 0));
  }

  function rowFor(node, depth) {
    const def = editor.registry.get(node.type);
    const wrap = el('div', { class: 'pb-row-wrap' });

    const row = el('div', {
      class: `pb-row${editor.selection() === node.id ? ' is-selected' : ''}${node.type === 'page-root' ? ' is-root' : ''}`,
      draggable: node.type !== 'page-root',
      style: `padding-left:${8 + depth * 14}px`,
      dataset: { id: node.id },
      onclick: (e) => { e.stopPropagation(); editor.select(node.id); },
      ondragstart: (e) => {
        dragging = { kind: 'node', id: node.id };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.id);
      },
      ondragend: () => { dragging = null; clearMarker(); },
      ondragover: (e) => onDragOver(e, node, row),
      ondragleave: () => clearMarker(),
      ondrop: (e) => onDrop(e, node),
    }, [
      el('span', { class: 'pb-row-icon' }, [icon(def ? def.icon : '')]),
      el('span', { class: 'pb-row-label', text: def ? def.label : `${node.type} (unknown)` }),
      badgeFor(node),
    ]);

    wrap.append(row);
    if (node.children.length) {
      wrap.append(el('div', { class: 'pb-row-children' }, node.children.map((c) => rowFor(c, depth + 1))));
    }
    return wrap;
  }

  function badgeFor(node) {
    const issues = editor.issuesFor(node.id);
    if (!issues.length) return null;
    const worst = issues.some((i) => i.level === 'error') ? 'error' : 'warn';
    return el('span', { class: `pb-row-badge is-${worst}`, text: String(issues.length), title: issues.map((i) => i.message).join('\n') });
  }

  // Top / bottom thirds drop as siblings, the middle drops inside. Every option
  // is checked against childPolicy before it is offered.
  function zoneFor(e, row, node) {
    const rect = row.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const type = dragging && (dragging.kind === 'type' ? dragging.type : nodeType(dragging.id));
    if (!type) return null;

    const inside = canInsert(editor.registry, editor.doc.root, node.id, type).ok
      && !(dragging.kind === 'node' && isAncestor(dragging.id, node.id));
    const parent = findParent(editor.doc.root, node.id);
    const sibling = parent && canInsert(editor.registry, editor.doc.root, parent.id, type).ok
      && !(dragging.kind === 'node' && dragging.id === node.id);

    if (inside && (y > 0.33 && y < 0.67 || !sibling)) return { kind: 'inside', parentId: node.id, index: node.children.length };
    if (!sibling) return null;
    const at = parent.children.findIndex((c) => c.id === node.id);
    return y < 0.5
      ? { kind: 'before', parentId: parent.id, index: at }
      : { kind: 'after', parentId: parent.id, index: at + 1 };
  }

  function nodeType(id) {
    const found = editor.findNode(id);
    return found ? found.type : null;
  }

  function isAncestor(ancestorId, nodeId) {
    let cur = editor.findNode(nodeId);
    while (cur) {
      if (cur.id === ancestorId) return true;
      cur = findParent(editor.doc.root, cur.id);
    }
    return false;
  }

  function onDragOver(e, node, row) {
    const zone = zoneFor(e, row, node);
    clearMarker();
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragging.kind === 'node' ? 'move' : 'copy';
    marker = row;
    row.classList.add(`pb-drop-${zone.kind}`);
  }

  function onDrop(e, node) {
    e.preventDefault();
    e.stopPropagation();
    const row = e.currentTarget;
    const zone = zoneFor(e, row, node);
    clearMarker();
    if (!zone || !dragging) return;
    if (dragging.kind === 'node') editor.dispatch(Move(dragging.id, zone.parentId, zone.index));
    else editor.dispatch(InsertType(zone.parentId, dragging.type, zone.index));
    dragging = null;
  }

  function clearMarker() {
    if (!marker) return;
    marker.classList.remove('pb-drop-before', 'pb-drop-after', 'pb-drop-inside');
    marker = null;
  }

  return { render, root };
}
