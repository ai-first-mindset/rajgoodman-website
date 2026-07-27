// Turning legacy raw-html blobs into typed nodes.
//
// Pages migrated from the static site arrived as one big `raw-html` block, so
// nothing in them is editable. This walks a document, recognises sections it
// has a typed element for, and replaces each one with a real node -- splitting
// the surrounding markup into smaller raw-html blocks around it.
//
// It is deliberately CONSERVATIVE. A section is only lifted when its markup
// matches exactly and the typed node renders back byte-for-byte; anything
// unrecognised is left alone as raw-html. Decomposition is therefore additive
// and safe to run repeatedly: `verifyDecomposition()` is the gate.

import { newId } from './core/node.js';

// Each recogniser: find its section in a blob and return the node for it.
// `match` must capture the WHOLE section, so the remainder splits cleanly.

const statBand = {
  type: 'stat-band',
  // A "sec reach" section whose wrap contains a .big counter row.
  find(html) {
    const re = /<section class="sec reach">[\s\S]*?<\/section>/g;
    let m = re.exec(html);
    while (m) {
      if (m[0].includes('<div class="big">')) return { start: m.index, end: m.index + m[0].length, source: m[0] };
      m = re.exec(html);
    }
    return null;
  },
  build(source) {
    const pick = (re) => { const m = source.match(re); return m ? unescapeText(m[1]) : ''; };
    const stats = [...source.matchAll(
      /<div class="cell"><div class="n"><span data-count="([^"]*)">0<\/span>([^<]*)<\/div><div class="l">([^<]*)<\/div><\/div>/g,
    )].map((m) => ({
      id: newId('it'),
      type: 'stat-item',
      props: { value: unescapeText(m[1]), suffix: unescapeText(m[2]), label: unescapeText(m[3]) },
      children: [],
    }));
    if (!stats.length) return null;
    return {
      id: newId('sec'),
      type: 'stat-band',
      props: {
        idx: pick(/<span class="idx">([\s\S]*?)<\/span>/),
        kicker: pick(/<span class="kick">([\s\S]*?)<\/span>/),
        heading: pick(/<h2[^>]*>([\s\S]*?)<\/h2>/),
        text: pick(/<p class="sub"[^>]*>([\s\S]*?)<\/p>/),
        label: pick(/<a href="[^"]*" class="btn btn-y">([\s\S]*?)\s*<span class="ar">/),
        url: (source.match(/<a href="([^"]*)" class="btn btn-y">/) || [, ''])[1],
      },
      children: stats,
    };
  },
};

export const RECOGNISERS = [statBand];

// Text captured out of markup is escaped; props hold the unescaped value so the
// author edits real text and the render re-escapes it.
function unescapeText(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
}

const rawNode = (html) => ({ id: newId('raw'), type: 'raw-html', props: { html }, children: [] });

// One raw-html blob -> the list of nodes it becomes. Recurses over the
// remainder so several sections can be lifted out of the same blob.
export function decomposeHtml(html) {
  for (const rec of RECOGNISERS) {
    const hit = rec.find(html);
    if (!hit) continue;
    const node = rec.build(hit.source);
    if (!node) continue;
    const before = html.slice(0, hit.start).replace(/\s+$/, '');
    const after = html.slice(hit.end).replace(/^\s+/, '');
    return [
      ...(before ? decomposeHtml(before) : []),
      node,
      ...(after ? decomposeHtml(after) : []),
    ];
  }
  return [rawNode(html)];
}

// Whole document. Only raw-html children are touched.
export function decomposeDocument(doc) {
  const children = doc.root.children.flatMap((child) => (
    child.type === 'raw-html' && typeof child.props.html === 'string'
      ? decomposeHtml(child.props.html)
      : [child]
  ));
  return { ...doc, root: { ...doc.root, children } };
}

// THE GATE. Decomposition is only valid if the new tree renders to exactly the
// same bytes as the old one. Callers must refuse to save when this fails.
export function verifyDecomposition(before, after, render) {
  const a = render(before);
  const b = render(after);
  if (a === b) return { ok: true };
  let at = 0;
  while (at < a.length && a[at] === b[at]) at += 1;
  return {
    ok: false,
    at,
    expected: a.slice(Math.max(0, at - 60), at + 80),
    actual: b.slice(Math.max(0, at - 60), at + 80),
  };
}
