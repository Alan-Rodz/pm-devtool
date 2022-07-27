import { Attribute, Editor } from '@tiptap/core';
import { DOMOutputSpec, Mark as ProseMirrorMark, Node as ProseMirrorNode } from 'prosemirror-model';

import { getHeadingThemeValue, getMarkName, getMarkValue, getNodeName, getRenderAttributes, getRenderTag, getThemeValue, isHeadingNode, isTextNode, mergeAttributes, mergeAttributeValues, AttributeType, Attributes, InvalidMergedAttributeValue, MarkName, MarkRendererSpecs, MarkSpecs, MergedAttributeValue,  NodeRendererSpecs, NodeSpecs, SetAttributeType, DATA_NODE_TYPE } from 'common';

import { getSelectedNode } from './node';

// ********************************************************************************
// == Util ========================================================================
/**
 * Sets the parsing behavior that will be used when parsing an {@link Attribute}
 *
 * @param name The name of the {@link Attribute} to be parsed
 * @param type The {@link SetAttributeType} for the {@link Attribute} that will be parsed
 * @param defaultValue The default value of the {@link Attribute} to be parsed
 * @returns The {@link Attribute} spec object that defines the parsing behavior of the {@link Attribute}
 */
export const setAttributeParsingBehavior = (name: string, type: SetAttributeType,  defaultValue?: string | string[] | boolean | number | undefined): Attribute => {
  let parseHTML: (element: HTMLElement) => string | string[] | boolean | number | null = (element: HTMLElement) => element.getAttribute(name);

  switch(type) {
    case SetAttributeType.STRING:
      break/*use default*/;
    case SetAttributeType.BOOLEAN:
      parseHTML = (element: HTMLElement) => {
        const attr = element.getAttribute(name);
        if(attr === 'true') return true;
        return false;
      };
      break;
    case SetAttributeType.NUMBER:
      parseHTML = (element: HTMLElement) => Number(element.getAttribute(name));
      break;
    case SetAttributeType.ARRAY:
      parseHTML = (element: HTMLElement) => {
        const attr = element.getAttribute(name);
        if(!attr) return [];

        return attr.split(',');
      };
      break/*use default*/;
  }

  return {
    default: defaultValue,
    parseHTML,
    keepOnSplit: false/*don't keep by default*/,
  };
};

export const getNodeOutputSpec = (node: ProseMirrorNode, HTMLAttributes: Attributes, isLeaf: boolean = false): DOMOutputSpec => {
  const nodeName = getNodeName(node);
  const nodeRendererSpec = NodeRendererSpecs[nodeName],
        nodeSpec = NodeSpecs[nodeName];

  // All nodes require to have 'DATA_NODE_TYPE' attribute to be able to identify
  // the Node.
  const attributes = mergeAttributes(HTMLAttributes, { [DATA_NODE_TYPE]: node.type.name });
  const tag = getRenderTag(attributes, nodeRendererSpec);
  const merged = getRenderAttributes(nodeName, attributes, nodeRendererSpec, nodeSpec);

  // Leaf nodes don't need a content hole
  if(isLeaf) return [tag, merged];
  return [tag, merged, 0/*content hole*/];
};

export const getMarkOutputSpec = (mark: ProseMirrorMark, HTMLAttributes: Attributes): DOMOutputSpec => {
  const markName = getMarkName(mark);
  const markRendererSpec = MarkRendererSpecs[markName],
        markSpec = MarkSpecs[markName];

  // All marks require to have 'data-mark-type' attribute to be able to identify
  // the mark.
  const attributes = mergeAttributes(HTMLAttributes, { 'data-mark-type': mark.type.name });
  const tag = getRenderTag(attributes, markRendererSpec);
  const merged = getRenderAttributes(markName, attributes, markRendererSpec, markSpec);
  return [tag, merged];
};

// == Rendered values =============================================================
// Gets the DOM rendered value of the given Attribute in the current selected
// Text Node. In the case of a ranged selection a merging of the values will be
// attempted.
// There are multiple layers on how this value is determined, in order of priority:
// 1. The value of an Attribute in a Mark present on the Node.
// 2. The value of an Attribute in a Node.
// 3. The default value of an Attribute in a Node.
// 4. The value of an Attribute in the Theme.
// 5. The inherited value from a parent DOM element. In this case the editor don't
//   have an easy way to know what the actual value used is.
export const getTextDOMRenderedValue = (editor: Editor, attributeType: AttributeType, markType: MarkName): MergedAttributeValue => {
  const { state } = editor;
  const { selection } = state;
  const start = selection.$from.pos,
        end = selection.$to.pos;

  // Get the initial value based on the active mark.
  // NOTE: This is needed in the case that a Node don't have a TextNode yet but the
  //       mark is active, when creating the TextNode it will this Mark active.
  const currentMarkAttributes = editor.getAttributes(markType);
  let mergedValue: MergedAttributeValue = currentMarkAttributes[attributeType];

  // Merges the value of all different attributeType in the given range.
  state.doc.nodesBetween(start, end, (node, pos, parent) => {
    if(mergedValue === InvalidMergedAttributeValue) return false/*stop search*/;
    if(!isTextNode(node))  return;/*nothing to do*/

    // Marks are applied to TextNodes only, get the Attribute value form the Mark.
    const markValue = getMarkValue(node, markType, attributeType);
    // Value was found, merge it with mergedValue.
    if(markValue !== undefined) {
      mergedValue = mergeAttributeValues(mergedValue, markValue);
      return/*nothing else to do*/;
    } /* else -- no value was found for the given Mark */

    // TextNode will inherit the vale of the parent Node, use its attribute
    // value instead.
    const attributeValue = getDOMNodeRenderedValue(parent, attributeType);
    mergedValue = mergeAttributeValues(mergedValue, attributeValue);
    return/*nothing else to do*/;
  });

  // If no value was resolved and the selection is a single selection, the default
  // value of the TextNode at the position will be resolved to the parent node.
  if(start === end && mergedValue === undefined){
    const node = getSelectedNode(state, selection.$anchor.depth/*parent node*/);
    if(node) { mergedValue = getDOMNodeRenderedValue(node, attributeType); }
  }

  return mergedValue;
};
// Gets the DOM rendered value of the given Attribute in the given Node.
export const getDOMNodeRenderedValue = (node: ProseMirrorNode, attributeType: AttributeType): string | undefined => {
  // Check if the value is defined on the attributes. If so, return it.
  // NOTE: The attributes also includes the default attributes, there is no need to
  //       do a special check for the default attributes.
  if(node.attrs[attributeType]) return node.attrs[attributeType];

  // Heading nodes are a special case since the FontSize and TextColor are defined
  // by its level
  if(isHeadingNode(node) && (attributeType === AttributeType.FontSize || attributeType === AttributeType.TextColor)) return getHeadingThemeValue(attributeType, node.attrs[AttributeType.Level]);

  const nodeName = getNodeName(node);

  // Get the value from the current theme.
  const themeValue = getThemeValue(nodeName, attributeType);

  // FIXME: What happens if the the value is undefined? In this case the node will
  //        inherit the value from the parent but how do we know what the value is?
  return themeValue;
};

