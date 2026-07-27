// Marketing elements. Three of them are repeaters (FAQ, Stats, Feature cards);
// none contains any repeater-specific code, because a repeater is just a
// childPolicy.

import { esc, safeUrl } from '../core/html.js';
import { ICONS, sectionHead, HEAD_FIELDS, text, area, html, toggle } from './shared.js';

export const cta = {
  type: 'cta',
  label: 'Call to action',
  category: 'Marketing',
  icon: ICONS.cta,
  autoNumber: true,
  schema: [...HEAD_FIELDS, area('text', 'Sub text'), text('label', 'Button label'), text('url', 'Button URL')],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const p = ctx.props;
    const head = sectionHead({ ...p, showLine: false }, ctx.ordinal);
    const sub = p.text ? `\n    <p class="sub" style="margin:1rem auto 0">${esc(p.text)}</p>` : '';
    const btn = p.label ? `\n    <a href="${esc(safeUrl(p.url) || '#')}" class="btn btn-y">${esc(p.label)} <span class="ar">&rarr;</span></a>` : '';
    return `<section class="sec reach">
  <div class="wrap" data-reveal>
    ${head}${sub}${btn}
  </div>
</section>`;
  },
};

export const faqItem = {
  type: 'faq-item',
  label: 'Question',
  category: 'Items',
  icon: ICONS.faq,
  standalone: false,
  schema: [
    text('question', 'Question'),
    html('answer_html', 'Answer (HTML allowed)', ''),
    toggle('open', 'Open by default', false),
  ],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const { question, answer_html: answer, open } = ctx.props;
    return `<details${open ? ' open' : ''}><summary>${esc(question)}<span class="pm-ic"></span></summary><div class="ans">${answer || ''}</div></details>`;
  },
};

export const faq = {
  type: 'faq',
  label: 'FAQ accordion',
  category: 'Marketing',
  icon: ICONS.faq,
  autoNumber: true,
  schema: [
    text('idx', 'Index label (e.g. [ 01 ])'),
    text('kicker', 'Kicker', 'FAQs'),
    text('heading', 'Heading', 'Questions, answered'),
  ],
  childPolicy: { kind: 'repeater', item: 'faq-item', min: 1 },
  render: (ctx) => `<section class="sec tight">
  <div class="wrap">
    ${sectionHead(ctx.props, ctx.ordinal)}
    <div class="faq" data-reveal>
      ${ctx.renderChildren({ separator: '\n      ' })}
    </div>
  </div>
</section>`,
};

export const elTestimonial = {
  type: 'el-testimonial',
  label: 'Testimonial',
  category: 'Marketing',
  icon: ICONS.quote,
  schema: [area('quote', 'Quote'), text('name', 'Name'), text('role', 'Role'), text('org', 'Organisation')],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const { quote, name, role, org } = ctx.props;
    const orgEl = org ? `<span>${esc(org)}</span>` : '';
    const roleEl = role ? `<span>${esc(role)}</span>` : '';
    return `<div class="pb-testimonial" data-reveal><div class="top"><span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>${orgEl}</div><p>${esc(quote)}</p><div class="who">${esc(name)}${roleEl}</div></div>`;
  },
};

export const statItem = {
  type: 'stat-item',
  label: 'Stat',
  category: 'Items',
  icon: ICONS.stats,
  standalone: false,
  schema: [text('value', 'Number', '100'), text('suffix', 'Suffix', '+'), text('label', 'Label', 'Metric')],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const { value, suffix, label } = ctx.props;
    return `<div class="cell"><div class="n"><span data-count="${esc(value)}">0</span>${esc(suffix || '')}</div><div class="l">${esc(label)}</div></div>`;
  },
};

export const elStats = {
  type: 'el-stats',
  label: 'Stats',
  category: 'Marketing',
  icon: ICONS.stats,
  schema: [],
  childPolicy: { kind: 'repeater', item: 'stat-item' },
  render: (ctx) => `<div class="big" data-reveal>${ctx.renderChildren({ separator: '' })}</div>`,
};

export const featureCard = {
  type: 'feature-card',
  label: 'Feature card',
  category: 'Items',
  icon: ICONS.features,
  standalone: false,
  schema: [text('title', 'Title', 'Feature'), area('text', 'Text', 'Describe the feature here.')],
  childPolicy: { kind: 'none' },
  render: (ctx) => {
    const { title, text: body } = ctx.props;
    const delay = ctx.index ? ` data-delay="${ctx.index * 80}"` : '';
    return `<article class="feat" data-reveal${delay}><span class="ct tl"></span><span class="ct br"></span><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`;
  },
};

export const elFeatures = {
  type: 'el-features',
  label: 'Feature cards',
  category: 'Marketing',
  icon: ICONS.features,
  schema: [],
  childPolicy: { kind: 'repeater', item: 'feature-card' },
  render: (ctx) => `<div class="feat-grid" data-reveal>${ctx.renderChildren({ separator: '' })}</div>`,
};

export default [cta, faqItem, faq, elTestimonial, statItem, elStats, featureCard, elFeatures];
