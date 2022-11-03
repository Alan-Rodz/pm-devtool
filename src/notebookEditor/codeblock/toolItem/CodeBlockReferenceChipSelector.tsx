import { useCallback, useEffect } from 'react';

import { getSelectedNode, isNodeType, updateSingleNodeAttributesCommand, AttributeType, NodeName, DATA_VISUAL_ID } from 'common';

import { ChipValue } from 'notebookEditor/extension/shared/component/chipTool/Chip';
import { ChipTool } from 'notebookEditor/extension/shared/component/chipTool/ChipTool';
import { InputToolItemContainer } from 'notebookEditor/extension/shared/component/InputToolItemContainer';
import { EditorToolComponentProps } from 'notebookEditor/toolbar/type';

import { focusCodeBlock, getLabelFromValue, getValueFromLabel, isValidCodeBlockReference, validateChip } from '../util';

// ********************************************************************************
// NOTE: This component is meant to be used with nodes that require only one
//       reference to be selected.

// == Interface ===================================================================
interface Props extends EditorToolComponentProps {
  nodeName: NodeName;
}

// == Component ===================================================================
export const CodeBlockReferenceChipSelector: React.FC<Props> = ({ editor, depth, nodeName }) => {
  const { state } = editor.view;
  const { selection } = state;
  const node = getSelectedNode(state, depth);

  // -- Callback ------------------------------------------------------------------
  const updateAttribute = useCallback((value: string | undefined, focus?: boolean) => {
    if(!node) return/*nothing to do*/;
    updateSingleNodeAttributesCommand(node.type.name as NodeName/*by definition*/, selection.$anchor.pos, { [AttributeType.CodeBlockReference]: value })(editor.view.state, editor.view.dispatch);
    if(focus) editor.view.focus();
  }, [editor.view, node, selection.$anchor.pos]);

  // -- Effect --------------------------------------------------------------------
  /** doing CMD + Click on a VisualId toggles it from the CodeBlockReference */
  useEffect(() => {
    if(!node) return/*nothing to do*/;
    const reference = node.attrs[AttributeType.CodeBlockReference];

    const handler = async (event: MouseEvent) => {
      if(!event.metaKey) return/*not a meta key is pressed -- nothing to do*/;

      const { target } = event;
      if(!target) return/*no target -- nothing to do*/;
      if(!(target instanceof HTMLElement)) return/*not an element -- nothing to do*/;
      const visualId = target.getAttribute(DATA_VISUAL_ID);
      if(!visualId) return/*no visualId -- nothing to do*/;
      const codeBlockReference = isValidCodeBlockReference(editor, visualId);
      if(!codeBlockReference.isValid) return/*not a valid codeBlockReference -- nothing to do*/;
      const codeblockId = codeBlockReference.codeBlockView.node.attrs[AttributeType.Id] ?? ''/*no id by default*/;
      event.preventDefault();
      event.stopPropagation();

      // toggles the value
      const newValue = codeblockId === reference ? '' : codeblockId;
      updateAttribute(newValue, false/*don't focus*/);
    };

    window.addEventListener('mousedown', handler);

    // removes the listener on unmount
    return () => { window.removeEventListener('mousedown', handler); };
  }, [editor, nodeName, node, updateAttribute]);

  if(!node || !isNodeType(node, nodeName)) return null/*nothing to render - invalid node render*/;

  // gets the value in an array to be used by ChipTool
  const reference = node.attrs[AttributeType.CodeBlockReference],
        value = reference ? [reference] : [],
        id = node.attrs[AttributeType.Id] ?? ''/*no id by default*/;

  // -- Handler -------------------------------------------------------------------
  const handleAddValue = (label: string, focus?: boolean) => {
    const newValue: ChipValue = { label, value: getValueFromLabel(editor, label) };
    handleChange([...chips, newValue]);
  };

  const handleChange = (chips: ChipValue[], focus?: boolean) => {
    if(chips.length > 1) console.error('CodeBlockReferenceChipSelector: only one reference is allowed');

    // gets the value from the array since only one is allowed and is stored as a
    // single string
    const newValue = chips.length > 0 ? chips[0].value : undefined;
    updateAttribute(newValue, focus);
  };

  // SEE: CodeBlockReferencesChipSelector.tsx
  const handleChipClick = (chip: ChipValue) => focusCodeBlock(editor, chip.label/*visual id*/);

  // -- UI ------------------------------------------------------------------------
  const chips = value.map(chip => ({ label: getLabelFromValue(editor, chip), value: chip }));
  return (
    <InputToolItemContainer name={'Reference'}>
      <ChipTool
        nodeId={id}
        value={chips}
        maxValues={1}
        isDraggable={false}
        validate={(visualId) => validateChip(editor, visualId)}
        onAddValue={handleAddValue}
        onChange={handleChange}
        onChipClick={handleChipClick}
      />
    </InputToolItemContainer>
  );
};

