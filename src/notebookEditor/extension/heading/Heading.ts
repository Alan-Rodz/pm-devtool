import { textblockTypeInputRule, Node } from '@tiptap/core';

import { AttributeType, getHeadingLevelFromTag, HeadingLevel, HeadingNodeSpec,  SetAttributeType } from 'common';

import { NoStorage } from 'notebookEditor/model/type';

import { getNodeOutputSpec,  setAttributeParsingBehavior } from '../util/attribute';
import { createDefaultHeadingAttributes, HeadingOptions, HEADING_ID } from './type';
import { setHeadingCommand, toggleHeadingCommand } from './command';

// NOTE: this Extension leverages the UniqueNodeId extension
// ********************************************************************************
// == Node ========================================================================
export const Heading = Node.create<HeadingOptions, NoStorage>({
  ...HeadingNodeSpec,

  // -- Attribute -----------------------------------------------------------------
  addAttributes() {
    return {
      id: setAttributeParsingBehavior('id', SetAttributeType.STRING, HEADING_ID),
      level: { default: HeadingLevel.One, parseHTML: element => getHeadingLevelFromTag(element.tagName) },
      initialMarksSet: setAttributeParsingBehavior('initialMarksSet', SetAttributeType.BOOLEAN, false),

      [AttributeType.FontSize]: setAttributeParsingBehavior(AttributeType.FontSize, SetAttributeType.STRING),
      [AttributeType.TextColor]: setAttributeParsingBehavior(AttributeType.TextColor, SetAttributeType.STRING),

      [AttributeType.PaddingTop]: setAttributeParsingBehavior(AttributeType.PaddingTop, SetAttributeType.STRING),
      [AttributeType.PaddingBottom]: setAttributeParsingBehavior(AttributeType.PaddingBottom, SetAttributeType.STRING),
      [AttributeType.PaddingLeft]: setAttributeParsingBehavior(AttributeType.PaddingLeft, SetAttributeType.STRING),
      [AttributeType.PaddingRight]: setAttributeParsingBehavior(AttributeType.PaddingRight, SetAttributeType.STRING),

      [AttributeType.MarginTop]: setAttributeParsingBehavior(AttributeType.MarginTop, SetAttributeType.STRING),
      [AttributeType.MarginLeft]: setAttributeParsingBehavior(AttributeType.MarginLeft, SetAttributeType.STRING),
      [AttributeType.MarginBottom]: setAttributeParsingBehavior(AttributeType.MarginBottom, SetAttributeType.STRING),
      [AttributeType.MarginRight]: setAttributeParsingBehavior(AttributeType.MarginRight, SetAttributeType.STRING),
    };
  },
  addOptions() {
    return {
      levels: [HeadingLevel.One, HeadingLevel.Two, HeadingLevel.Three],
      HTMLAttributes: {/*currently nothing*/},
    };
  },

  // -- Command -------------------------------------------------------------------
  addCommands() {
    return {
      setHeading: setHeadingCommand,
      toggleHeading: toggleHeadingCommand,
    };
  },
  addKeyboardShortcuts() {
    return this.options.levels.reduce((items, level) => ({
      ...items, ...{ [`Mod-Alt-${level}`]: () => this.editor.commands.setHeading(createDefaultHeadingAttributes(level)) },
    }), {});
  },

  // -- Input ---------------------------------------------------------------------
  // Create a Heading node if the user types '#' a certain amount of times and
  // a space or an enter. The amount of times '#' was typed will be the level
  // of the Heading, if it is a valid HeadingLevel
  addInputRules() {
    return this.options.levels.map(level => {
      return textblockTypeInputRule({
        find: new RegExp(`^(#{1,${level}})\\s$`),
        type: this.type,
        getAttributes: { level },
      });
    });
  },

  // -- View ----------------------------------------------------------------------
  parseHTML() {
    return this.options.levels.map((level: HeadingLevel) => ({
      tag: `h${level}`,

      attrs: { level, fontSize: '20px' },
    }));
  },
  renderHTML({ node, HTMLAttributes }) { return getNodeOutputSpec(node, HTMLAttributes); },
});
