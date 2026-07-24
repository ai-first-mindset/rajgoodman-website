// Admin Pages visual editor entry. Bundled (IIFE) to window.PagesBuilder and
// loaded by admin/index.html. Puck edits the data; api/_blocks.js (bundled in via
// the canvas) renders both the editor preview and the live page — single source
// of truth. Persistence stays in admin.js (onChange keeps PAGE_BLOCKS current).
import { createRoot } from 'react-dom/client';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { config } from './config.jsx';
import { toPuck, toBlocks } from './adapter.js';

let root = null;
let hostEl = null;
let changeCb = null;
let publishCb = null;
let stopStyles = null;

// Puck renders the canvas in an iframe; load the real site.css into it so the
// block previews look exactly like the published page. Re-inject if Puck
// recreates the iframe.
function ensureIframeStyles(el) {
  const inject = () => {
    const iframe = el.querySelector('iframe');
    const doc = iframe && iframe.contentDocument;
    if (doc && doc.head && !doc.getElementById('pb-site-css')) {
      const link = doc.createElement('link');
      link.id = 'pb-site-css';
      link.rel = 'stylesheet';
      link.href = '/site.css';
      doc.head.appendChild(link);
      // The site reveals [data-reveal] elements via common.js (initReveal), which
      // doesn't run in this preview iframe. Show them so the canvas isn't blank.
      const st = doc.createElement('style');
      st.id = 'pb-reveal-override';
      st.textContent = '[data-reveal]{opacity:1 !important;transform:none !important}';
      doc.head.appendChild(st);
    }
  };
  const iv = setInterval(inject, 400);
  return () => clearInterval(iv);
}

function render(blocks) {
  root.render(
    <Puck
      config={config}
      data={toPuck(blocks || [])}
      onChange={(d) => { if (changeCb) changeCb(toBlocks(d)); }}
      onPublish={(d) => { if (changeCb) changeCb(toBlocks(d)); if (publishCb) publishCb(); }}
    />,
  );
}

export function mount(el, blocks, onChange, onPublish) {
  hostEl = el;
  changeCb = onChange || null;
  publishCb = onPublish || null;
  root = createRoot(el);
  render(blocks);
  stopStyles = ensureIframeStyles(el);
}

export function setData(blocks) {
  if (root) render(blocks);
}

export function unmount() {
  if (stopStyles) { stopStyles(); stopStyles = null; }
  if (root) { root.unmount(); root = null; }
  hostEl = null; changeCb = null; publishCb = null;
}
