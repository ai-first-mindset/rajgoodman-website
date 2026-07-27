// Composite sections: elements that model the site's OWN recurring sections,
// as opposed to the generic kit in content.js / marketing.js.
//
// These exist so a page stops being an opaque raw-html blob. Each one has to
// emit its section's live markup byte-for-byte, because the pages already
// exist and must not change when they are decomposed -- so the renders here
// look fussy on purpose (exact indentation, the literal arrow glyph, escText()
// rather than esc() in text nodes). tests/builder-sections.test.js checks each
// against the real published markup.

import { esc, escText, safeUrl } from '../core/html.js';
import { ICONS, text, area } from './shared.js';

const ARROW = '→'; // the literal glyph the pages use, not &rarr;

// "Global Reach": a centred heading band wrapping an animated counter row.
// Present on 11 of the 16 pages, which makes it the cheapest section to type.
export const statBand = {
  type: 'stat-band',
  label: 'Stat band',
  category: 'Sections',
  icon: ICONS.stats,
  schema: [
    text('idx', 'Index label (e.g. [ 09 ])'),
    text('kicker', 'Kicker'),
    text('heading', 'Heading'),
    area('text', 'Sub text'),
    text('label', 'Button label'),
    text('url', 'Button URL'),
  ],
  childPolicy: { kind: 'repeater', item: 'stat-item', min: 1 },
  render: (ctx) => {
    const p = ctx.props;
    const idx = p.idx ? `<span class="idx">${escText(p.idx)}</span>` : '';
    const kick = p.kicker ? `<span class="kick">${escText(p.kicker)}</span>` : '';
    const head = (idx || kick)
      ? `<div class="shead" style="justify-content:center">${idx}${kick}</div>\n    ` : '';
    const h2 = p.heading ? `<h2>${escText(p.heading)}</h2>\n    ` : '';
    const sub = p.text
      ? `<p class="sub" style="margin:1rem auto 0">${escText(p.text)}</p>\n    ` : '';
    const btn = p.label
      ? `\n    <a href="${esc(safeUrl(p.url) || '#')}" class="btn btn-y">${escText(p.label)} <span class="ar">${ARROW}</span></a>`
      : '';
    return `<section class="sec reach">
  <div class="wrap" data-reveal>
    ${head}${h2}${sub}<div class="big">
      ${ctx.renderChildren({ separator: '\n      ' })}
    </div>${btn}
  </div>
</section>`;
  },
};

export default [statBand];
