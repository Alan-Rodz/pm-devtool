import { Command, EditorState, Transaction } from 'prosemirror-state';

import { AbstractDocumentUpdate, MarkName } from 'common';

import { ToggleOrSetMarkDocumentUpdate } from '../markHolder/command';

// ********************************************************************************
/** toggle the Italic Mark */
export const toggleItalicCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new ToggleItalicDocumentUpdate(), state, dispatch);
export class ToggleItalicDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  /**
   * modify the given Transaction such that the Italic Mark
   * is toggled and return it
   */
  public update(editorState: EditorState, tr: Transaction) {
    const updatedTr = new ToggleOrSetMarkDocumentUpdate(editorState.schema.marks[MarkName.ITALIC]).update(editorState, tr);
    return updatedTr/*updated*/;
  }
}
