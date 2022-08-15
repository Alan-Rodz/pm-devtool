import { customAlphabet } from 'nanoid';
import { Fragment, Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { Selection, TextSelection, Transaction } from 'prosemirror-state';

import { Attributes, AttributeType } from './attribute';
import { Command } from './command';
import { JSONMark } from './mark';
import { NotebookSchemaType } from './schema';
import { getBlockNodeRange } from './selection';
import { mapOldStartAndOldEndThroughHistory } from './step';

// ********************************************************************************
// == Node definition =============================================================
export type NodeIdentifier = string/*alias*/;

// --------------------------------------------------------------------------------
/** Unique identifier for each Node on the schema */
export enum NodeName {
  DOC = 'document',
  HEADING = 'heading',
  MARK_HOLDER = 'markHolder',
  PARAGRAPH = 'paragraph',
  TEXT = 'text',
}
export const getNodeName = (node: ProseMirrorNode) => node.type.name as NodeName;

/**
 * The type of group that this Node belongs to. This is used on the Content field
 * on a NodeSpec.
 */
// NOTE: When using a custom group type it is expected to be defined here with a
//       explicit description on where and why it is used. This is done to help
//       prevent inconsistencies between the content of a node and the Group it
//       belongs to.
export enum NodeGroup {
  BLOCK = 'block',
  INLINE = 'inline',
}

/** the HTML tag used when rendering the node to the DOM */
export type NodeTag = string/*alias*/;

// == JSON ========================================================================
/** JSON representation of a ProseMirror Node */
export type JSONNode<A extends Attributes = {}> = {
  type: NodeName;
  content?: JSONNode[];
  text?: string;

  // Attributes are not required in a node and potentially not be present.
  attrs?: Partial<A>;
  marks?: JSONMark[];
};
/** Stringified version of the content of the Node */
export type NodeContent = string/*alias*/;

/** Type of ProseMirror Node Content when creating Nodes or Marks from a Node or Mark type */
export type ProseMirrorNodeContent = Fragment<NotebookSchemaType> | ProseMirrorNode<NotebookSchemaType> | ProseMirrorNode<NotebookSchemaType>[];

// --------------------------------------------------------------------------------
// JSON as seen from Schema#nodeFromJSON() or Schema#markFromJSON()
export type JSONContent = { [key: string]: any; };

// --------------------------------------------------------------------------------
export const nodeToJSONNode = (node: ProseMirrorNode) => node.toJSON() as JSONNode;
export const nodeToContent = (node: ProseMirrorNode<Schema>) => JSON.stringify(nodeToJSONNode(node)) as NodeContent;
export const contentToJSONNode = (content: NodeContent) => JSON.parse(content) as JSONNode;
export const contentToNode = (schema: Schema, content?: NodeContent) => content ? ProseMirrorNode.fromJSON(schema, contentToJSONNode(content)) : undefined/*none*/;

// == Manipulation ================================================================
// -- Search ----------------------------------------------------------------------
export type NodeFound = { node: ProseMirrorNode; position: number; };

/** @returns the parent node of a {@link Selection} */
export const getParentNode = (selection: Selection): ProseMirrorNode => selection.$anchor.parent;

/**
 * @param node1 The first {@link ProseMirrorNode} whose content will be compared
 * @param node2 The second {@link ProseMirrorNode} whose content will be compared
 * @returns The position at which the differences between the contents of the two
 *          Nodes start, and the object that contains the positions at which the
 *          differences between the contents of the two nodes end. Since the end
 *          position may not be the same in both Nodes, an object with the two
 *          positions is returned. If the content of the two Nodes is the same,
 *          undefined is returned
 */
 export const findContentDifferencePositions = (node1: ProseMirrorNode, node2: ProseMirrorNode) => {
  const docsDifferenceStart = node1.content.findDiffStart(node2.content),
        docDifferenceEnds = node1.content.findDiffEnd(node2.content);

  if(!docsDifferenceStart && docsDifferenceStart !== 0/*is a valid doc position*/) return;
  if(!docDifferenceEnds) return;

  return { docsDifferenceStart, docDifferenceEnds };
};

/**
 * @param transaction The transaction whose affected ranges are being computed
 * @param stepMapIndex The stepMapIndex of the corresponding stepMap of the Transaction
 * @param unmappedOldStart The default oldStart of the stepMap of the Transaction
 * @param unmappedOldEnd The default oldEnd of the stepMap of the Transaction
 * @param nodeNames The names of the Nodes that are being looked for in the affected range
 * @returns The Nodes of the specified types that existed in the affected range
 *          of the Transaction before the steps were applied, and the Nodes of the
 *          specified types that exist after the Steps have been applied
 */
// NOTE: Separated into its own method since all logic that needs to check whether
//       some node was deleted in a transaction uses this approach
export const getNodesAffectedByStepMap = (transaction: Transaction, stepMapIndex: number, unmappedOldStart: number, unmappedOldEnd: number, nodeNames: Set<NodeName>) => {
  // map to get the oldStart, oldEnd that account for history
  const { mappedOldStart, mappedOldEnd, mappedNewStart, mappedNewEnd } = mapOldStartAndOldEndThroughHistory(transaction, stepMapIndex, unmappedOldStart, unmappedOldEnd),

  oldNodeObjs = getNodesBetween(transaction.before, mappedOldStart, mappedOldEnd, nodeNames),
  newNodeObjs = getNodesBetween(transaction.doc, mappedNewStart, mappedNewEnd, nodeNames);

  return { oldNodeObjs, newNodeObjs };
};

/**
 * Creates and returns an array of {@link NodeFound} by looking at the Nodes between
 * {@link #from} and {@link #to} in the given {@link #rootNode}, adding those Nodes
 * whose type name is included in the given {@link #nodeNames} set. Very similar to
 * doc.nodesBetween, but specifically for {@link NodeFound} objects.
 */
 export const getNodesBetween = (rootNode: ProseMirrorNode, from: number, to: number, nodeNames: Set<NodeName>) => {
  const nodesOfType: NodeFound[] = [];
  rootNode.nodesBetween(from, to, (node, position) => {
    const nodeName = getNodeName(node);
    if(nodeNames.has(nodeName)) {
      nodesOfType.push({ node, position });
    } /* else -- ignore Node */
  });

  return nodesOfType;
};

// -- Creation --------------------------------------------------------------------
/** Creates a {@link Fragment} with the content of the input Node plus the given {@link appendedNode} */
export const createFragmentWithAppendedContent = (node: ProseMirrorNode, appendedNode: ProseMirrorNode) =>
    node.content.append(Fragment.from(appendedNode));

// -- Setter ----------------------------------------------------------------------
/**
 * Sets a Block Node across the range covered by the entirety
 * of the current selection
 */
 export const setBlockNodeAcrossNodes = (schema: NotebookSchemaType, blockNodeName: NodeName, attributes: Partial<Attributes>): Command => (tr, dispatch) => {
  const { from, to } = getBlockNodeRange(tr.selection);
  const textContent = tr.doc.textBetween(from, to, '\n'/*insert for every Block Node*/);

  tr.setSelection(new TextSelection(tr.doc.resolve(from - 1/*account for start of parent at from*/), tr.doc.resolve(to)))
    .replaceSelectionWith(schema.nodes[blockNodeName].create(attributes, schema.text(textContent)));

  if(dispatch) dispatch(tr);
  return true/*can be done*/;
};

// -- Transaction -----------------------------------------------------------------
/**
 * @param transaction The transaction that will be checked
 * @param nodeNameSet The set of node names that will be looked for in the
 *        {@link NodeFound} array of Nodes affected by the Transaction's stepMaps
 * @returns `true` if any of the stepMaps in the Transaction modified Nodes whose
 *          type name is included in the given nodeNameSet. `false` otherwise
 */
export const wereNodesAffectedByTransaction = (transaction: Transaction, nodeNameSet: Set<NodeName>) => {
  const { maps } = transaction.mapping;
  for(let stepMapIndex = 0; stepMapIndex < maps.length; stepMapIndex++) {
    let nodesOfTypeAffected = false/*default*/;

    // NOTE: unfortunately StepMap does not expose an array interface so that a
    //       for-loop-break construct could be used here for performance reasons
    maps[stepMapIndex].forEach((unmappedOldStart, unmappedOldEnd) => {
      if(nodesOfTypeAffected) return/*already know nodes were affected*/;

      const { oldNodeObjs, newNodeObjs } = getNodesAffectedByStepMap(transaction, stepMapIndex, unmappedOldStart, unmappedOldEnd, nodeNameSet);
      const oldNodesAffected = nodeFoundArrayContainsNodesOfType(oldNodeObjs, nodeNameSet),
        newNodesAffected = nodeFoundArrayContainsNodesOfType(newNodeObjs, nodeNameSet);

      if((oldNodesAffected || newNodesAffected)) {
        nodesOfTypeAffected = true;
        return;
      } /* else -- keep checking if nodes were affected*/
    });

    if(nodesOfTypeAffected) return true/*nodes were affected*/;
  }

  return false/*nodes were not affected*/;
};
const nodeFoundArrayContainsNodesOfType = (nodeObjs: NodeFound[], nodeNameSet: Set<NodeName>) =>
  nodeObjs.some(({ node }) => nodeNameSet.has(node.type.name as NodeName/*by definition*/));

/**
 * @param transaction The transaction whose stepMaps will be looked through
 * @param nodeNameSet The set of nodeNames that will be looked for deletions in
 *        the Transaction's stepMaps
 * @returns an array of {@link NodeFound} with the Nodes of the specified types
 *          that were deleted by the Transaction if any
 */
export const getRemovedNodesByTransaction = (transaction: Transaction, nodeNameSet: Set<NodeName>) => {
  const { maps } = transaction.mapping;
  let removedNodeObjs: NodeFound[] = [/*empty by default*/];
  // NOTE: since certain operations (e.g. dragging and dropping a Node) occur
  //       throughout more than one stepMapIndex, returning as soon as possible
  //       from this method can lead to incorrect behavior (e.g. the dragged Node's
  //       nodeView being deleted before the next stepMap adds it back). For this
  //       reason the removed Nodes are computed on each stepMap and the final
  //       removedNodeObjs array is what is returned
  // NOTE: this is true for this method specifically given its intent (checking to
  //       see if Nodes of a specific type got deleted), and does not mean that
  //       other extensions or plugins that use similar functionality to see if
  //       Nodes got deleted or added cannot return early, as this will depend on
  //       their specific intent
  for(let stepMapIndex=0; stepMapIndex < maps.length; stepMapIndex++) {
    maps[stepMapIndex].forEach((unmappedOldStart, unmappedOldEnd) => {
      const { oldNodeObjs, newNodeObjs } = getNodesAffectedByStepMap(transaction, stepMapIndex, unmappedOldStart, unmappedOldEnd, nodeNameSet);
      removedNodeObjs = computeRemovedNodeObjs(oldNodeObjs, newNodeObjs);
    });
  }
  return removedNodeObjs;
};

/** Get Nodes that are no longer present in the newArray */
export const computeRemovedNodeObjs = (oldArray: NodeFound[], newArray: NodeFound[]) =>
  oldArray.filter(oldNodeObj => !newArray.some(newNodeObj => newNodeObj.node.attrs[AttributeType.Id] === oldNodeObj.node.attrs[AttributeType.Id]));

// == Unique Node Id ==============================================================
// NOTE: at a minimum the id must be URL-safe (i.e. without the need to URL encode)
// NOTE: this is expected to be used within a given context (e.g. within a document)
//       and therefore does not need to have as much randomness as, say, UUIDv4
const customNanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10/*T&E*/);
export const generateNodeId = () => customNanoid();

/**
 * Computes the corresponding id that the tag for a Node will receive if needed.
 * Note that not all nodes require their view to have an ID, but all nodeViews
 * whose nodes make use of this functionality -must- have an ID attribute.
 */
 export const nodeToTagId = (node: ProseMirrorNode) => `${node.type.name}-${node.attrs[AttributeType.Id]}`;
