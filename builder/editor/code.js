// Code view: the "edit the HTML instead" tab.
//
// WordPress can round-trip its code editor because Gutenberg serialises blocks
// AS HTML comments inside HTML. Our document is a tree, so there are two honest
// sources to expose rather than one:
//
//   HTML     what the page will actually serve. Editable: applying it re-parses
//            the markup, turning recognised sections back into typed elements
//            and leaving the rest as raw HTML. That is lossy for typed elements
//            with no recogniser, so it asks first.
//   Document the JSON tree itself -- the real source, losslessly editable.
//
// Both apply through the command layer, so both are undoable.

import { el, clear } from './dom.js';
import { renderDocument, createEnv } from '../core/render.js';
import { serialize, parse } from '../core/document.js';
import { decomposeHtml } from '../decompose.js';
import { ReplaceChildren } from '../core/commands.js';

export function createCodeView(host, editor) {
  const root = el('div', { class: 'pb-code' });
  host.append(root);
  let tab = 'html';
  let dirty = false;

  function currentHtml() {
    const env = createEnv({ registry: editor.registry, theme: editor.theme, data: editor.data });
    return renderDocument(editor.doc, env);
  }

  function render() {
    clear(root);
    const area = el('textarea', {
      class: 'pb-code-area', spellcheck: 'false',
      oninput: () => { dirty = true; },
    });
    area.value = tab === 'html' ? currentHtml() : JSON.stringify(serialize(editor.doc), null, 2);
    dirty = false;

    root.append(
      el('div', { class: 'pb-code-bar' }, [
        el('button', {
          type: 'button', class: `pb-code-tab${tab === 'html' ? ' is-on' : ''}`, text: 'HTML',
          onclick: () => { tab = 'html'; render(); },
        }),
        el('button', {
          type: 'button', class: `pb-code-tab${tab === 'json' ? ' is-on' : ''}`, text: 'Document',
          onclick: () => { tab = 'json'; render(); },
        }),
        el('span', { class: 'pb-spacer' }),
        el('span', {
          class: 'pb-code-note',
          text: tab === 'html'
            ? 'Applying replaces the page with this markup.'
            : 'The document tree — edits are lossless.',
        }),
        el('button', {
          type: 'button', class: 'pb-tool', text: 'Copy',
          onclick: () => { area.select(); navigator.clipboard && navigator.clipboard.writeText(area.value); },
        }),
        el('button', {
          type: 'button', class: 'pb-tool pb-primary', text: 'Apply',
          onclick: () => apply(area.value),
        }),
      ]),
      area,
      el('p', { class: 'pb-code-err' }),
    );
  }

  function fail(message) {
    root.querySelector('.pb-code-err').textContent = message;
  }

  function apply(value) {
    fail('');
    if (tab === 'json') {
      let next;
      try { next = JSON.parse(value); } catch (e) { fail(`Not valid JSON: ${e.message}`); return; }
      const { doc, issues } = parse(next);
      if (!doc.root || !Array.isArray(doc.root.children)) { fail('Document needs a root with children.'); return; }
      editor.dispatch(ReplaceChildren(editor.doc.root.id, doc.root.children));
      if (issues.length) fail(issues[0].message);
      render();
      return;
    }

    // HTML -> tree. Recognised sections become typed elements again; anything
    // else becomes raw HTML, which loses element typing that has no recogniser.
    const typed = editor.doc.root.children.filter((c) => c.type !== 'raw-html').length;
    if (typed && !window.confirm(
      `${typed} element${typed === 1 ? '' : 's'} on this page will be replaced by the markup below. `
      + 'Sections the builder recognises will become editable again; the rest becomes raw HTML. Continue?',
    )) return;

    const nodes = decomposeHtml(value);
    editor.dispatch(ReplaceChildren(editor.doc.root.id, nodes));
    render();
  }

  return { render, root, isDirty: () => dirty };
}
