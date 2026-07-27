// Public entry point for the page builder engine.
//
// The SAME module graph is imported by the serverless page renderer and by the
// admin canvas, which is what makes "one render function for canvas and
// production" literally true rather than a convention.
//
//   import { renderPageBlocks } from '../builder/index.js';
//   renderPageBlocks(page.blocks, { page });

import { registry } from './elements/index.js';
import { parse, normalize, serialize, createDocument, DOCUMENT_VERSION } from './core/document.js';
import { createEnv, renderDocument } from './core/render.js';
import { createTheme, SIGNAL_THEME } from './core/tokens.js';
import { pageSources } from './core/bindings.js';

export { registry, createBuilderRegistry } from './elements/index.js';
export * from './core/node.js';
export * from './core/commands.js';
export * from './core/validate.js';
export * from './core/policy.js';
export { parse, normalize, serialize, createDocument, DOCUMENT_VERSION } from './core/document.js';
export { createEnv, renderDocument, renderNode, renderList } from './core/render.js';
export { createTheme, SIGNAL_THEME } from './core/tokens.js';
export { createDataScope, pageSources, binding, isBinding } from './core/bindings.js';
export { esc, stripTags } from './core/html.js';

// Production environment: reference theme, page/site bindings, no decoration.
export function productionEnv({ page = {}, site = {}, theme = SIGNAL_THEME } = {}) {
  return createEnv({
    registry,
    theme: createTheme(theme),
    data: pageSources(page, site),
    mode: 'production',
  });
}

// Render whatever the `pages` table holds -- legacy blocks[] or a v2 document --
// to the site's markup. Migration happens on read; stored bytes are untouched.
export function renderPageBlocks(stored, opts = {}) {
  const { doc } = parse(stored);
  return renderDocument(doc, productionEnv(opts));
}

export function newDocument() {
  return createDocument(registry);
}

export { serialize as serializeDocument, normalize as normalizeDocument, DOCUMENT_VERSION as documentVersion };
