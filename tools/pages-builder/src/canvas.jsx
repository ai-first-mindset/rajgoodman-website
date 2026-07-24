// WYSIWYG block preview for the Puck canvas: renders each block with the SAME
// server renderer (api/_blocks.js renderBlock) so the canvas shows the exact
// site markup and there is no second render implementation to drift.
import { usePuck } from '@puckeditor/core';
import { renderBlock } from '../../../api/_blocks.js';

// Types whose section heading is auto-numbered ([ 01 ]…) by renderBlocks server-side.
const NUMBERED = new Set(['section-heading', 'faq', 'cta']);

// Reproduce renderBlocks' auto-number live: this block's ordinal among numbered
// blocks, computed from Puck's current content order.
function autoNoFor(content, id, type) {
  if (!NUMBERED.has(type)) return null;
  let n = 0;
  for (const item of content || []) {
    if (NUMBERED.has(item.type)) {
      n += 1;
      if (item.props && item.props.id === id) return n;
    }
  }
  return n || null;
}

export function BlockPreview({ type, ...props }) {
  const { appState } = usePuck();
  const content = appState && appState.data ? appState.data.content : [];
  const autoNo = autoNoFor(content, props.id, type);
  // props carries Puck render metadata (puck/editMode) too — renderBlock only
  // reads the known block fields, so the extra keys are harmless.
  const html = renderBlock({ ...props, type }, autoNo);
  return <div className="pb-block" dangerouslySetInnerHTML={{ __html: html }} />;
}
