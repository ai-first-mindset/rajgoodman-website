// Every element the builder can place. Registration is the ONLY step: from this
// one list each element gains an inspector, serialization, drag-and-drop, undo
// and token theming, because all of those are implemented over the interface
// rather than per type.

import { createRegistry } from '../core/registry.js';
import layout from './layout.js';
import content from './content.js';
import media from './media.js';
import marketing from './marketing.js';
import sections from './sections.js';
import blocks from './blocks.js';

export const ELEMENTS = [...layout, ...content, ...media, ...marketing, ...sections, ...blocks];

export function createBuilderRegistry(extra = []) {
  return createRegistry().registerAll([...ELEMENTS, ...extra]);
}

// Shared instance for the app (server render and editor alike).
export const registry = createBuilderRegistry();
