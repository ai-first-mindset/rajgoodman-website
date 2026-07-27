// SEO extraction over a page document.
//
// This is DOMAIN code, deliberately outside builder/core: it knows that the
// site's FAQ element should become FAQPage structured data. Keeping the type
// name here rather than in the engine is the point -- the core stays
// meaning-free and a domain plugs in without forking it.

import { parse } from './core/document.js';
import { collect } from './core/node.js';
import { stripTags } from './core/html.js';
import { registry } from './elements/index.js';
import { pageSources, resolveDeep } from './core/bindings.js';

const FAQ_TYPE = 'faq';
const FAQ_ITEM_TYPE = 'faq-item';

// Q&A pairs across every FAQ on the page, for FAQPage JSON-LD. Accepts either a
// v2 document or the legacy blocks[] array, exactly like the renderer does.
export function extractFaqItems(stored, opts = {}) {
  const { doc } = parse(stored);
  const scope = pageSources(opts.page || {}, opts.site || {});
  const out = [];

  for (const faq of collect(doc.root, (n) => n.type === FAQ_TYPE)) {
    for (const item of faq.children) {
      if (item.type !== FAQ_ITEM_TYPE) continue;
      const props = resolveDeep(item.props || {}, scope);
      const q = stripTags(props.question);
      const a = stripTags(props.answer_html);
      if (q && a) out.push({ q, a });
    }
  }
  return out;
}

// Which props hold author-written HTML, per element type. Derived from the
// schemas, so a new element with an `html` control is covered automatically and
// nobody has to remember to add it to the sanitiser.
export function htmlFieldsByType(reg = registry) {
  const map = {};
  for (const def of reg.list()) {
    const names = def.schema.filter((f) => f.control === 'html').map((f) => f.name);
    if (names.length) map[def.type] = names;
  }
  return map;
}
