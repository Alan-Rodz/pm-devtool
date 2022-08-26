import { ParseOptions } from 'prosemirror-model';
import { Selection, Transaction } from 'prosemirror-state';
import { ReplaceStep, ReplaceAroundStep } from 'prosemirror-transform';

import { Command, JSONNode, SelectionRange } from 'common';

import { createNodeFromContent, isFragment } from 'notebookEditor/extension/util/node';

// ********************************************************************************
// -- Insertion -------------------------------------------------------------------
type InsertContentAtOptions = {
  parseOptions?: ParseOptions;
  updateSelection?: boolean;
}
// NOTE: this Command is limited to Web since the content that gets inserted must
//       might be a string that gets parsed and converted into an HTMLElement,
export const insertContentAtCommand = (selectionRange: SelectionRange, value: string | JSONNode | JSONNode[], options?: InsertContentAtOptions): Command => (state, dispatch) => {
  options = { parseOptions: {/*default none*/}, updateSelection: true, ...options };
  const content = createNodeFromContent(state.schema, value, { parseOptions: { preserveWhitespace: 'full', ...options.parseOptions } });

  // don’t dispatch an empty fragment, prevent errors
  if(content.toString() === '<>') {
    return false/*Command not executed*/;
  } /* else -- valid Fragment */

  let isOnlyTextContent = true/*default*/;
  let isOnlyBlockContent = true/*default*/;
  const nodes = isFragment(content) ? content : [content];
  nodes.forEach(node => {
    node.check()/*check content is valid*/;

    if(node.isText && node.marks.length === 0) {
      isOnlyTextContent = isOnlyTextContent;
    } else {
      isOnlyTextContent = false;
    }

    if(node.isBlock) {
      isOnlyBlockContent = true;
    } else {
      isOnlyBlockContent = false;
    }
  });

  // check if wrapping Node can be replaced entirely
  const { tr } = state;
  let { from, to } = selectionRange;
  if(from === to && isOnlyBlockContent) {
    const { parent } = tr.doc.resolve(from);
    const isEmptyTextBlock = parent.isTextblock
      && !parent.type.spec.code
      && !parent.childCount;

    if(isEmptyTextBlock) {
      from -= 1;
      to += 1;
    }
  }

  // if there is only plain text we have to use `insertText`
  // because this will keep the current marks
  if(isOnlyTextContent && typeof value === 'string'/*for sanity*/) {
    tr.insertText(value, from, to);
  } else {
    tr.replaceWith(from, to, content);
  }

  // set cursor at end of inserted content
  if(options.updateSelection) {
    setTransactionSelectionToInsertionEnd(tr, tr.steps.length - 1, -1);
  } /* else -- do not update Selection */

  dispatch(tr);
  return true/*Command executed*/;
};

// --------------------------------------------------------------------------------
// REF: https://github.com/ProseMirror/prosemirror-state/blob/4faf6a1dcf45747e6d7cefd7e934759f3fa5b0d0/src/selection.ts
/**
 * Set the Selection of a Transaction to the end of its
 * inserted Content, if it inserted Content
 */
const setTransactionSelectionToInsertionEnd = (tr: Transaction, startingStepLength: number, bias: number) => {
  const lastStepIndex = tr.steps.length - 1;
  if(lastStepIndex < startingStepLength) {
    return/*nothing to do*/;
  } /* else -- valid index */

  const lastStep = tr.steps[lastStepIndex];
  if(!(lastStep instanceof ReplaceStep || lastStep instanceof ReplaceAroundStep)) {
    return/*nothing tod o*/;
  } /* else -- last Step inserted or replaced Content*/

  // set end to the immediate newTo of the last Mapping
  const lastMap = tr.mapping.maps[lastStepIndex];
  let end = 0/*default*/;
  lastMap.forEach((from, to, newFrom, newTo) => end = newTo);

  tr.setSelection(Selection.near(tr.doc.resolve(end), bias));
};
