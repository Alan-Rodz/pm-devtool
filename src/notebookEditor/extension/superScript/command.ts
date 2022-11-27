import { Command, EditorState, Transaction } from 'prosemirror-state';

import { AbstractDocumentUpdate, MarkName } from 'common';

import { ToggleOrSetMarkDocumentUpdate } from '../markHolder/command';

// ********************************************************************************
/** toggle the Superscript Mark */
export const toggleSuperScriptCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new ToggleSuperScriptDocumentUpdate(), state, dispatch);
export class ToggleSuperScriptDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  /**
   * modify the given Transaction such that the Superscript Mark
   * is toggled and return it
   */
  public update(editorState: EditorState, tr: Transaction) {
    const updatedTr = new ToggleOrSetMarkDocumentUpdate(editorState.schema.marks[MarkName.SUPER_SCRIPT]).update(editorState, tr);
    return updatedTr/*updated*/;
  }
}
