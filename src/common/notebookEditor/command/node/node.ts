import { Fragment, NodeType, Slice } from 'prosemirror-model';
import { Command, EditorState, NodeSelection, Selection, TextSelection, Transaction } from 'prosemirror-state';
import { canSplit, findWrapping, liftTarget, replaceStep, ReplaceStep } from 'prosemirror-transform';
import { EditorView } from 'prosemirror-view';

import { isBlank } from '../../../util';
import { Attributes } from '../../attribute';
import { isMarkHolderNode } from '../../extension/markHolder';
import { isTextNode } from '../../extension/text';
import { isNodeActive, NodeName } from '../../node';
import { isGapCursorSelection, isNodeSelection, isTextSelection } from '../../selection';
import { AbstractDocumentUpdate } from '../type';
import { defaultBlockAt, deleteBarrier, findCutAfter, findCutBefore, textblockAt } from '../util';

// ********************************************************************************
// -- Create ----------------------------------------------------------------------
/** Creates a Block Node below the current Selection */
export const createBlockNodeCommand = (blockNodeName: NodeName, attributes: Partial<Attributes>): Command => (state, dispatch) =>
  AbstractDocumentUpdate.execute(new CreateBlockNodeDocumentUpdate(blockNodeName, attributes), state, dispatch);
export class CreateBlockNodeDocumentUpdate implements AbstractDocumentUpdate {
  public constructor(private readonly blockNodeName: NodeName, private readonly attributes: Partial<Attributes>) {/*nothing additional*/ }

  /*
   * modify the given Transaction such that a Bloc Node is created
   * below the current Selection
   */
  public update(editorState: EditorState, tr: Transaction) {
    const { schema } = editorState;
    if(isGapCursorSelection(tr.selection)) return false/*do not allow creation when selection is GapCursor*/;

    const { $anchor, $head } = tr.selection;
    const blockNodeType = schema.nodes[this.blockNodeName];

    // if the current Block and the Selection are both empty
    // (or only a MarkHolder is present), replace the
    // parent Block with the desired Block
    const { content, firstChild } = $anchor.parent;
    const { size: contentSize } = content;

    let onlyContainsEmptyTextNodes = true/*default*/;
    $anchor.parent.content.forEach(child => {
      if(!isTextNode(child) || !isBlank(child.textContent)) {
        onlyContainsEmptyTextNodes = false;
      } /* else -- do not change default */
    });

    if(tr.selection.empty/*empty implies parent($anchor) === parent($head)*/
      && (contentSize < 1/*parent has no content*/
        || onlyContainsEmptyTextNodes/*the content is only white space and there are no atom nodes*/
        || contentSize === 1 && firstChild && isMarkHolderNode(firstChild)/*parent only has a MarkHolder*/)
    ) {
      const parentBlockRange = $anchor.blockRange($anchor);
      if(!parentBlockRange) return false/*no parent Block Range*/;

      const { $from, $to } = parentBlockRange;
      tr.setBlockType($from.pos, $to.pos, blockNodeType, this.attributes)
        .setSelection(Selection.near(tr.doc.resolve($to.pos - 1/*inside the new Block*/)));

      return tr/*nothing left to do*/;
    } /* else -- not the same parent (multiple Selection) or content not empty, insert Block below */

    const above = $head.node(-1/*document level*/),
          after = $head.indexAfter(-1/*document level*/);

    if(!blockNodeType || !above.canReplaceWith(after, after, blockNodeType)) return false/*cannot replace Node above*/;

    const creationPos = $head.after();
    const newBlockNode = blockNodeType.createAndFill(this.attributes);
    if(!newBlockNode) return false/*no valid wrapping was found*/;

    tr.replaceWith(creationPos, creationPos, newBlockNode)
      .setSelection(Selection.near(tr.doc.resolve(creationPos + 1/*inside the new Block*/), 1/*look forwards first*/));

    return tr/*updated*/;
  }
}

