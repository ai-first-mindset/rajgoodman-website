// The inspector is GENERATED, never authored. It reads the selected node's
// definition schema, asks the control registry for a control per field, and
// dispatches a command on change. No element ships bespoke editor code -- this
// file has no knowledge of any element type.

import { el, clear, icon } from './dom.js';
import { visibleFields } from '../core/validate.js';
import { arityOf, acceptedTypes } from '../core/policy.js';
import { SetProp, SetStyle, InsertType, Remove, Move, Duplicate } from '../core/commands.js';
import { isBinding, binding } from '../core/bindings.js';

const STYLE_GROUP_LABELS = { space: 'Top spacing', align: 'Alignment', surface: 'Background' };

export function createInspector(host, editor) {
  const root = el('div', { class: 'pb-inspector' });
  host.append(root);

  function render() {
    clear(root);
    const node = editor.selectedNode();
    if (!node) {
      root.append(el('p', { class: 'pb-empty', text: 'Select an element to edit it.' }));
      return;
    }
    const def = editor.registry.get(node.type);
    if (!def) {
      root.append(el('p', { class: 'pb-empty', text: `Unknown element "${node.type}" (preserved on save).` }));
      return;
    }

    root.append(header(node, def));

    const fields = visibleFields(def, node.props);
    if (fields.length) root.append(group('Content', fields.map((f) => fieldRow(node, f))));

    const childUi = childrenGroup(node, def);
    if (childUi) root.append(childUi);

    root.append(group('Design', editor.theme.slots.map((slot) => styleRow(node, slot)), true));

    const issues = editor.issuesFor(node.id);
    if (issues.length) root.append(el('div', { class: 'pb-issues' }, issues.map(
      (i) => el('p', { class: `pb-issue pb-issue-${i.level}`, text: i.message }),
    )));
  }

  function header(node, def) {
    return el('div', { class: 'pb-insp-head' }, [
      el('span', { class: 'pb-insp-icon' }, [icon(def.icon)]),
      el('span', { class: 'pb-insp-title', text: def.label }),
      el('span', { class: 'pb-insp-actions' }, [
        el('button', {
          type: 'button', class: 'pbi-btn', title: 'Duplicate', text: 'Duplicate',
          onclick: () => editor.dispatch(Duplicate(node.id)),
        }),
        el('button', {
          type: 'button', class: 'pbi-btn pbi-danger', title: 'Delete', text: 'Delete',
          onclick: () => editor.dispatch(Remove(node.id)),
        }),
      ]),
    ]);
  }

  function group(title, rows, collapsed = false) {
    const body = el('div', { class: 'pb-group-body' }, rows.filter(Boolean));
    const box = el('section', { class: `pb-group${collapsed ? ' is-collapsed' : ''}` }, [
      el('button', {
        type: 'button', class: 'pb-group-head', text: title,
        onclick: (e) => e.currentTarget.parentElement.classList.toggle('is-collapsed'),
      }),
      body,
    ]);
    return box;
  }

  // One row per field. The binding toggle is generic: any field can hold a
  // Binding instead of a literal, so no control has to know about bindings.
  function fieldRow(node, field) {
    const value = node.props[field.name];
    const bound = isBinding(value);
    const control = editor.controls.get(field.control);

    const input = bound
      ? bindingPicker(node, field, value)
      : control.render(field, value, (next) => editor.dispatch(SetProp(node.id, field.name, next)));

    const label = field.control === 'toggle' && !bound
      ? null
      : el('label', { class: 'pb-label', text: field.label });

    return el('div', { class: 'pb-field' }, [
      el('div', { class: 'pb-field-head' }, [
        label,
        editor.dataPaths().length ? el('button', {
          type: 'button',
          class: `pb-bind${bound ? ' is-on' : ''}`,
          title: bound ? 'Use a fixed value' : 'Bind to page data',
          text: bound ? 'bound' : 'bind',
          onclick: () => editor.dispatch(SetProp(
            node.id, field.name,
            bound ? (value.fallback ?? '') : binding(editor.dataPaths()[0].value),
          )),
        }) : null,
      ]),
      input,
    ]);
  }

  function bindingPicker(node, field, value) {
    const paths = editor.dataPaths();
    const sel = el('select', {
      class: 'pbi-input',
      onchange: (e) => editor.dispatch(SetProp(node.id, field.name, binding(e.target.value, value.fallback))),
    }, paths.map((p) => el('option', { text: p.label, value: p.value })));
    sel.value = value.$bind;
    const fallback = el('input', {
      class: 'pbi-input', type: 'text', placeholder: 'Fallback when empty',
      oninput: (e) => editor.dispatch(SetProp(node.id, field.name, binding(value.$bind, e.target.value))),
    });
    fallback.value = value.fallback == null ? '' : value.fallback;
    return el('div', { class: 'pb-bindrow' }, [sel, fallback]);
  }

  // Children are edited through the SAME mechanism whether the policy is a
  // repeater or an open container: add / remove / reorder over child Nodes.
  function childrenGroup(node, def) {
    const allowed = acceptedTypes(def, editor.registry);
    if (!allowed.length) return null;
    const { min, max } = arityOf(def);

    const rows = node.children.map((child, i) => {
      const childDef = editor.registry.get(child.type);
      return el('div', { class: 'pb-childrow' }, [
        el('button', {
          type: 'button', class: 'pb-childname', text: summarise(child, childDef, i),
          onclick: () => editor.select(child.id),
        }),
        el('button', {
          type: 'button', class: 'pbi-btn pbi-icon', title: 'Move up', text: '↑',
          disabled: i === 0,
          onclick: () => editor.dispatch(Move(child.id, node.id, i - 1)),
        }),
        el('button', {
          type: 'button', class: 'pbi-btn pbi-icon', title: 'Move down', text: '↓',
          disabled: i === node.children.length - 1,
          onclick: () => editor.dispatch(Move(child.id, node.id, i + 1)),
        }),
        el('button', {
          type: 'button', class: 'pbi-btn pbi-icon pbi-danger', title: 'Remove', text: '×',
          disabled: node.children.length <= min,
          onclick: () => editor.dispatch(Remove(child.id)),
        }),
      ]);
    });

    const canAdd = node.children.length < max;
    const adders = allowed.map((type) => el('button', {
      type: 'button', class: 'pbi-btn', disabled: !canAdd,
      text: `Add ${editor.registry.get(type).label}`,
      onclick: () => editor.dispatch(InsertType(node.id, type)),
    }));

    return group(`Items (${node.children.length})`, [...rows, el('div', { class: 'pb-adders' }, adders)]);
  }

  // A readable label for a child row, derived from the schema's first text
  // field -- generic, so no element supplies a summary function.
  function summarise(child, childDef, i) {
    if (!childDef) return `${child.type} ${i + 1}`;
    const first = childDef.schema.find((f) => f.control === 'text' || f.control === 'textarea');
    const value = first && child.props[first.name];
    const text = isBinding(value) ? `{${value.$bind}}` : value;
    return text ? `${childDef.label}: ${String(text).slice(0, 38)}` : `${childDef.label} ${i + 1}`;
  }

  function styleRow(node, slot) {
    const options = editor.theme.options(slot);
    if (!options.length) return null;
    const field = { name: slot, control: 'token', label: STYLE_GROUP_LABELS[slot] || slot, options, default: '' };
    return el('div', { class: 'pb-field' }, [
      el('label', { class: 'pb-label', text: field.label }),
      editor.controls.get('token').render(
        field,
        (node.style || {})[slot] || '',
        (next) => editor.dispatch(SetStyle(node.id, slot, next)),
      ),
    ]);
  }

  return { render, root };
}
