import { Extension } from '@tiptap/core';

import { ExtensionName, NoOptions, NoStorage } from 'notebookEditor/model/type';

import { InlineNodeWithContentPlugin } from './plugin';

// ********************************************************************************
// NOTE: this Extension implements common behavior to all inline Nodes with Content
// NOTE: All common attributes and methods shared across inline Nodes with Content
//       are defined in its corresponding common file
//       (SEE: src/common/notebookEditor/extension/inlineNodeWithContent.ts)
// == Extension ===================================================================
export const InlineNodeWithContent = Extension.create<NoOptions, NoStorage>({
  name: ExtensionName.INLINE_NODE_WITH_CONTENT,

  // -- Plugin --------------------------------------------------------------------
  addProseMirrorPlugins() { return [ InlineNodeWithContentPlugin() ]; },
});