// -- Clear -----------------------------------------------------------------------
/** clear the Nodes in the current Block */
export const clearNodesCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new ClearNodesDocumentUpdate(), state, dispatch);
export class ClearNodesDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  // NOTE: this is inspired by https://github.com/ueberdosis/tiptap/blob/8c6751f0c638effb22110b62b40a1632ea6867c9/packages/core/src/commands/clearNodes.ts
  /**
   * update the given Transaction such that the Nodes in
   * the current Block are cleared
   */
  public update(editorState: EditorState, tr: Transaction) {
    const { selection } = tr;
    const { ranges } = selection;

    ranges.forEach(({ $from, $to }) => {
      editorState.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
        if(node.type.isText) {
          return/*nothing to do, keep descending*/;
        } /* else -- not a Text Node */

        const { doc, mapping } = tr;
        const $mappedFrom = doc.resolve(mapping.map(pos));
        const $mappedTo = doc.resolve(mapping.map(pos + node.nodeSize));
        const nodeRange = $mappedFrom.blockRange($mappedTo);

        if(!nodeRange) {
          return/*valid Block Range not found*/;
        } /* else -- clear Nodes to default Block type by Lifting */

        const targetLiftDepth = liftTarget(nodeRange);
        if(node.type.isTextblock) {
          const { defaultType } = $mappedFrom.parent.contentMatchAt($mappedFrom.index());
          tr.setNodeMarkup(nodeRange.start, defaultType);
        } /* else -- default Block is not a TextBlock, just try to lift */

        if(targetLiftDepth || targetLiftDepth === 0/*top level of the Document*/) {
          tr.lift(nodeRange, targetLiftDepth);
        } /* else -- do not lift */
      });
    });

    return tr/*updated*/;
  }
}

// -- Insert ----------------------------------------------------------------------
// replace the Selection with a newline character. Must be set for Block Nodes
// whose behavior should match the one provided by specifying 'code' in the
// NodeSpec, without the need of declaring it, thus getting rid of the ProseMirror
// induced constraints that come with it (e.g. not being able to paste Marks)
export const insertNewlineCommand = (nodeName: NodeName): Command => (state, dispatch) =>
  AbstractDocumentUpdate.execute(new InsertNewlineDocumentUpdate(nodeName), state, dispatch);
export class InsertNewlineDocumentUpdate implements AbstractDocumentUpdate {
  public constructor(private readonly nodeName: NodeName) {/*nothing additional*/}

  /*
   * modify the given Transaction such that the Selection is replaced with a
   * newline character
   */
  public update(editorState: EditorState, tr: Transaction) {
    let { $head, $anchor } = editorState.selection;
    if(!$head.sameParent($anchor)) return false/*do not allow on multiple Node Selection*/;
    if($head.parent.type.name !== this.nodeName) return false/*should not be handled by this Node*/;

    tr.insertText('\n').scrollIntoView();
    return tr;
  }
}

// -- Leave -----------------------------------------------------------------------
// NOTE: this is inspired by https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L246
// create a default Block Node after the one at the current Selection and
// move the cursor there
export const leaveBlockNodeCommand = (nodeName: NodeName): Command => (state, dispatch) =>
  AbstractDocumentUpdate.execute(new LeaveBlockNodeDocumentUpdate(nodeName), state, dispatch);
export class LeaveBlockNodeDocumentUpdate implements AbstractDocumentUpdate {
  public constructor(private readonly nodeName: NodeName) {/*nothing additional*/ }

  /*
   * modify the given Transaction such that a default Block Node is created
   * after the one at the current Selection and the cursor is moved there
   */
  public update(editorState: EditorState, tr: Transaction) {
    const { $head, $anchor } = editorState.selection;
    if(!$head.sameParent($anchor)) return false/*Selection spans multiple Blocks*/;
    if(!($head.parent.type.name === this.nodeName)) return false/*this Node should not handle the call*/;

    const grandParentOfHead = $head.node(-1/*grandParent*/),
          indexAfterGrandParentOfHead = $head.indexAfter(-1/*grandParent depth*/);
    const defaultBlockType = defaultBlockAt(grandParentOfHead.contentMatchAt(indexAfterGrandParentOfHead));

    if(!defaultBlockType) return false/*no valid type was found*/;
    if(!grandParentOfHead.canReplaceWith(indexAfterGrandParentOfHead, indexAfterGrandParentOfHead, defaultBlockType)) return false/*invalid replacement*/;

    const newBlockNode = defaultBlockType.createAndFill();
    if(!newBlockNode) return false/*no valid wrapping was found*/;

    const posAfterReplacement = $head.after();
    tr.replaceWith(posAfterReplacement, posAfterReplacement, newBlockNode)
      .setSelection(Selection.near(tr.doc.resolve(posAfterReplacement), 1/*look forwards first*/))
      .scrollIntoView();

    return tr/*updated*/;
  }
}

