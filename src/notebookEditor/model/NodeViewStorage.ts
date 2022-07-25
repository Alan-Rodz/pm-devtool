import { Editor } from '@tiptap/core';

import { NodeIdentifier, NodeName } from 'common';

import { AbstractNodeController } from 'notebookEditor/model/AbstractNodeController';

// ********************************************************************************
/**
 * Returns the {@link NodeViewStorage} that manages all {@link AbstractNodeViews}
 * for a particular type of Node
 */
export const getNodeViewStorage = <Storage extends NodeViewStorage<any>>(editor: Editor, nodeName: NodeName): Storage => {
  const storage = editor.storage[nodeName];
  if(!isNodeViewStorage<Storage>(storage)) throw new Error(`Invalid storage for Node (${nodeName}): ${JSON.stringify(storage)}`);

  return storage;
};

// ********************************************************************************
/**
 * Implements the common properties to all storage objects used by {@link AbstractNodeController}
 */
export class NodeViewStorage<V extends AbstractNodeController<any>> {
  private readonly nodeViewMap = new Map<NodeIdentifier, V>();

  // == Life-cycle ================================================================
  public constructor() {/*currently nothing*/}

  // == NodeViews =================================================================
  // retrieves the node view for the specified node identifier. Such a node view
  // may not exist
  public getNodeView(id: NodeIdentifier) { return this.nodeViewMap.get(id); }

  // adds or updates the specified node view to storage
  public addNodeView(id: NodeIdentifier, nodeView: V) { this.nodeViewMap.set(id, nodeView); }

  // removes the specified node view from storage
  public removeNodeView(id: NodeIdentifier) { this.nodeViewMap.delete(id); }

  /** Calls the specified callback for each NodeView in Storage */
  public forEachNodeView(operation: (nodeView: V) => void) {
    this.nodeViewMap.forEach(nodeView => operation(nodeView));
  }
}

export const isNodeViewStorage = <Storage extends NodeViewStorage<any>>(obj: any): obj is Storage =>
  'nodeViewMap' in obj;
