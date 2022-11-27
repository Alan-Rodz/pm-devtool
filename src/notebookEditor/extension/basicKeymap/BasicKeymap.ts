import { keymap } from 'prosemirror-keymap';

import { chainCommands, deleteSelectionCommand, joinBackwardCommand, joinForwardCommand, liftEmptyBlockNodeCommand, selectNodeBackwardCommand, selectNodeForwardCommand, splitBlockKeepMarksCommand } from 'common';

import { ExtensionName, ExtensionPriority } from 'notebookEditor/model';
import { undoInputRuleCommand } from 'notebookEditor/plugin/inputRule/command';

import { Extension } from '../type/Extension/Extension';
import { basicKeymapPlugin } from './plugin';

// ********************************************************************************
// REF: https://github.com/ProseMirror/prosemirror-example-setup/blob/master/src/keymap.ts

// == Node ========================================================================
export const BasicKeymap = new Extension({
  // -- Definition ----------------------------------------------------------------
  name: ExtensionName.BASIC_KEYMAP,
  priority: ExtensionPriority.BASIC_KEYMAP,

  // -- Input ---------------------------------------------------------------------
  inputRules: (editor) => [/*none*/],

  // -- Paste ---------------------------------------------------------------------
  pasteRules: (editor) => [/*none*/],

  // -- Plugin --------------------------------------------------------------------
  addProseMirrorPlugins: () => [
    basicKeymapPlugin(),
    keymap({
      'Enter': chainCommands(liftEmptyBlockNodeCommand, splitBlockKeepMarksCommand),
      'Backspace': chainCommands(undoInputRuleCommand, deleteSelectionCommand, joinBackwardCommand, selectNodeBackwardCommand),
      'Mod-Backspace': chainCommands(deleteSelectionCommand, joinBackwardCommand, selectNodeBackwardCommand),
      'Delete': chainCommands(deleteSelectionCommand, joinForwardCommand, selectNodeForwardCommand),
      'Mod-Delete': chainCommands(deleteSelectionCommand, joinForwardCommand, selectNodeForwardCommand),
    }),
  ],
});
