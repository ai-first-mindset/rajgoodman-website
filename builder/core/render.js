// The fold. ONE recursive function produces the composite artifact, and it is
// the same function for the editing canvas and for production output -- there is
// no separate preview renderer. Nothing in here branches on a node's type: it
// looks the definition up in the registry and hands it a RenderContext.
//
// Each node's render decides WHERE its already-composed children go by calling
// ctx.renderChildren() and placing the result. It never inspects a child's
// internals. A leaf ignores the slot; a container drops it into its markup; a
// repeater's children compose exactly the same way. The final artifact is the
// ordered fold of the whole tree.

import { esc } from './html.js';
import { resolveDeep, createDataScope } from './bindings.js';
import { createTheme } from './tokens.js';

// Build the environment threaded through the fold.
//   registry  - element definitions
//   theme     - token resolution (createTheme)
//   data      - binding resolution (createDataScope)
//   mode      - 'production' | 'edit'
//   decorate  - optional (html, node, def) => html, used by the canvas to add
//               selection affordances WITHOUT a second renderer
export function createEnv({ registry, theme, data, mode = 'production', decorate = null }) {
  return {
    registry,
    theme: theme || createTheme(),
    data: data || createDataScope(),
    mode,
    decorate,
  };
}

// An unregistered type is never silently dropped: any raw HTML payload is
// preserved, otherwise an inert marker keeps the node visible in the output.
// This is the forward-compatibility boundary -- older code renders documents
// authored by newer code without crashing or losing content.
function renderUnknown(node) {
  const html = node.props && node.props.html;
  if (typeof html === 'string' && html) return html;
  // Wording matches the legacy renderer's marker so output stays byte-identical
  // for any document that already contains one.
  return `<!-- unsupported-block:${esc(node.type || 'unknown')} -->`;
}

// Token classes wrap the element's own output. Applied generically here, so no
// element implements spacing/alignment/surface itself, and a node with no style
// produces no wrapper at all.
function applyStyle(html, node, env) {
  const cls = env.theme.classesFor(node.style);
  return cls ? `<div class="pb-wrap ${cls}">${html}</div>` : html;
}

// Render an ordered sibling list. Auto-numbering is a DECLARED TRAIT of a
// definition (`autoNumber`), resolved here per list -- so numbering is a
// property of the registry, not a special case in any element or algorithm.
export function renderList(nodes, env, { separator = '\n' } = {}) {
  const list = Array.isArray(nodes) ? nodes : [];
  let n = 0;
  return list
    .map((child, index) => {
      const def = env.registry.get(child && child.type);
      const ordinal = def && def.autoNumber ? (n += 1) : null;
      return renderNode(child, env, { index, ordinal });
    })
    .filter(Boolean)
    .join(separator);
}

export function renderNode(node, env, position = {}) {
  if (!node || typeof node !== 'object') return '';
  const def = env.registry.get(node.type);
  if (!def) return applyStyle(renderUnknown(node), node, env);

  const children = Array.isArray(node.children) ? node.children : [];
  const ctx = {
    node,
    id: node.id,
    props: resolveDeep(node.props || {}, env.data),
    // Structural facts (arity, position) are fair game; a parent still never
    // reads a child's props.
    childCount: children.length,
    index: position.index == null ? 0 : position.index,
    ordinal: position.ordinal == null ? null : position.ordinal,
    renderChildren: (opts) => renderList(children, env, opts),
    token: (ref) => env.theme.resolve(ref),
    resolve: (v) => env.data.resolve(v),
    mode: env.mode,
    env,
  };

  const out = applyStyle(def.render(ctx), node, env);
  return env.decorate ? env.decorate(out, node, def) : out;
}

// Whole-document entry point: the root is an ordinary node whose render simply
// emits its composed children.
export function renderDocument(doc, env) {
  return renderNode(doc.root, env);
}
