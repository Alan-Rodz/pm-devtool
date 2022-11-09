import { EditorState, NodeSelection, Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { RemoveMarkStep } from 'prosemirror-transform';

import { combineTransactionSteps, getChangedRanges, isNestedViewBlockNode, isNestedViewNode, isTextSelection } from 'common';

// ********************************************************************************
/**
 * Plugin used to store information that is used by NestedNodeView Nodes
 * to determine where to place the cursor when expanding themselves
 * without overriding the default arrow key behavior
 */
// == Constant ====================================================================
export const nestedViewNodePluginKey = new PluginKey<NestedViewNodePluginState>('nestedViewNodePluginKey');

// == Class =======================================================================
export class NestedViewNodePluginState {
  constructor(
    // NOTE: this is needed since an inline NestedViewNode may be a valid
    //       TextSelection and NodeSelection at the same time, yet the NestedView
    //       will only open when set as a NodeSelection by contract
    // the position of the Cursor on the previous state to the previous state of the Editor
    public prevprevCursorPos: number,

    // the position of the Cursor on the previous state of the Editor
    public prevCursorPos: number
  ) {/*nothing additional*/}

  // produce a new Plugin state
  public apply = (tr: Transaction, thisPluginState: NestedViewNodePluginState, oldEditorState: EditorState, newEditorState: EditorState) => {
    this.prevprevCursorPos = this.prevCursorPos;
    this.prevCursorPos = oldEditorState.selection.from;
    return this/*state updated*/;
  };
}

// == Plugin ======================================================================
export const nestedViewNodePlugin = () => {
  const nestedViewNodePlugin = new Plugin<NestedViewNodePluginState>({
    // -- Setup -------------------------------------------------------------------
    key: nestedViewNodePluginKey,

    // -- State -------------------------------------------------------------------
    state: {
      // initialize the plugin state
      init: (_, state) => new NestedViewNodePluginState(0/*default*/, 0/*default*/),

      // apply changes to the plugin state from a view transaction
      apply: (transaction, thisPluginState, oldState, newState) => thisPluginState.apply(transaction, thisPluginState, oldState, newState),
    },

    appendTransaction(transactions, oldState, newState) {
      const { tr, selection } = newState;
      const { parent } = selection.$anchor;

      // ensure that a TextSelection inside a LatexBlock always
      // selects that Node, making its inner View render
      if(isTextSelection(selection) && isNestedViewBlockNode(parent)) {
        tr.setSelection(NodeSelection.create(tr.doc, selection.$from.pos - selection.$from.parentOffset - 1/*inside the Node*/));
      } /* else -- ensure there are no Marks in inline NestedViewNodes */

      // since some NestedViewNodes may be inline Nodes, and there is no
      // way to exclude Marks from Nodes themselves, only their content
      // (SEE: REF above), check the changed ranges
      const transform = combineTransactionSteps(oldState.doc, [...transactions]),
            changes = getChangedRanges(transform);
      changes.forEach(({ newRange }) => {
        newState.doc.nodesBetween(newRange.from, newRange.to, (node, pos) => {
          if(isNestedViewNode(node) && node.marks.length > 0) {
            for(let i=0; i<node.mark.length; i++) {
              tr.step(new RemoveMarkStep(pos, pos+node.nodeSize, node.marks[i]));
            } /* else -- not a NestedViewNode, do nothing */
          }
        });
      });

      return tr/*do not append Transaction*/;
    },
  });

  return nestedViewNodePlugin;
};
