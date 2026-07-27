// The element library. Its contents ARE the registry's categories -- there is
// no hand-maintained list -- and each entry is enabled only where childPolicy
// says it may go.

import { el, clear, icon } from './dom.js';
import { canInsert } from '../core/validate.js';
import { InsertType } from '../core/commands.js';
import { findParent } from '../core/node.js';
import { beginTypeDrag, endDrag } from './outline.js';

export function createInserter(host, editor) {
  const root = el('div', { class: 'pb-inserter' });
  host.append(root);
  let filter = '';

  function render() {
    clear(root);
    root.append(el('div', { class: 'pb-inserter-head' }, [
      el('span', { text: 'Elements' }),
      el('input', {
        class: 'pbi-input pb-search', type: 'search', placeholder: 'Search',
        value: filter,
        oninput: (e) => { filter = e.target.value.toLowerCase(); renderList(); },
      }),
    ]));
    root.append(el('div', { class: 'pb-inserter-list' }));
    renderList();
  }

  function renderList() {
    const list = clear(root.querySelector('.pb-inserter-list'));

    for (const [category, defs] of editor.registry.categories()) {
      if (category === 'System') continue;
      const matches = defs.filter((d) => !filter || d.label.toLowerCase().includes(filter));
      if (!matches.length) continue;

      list.append(el('div', { class: 'pb-cat', text: category }));
      list.append(el('div', { class: 'pb-cat-grid' }, matches.map((def) => {
        const allowed = Boolean(targetFor(def.type)); // for styling only
        return el('button', {
          type: 'button',
          class: `pb-el${allowed ? '' : ' is-disabled'}`,
          title: allowed ? `Add ${def.label}` : `${def.label} cannot go here`,
          draggable: true,
          ondragstart: (e) => { beginTypeDrag(def.type); e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', def.type); },
          ondragend: endDrag,
          // Resolved at click time: the selection may have moved since render.
          onclick: () => {
            const target = targetFor(def.type);
            if (target) editor.dispatch(InsertType(target.parentId, def.type, target.index));
          },
        }, [icon(def.icon, 18), el('span', { text: def.label })]);
      })));
    }
  }

  // Where a given type would land: inside the selection when it accepts that
  // type, otherwise straight after the selection, otherwise at the end of the
  // page. Null means the type has nowhere legal to go right now.
  function targetFor(type) {
    const tree = editor.doc.root;
    const ok = (parentId) => canInsert(editor.registry, tree, parentId, type).ok;
    const selected = editor.selectedNode();

    if (selected && selected.id !== tree.id) {
      if (ok(selected.id)) return { parentId: selected.id, index: selected.children.length };
      const parent = findParent(tree, selected.id);
      if (parent && ok(parent.id)) {
        return { parentId: parent.id, index: parent.children.findIndex((c) => c.id === selected.id) + 1 };
      }
    }
    return ok(tree.id) ? { parentId: tree.id, index: tree.children.length } : null;
  }

  return { render, root };
}
