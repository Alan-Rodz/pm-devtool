import { ChainedCommands, Editor } from '@tiptap/core';
import { Mark, MarkType } from 'prosemirror-model';
import { Selection, TextSelection } from 'prosemirror-state';

import { createMarkHolderNode, getMarkName, isMarkHolderNode, AttributeType, JSONMark, JSONNode, MarkHolderNodeType, MarkName, SchemaV1 } from 'common';

// ********************************************************************************
// creates a MarkHolder Node holding the Marks corresponding to the given MarkNames
export const createMarkHolderJSONNode = (editor: Editor, markNames: MarkName[]): JSONNode => {
  const storedMarks = markNames.map(markName => editor.schema.marks[markName].create());
  const markHolder = createMarkHolderNode(editor.schema, { storedMarks: JSON.stringify(storedMarks) });

  return markHolder.toJSON() as JSONNode;
};

/**
 * Checks to see whether or not the first child of the parent of the current Editor
 * {@link Selection} is a MarkHolderNode. It returns it if it is, and otherwise it
 * returns false
 */
export const getMarkHolder = (editor: Editor) => {
  const { firstChild } = editor.state.selection.$anchor.parent;
  if(firstChild && isMarkHolderNode(firstChild)) return firstChild;
  /* else -- firstChild does not exist or is not a MarkHolder */

  return undefined/*not found*/;
};

/** Toggles a mark in the mark holder. This should be used when a mark is added to
 *  an empty node. */
export const toggleMarkInMarkHolder = (selection: Selection, chain: () => ChainedCommands, markHolder: MarkHolderNodeType, appliedMarkType: MarkType) => {
  let newMarksArray: Mark[] = [];
  const storedMarks  = markHolder.attrs[AttributeType.StoredMarks];
  if(!storedMarks) return false/*nothing to do*/;

  if(parseStoredMarks(storedMarks).some(mark => getMarkName(mark) === appliedMarkType.name)) {
    // already included, remove it
    newMarksArray = [...parseStoredMarks(storedMarks).filter(mark => getMarkName(mark) !== appliedMarkType.name)];
  } else {
    // not included yet, add it
    newMarksArray = [...parseStoredMarks(storedMarks), appliedMarkType.create()];
  }

  return chain().focus().command((props) => {
    const { dispatch, tr } = props;
    if(!selection.$anchor.parent.isBlock) return false/*command cannot be executed, Selection parent is not a Block Node*/;

    const startOfParentNodePos = tr.doc.resolve(selection.$anchor.pos - selection.$anchor.parentOffset);
    const { pos: startingPos } = tr.selection.$anchor;
    if(dispatch) {
      tr.setSelection(new TextSelection(startOfParentNodePos, tr.doc.resolve(startOfParentNodePos.pos + markHolder.nodeSize)))
        .setNodeMarkup(tr.selection.$anchor.pos, undefined/*maintain type*/, { storedMarks: JSON.stringify(newMarksArray) })
        .setSelection(new TextSelection(tr.doc.resolve(startingPos)));
      dispatch(tr);
    } /* else -- called from can() (SEE: src/notebookEditor/README.md/#Commands) */

    return true/*command can be executed*/;
  }).run();
};

/** Checks if a MarkHolder contains a given Mark in its storedMarks attribute */
export const inMarkHolder = (editor: Editor, markName: MarkName) => {
  const markHolder = getMarkHolder(editor);
  if(!markHolder) return false/*MarkHolder is not present*/;

  const storedMarks = markHolder.attrs[AttributeType.StoredMarks];
  if(!storedMarks) return false/*no stored Marks, false by definition*/;

  return parseStoredMarks(storedMarks).some(mark => getMarkName(mark) === markName);
};

/** Parses the stringified array of Marks and returns it as a {@link Mark} array*/
export const parseStoredMarks = (stringifiedStoredMarks: string) => {
  const JSONMarks = JSON.parse(stringifiedStoredMarks) as JSONMark[]/*by contract*/;
  const storedMarks = JSONMarks.map(markName => Mark.fromJSON(SchemaV1, markName));

  return storedMarks;
};
