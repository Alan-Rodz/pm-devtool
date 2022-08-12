import { getSelectedNode, AttributeType, InvalidMergedAttributeValue, MarkName } from 'common';

import { ColorPicker } from 'notebookEditor/extension/style/component/ColorPicker';
import { getTextDOMRenderedValue  } from 'notebookEditor/extension/util/attribute';
import { textColors } from 'notebookEditor/theme/type';
import { EditorToolComponentProps } from 'notebookEditor/toolbar/type';

// ********************************************************************************
// NOTE: This component adds a TextStyle mark in the selected text that adds the
//       color to the text. This don't update the TextColor attribute of the Node.
//       if that's the use case you should use TextColorToolItem instead.
interface Props extends EditorToolComponentProps {/*no additional*/}
export const TextColorMarkToolItem: React.FC<Props> = ({ editor, depth }) => {
  const { state } = editor;
  const node = getSelectedNode(state, depth);
  if(!node) return null/*nothing to render*/;

  const domRenderValue = getTextDOMRenderedValue(editor, AttributeType.TextColor, MarkName.TEXT_STYLE);
  const inputValue = domRenderValue === InvalidMergedAttributeValue ? '' : domRenderValue;

  // == Handler ===================================================================
  const handleChange = (value: string, focusEditor?: boolean) => {
    editor.commands.setTextStyle(AttributeType.TextColor, value);

    // Focus the editor again
    if(focusEditor) editor.commands.focus();
  };

  // == UI ========================================================================
  return (
    <ColorPicker name='Color' value={inputValue ?? ''} colors={textColors} onChange={handleChange} />
  );
};
