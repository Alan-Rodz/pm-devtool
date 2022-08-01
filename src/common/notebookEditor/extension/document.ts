import { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';

import { AttributesTypeFromNodeSpecAttributes } from '../attribute';
import { NodeRendererSpec } from '../htmlRenderer/type';
import { JSONNode, NodeGroup, NodeName } from '../node';
import { NotebookSchemaType } from '../schema';

// ********************************************************************************
// == Attribute ===================================================================
// NOTE: must be present on the NodeSpec below
// NOTE: this value must have matching types -- the ones defined in the Extension
const DocumentAttributesSpec = {/*no attributes*/};
export type DocumentAttributes = AttributesTypeFromNodeSpecAttributes<typeof DocumentAttributesSpec>;

// == Spec ========================================================================
// -- Node Spec -------------------------------------------------------------------
export const DocumentNodeSpec: NodeSpec = {
  name: NodeName.DOC/*expected and guaranteed to be unique*/,

  // NOTE: is expected that the Schema using this Node explicitly defines that this
  //       is the top Node
  // SEE:  /common/notebookEditor/schema.ts
  topNode: true/*it's the Node that will be used as a root for the Document*/,
  content: `${NodeGroup.BLOCK}+`,

  attrs: DocumentAttributesSpec,
};

// -- Render Spec -----------------------------------------------------------------
export const DocumentNodeRendererSpec: NodeRendererSpec<DocumentAttributes> = {
  tag: 'div',

  attributes: {/*no Attributes*/},
};

// == Type ========================================================================
// -- Node Type -------------------------------------------------------------------
// NOTE: this is the only way since PM does not provide a way to specify the type
//       of the Attributes
export type DocumentNodeType = ProseMirrorNode<NotebookSchemaType> & {/*nothing additional*/};
export const isDocumentNode = (node: ProseMirrorNode<NotebookSchemaType>): node is DocumentNodeType => node.type.name === NodeName.DOC;

// -- JSON Node Type --------------------------------------------------------------
export type DocumentJSONNodeType = JSONNode<DocumentAttributes> & { type: NodeName.DOC; };
export const isDocumentJSONNode = (node: JSONNode): node is DocumentJSONNodeType => node.type === NodeName.DOC;
