import { EditorState, Transaction } from 'prosemirror-state';

import {  AbstractDocumentUpdate, Command, MarkName, NotebookSchemaType } from 'common';

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
  public update(editorState: EditorState<NotebookSchemaType>, tr: Transaction<NotebookSchemaType>) {
    const updatedTr = new ToggleOrSetMarkDocumentUpdate(MarkName.STRIKETHROUGH, editorState.schema.marks[MarkName.STRIKETHROUGH]).update(editorState, tr);
    return updatedTr/*updated*/;
  }
}
