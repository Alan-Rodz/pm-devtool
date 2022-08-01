import { getMarkOutputSpec } from 'notebookEditor/extension/util/attribute';
import { Mark as ProseMirrorMark, MarkSpec } from 'prosemirror-model';

import { MarkRendererSpec } from '../htmlRenderer/type';
import { JSONMark, MarkName } from '../mark';
import { NotebookSchemaType } from '../schema';

// ********************************************************************************
// == Attribute ===================================================================
export type BoldAttributes = {/*currently none*/};

// == Spec ========================================================================
// -- Mark Spec -------------------------------------------------------------------
export const BoldMarkSpec: MarkSpec = {
  name: MarkName.BOLD/*expected and guaranteed to be unique*/,

  // NOTE: toDOM must be defined so that the Schema knows how to create it
  //       (SEE: schema.ts)
  toDOM: (mark, inline) => getMarkOutputSpec(mark, mark.attrs ?? {/*empty object if attrs are undefined*/}),
};

// -- Render Spec -----------------------------------------------------------------
export const BoldMarkRendererSpec: MarkRendererSpec<BoldAttributes> = {
  // NOTE: the tag is only used for the Editor. The HTML renderer uses the tag of
  //       the TextNode instead
  // SEE: ./renderer.ts
  tag: 'strong',
  render: { style: 'font-weight: bold;' },

  attributes: {/*no Attributes*/},
};

// == Type ========================================================================
// -- Mark Type -------------------------------------------------------------------
// NOTE: this is the only way since PM does not provide a way to specify the type
//       of the attributes
export type BoldMarkType = ProseMirrorMark<NotebookSchemaType> & { attrs: BoldAttributes; };
export const isBoldMark = (mark: ProseMirrorMark<NotebookSchemaType>): mark is BoldMarkType => mark.type.name === MarkName.BOLD;

// -- JSON Mark Type --------------------------------------------------------------
export type BoldJSONMarkType = JSONMark<BoldAttributes> & { type: MarkName.BOLD; };
export const isBoldJSONMark = (mark: JSONMark): mark is BoldJSONMarkType => mark.type === MarkName.BOLD;
