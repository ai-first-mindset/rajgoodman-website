// The canvas renders the tree with the PRODUCTION renderer. There is no preview
// renderer: `decorate` only stamps a data-pb-id onto each node's outermost tag,
// which is an attribute and therefore cannot shift a single pixel of layout.
// What the author sees is literally what the page will serve.

import { el } from './dom.js';
import { createEnv, renderDocument } from '../core/render.js';

// Stamp the id on the node's OWN outermost tag, skipping any leading comments.
//
// Two cases matter. If that tag already carries a data-pb-id, the node
// contributed no markup of its own (page-root renders exactly its children), so
// stamping again would emit a duplicate attribute and steal the child's
// identity -- leave it alone. If there is no tag at all, fall back to a hidden
// marker so the node still has a handle in the canvas.
const FIRST_TAG = /^(\s*(?:<!--[\s\S]*?-->\s*)*)(<[a-z][a-z0-9-]*)([\s>/])/i;

export function stampId(html, node) {
  if (!html) return html;
  const match = html.match(FIRST_TAG);
  if (!match) return `<span data-pb-id="${node.id}" data-pb-shim></span>${html}`;
  const openTagEnd = html.indexOf('>', match[0].length - 1);
  const openTag = html.slice(0, openTagEnd < 0 ? html.length : openTagEnd);
  if (openTag.includes('data-pb-id=')) return html;
  return html.replace(FIRST_TAG, `$1$2 data-pb-id="${node.id}"$3`);
}

// Selection affordances are outlines and attributes only: nothing here occupies
// space, so the canvas box model stays identical to the published page. The two
// overrides below stand in for common.js, which does not run in the canvas:
// [data-reveal] starts at opacity 0 on the live site, and counters animate up
// from 0 -- both would otherwise show the author a blank or zeroed page.
const CANVAS_CSS = `
  html { scroll-behavior: auto; }
  body { cursor: default; }
  [data-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
  [data-pb-hover] { outline: 1px dashed rgba(56,88,233,.75); outline-offset: 2px; }
  [data-pb-selected] { outline: 2px solid #3858e9; outline-offset: 2px; }
  [data-pb-shim] { display: none; }
  .pb-canvas-empty { color: #f4efe6; font-family: system-ui, sans-serif; opacity: .6;
    text-align: center; padding: 120px 20px; }
`;

export function createCanvas(host, editor) {
  const frame = el('iframe', { class: 'pb-canvas', title: 'Page canvas' });
  host.append(frame);

  let ready = false;
  let pendingScroll = 0;

  // A src-less iframe's about:blank document is available synchronously, and its
  // load event may already have fired by the time we could listen for it, so the
  // canvas boots on demand rather than on an event.
  function ensureReady() {
    if (ready) return true;
    if (!frame.contentDocument) return false;
    boot();
    return true;
  }

  function boot() {
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/site.css">
<style>${CANVAS_CSS}</style></head><body><main></main></body></html>`);
    doc.close();

    doc.addEventListener('click', (e) => {
      const target = e.target.closest('[data-pb-id]');
      e.preventDefault();
      if (target) editor.select(target.getAttribute('data-pb-id'));
    });
    doc.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-pb-id]');
      doc.querySelectorAll('[data-pb-hover]').forEach((n) => n.removeAttribute('data-pb-hover'));
      if (target) target.setAttribute('data-pb-hover', '');
    });
    doc.addEventListener('mouseleave', () => {
      doc.querySelectorAll('[data-pb-hover]').forEach((n) => n.removeAttribute('data-pb-hover'));
    });
    ready = true;
  }

  function render() {
    if (!ensureReady()) return;
    const doc = frame.contentDocument;
    const main = doc.querySelector('main');
    if (!main) return;

    const scroll = doc.documentElement.scrollTop || doc.body.scrollTop || pendingScroll;
    const env = createEnv({
      registry: editor.registry,
      theme: editor.theme,
      data: editor.data,
      mode: 'edit',
      decorate: stampId,
    });

    const html = renderDocument(editor.doc, env);
    main.innerHTML = html || '<div class="pb-canvas-empty">This page is empty. Add an element to begin.</div>';

    // Counters animate from 0 to their target via common.js on the live page;
    // show the target so the author is not looking at a row of zeroes.
    doc.querySelectorAll('[data-count]').forEach((span) => {
      const target = span.getAttribute('data-count');
      if (target) span.textContent = target;
    });

    highlight();
    doc.documentElement.scrollTop = scroll;
    doc.body.scrollTop = scroll;
    pendingScroll = scroll;
  }

  function highlight() {
    if (!ready) return;
    const doc = frame.contentDocument;
    doc.querySelectorAll('[data-pb-selected]').forEach((n) => n.removeAttribute('data-pb-selected'));
    const id = editor.selection();
    if (!id) return;
    const target = doc.querySelector(`[data-pb-id="${CSS.escape(id)}"]`);
    if (target) target.setAttribute('data-pb-selected', '');
  }

  function scrollTo(id) {
    if (!ensureReady()) return;
    const target = frame.contentDocument.querySelector(`[data-pb-id="${CSS.escape(id)}"]`);
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  return { render, highlight, scrollTo, frame };
}
