import { getMarkOutputSpec } from 'notebookEditor/extension/util/attribute';
import { Mark as ProseMirrorMark, MarkSpec } from 'prosemirror-model';

import { MarkRendererSpec } from '../htmlRenderer/type';
import { JSONMark, MarkName } from '../mark';
import { NotebookSchemaType } from '../schema';

// ********************************************************************************
// == Attribute ===================================================================
export type StrikethroughAttributes = {/*currently none*/};

// == Spec ========================================================================
// -- Mark Spec -------------------------------------------------------------------
export const StrikethroughMarkSpec: MarkSpec = {
  name: MarkName.STRIKETHROUGH/*expected and guaranteed to be unique*/,
  // NOTE: toDOM must be defined so that the Schema knows how to create it
  //       (SEE: schema.ts)
  toDOM: (mark, inline) => getMarkOutputSpec(mark, mark.attrs ?? {/*empty object if attrs are undefined*/}),
};

// -- Render Spec -----------------------------------------------------------------
export const StrikethroughMarkRendererSpec: MarkRendererSpec<StrikethroughAttributes> = {
  // NOTE: the tag is only used for the Editor. The HTML renderer uses the tag of
  //       the TextNode instead
  // SEE: ./renderer.ts
  tag: 's',
  render: { style: 'text-decoration: line-through;' },

  attributes: {/*no attributes*/},
};

// == Type ========================================================================
// -- Mark Type -------------------------------------------------------------------
// NOTE: this is the only way since PM does not provide a way to specify the type
//       of the Attributes
export type StrikethroughMarkType = ProseMirrorMark<NotebookSchemaType> & { attrs: StrikethroughAttributes; };
export const isStrikethroughMark = (mark: ProseMirrorMark<NotebookSchemaType>): mark is StrikethroughMarkType => mark.type.name === MarkName.STRIKETHROUGH;

// -- JSON Mark Type --------------------------------------------------------------
export type StrikethroughJSONMarkType = JSONMark<StrikethroughAttributes> & { type: MarkName.STRIKETHROUGH; };
export const isStrikethroughJSONMark = (mark: JSONMark): mark is StrikethroughJSONMarkType => mark.type === MarkName.STRIKETHROUGH;
