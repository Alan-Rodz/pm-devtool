import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { AbstractDocumentUpdate } from 'common';

// ********************************************************************************
/**
 * Performs the functionality of the given {@link AbstractDocumentUpdate}s
 * by merging the EditorState produced after applying each of their Transaction
 * modifications, resulting in their effect being combined as a single operation
 * through the History
 */
export const applyDocumentUpdates = (startingState: EditorState, documentUpdates: AbstractDocumentUpdate[], view: EditorView): boolean => {
  let currentState = startingState/*default*/;

  for(let i=0; i<documentUpdates.length; i++) {
    // get the Transaction resulting from applying the DocumentUpdate
    // to the current EditorState
    const newTr = documentUpdates[i].update(currentState, currentState.tr);

    // either all DocumentUpdates are valid and applied, or none of them are applied
    if(!newTr) {
      return false/*at least one update failed*/;
    } /* else -- valid update */

    // apply the Transaction to the current EditorState to produce a new one
    currentState = currentState.apply(newTr);
  }

  // update the View with the final EditorState, after all DocumentUpdates have
  // been applied, resulting in a single change for the History
  view.updateState(currentState);
  return true/*updates applied*/;
};
