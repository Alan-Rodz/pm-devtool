import { Slice } from 'prosemirror-model';
import { NodeSelection, Plugin, PluginKey, Selection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { createMarkHolderNode, getNodesAffectedByStepMap, isMarkHolderNode, markFromJSONMark, parseStringifiedMarksArray, stringifyMarksArray, AttributeType, NodeName } from 'common';

import { NoPluginState } from 'notebookEditor/model';

import { parseStoredMarks } from './util';

// == Constant ====================================================================
// the Inclusion Set of Nodes that must maintain marks after their Content was
// deleted, if any marks were active when said Content was deleted
const blockNodesThatPreserveMarks = new Set([NodeName.HEADING, NodeName.PARAGRAPH]);

// == Plugin ======================================================================
export const markHolderPlugin = () => new Plugin({
  // -- Definition ----------------------------------------------------------------
  key: new PluginKey<NoPluginState>('markHolderPluginKey'),

  // -- Transaction ---------------------------------------------------------------
  // when a BlockNode that must preserve Marks (SEE: blockNodesThatPreserveMarks Set
  // above) gets its Content removed but the Node is not deleted (i.e., the
  // Content's length was greater than zero and now its -exactly- zero), and there
  // were activeMarks, insert a MarkHolder Node that contains the respective Marks
  appendTransaction(transactions, oldState, newState) {
    if(newState.doc === oldState.doc) return/*no changes*/;
    const { tr } = newState;

    // do not allow cursor to be set behind a MarkHolder
    // NOTE: (this case is handled in the keyDown handler when Enter is pressed for
    //       expected behavior, i.e. inserting a Paragraph) above
    // SEE:  handleKeyDown below
    const nodeAfterPos = newState.doc.nodeAt(newState.selection.anchor);
    if(nodeAfterPos && isMarkHolderNode(nodeAfterPos)) {
      tr.setSelection(new TextSelection(tr.doc.resolve(newState.selection.anchor + 1)));
    } /* else -- no need to modify selection */

   // NOTE: this Transaction has to step through all stepMaps without leaving
    //       early since any of them can leave a Block Node of the inclusion
    //       Set empty, and none should be missed, regardless of whether or not
    //       they had Content before (i.e. what matters is that there are Marks
    //       to store in the MarkHolder)
    for(let i=0;i<transactions.length;i++) {
      const { maps } = transactions[i].mapping;

      // iterate over all maps in the Transaction
      for(let stepMapIndex=0; stepMapIndex<maps.length; stepMapIndex++) {
        // (SEE: NOTE above)
        maps[stepMapIndex].forEach((unmappedOldStart, unmappedOldEnd) => {
          const { newNodePositions } = getNodesAffectedByStepMap(transactions[i], stepMapIndex, unmappedOldStart, unmappedOldEnd, blockNodesThatPreserveMarks);
          const { storedMarks } = transactions[i];

          // ensure no MarkHolders ever get pasted or set in places they should not be
          for(let newNPIndex=0; newNPIndex<newNodePositions.length; newNPIndex++) {
            const nodeContentSize = newNodePositions[newNPIndex].node.content.size;
            newNodePositions[newNPIndex].node.content.forEach((descendant, offsetIntoParent) => {
              if(
                  // if there are any MarkHolders in the middle of a Block
                  (isMarkHolderNode(descendant)
                  && nodeContentSize > 1 /*more than one child*/
                  && offsetIntoParent !== 0 /*MarkHolder is not the first one*/)
                  ||
                  // if there are any MarkHolders at the start of a non-empty Block
                  (isMarkHolderNode(descendant)
                  && nodeContentSize > 1 /*more than one child*/)
              ) {
                tr.setSelection(NodeSelection.create(tr.doc, (newNodePositions[newNPIndex].position+1/*inside the parent*/) + offsetIntoParent))
                  .deleteSelection();
              }
            });
          }

          // check if any legitimate MarkHolders must be added
          for(let newNPIndex=0; newNPIndex<newNodePositions.length; newNPIndex++) {
            if(newNodePositions[newNPIndex].node.content.size > 0/*has content*/ || !storedMarks /*no storedMarks*/) continue/*nothing to do*/;

            tr.insert(newNodePositions[newNPIndex].position + 1/*inside the parent*/, createMarkHolderNode(newState.schema, { storedMarks: stringifyMarksArray(storedMarks) }));
          }
        });
      }
    }
    return tr;
  },

  // -- Props ---------------------------------------------------------------------
  props: {
    // .. Handler .................................................................
    // when the User types something and the cursor is currently past a MarkHolder,
    // delete the MarkHolder and ensure the User's input gets the MarkHolder marks
    // applied to it
    handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
      const { dispatch, tr, posBeforeAnchorPos } = getUtilsFromView(view);

      // since default PM Backspace behavior is different depending on whether
      // the Block-level NodeBefore of the Selection has content or not,
      // and since MarkHolders should mimic 'empty content', if a BackSpace
      // occurs and the TextBlock Node before it only has a MarkHolder as its
      // content, remove it (effectively setting up the conditions
      // for default behavior) and let PM handle the default behavior.
      // This is the first checked condition since it does not deal with the
      // behavior of the MarkHolder, but rather being consistent with
      // the default behavior of PM Block Nodes
      if(event.key === 'Backspace' && (posBeforeAnchorPos-1/*parent at the previous block level*/ > 0/*not at the start of the doc*/)) {
          const posInsidePrevBlockNode = tr.doc.resolve(posBeforeAnchorPos-1/*Node before the current parent, block-level wise*/);
          const { parent: previousNodeParent } = posInsidePrevBlockNode;

          if(previousNodeParent.isTextblock && previousNodeParent.content.size === 1/*sanity check, only 1 child*/ &&  previousNodeParent.firstChild && isMarkHolderNode(previousNodeParent.firstChild) ) {
            tr.setSelection(new NodeSelection(tr.doc.resolve(posInsidePrevBlockNode.pos - posInsidePrevBlockNode.parentOffset - 1/*select the whole previous parent*/)))
              .replaceSelectionWith(previousNodeParent.copy());
            dispatch(tr);

            return false/*let PM handle the rest of the event*/;
          } /* else -- previous Node is not a TextBlock or its first child is not a MarkHolder, do nothing */
      } /* else -- not handling a Backspace or not a valid position to do the check */

      const markHolder = view.state.doc.nodeAt(posBeforeAnchorPos);
      if(!markHolder || !isMarkHolderNode(markHolder)) return false/*let PM handle the event*/;
        const markHolderParentPos = Math.max(0/*don't go outside limits*/, posBeforeAnchorPos - 1)/*by contract --  MarkHolder gets inserted at start of parent Node*/;

      // when pressing ArrowLeft, ensure expected behavior by setting the selection
      // behind the MarkHolder (manually) and then letting PM handle the event.
      // This only has to be done for ArrowLeft since Cursor is maintained past the
      // MarkHolder (i.e. to its right) by default.
      // (SEE: appendedTransaction above).
      if(event.key === 'ArrowLeft' && (posBeforeAnchorPos > 1/*not pressing ArrowLeft at the start of the document*/)) {
        const posBeforeMarkHolder = Math.max(0/*don't go outside limits*/, posBeforeAnchorPos - 1);
        tr.setSelection(new TextSelection(tr.doc.resolve(posBeforeMarkHolder), tr.doc.resolve(posBeforeMarkHolder)));
        dispatch(tr);
        return false/*PM handles default selection*/;
      } /* else -- not handling ArrowLeft */

      // if Backspace is pressed and a MarkHolder is present, delete it along
      // with its parent, and set the Selection accordingly
      if(event.key === 'Backspace') {
        tr.setSelection(NodeSelection.create(tr.doc, markHolderParentPos))
          .deleteSelection()
          .setSelection(Selection.near(tr.doc.resolve(tr.selection.anchor)));
        dispatch(tr);
        return true/*event handled*/;
      } /* else -- not handling Backspace */

      // NOTE: events that involve these keys are left to PM to handle. The only
      //       special case is a Paste operation, which is handled below
      //       (SEE: handlePaste, transformPasted)
      if(event.ctrlKey || event.altKey || event.metaKey || event.key.length > 1) {
        return false/*do not handle event*/;
      } /* else -- handle event */

      // Apply the stored marks to the current selection
      const stringifiedMarksArray = markHolder.attrs[AttributeType.StoredMarks];
      if(!stringifiedMarksArray) return false/*nothing to do, do not handle event*/;

      // Range to insert text and marks
      const from = tr.doc.resolve(posBeforeAnchorPos).pos,
            to = tr.doc.resolve(posBeforeAnchorPos + markHolder.nodeSize).pos;

      // Create marks from the stored marks attribute
      const marks = parseStringifiedMarksArray(stringifiedMarksArray).map(jsonMark => markFromJSONMark(view.state.schema, jsonMark));

      // Insert the text and apply every stored mark into it
      tr.insertText(event.key, from, to);
      marks.forEach(mark => tr.addMark(from, to + 1/*exclusive selection -- add one to wrap whole text*/, mark));

      dispatch(tr);
      return true/*event handled*/;
    },

    // ............................................................................
    // when the User pastes something and the cursor is currently past a MarkHolder,
    // delete the MarkHolder and ensure the pasted slice gets the MarkHolder marks
    // applied to it
    handlePaste: (view: EditorView, event: ClipboardEvent, slice: Slice) => {
      const { dispatch, tr, posBeforeAnchorPos } = getUtilsFromView(view),
            markHolder = view.state.doc.nodeAt(posBeforeAnchorPos);
      if(!markHolder || !isMarkHolderNode(markHolder)) return false/*let PM handle the event*/;

      const storedMarks = markHolder.attrs[AttributeType.StoredMarks];
      if(!storedMarks) return false/*nothing to do, do not handle event*/;

      tr.setSelection(new TextSelection(tr.doc.resolve(posBeforeAnchorPos), tr.doc.resolve(posBeforeAnchorPos + markHolder.nodeSize)))
        .replaceSelection(slice);
      parseStoredMarks(view.state.schema, storedMarks).forEach(storedMark => tr.addMark(posBeforeAnchorPos, posBeforeAnchorPos + slice.size, storedMark));
      dispatch(tr);
      return true/*event handled*/;
    },
  },
});

// == Util ========================================================================
// Utility function to return dispatch, tr and pos in the same object
const getUtilsFromView = (view: EditorView) => {
  const { dispatch } = view;
  const { tr } = view.state;
  const posBeforeAnchorPos = Math.max(0/*don't go outside limits*/, view.state.selection.anchor - 1)/*selection will be past the MarkHolder*/;

  return { dispatch, tr, posBeforeAnchorPos };
};
