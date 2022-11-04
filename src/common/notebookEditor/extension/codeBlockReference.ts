import { Mark as ProseMirrorMark, Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';


import { isBlank } from '../../util';
import { AttributeType, noNodeOrMarkSpecAttributeDefaultValue, AttributesTypeFromNodeSpecAttributes } from '../attribute';
import { RendererState, VisualId } from '../htmlRenderer/state';
import { createNodeDataTypeAttribute, NodeRendererSpec } from '../htmlRenderer/type';
import { getAllowedMarks } from '../mark';
import { NodeIdentifier, NodeGroup, NodeName, ProseMirrorNodeContent, JSONNode } from '../node';
import { NotebookSchemaType } from '../schema';
import { getThemeValue } from '../theme';

// ********************************************************************************
// == Attribute ===================================================================
// NOTE: must be present on the NodeSpec below
// NOTE: This values must have matching types the ones defined in the Extension
export const CodeBlockReferenceNodeAttributeSpec = {
  [AttributeType.Id]: noNodeOrMarkSpecAttributeDefaultValue<NodeIdentifier>(),

   // the Id of the CodeBlock referenced by this CodeBlockReference
   [AttributeType.CodeBlockReference]: noNodeOrMarkSpecAttributeDefaultValue<CodeBlockReference>(),

  // the string that wraps the CodeBlockReference to the left
  [AttributeType.LeftDelimiter]: noNodeOrMarkSpecAttributeDefaultValue<string>(),
  // the string that wraps the CodeBlockReference to the right
  [AttributeType.RightDelimiter]: noNodeOrMarkSpecAttributeDefaultValue<string>(),
};
export type CodeBlockReferenceAttributes = AttributesTypeFromNodeSpecAttributes<typeof CodeBlockReferenceNodeAttributeSpec>;

// == Type ========================================================================
export type CodeBlockReference = NodeIdentifier/*alias*/;

// == Spec ========================================================================
// -- Node Spec -------------------------------------------------------------------
export const CodeBlockReferenceNodeSpec: NodeSpec = {
  // .. Definition ................................................................
  marks: getAllowedMarks([/*no Marks allowed for CodeBlockReference*/]),
  group: NodeGroup.INLINE,

  // .. Attribute .................................................................
  attrs: CodeBlockReferenceNodeAttributeSpec,

  // .. Misc .................................................................
  atom: true/*node does not have directly editable content*/,
  draggable: false,
  defining: true/*maintain original node during replace operations if possible*/,
  inline: true,
  leaf: true/*node does not have directly editable content*/,
  selectable: true,
};

// -- Render Spec -----------------------------------------------------------------
const renderCodeBlockReferenceNodeView = (attributes: CodeBlockReferenceAttributes, content: string, state: RendererState) => {
  let text = DEFAULT_CODEBLOCK_REFERENCE_NODE_TEXT/*default*/;
  const codeBlockReference = attributes[AttributeType.CodeBlockReference];

  if(!isBlank(codeBlockReference)) {
    const codeBlockId = codeBlockReference;
    if(codeBlockId) {
      const visualId = state[NodeName.CODEBLOCK].visualIds[codeBlockId];
      text = visualId ? visualId : DEFAULT_CODEBLOCK_REFERENCE_NODE_TEXT;
    } /* else -- do not change default */
  } /* else -- do not change default */

  const focusCodeBlockFunction = `try{document.getElementById('${codeBlockReference}').focus()}catch(error){/*do nothing on error*/}`;

  // NOTE: must not contain white space, else the renderer has issues
  //       (hence it is a single line below)
  // NOTE: createNodeDataTypeAttribute must be used for all nodeRenderSpecs
  //       that define their own renderNodeView
  const codeBlockReferenceInState = codeBlockReference && Object.keys(state.codeBlock.visualIds).includes(codeBlockReference);
  return `<a href="#${codeBlockReferenceInState ? codeBlockReference : ''}" ${createNodeDataTypeAttribute(NodeName.CODEBLOCK_REFERENCE)} style="cursor: ${codeBlockReferenceInState ? "pointer": "auto"}" onclick="${focusCodeBlockFunction}"><span>${computeCodeBlockReferenceText(attributes, text)}</span></a>`;
};

export const CodeBlockReferenceNodeRendererSpec: NodeRendererSpec<CodeBlockReferenceAttributes> = {
  tag: 'span',

  isNodeViewRenderer: true/*by definition*/,
  renderNodeView: renderCodeBlockReferenceNodeView,
  attributes: {/*no need to render attributes*/},
};

// -- Node Type -------------------------------------------------------------------
// NOTE: this is the only way to ensure the right attributes will be available
//       since PM does not provide a way to specify their type
export type CodeBlockReferenceNodeType = ProseMirrorNode & { attrs: CodeBlockReferenceAttributes; };
export const isCodeBlockReferenceNode = (node: ProseMirrorNode): node is CodeBlockReferenceNodeType => node.type.name === NodeName.CODEBLOCK_REFERENCE;

export const getCodeBlockReferenceNodeType = (schema: NotebookSchemaType) => schema.nodes[NodeName.CODEBLOCK_REFERENCE];
export const createCodeBlockReferenceNode = (schema: NotebookSchemaType, attributes?: Partial<CodeBlockReferenceAttributes>, content?: ProseMirrorNodeContent, marks?: ProseMirrorMark[]) =>
  getCodeBlockReferenceNodeType(schema).create(attributes, content, marks);

// -- JSON Node Type --------------------------------------------------------------
export type CodeBlockReferenceJSONNodeType = JSONNode<CodeBlockReferenceAttributes> & { type: NodeName.CODEBLOCK_REFERENCE; };
export const isCodeBlockReferenceJSONNode = (node: JSONNode): node is CodeBlockReferenceJSONNodeType => node.type === NodeName.CODEBLOCK_REFERENCE;

// == Util ========================================================================
export const DEFAULT_CODEBLOCK_REFERENCE_NODE_TEXT = 'ref'/*creation default*/;

// NOTE: obtaining the visualId is left to the caller since the checks may vary
//       depending on where the CodeBlockReference will be displayed (e.g. in
//       NodeView, Renderer)
export const computeCodeBlockReferenceText = (attrs: Partial<CodeBlockReferenceAttributes>, visualId: VisualId) => {
  // NOTE: checking explicitly for undefined for Delimiters since white spaces
  //       and 0s are allowed Delimiters. Not using isBlank() for the same reason
  let leftDelimiter = attrs[AttributeType.LeftDelimiter];
  if(leftDelimiter === undefined) leftDelimiter = getThemeValue(NodeName.CODEBLOCK_REFERENCE, AttributeType.LeftDelimiter);

  let rightDelimiter = attrs[AttributeType.RightDelimiter];
  if(rightDelimiter === undefined) rightDelimiter = getThemeValue(NodeName.CODEBLOCK_REFERENCE, AttributeType.RightDelimiter);

  return `${leftDelimiter}${visualId}${rightDelimiter}`;
};
