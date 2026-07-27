// The editor shell: canvas + outline + inspector + inserter over the command
// layer. Every pane is a pure function of the document, and the ONLY way any of
// them changes anything is by dispatching a command -- so undo/redo works
// everywhere without a single pane knowing that it exists.
//
// Exposed as window.PagesBuilder with the same mount/setData/unmount surface the
// admin already calls.

import { el, clear, debounce } from './dom.js';
import { registry } from '../elements/index.js';
import { createTheme } from '../core/tokens.js';
import { pageSources } from '../core/bindings.js';
import { parse, serialize, normalize } from '../core/document.js';
import { createHistory, Remove } from '../core/commands.js';
import { findNode as findIn } from '../core/node.js';
import { validateTree } from '../core/validate.js';
import { createControlRegistry } from './controls.js';
import { createCanvas } from './canvas.js';
import { createOutline } from './outline.js';
import { createInspector } from './inspector.js';
import { createInserter } from './inserter.js';

let current = null;

export function mount(host, stored, onChange, onPublish, options = {}) {
  unmount();

  const theme = createTheme(options.theme);
  const controls = createControlRegistry(options.controls);
  const data = pageSources(options.page || {}, options.site || {});
  const { doc: parsed, issues: loadIssues } = parse(stored);
  const history = createHistory(normalize(parsed, registry), { registry });

  let selection = null;
  let issues = [];

  const editor = {
    registry,
    theme,
    controls,
    data,
    get doc() { return history.doc; },
    selection: () => selection,
    selectedNode: () => (selection ? findIn(history.doc.root, selection) : null),
    findNode: (id) => findIn(history.doc.root, id),
    dataPaths: () => data.paths(),
    issuesFor: (id) => issues.filter((i) => i.nodeId === id),
    dispatch(cmd) {
      // Selection follows the command (an Insert selects what it inserted); it
      // is applied in the history subscription, BEFORE the panes re-render.
      const result = history.dispatch(cmd);
      if (result.issues && result.issues.length) toast(result.issues[0].message);
      return result;
    },
    select(id) {
      selection = id;
      inserter.render();   // what may be inserted depends on the selection
      outline.render();
      inspector.render();
      canvas.highlight();
    },
  };

  // --- Chrome ---------------------------------------------------------------
  const shell = el('div', { class: 'pb-shell' });
  const left = el('aside', { class: 'pb-left' });
  const middle = el('div', { class: 'pb-middle' });
  const right = el('aside', { class: 'pb-right' });
  const bar = el('div', { class: 'pb-bar' });
  const stage = el('div', { class: 'pb-stage' });

  middle.append(bar, stage);
  shell.append(left, middle, right);
  clear(host).append(shell);

  const inserter = createInserter(left, editor);
  const outline = createOutline(left, editor);
  const canvas = createCanvas(stage, editor);
  const inspector = createInspector(right, editor);

  const undoBtn = el('button', { type: 'button', class: 'pb-tool', text: 'Undo', onclick: () => { history.undo(); } });
  const redoBtn = el('button', { type: 'button', class: 'pb-tool', text: 'Redo', onclick: () => { history.redo(); } });
  const status = el('span', { class: 'pb-status' });
  bar.append(
    undoBtn, redoBtn, status,
    el('span', { class: 'pb-spacer' }),
    el('button', {
      type: 'button', class: 'pb-tool pb-primary', text: 'Publish',
      onclick: () => onPublish && onPublish(serialize(history.doc)),
    }),
  );

  const toastEl = el('div', { class: 'pb-toast' });
  shell.append(toastEl);
  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  // --- The one update path --------------------------------------------------
  const renderCanvas = debounce(() => canvas.render(), 90);

  function refresh() {
    issues = validateTree(history.doc, registry);
    undoBtn.disabled = !history.canUndo;
    redoBtn.disabled = !history.canRedo;
    const errors = issues.filter((i) => i.level === 'error').length;
    status.textContent = errors ? `${errors} issue${errors === 1 ? '' : 's'}` : '';
    status.className = `pb-status${errors ? ' is-error' : ''}`;
    inserter.render();
    outline.render();
    inspector.render();
    renderCanvas();
    if (onChange) onChange(serialize(history.doc));
  }

  history.subscribe((doc, info) => {
    if (info && info.selection) selection = info.selection;
    // A node that undo removed can no longer be the selection.
    if (selection && !findIn(doc.root, selection)) selection = null;
    refresh();
  });

  // Keyboard: undo/redo and delete, dispatched like everything else.
  function onKey(e) {
    const typing = /input|textarea|select/i.test((e.target.tagName || ''));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) history.redo(); else history.undo();
    } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault();
      editor.dispatch(Remove(selection));
    }
  }
  document.addEventListener('keydown', onKey);

  current = {
    host,
    destroy() {
      document.removeEventListener('keydown', onKey);
      clear(host);
    },
    setData(next) { history.reset(normalize(parse(next).doc, registry)); },
  };

  refresh();
  if (loadIssues.length) toast(loadIssues[0].message);
  return current;
}

export function setData(stored) {
  if (current) current.setData(stored);
}

export function unmount() {
  if (current) current.destroy();
  current = null;
}

if (typeof window !== 'undefined') {
  window.PagesBuilder = { mount, setData, unmount };
}