// -- Split -----------------------------------------------------------------------
// split the Block at the Selection
export const splitBlockCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new SplitBlockDocumentUpdate(), state, dispatch);
export class SplitBlockDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  // NOTE: this is inspired by https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L295
  /**
   * modify the given Transaction such that the Block at
   * the current Selection is split
   */
  public update(editorState: EditorState, tr: Transaction) {
    const selectionReference = editorState.selection;
    const { $from, $to } = selectionReference;

    if(isNodeSelection(editorState.selection) && editorState.selection.node.isBlock) {
      if(!$from.parentOffset || !canSplit(editorState.doc, $from.pos)) {
        return false/*cannot split*/;
      } /* else -- no offset into $from's parent or can split Node */

      tr.split($from.pos).scrollIntoView();
      return tr/*updated*/;
    } /* else -- not splitting a Block Node Selection */

    if(!$from.parent.isBlock) {
      return false/*cannot split a non- Block Node*/;
    } /* else -- try to split */

    // create a default Block if no content in the parent or when at the end of the parent
    let needToCreateDefaultBlock = false/*default*/;
    if($from.parent.type === editorState.doc.type.contentMatch.defaultType) {
      if(!$from.parent.textContent) {
        needToCreateDefaultBlock = true;
      } /* else -- the parent has content, do not change default */
    } else {
      if($to.parentOffset === $to.parent.content.size/*at the end of the parent's content*/) {
        needToCreateDefaultBlock = true;
      } /* else -- not at the end of the parent's content, no need to create */
    }

    if(isTextSelection(editorState.selection)) {
      tr.deleteSelection();
    } /* else -- not a TextSelection, no need to delete anything */

    let defaultTypeAtDepth = undefined/*default*/;
    if($from.depth !== 0/*not pointing directly at the root node*/) {
      defaultTypeAtDepth = $from.node(-1/*grand parent*/).contentMatchAt($from.indexAfter(-1/*grand parent depth*/)).defaultType;
    } /* else -- pointing directly at the root node */

    let typesAfterSplit = undefined/*default*/;
    if(needToCreateDefaultBlock && defaultTypeAtDepth) {
      typesAfterSplit = [{ type: defaultTypeAtDepth }];
    } /* else -- keep default */

    // check if canSplit with the types from above
    let canPerformSplit = canSplit(tr.doc, tr.mapping.map($from.pos), 1/*direct child of Doc depth*/, typesAfterSplit);

    // check if canSplit with defaultTypeAtDepth
    if(!typesAfterSplit /*could not split with the types from above*/
        && !canPerformSplit /*could not split with the types from above*/
        && defaultTypeAtDepth /*there exist a default type at this depth*/
        && canSplit(tr.doc, tr.mapping.map($from.pos), 1/*direct child of Doc depth*/, [{ type: defaultTypeAtDepth }]) /*can perform split*/
      ) {
      typesAfterSplit = [{ type: defaultTypeAtDepth }];
      canPerformSplit = true;
    }

    if(canPerformSplit && defaultTypeAtDepth) {
      tr.split(tr.mapping.map($from.pos), 1/*depth*/, typesAfterSplit);

      if(!needToCreateDefaultBlock
        && !$from.parentOffset/*parent has no content*/
        && $from.parent.type !== defaultTypeAtDepth
        && $from.node(-1/*grandParent*/).canReplace($from.index(-1), $from.indexAfter(-1), Fragment.from(defaultTypeAtDepth.create()))
      ) {
        tr.setNodeMarkup(tr.mapping.map($from.before()), defaultTypeAtDepth);
      }
    } /* else -- cannot perform split or there is no default type at depth */

    tr.scrollIntoView();
    return tr/*updated*/;
  }
}

