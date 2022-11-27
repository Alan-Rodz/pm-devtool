import { keymap } from 'prosemirror-keymap';

import { getNodeOutputSpec, ListItemNodeSpec, NodeName, DATA_NODE_TYPE, chainCommands } from 'common';

import { createExtensionParseRules, getExtensionAttributesObject } from 'notebookEditor/extension/type/Extension/util';
import { NodeExtension } from 'notebookEditor/extension/type/NodeExtension/NodeExtension';
import { ExtensionPriority } from 'notebookEditor/model';

import { ListItemAttrs } from './attribute';
import { joinBackwardToEndOfClosestListItem, joinForwardToStartOfClosestListItemCommand, liftListItemCommand, sinkListItemCommand, splitListItemKeepMarksCommand } from './command';

// ********************************************************************************
// == Node ========================================================================
export const ListItem = new NodeExtension({
  // -- Definition ----------------------------------------------------------------
  name: NodeName.LIST_ITEM,
  priority: ExtensionPriority.LIST_ITEM,

  // -- Attribute -----------------------------------------------------------------
  defineNodeAttributes: (extensionStorage) => ListItemAttrs,

  // -- Spec ----------------------------------------------------------------------
  partialNodeSpec: { ...ListItemNodeSpec },

  // -- DOM -----------------------------------------------------------------------
  defineDOMBehavior: (extensionStorage) => ({
    // match ListItem tags and Block Nodes (which use the div tag)
    parseDOM: createExtensionParseRules([
      { tag: `li[${DATA_NODE_TYPE}="${NodeName.LIST_ITEM}"]` },
      { tag: 'li' },
      { tag: 'div' }], ListItemAttrs),
    toDOM: (node) => getNodeOutputSpec(node, getExtensionAttributesObject(node, ListItemAttrs)),
  }),

  // -- Input ---------------------------------------------------------------------
  inputRules: (editor) => [/*none*/],

  // -- Paste ---------------------------------------------------------------------
  pasteRules: (editor) => [/*none*/],

  // -- Plugin --------------------------------------------------------------------
  addProseMirrorPlugins: (editor) => [
    keymap({
      'Enter': chainCommands(liftListItemCommand('Enter'), splitListItemKeepMarksCommand),
      'Shift-Tab': liftListItemCommand('Shift-Tab'),
      'Tab': sinkListItemCommand,
      'Backspace': () => {
        const liftResult = liftListItemCommand('Backspace')(editor.view.state, editor.view.dispatch);
        if(liftResult) return liftResult/* else -- could not Lift */;

        return joinBackwardToEndOfClosestListItem(editor);
      },
      'Delete': joinForwardToStartOfClosestListItemCommand,
    }),
  ],
});
