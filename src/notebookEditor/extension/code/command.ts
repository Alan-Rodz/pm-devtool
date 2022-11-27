import { Command, EditorState, Transaction } from 'prosemirror-state';

import { AbstractDocumentUpdate, MarkName } from 'common';

import { ToggleOrSetMarkDocumentUpdate } from '../markHolder/command';

// ********************************************************************************
/** toggle the Code Mark */
export const toggleCodeCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new ToggleCodeDocumentUpdate(), state, dispatch);
export class ToggleCodeDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  /**
   * modify the given Transaction such that the Code Mark
   * is toggled and return it
   */
  public update(editorState: EditorState, tr: Transaction) {
    const updatedTr = new ToggleOrSetMarkDocumentUpdate(editorState.schema.marks[MarkName.CODE]).update(editorState, tr);
    return updatedTr/*updated*/;
  }
}
