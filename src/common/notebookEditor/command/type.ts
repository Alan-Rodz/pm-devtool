import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

// ********************************************************************************
// TODO: create applyDocumentUpdates for cloud-functions and use
//       AbstractDocumentUpdates as needed

// == Constant ====================================================================
// constant for the Metadata key name to use whenever a Transaction should not have
// its effects be undo-able by an Undo Command. (SEE: History.ts)
export const HISTORY_META = 'addToHistory';

// == Command =====================================================================
// Commands are meant to be atomic (i.e. they "encapsulate functionality"). The
// Transaction dispatched by a Command goes through one DocumentUpdate. Multiple
// DocumentUpdates can be executed in a single operation through the
// applyDocumentUpdates method (SEE: web/src/command/update.ts)
export type Command = (state: EditorState, dispatch: (tr: Transaction) => void | undefined/*not given by caller*/, view?: EditorView)
  => boolean/*indicates whether the command can be performed*/;

// == Update ======================================================================
// A DocumentUpdate encapsulates the individual modifications that a Transaction
// goes through. DocumentUpdates can be performed once in a single operation
// through a Command, or their functionality can be chained into a single operation
// through the applyDocumentUpdates method (SEE: web/src/command/update.ts)
export type DocumentUpdate = Readonly<{
  /** modifies the specified ProseMirror Document */
  update: (editorState: EditorState, tr: Transaction, view?: EditorView) => UpdateResult;
}>;

// AbstractDocumentUpdates provide an unified interface that can be used by the
// server and the client, while at the same time allowing Commands to maintain
// their 'single operation' semantics
export abstract class AbstractDocumentUpdate implements DocumentUpdate {
  /** returns the modified Transaction so that it can be dispatched by Commands */
  public abstract update(editorState: EditorState, tr: Transaction, view?: EditorView): UpdateResult;

  /**
   * receive an updated {@link Transaction} and return whether it was
   * successfully executed
   */
  public static execute(updatedTr: Transaction | false/*could not update Transaction*/, dispatch?: (tr: Transaction) => void | undefined/*not given by caller*/) {
    if(updatedTr && dispatch) {
      dispatch(updatedTr);
      return true/*Command executed*/;
    } /* else -- Command cannot be executed */

    return false/*not executed*/;
  }
}

// allow maintaining ProseMirror Command 'return' semantics. Whenever a Command or
// DocumentUpdate is allowed to proceed, the updated Transaction is returned.
// Otherwise, false is returned, like regular PM Commands
type UpdateResult = Transaction | false;
