# Page builder

A schema-driven visual page builder. Zero dependencies, plain ESM, no build step:
the **same modules** are imported by the serverless page renderer (`api/_page-template.js`)
and by the admin editor, which is what makes "one render function for canvas and
production" literally true rather than a convention.

```
builder/
  core/        the engine — knows nothing about any element
    registry.js   type -> ElementDefinition; the single source of truth
    node.js       the Node shape + immutable tree operations
    policy.js     containment as one table: none / any / whitelist / repeater
    render.js     the fold: renderNode / renderList / renderDocument
    document.js   versioned document, serialization, migrations
    commands.js   Insert / Remove / Move / SetProp / SetStyle / Duplicate + history
    validate.js   childPolicy, field and cross-node rules
    tokens.js     style tokens (nodes store refs, never values)
    bindings.js   content bindings (props resolve from a data source)
    html.js       esc / stripTags
  elements/    the site's elements, one ElementDefinition each
  editor/      the admin UI: canvas, outline, inspector, inserter, controls
  seo.js       domain code: FAQPage extraction, html-field derivation
```

## Adding an element

Add one `ElementDefinition` to `builder/elements/` and list it in `elements/index.js`.
That is the whole job. The element then has an inspector, serialization,
drag-and-drop, undo/redo, validation and token theming, because all of those are
implemented once over the interface — never per type.

```js
export const pricingTable = {
  type: 'pricing-table',
  label: 'Pricing table',
  category: 'Marketing',
  icon: ICONS.features,
  schema: [ select('currency', 'Currency', [...], 'GBP') ],   // drives the inspector AND defaults()
  childPolicy: { kind: 'repeater', item: 'pricing-tier', min: 1, max: 3 },
  render: (ctx) => `<div class="pricing">${ctx.renderChildren({ separator: '' })}</div>`,
  validate: (node, tree) => [],   // optional
};
```

`tests/builder-engine.test.js` asserts this end to end: it registers a throwaway
element and checks it inherits every capability with no other change.

## Rules the code must keep

- **No branching on node type** in `core/` — a test greps for it. Type knowledge
  lives in the registry (lookup) and in `document.js`'s legacy migration only.
- **No per-element editor code.** If a schema needs an affordance that does not
  exist, add a control to `editor/controls.js`; it becomes available everywhere.
- **No literal styles or literal data on nodes.** Styles are token refs resolved
  by the theme; external content is a `{ $bind }` resolved by the data scope.
- **All mutation goes through `commands.js`.** Nothing else may touch a node.
- **One renderer.** The canvas uses the production `renderNode`; its only
  addition is a `data-pb-id` attribute, which cannot affect layout.

## Documents and compatibility

Stored shape is `{ version, root }`. `pages.blocks` may still hold the legacy
flat `blocks[]` array; `parse()` migrates it on read (v1 → v2) and stored bytes
are never rewritten just by rendering. Unknown element types and unknown props
are preserved and rendered as inert markers, so older code can open a document
written by newer code.

`api/_blocks.js` is the **frozen v1 renderer**, kept off the serving path purely
as the regression oracle for `tests/builder-parity.test.js`, which asserts the
new engine's output is byte-identical for every element type and for the real
published `/about/` document.

## Editing the builder

There is nothing to build. Edit the files; the admin loads them directly
(`<script type="module" src="/builder/editor/index.js">`). Run the tests with
`node --test 'tests/**/*.test.js'`.