/** split the Block at the Selection keeping active Marks */
export const splitBlockKeepMarksCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new SplitBlockKeepMarksDocumentUpdate(), state, dispatch);
export class SplitBlockKeepMarksDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  /**
   * modify the given Transaction such that the Block at
   * the current Selection is split and the Marks are kept
   */
  public update(editorState: EditorState, tr: Transaction) {
    const startingMarks = editorState.storedMarks || (editorState.selection.$to.parentOffset && editorState.selection.$from.marks());
    const updatedTr = new SplitBlockDocumentUpdate().update(editorState, tr);

    if(updatedTr) {
      if(startingMarks) {
        updatedTr.ensureMarks(startingMarks);
      } /* else -- there were no Marks before splitting the block */
      return updatedTr;
    } /* else -- return default */

    return false/*default*/;
  }
}

// -- Wrap ------------------------------------------------------------------------
export const toggleWrapCommand = (nodeType: NodeType, attrs: Partial<Attributes>): Command => (state, dispatch) =>
  AbstractDocumentUpdate.execute(new ToggleWrapDocumentUpdate(nodeType, attrs), state, dispatch);
export class ToggleWrapDocumentUpdate implements AbstractDocumentUpdate {
  public constructor(private readonly nodeType: NodeType, private readonly attrs: Partial<Attributes>) {/*nothing additional*/}
  /*
    * modify the given Transaction such that the Selection is wrapped in a Node
    * of the given type with the given Attributes
    */
  public update(editorState: EditorState, tr: Transaction) {
    const nodeActive = isNodeActive(editorState, this.nodeType.name as NodeName/*by definition*/, this.attrs);

    if(nodeActive) {
      return new LiftBlockDocumentUpdate(this.nodeType, this.attrs).update(editorState, editorState.tr);
    } /* else -- wrap */

    return new WrapInDocumentUpdate(this.nodeType, this.attrs).update(editorState, tr);
  }
}

/** wrap the Selection in a Node of the given type with the given Attributes */
export const wrapInCommand = (nodeType: NodeType, attrs: Partial<Attributes>): Command => (state, dispatch) =>
  AbstractDocumentUpdate.execute(new WrapInDocumentUpdate(nodeType, attrs), state, dispatch);
export class WrapInDocumentUpdate implements AbstractDocumentUpdate {
  public constructor(private readonly nodeType: NodeType, private readonly attrs: Partial<Attributes>) {/*nothing additional*/}
  /*
   * modify the given Transaction such that the Selection is wrapped in a Node
   * of the given type with the given Attributes
   */
  public update(editorState: EditorState, tr: Transaction) {
    const { $from, $to } = editorState.selection;

    const range = $from.blockRange($to);
    const wrapping = range && findWrapping(range, this.nodeType, this.attrs);
    if(!wrapping) return false/*no valid wrapping was found*/;

    tr.wrap(range, wrapping).scrollIntoView();

    return tr/*updated*/;
  }
}

// -- Lift ------------------------------------------------------------------------
/**
 * lift the selected block, or the closest ancestor block of the
 * selection that can be lifted, out of its parent Node
 */
export const liftCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new LiftDocumentUpdate(), state, dispatch);
export class LiftDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  // NOTE: this is inspired by https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L217
  /*
   * modify the given Transaction such that the selected Block or
   * the closest ancestor Block of the Selection that can be lifted
   * is lifted out of its parent Node
   */
  public update(editorState: EditorState, tr: Transaction) {
    const { $from, $to } = editorState.selection;
    const blockRange = $from.blockRange($to);

    const targetDepth = blockRange && liftTarget(blockRange);
    if(!blockRange || targetDepth === null) return false/*no depth at which to lift the Block*/;

    tr.lift(blockRange, targetDepth).scrollIntoView();
    return tr/*updated*/;
  }
}

/** lift the selected Block if it is of the given type and has the given attributes */
export const liftBlockNodeCommand = (nodeType: NodeType, attrs: Partial<Attributes>): Command => (state, dispatch) =>
  AbstractDocumentUpdate.execute(new LiftBlockDocumentUpdate(nodeType, attrs), state, dispatch);
