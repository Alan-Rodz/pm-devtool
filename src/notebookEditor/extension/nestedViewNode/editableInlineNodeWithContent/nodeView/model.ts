import { getPosType, EditableInlineNodeWithContentNodeType } from 'common';

import { Editor } from 'notebookEditor/editor/Editor';
import { AbstractNestedViewNodeModel } from 'notebookEditor/extension/nestedViewNode/nodeView/model';

import { EditableInlineNodeWithContentStorageType } from './controller';

// ********************************************************************************
export class EditableInlineNodeWithContentModel extends AbstractNestedViewNodeModel<EditableInlineNodeWithContentNodeType, EditableInlineNodeWithContentStorageType> {
  public constructor(editor: Editor, node: EditableInlineNodeWithContentNodeType, storage: EditableInlineNodeWithContentStorageType, getPos: getPosType) {
    super(editor, node, storage, getPos);

    // currently nothing else required
  }
}
