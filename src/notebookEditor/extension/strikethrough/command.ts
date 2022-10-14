import { EditorState, Transaction } from 'prosemirror-state';

import {  AbstractDocumentUpdate, Command, MarkName } from 'common';

import { ToggleOrSetMarkDocumentUpdate } from '../markHolder/command';

// ********************************************************************************
/** toggle the Strikethrough Mark */
export const toggleStrikethroughCommand: Command = (state, dispatch) => {
  const updatedTr = new ToggleStrikethroughDocumentUpdate().update(state, state.tr);
  if(updatedTr) {
    dispatch(updatedTr);
    return true/*Command executed*/;
  } /* else -- Command cannot be executed */

  return false/*not executed*/;
};
export class ToggleStrikethroughDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  /**
   * modify the given Transaction such that the Strikethrough Mark
   * is toggled and return it
   */
  public update(editorState: EditorState, tr: Transaction) {
    const updatedTr = new ToggleOrSetMarkDocumentUpdate(editorState.schema.marks[MarkName.STRIKETHROUGH]).update(editorState, tr);
    return updatedTr/*updated*/;
  }
}