export class LiftBlockDocumentUpdate implements AbstractDocumentUpdate {
  public constructor(private readonly nodeType: NodeType, attrs: Partial<Attributes>) {/*nothing additional*/}
  /*
   * modify the given transaction such that the selected Block if it is of the given
   * type and has the given attributes
   */
  public update(editorState: EditorState, tr: Transaction) {
    const nodeActive = isNodeActive(editorState, this.nodeType.name as NodeName/*by definition*/, {/*no attrs*/});
    if(!nodeActive) return false/*specified Node is not present, nothing to lift*/;

    return new LiftDocumentUpdate().update(editorState, tr);
  }
}

// NOTE: this is inspired by https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L277
// If the cursor is in an empty Text Block that can be lifted, lift it.
export const liftEmptyBlockNodeCommand: Command = (state, dispatch) =>
  AbstractDocumentUpdate.execute(new LiftEmptyBlockNodeDocumentUpdate(), state, dispatch);
export class LiftEmptyBlockNodeDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  // NOTE: this is inspired by https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L277
  /*
   * modify the given Transaction such that an empty Block Node is lifted
   * if it exists, and return it
   */
  public update(editorState: EditorState, tr: Transaction) {
    const { $cursor } = editorState.selection as TextSelection/*specifically looking for $cursor*/;
    if(!$cursor || $cursor.parent.content.size) return false/*not a TextSelection or Block is not empty*/;

    if($cursor.depth > 1/*Block is nested*/ && ($cursor.after() !== $cursor.end(-1/*absolute pos of the parent*/))) {
      let posBefore = $cursor.before();
      if(canSplit(editorState.doc, posBefore)) {
        return tr.split(posBefore).scrollIntoView();
      } /* else -- cant split, do nothing */
    } /* else -- could not split */

    const blockRange = $cursor.blockRange();
    const targetDepth = blockRange && liftTarget(blockRange);
    if(!blockRange || targetDepth == null) return false/*no targetDepth Depth to which the Content in Range can be lifted found*/;

    return editorState.tr.lift(blockRange, targetDepth).scrollIntoView()/*updated*/;
  }
}

// -- Join ------------------------------------------------------------------------
// if the Selection is empty and at the start of a Text Block, try to reduce the
// distance between that Block and the one before it if there's a Block directly
// before it that can be joined, by joining them. Otherwise try to move the
// selected Block closer to the next one in the Document structure by lifting
// it out of its parent or moving it into a parent of the previous Block
export const joinBackwardCommand: Command = (state, dispatch, view) =>
  AbstractDocumentUpdate.execute(new JoinBackwardDocumentUpdate(), state, dispatch, view);
export class JoinBackwardDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/}

  // NOTE: this is inspired by https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L21
  /**
   * modify the given Transaction such that the conditions described by the
   * joinBackward Command (SEE: joinBackwardCommand above) hold
   */
  public update(editorState: EditorState, tr: Transaction, view: EditorView | undefined/*not given by the caller*/) {
    const { $cursor } = editorState.selection as TextSelection/*specifically looking for $cursor*/;
    if(!$cursor) return false/*selection is not an empty Text selection*/;
    if(view) {
      const wouldLeaveBlockIfBackward = view.endOfTextblock('backward', editorState);
      if(!wouldLeaveBlockIfBackward || $cursor.parentOffset > 0/*not at the start of the TextBlock*/) {
        return false;
      } /* else -- would leave the parent Text Block if Cursor goes back, or the Cursor is at the start of the parent TextBlock*/
    } /* else -- View not given */

    // if there is no Node before this one, try lifting
    const $cut = findCutBefore($cursor);
    if(!$cut) {
      const cursorBlockRange = $cursor.blockRange();
      const target = cursorBlockRange && liftTarget(cursorBlockRange);
      if(target == null) return false/*no target Depth to which the Content in Range can be lifted found*/;

      return editorState.tr.lift(cursorBlockRange!, target).scrollIntoView();
    } /* else -- a valid $cut position was found */

    const nodeBeforeCut = $cut.nodeBefore!;

    // try to join
    const deleteBarrierUpdatedTr = deleteBarrier(editorState, $cut);
    if(!nodeBeforeCut.type.spec.isolating && deleteBarrierUpdatedTr) {
      return deleteBarrierUpdatedTr;
    } /* else -- isolating nodeBefore or could not join or replace */

    // if the Node below has no content and the node above is
    // selectable, delete the node below and select the one above.
    if($cursor.parent.content.size == 0/*empty*/ && (textblockAt(nodeBeforeCut, 'end') || NodeSelection.isSelectable(nodeBeforeCut))) {
      const deleteStep = replaceStep(editorState.doc, $cursor.before(), $cursor.after(), Slice.empty);
      if(deleteStep && (deleteStep as ReplaceStep/*by definition*/).slice.size < (deleteStep as ReplaceStep/*by definition*/).to - (deleteStep as ReplaceStep).from) {
        const tr = editorState.tr.step(deleteStep);

        tr.setSelection(textblockAt(nodeBeforeCut, 'end') ? Selection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos, -1/*move backward*/)), -1/*look backward*/)/*guaranteed by textBlockAt call*/! : NodeSelection.create(tr.doc, $cut.pos - nodeBeforeCut.nodeSize));
        tr.scrollIntoView();
        return tr/*updated*/;
      }
    }

    // if nodeBefore is an Atom, delete it
    if(nodeBeforeCut.isAtom && $cut.depth === $cursor.depth - 1) {
      return editorState.tr.delete($cut.pos - nodeBeforeCut.nodeSize, $cut.pos).scrollIntoView();
    } /* else -- nodeBefore is not an Atom */

    return false/*could not joinBackward*/;
  }
}

