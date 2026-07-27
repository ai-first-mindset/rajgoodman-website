// The control registry: the vocabulary a Field's `control` key draws on.
//
// Adding a control here makes it available to EVERY element's schema. No
// element may implement its own settings UI -- if an element needs an editing
// affordance that does not exist yet, it belongs in this file, not in the
// element.
//
// A control is { render(field, value, onChange) -> HTMLElement, coerce(raw) }.

import { el } from './dom.js';

const asText = (v) => String(v == null ? '' : v);

function textInput(field, value, onChange, { multiline = false, rows = 3, className = '' } = {}) {
  const input = el(multiline ? 'textarea' : 'input', {
    class: `pbi-input ${className}`.trim(),
    placeholder: field.placeholder || '',
    oninput: (e) => onChange(asText(e.target.value)),
  });
  if (!multiline) input.type = 'text';
  else input.rows = rows;
  input.value = asText(value);
  return input;
}

export const CONTROLS = {
  text: {
    coerce: asText,
    render: (field, value, onChange) => textInput(field, value, onChange),
  },

  textarea: {
    coerce: asText,
    render: (field, value, onChange) => textInput(field, value, onChange, { multiline: true }),
  },

  // HTML-bearing field. Declaring a field as `html` is also what tells the
  // write path to sanitise it, so the schema is the single source of that too.
  html: {
    coerce: asText,
    render: (field, value, onChange) => textInput(field, value, onChange, { multiline: true, rows: 6, className: 'pbi-code' }),
  },

  number: {
    coerce: (v) => (v === '' || v == null ? 0 : Number(v)),
    render(field, value, onChange) {
      return el('input', {
        class: 'pbi-input', type: 'number', value: value == null ? '' : value,
        oninput: (e) => onChange(this.coerce(e.target.value)),
      });
    },
  },

  select: {
    coerce: (v) => v,
    render(field, value, onChange) {
      const options = field.options || [];
      const sel = el('select', {
        class: 'pbi-input',
        onchange: (e) => {
          const chosen = options[e.target.selectedIndex];
          onChange(chosen ? chosen.value : e.target.value);
        },
      }, options.map((o) => el('option', { text: o.label, value: String(o.value) })));
      const at = options.findIndex((o) => String(o.value) === String(value));
      sel.selectedIndex = at < 0 ? 0 : at;
      return sel;
    },
  },

  toggle: {
    coerce: (v) => Boolean(v),
    render(field, value, onChange) {
      const input = el('input', {
        type: 'checkbox', class: 'pbi-check',
        onchange: (e) => onChange(e.target.checked),
      });
      input.checked = Boolean(value);
      return el('label', { class: 'pbi-toggle' }, [input, el('span', { text: field.label })]);
    },
  },

  // Image URL plus a Browse hook. The admin supplies window.PagesBuilderMedia
  // when its media library is available; without it this degrades to a URL box.
  media: {
    coerce: (v) => String(v == null ? '' : v),
    render(field, value, onChange) {
      const input = el('input', {
        class: 'pbi-input', type: 'text', value: value == null ? '' : String(value),
        placeholder: 'https://...',
        oninput: (e) => onChange(this.coerce(e.target.value)),
      });
      const row = el('div', { class: 'pbi-media' }, [input]);
      if (typeof window !== 'undefined' && typeof window.PagesBuilderMedia === 'function') {
        row.append(el('button', {
          type: 'button', class: 'pbi-btn', text: 'Browse',
          onclick: () => window.PagesBuilderMedia((url) => { input.value = url; onChange(url); }),
        }));
      }
      if (value) row.append(el('img', { class: 'pbi-thumb', src: String(value), alt: '' }));
      return row;
    },
  },

  // Token picker, used by the Design group. Options come from the theme, so a
  // new token is available to every element without touching any schema.
  token: {
    coerce: (v) => v,
    render(field, value, onChange) {
      const options = [{ value: '', label: 'Default' }, ...(field.options || [])];
      const sel = el('select', {
        class: 'pbi-input',
        onchange: (e) => onChange(options[e.target.selectedIndex].value),
      }, options.map((o) => el('option', { text: o.label, value: o.value })));
      const at = options.findIndex((o) => o.value === (value || ''));
      sel.selectedIndex = at < 0 ? 0 : at;
      return sel;
    },
  },
};

export function createControlRegistry(extra = {}) {
  const controls = { ...CONTROLS, ...extra };
  return {
    get(name) { return controls[name] || controls.text; },
    has(name) { return Boolean(controls[name]); },
    register(name, control) { controls[name] = control; },
    names() { return Object.keys(controls); },
  };
}
