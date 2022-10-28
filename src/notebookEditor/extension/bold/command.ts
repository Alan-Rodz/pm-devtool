import { EditorState, Transaction } from 'prosemirror-state';

import { AbstractDocumentUpdate, Command, MarkName } from 'common';

import { ToggleOrSetMarkDocumentUpdate } from '../markHolder/command';

// ********************************************************************************
/** toggle the Bold Mark */
export const toggleBoldCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new ToggleBoldDocumentUpdate().update(state, state.tr), dispatch);
export class ToggleBoldDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  /**
   * modify the given Transaction such that the Bold Mark
   * is toggled and return it
   */
  public update(editorState: EditorState, tr: Transaction) {
    const updatedTr = new ToggleOrSetMarkDocumentUpdate(editorState.schema.marks[MarkName.BOLD]).update(editorState, tr);
    return updatedTr/*updated*/;
  }
}
