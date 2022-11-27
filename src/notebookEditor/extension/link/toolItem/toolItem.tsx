import { AiOutlineLink } from 'react-icons/ai';

import { getLinkMarkType, isMarkActive, isNodeSelection, MarkName } from 'common';

import { toolItemCommandWrapper } from 'notebookEditor/command/util';
import { toggleMarkInMarkHolderCommand } from 'notebookEditor/extension/markHolder/command';
import { getMarkHolder, inMarkHolder } from 'notebookEditor/extension/markHolder/util';
import { getDialogStorage } from 'notebookEditor/model/DialogStorage';
import { ToolItem } from 'notebookEditor/toolbar/type';
import { shouldShowToolItem } from 'notebookEditor/toolbar/util';

import { LinkColorToolItem } from './component/LinkColorToolItem';
import { LinkTargetToolItem } from './component/LinkTargetToolItem';
import { LinkURLToolItem } from './component/LinkURLToolItem';
import { unsetLinkCommand } from '../command';

// ********************************************************************************
// == Tool Items ==================================================================
export const linkToolItem: ToolItem = {
  toolType: 'button',

  name: MarkName.LINK/*expected and guaranteed to be unique*/,
  label: MarkName.LINK,

  icon: <AiOutlineLink size={16} />,
  tooltip: 'Link (⌘ + K)',

  shouldBeDisabled: (editor) => isNodeSelection(editor.view.state.selection),
  shouldShow: (editor, depth) => shouldShowToolItem(editor, depth),
  isActive: (editor) => {
    if(inMarkHolder(editor, MarkName.LINK)) return true/*is active in MarkHolder*/;

    return isMarkActive(editor.view.state, MarkName.LINK);
  },
  onClick: (editor, depth) => {
    // if MarkHolder is defined toggle the Mark inside it
    const markHolder = getMarkHolder(editor.view.state);

    if(markHolder) {
      return toolItemCommandWrapper(editor, depth, toggleMarkInMarkHolderCommand(markHolder, getLinkMarkType(editor.view.state.schema)));
    } /* else -- MarkHolder not present */

    // (SEE: EditorUserInteractions.tsx)
    const { from } = editor.view.state.selection,
      linkMarkActive = isMarkActive(editor.view.state, MarkName.LINK) || editor.view.state.doc.rangeHasMark(from, from + 1, editor.view.state.schema.marks[MarkName.LINK]);
    if(linkMarkActive) {
      return unsetLinkCommand()(editor.view.state/*current state*/, editor.view.dispatch);
    } /* else -- Link Mark not active, add a new one */

    const linkStorage = getDialogStorage(editor, MarkName.LINK);
    if(!linkStorage) return/*nothing to do*/;
    linkStorage.setShouldInsertNodeOrMark(true);

    // focus the Editor again
    return editor.view.focus();
  },
};

export const linkURLToolItem: ToolItem = {
  toolType: 'component',
  name: 'linkURLToolItem'/*expected and guaranteed to be unique*/,

  component: LinkURLToolItem,
};

export const linkTargetToolItem: ToolItem = {
  toolType: 'component',
  name: 'linkTargetToolItem'/*expected and guaranteed to be unique*/,

  component: LinkTargetToolItem,
};

export const linkColorToolItem: ToolItem = {
  toolType: 'component',
  name: 'linkColorToolItem'/*expected and guaranteed to be unique*/,

  component: LinkColorToolItem,
};