// When the Selection is empty and at the end of a TextBlock, select
// the node coming after that textblock, if possible
export const joinForwardCommand: Command = (state, dispatch, view) => AbstractDocumentUpdate.execute(new JoinForwardDocumentUpdate(), state, dispatch, view);
export class JoinForwardDocumentUpdate implements AbstractDocumentUpdate {
  public constructor() {/*nothing additional*/ }

  // NOTE: this is inspired by https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L109
  /**
   * modify the given Transaction such that the conditions described by the
   * joinForward Command (SEE: joinForward above) hold
   */
  public update(editorState: EditorState, tr: Transaction, view: EditorView | undefined/*not given by the caller*/) {
    const { $cursor } = editorState.selection as TextSelection/*specifically looking for $cursor*/;
    if(!$cursor) return false/*selection is not an empty Text selection*/;

    if(view) {
      const wouldLeaveBlockIfForward = view.endOfTextblock('forward', editorState);
      if(!wouldLeaveBlockIfForward || $cursor.parentOffset < $cursor.parent.content.size) {
        return false;
      } /* else -- would leave the parent Text Block if Cursor goes forward, or the Cursor is past the end of the parent TextBlock*/
    } /* else -- View not given */

    const $cut = findCutAfter($cursor);
    if(!$cut || !$cut.nodeAfter) return false/*no Node after this, nothing to do*/;

    const nodeAfterCut = $cut.nodeAfter;

    // try to join
    const deleteBarrierUpdatedTr = deleteBarrier(editorState, $cut);
    if(deleteBarrierUpdatedTr) {
      return deleteBarrierUpdatedTr;
    } /* else -- isolating nodeBefore or could not join or replace */

    // if the Node above has no content and the Node below is selectable,
    // delete the Node above and select the one below
    if($cursor.parent.content.size === 0/*empty*/
      && (textblockAt(nodeAfterCut, 'start') || NodeSelection.isSelectable(nodeAfterCut))
    ) {
      const deleteStep = replaceStep(editorState.doc, $cursor.before(), $cursor.after(), Slice.empty);
      if(deleteStep && (deleteStep as ReplaceStep).slice.size < (deleteStep as ReplaceStep).to - (deleteStep as ReplaceStep).from) {
          tr.step(deleteStep)
            .setSelection(textblockAt(nodeAfterCut, 'start') ? Selection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos)), 1/*look forward*/)/*guaranteed by textBlockAt*/! : NodeSelection.create(tr.doc, tr.mapping.map($cut.pos)))
            .scrollIntoView();
        return tr;
      }
    } /* else -- the Node above has content or the Node below is not selectable */

    // if the next Node is an Atom, delete it
    if(nodeAfterCut.isAtom && $cut.depth === $cursor.depth - 1/*parent*/) {
      tr.delete($cut.pos, $cut.pos + nodeAfterCut.nodeSize)
        .scrollIntoView();
      return tr;
    } /* else -- next Node is not an Atom or the $cut depth is not the same as the parent of $cut */

    return false/*could not joinForward*/;
  }
}
