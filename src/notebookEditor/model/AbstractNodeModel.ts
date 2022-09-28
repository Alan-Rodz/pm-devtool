import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from 'prosemirror-model';

import { getPosType, isGetPos } from 'common';

import { AbstractNodeController } from './AbstractNodeController';
import { NodeViewStorage } from './NodeViewStorage';
import { NoStorage } from './type';

// Abstract class that holds the model for a NodeController. The implementation of
// the model is left to the subclasses.
// SEE: AbstractNodeController
// ********************************************************************************
export abstract class AbstractNodeModel<NodeType extends ProseMirrorNode, Storage extends NodeViewStorage<AbstractNodeController<NodeType, any, any, any>> | NoStorage> {
  public readonly editor: Editor;
  public readonly storage: Storage;
  public node: NodeType;
  getPos: (() => number);

  private selected: boolean;

  // == Life-Cycle ================================================================
  public constructor(editor: Editor, node: NodeType, storage: Storage, getPos: getPosType) {
    if(!isGetPos(getPos)) throw new Error('getPos is not a function when creating an AbstractNodeController');

    this.editor = editor;
    this.storage = storage;
    this.node = node;
    this.getPos = getPos;

    // FIXME: Is this true?
    this.selected = false/*by contract*/;
  }

  // Sync getPos and node when prosemirror updates it
  public updateProps(getPos: (() => number)) {
    this.getPos = getPos;
  }

  // called by the Controller when the NodeModel's Node is removed.
  // This method is meant to be used to perform model-specific
  // functionality on Node removal. The remaining removal behavior is
  // handled by default by ProseMirror
  public destroy() {/*currently nothing*/}

  // ==============================================================================
  public setSelected(selected: boolean ) { this.selected = selected; }
  public getSelected() { return this.selected; }
}
