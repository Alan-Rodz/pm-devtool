import { Plugin as ProseMirrorPlugin, Transaction } from 'prosemirror-state';

import { Editor } from 'notebookEditor/editor';
import { NodeViewStorage, DialogStorage } from 'notebookEditor/model';
import { InputRule } from 'notebookEditor/plugin/inputRule';
import { PasteRule } from 'notebookEditor/plugin/pasteRule';

// == Constant ====================================================================
/** priority used by Extensions whose order of execution is not relevant*/
export const DEFAULT_EXTENSION_PRIORITY = 100;

// == Type ========================================================================
/** the type of the Storage used by the Extension */
export type ExtensionStorageType = NodeViewStorage<any> | DialogStorage | undefined/*Extension does not need storage*/;

/** the type of the optionally defined Transaction listener of an Extension */
export type TransactionListenerType = (editor: Editor, tr: Transaction) => void;

// == Interface ===================================================================
export interface ExtensionDefinition {
  name: string;
  priority: number;

  /** the Storage used by the Extension */
  addStorage?: () => ExtensionStorageType;

  /**
   * if the Extension must react to Transactions in the editor, then it
   * can do so through this function. Note that the this is meant to
   * react to Editor changes, not trigger them
   */
  transactionListener?: TransactionListenerType;

  /** the InputRules added by the Extension */
  inputRules: (editor: Editor) => InputRule[];

  /** the PasteRules added by the Extension */
  pasteRules: (editor: Editor) => PasteRule[];

  /** the ProseMirrorPlugins added by the Extension */
  addProseMirrorPlugins: (editor: Editor, extensionStorage: ExtensionStorageType) => ProseMirrorPlugin[];
}
