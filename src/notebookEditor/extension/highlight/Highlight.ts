import { Extension } from '@tiptap/core';
import { EditorState, Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { ExtensionName } from 'notebookEditor/model/type';
import { SELECTED_TEXT_CLASS } from 'notebookEditor/theme/theme';

// ********************************************************************************
// highlights the current selection in the cases of a text selection. The styles of
// the selection will only apply when the editor is not focused.
// SEE: index.css
// REF: https://discuss.prosemirror.net/t/add-css-class-to-current-node-or-selected-nodes/1287
export const Highlight = Extension.create({
  name: ExtensionName.HIGHLIGHT/*Expected and guaranteed to be unique*/,

  // -- Plugin --------------------------------------------------------------------
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state: EditorState) {
            const selection = state.selection;
            const from = selection.from,
                  to = selection.to;

            const decoration = Decoration.inline(from, to, { class: SELECTED_TEXT_CLASS });
            return DecorationSet.create(state.doc, [decoration]);
          },
        },
      }),
    ];
  },
});
