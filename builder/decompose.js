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

// The standard `sec tight` section: head + heading + body. The body is kept as
// a raw-html child rather than modelled field-by-field -- see the note on
// pageSection. Runs after statBand so the counter variant is claimed first.
const standardSection = {
  type: 'page-section',
  find(html) {
    // The body must not run into the NEXT section: without that guard a lazy
    // match whose own closing indentation differs swallows its neighbour.
    const re = /<section class="sec tight"( id="[^"]*")?>\n {2}<div class="wrap">\n {4}<div class="shead" data-reveal>(?:(?!<section class=)[\s\S])*?\n {2}<\/div>\n<\/section>/g;
    const m = re.exec(html);
    return m ? { start: m.index, end: m.index + m[0].length, source: m[0] } : null;
  },
  build(source) {
    const head = source.match(/<div class="shead" data-reveal>([\s\S]*?)<\/div>/);
    if (!head) return null;
    const pick = (re, from = head[1]) => { const m = from.match(re); return m ? unescapeText(m[1]) : ''; };
    const h2 = source.match(/\n {4}<h2 data-reveal( style="([^"]*)")?>([\s\S]*?)<\/h2>/);

    // Everything after the head/heading, VERBATIM (its own leading whitespace
    // included -- the sections do not indent their bodies consistently), as an
    // editable HTML child.
    const headEnd = h2 ? source.indexOf('</h2>') + 5 : source.indexOf('</div>', source.indexOf('shead')) + 6;
    const body = source.slice(headEnd, source.lastIndexOf('\n  </div>\n</section>'));

    // If the body cannot be expressed as indented children, decline the whole
    // section rather than reformat it -- it stays raw-html and nothing is lost.
    const split = body ? splitSectionBody(body) : null;
    if (body && !split) return null;
    return {
      id: newId('sec'),
      type: 'page-section',
      props: {
        idx: pick(/<span class="idx">([\s\S]*?)<\/span>/),
        kicker: pick(/<span class="kick">([\s\S]*?)<\/span>/),
        heading: h2 ? unescapeText(h2[3]) : '',
        showLine: head[1].includes('<span class="ln">'),
        anchor: (source.match(/<section class="sec tight" id="([^"]*)"/) || [, ''])[1],
        headingStyle: h2 && h2[2] ? h2[2] : '',
        lead: split ? split.lead : '',
      },
      children: split ? split.children : (body ? [rawNode(body)] : []),
    };
  },
};

// --- Section bodies --------------------------------------------------------
//
// A section whose body is one big raw-html child only makes its HEADING
// editable. Splitting that body into its top-level pieces is what makes the
// CONTENT editable: each piece becomes its own node, typed where we recognise
// it and a much smaller raw-html block where we do not.
//
// The pages indent each top-level body element on its own line, and
// page-section renders children joined by exactly that indent, so splitting on
// it round-trips precisely.
const BODY_SPLIT = '\n    ';

// One typed body element per recognised shape. `test` must match the WHOLE
// chunk, so a partial match can never silently drop markup.
const BODY_TYPES = [
  {
    type: 'sub-text',
    re: /^<p class="sub" data-reveal( style="([^"]*)")?>([\s\S]*)<\/p>$/,
    build: (m) => ({ html: m[3], style: m[2] || '' }),
  },
  {
    type: 'prose-block',
    re: /^<div class="prose" data-reveal( data-delay="([^"]*)")?( style="([^"]*)")?>([\s\S]*)<\/div>$/,
    build: (m) => ({ html: m[5], delay: m[2] || '', style: m[4] || '' }),
  },
  {
    type: 'button-row',
    re: /^<div( style="([^"]*)")? data-reveal><a href="([^"]*)"( target="_blank" rel="noopener")? class="btn (btn-line|btn-y)">([\s\S]*?) <span class="ar">→<\/span><\/a><\/div>$/,
    build: (m) => ({
      wrapStyle: m[2] || '',
      url: m[3],
      newTab: Boolean(m[4]),
      style: m[5] === 'btn-y' ? 'y' : 'line',
      label: unescapeText(m[6]),
    }),
  },
  {
    type: 'el-features',
    re: /^<div class="feat-grid">\n {6}([\s\S]*)\n {4}<\/div>$/,
    build: () => ({ reveal: false, indent: true }),
    children: (m) => [...m[1].matchAll(
      /<article class="feat" data-reveal(?: data-delay="\d+")?><span class="ct tl"><\/span><span class="ct br"><\/span>(?:<span class="ix">([^<]*)<\/span>)?<h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/article>/g,
    )].map((c) => ({
      id: newId('it'),
      type: 'feature-card',
      props: { ix: unescapeText(c[1] || ''), title: unescapeText(c[2]), text: unescapeText(c[3]) },
      children: [],
    })),
  },
];

function typeBodyChunk(chunk) {
  for (const shape of BODY_TYPES) {
    const m = chunk.match(shape.re);
    if (!m) continue;
    const children = shape.children ? shape.children(m) : [];
    if (shape.children && !children.length) continue; // never lose repeated content
    return { id: newId('el'), type: shape.type, props: shape.build(m), children };
  }
  return null;
}

// Depth-aware split: only break at an indent that is between top-level
// elements, never inside one.
function splitTopLevel(body) {
  const chunks = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '<') {
      if (body.startsWith('<!--', i)) { i = body.indexOf('-->', i) + 2; continue; }
      if (body[i + 1] === '/') depth -= 1;
      else if (/[a-zA-Z]/.test(body[i + 1] || '')) {
        const end = body.indexOf('>', i);
        if (end > 0 && body[end - 1] !== '/' && !VOID_HTML.test(body.slice(i, end))) depth += 1;
      }
    } else if (depth === 0 && body.startsWith(BODY_SPLIT, i)) {
      chunks.push(body.slice(start, i));
      start = i + BODY_SPLIT.length;
      i += BODY_SPLIT.length - 1;
    }
  }
  chunks.push(body.slice(start));
  return chunks;
}

const VOID_HTML = /<(br|hr|img|input|meta|link|source|track|col|area|base|embed|param|wbr)\b/i;

// A section's raw body -> its child nodes, plus any leading whitespace that
// belongs to the section rather than to a child.
export function splitSectionBody(body) {
  const chunks = splitTopLevel(body);
  if (chunks.length < 2) return null;
  const lead = chunks[0];
  // Anything but whitespace before the first indented element means the body is
  // not shaped the way we assume; leave it whole rather than risk mangling it.
  if (lead.trim() !== '') return null;
  const rest = chunks.slice(1).filter((c) => c !== '');
  if (!rest.length) return null;
  return { lead, children: rest.map((chunk) => typeBodyChunk(chunk) || rawNode(chunk)) };
}

export const RECOGNISERS = [statBand, standardSection];

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
    // Siblings are joined with a single "\n" at render, so exactly one newline
    // is removed at each split point and everything else -- including the
    // authoring comments between sections -- is preserved verbatim.
    const before = html.slice(0, hit.start).replace(/\n$/, '');
    const after = html.slice(hit.end).replace(/^\n/, '');
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
