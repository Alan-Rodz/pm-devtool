import { markInputRule as tiptapMarkInputRule, markPasteRule as tiptapMarkPasteRule, InputRule, PasteRule } from '@tiptap/core';
import { MarkType, Mark as ProseMirrorMark } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

// ********************************************************************************
/**
 * @param regExp The {@link RegExp} that will be turned into an {@link InputRule} for the desired {@link MarkType}
 * @param type The {@link MarkType} for which a new {@link InputRule} will be created
 * @returns an {@link InputRule} for the corresponding {@link MarkType} without
 *          {@link RegExp} duplication
 */
// REF: https://tiptap.dev/guide/custom-extensions
export const markInputRule = (regExp: RegExp, type: MarkType): InputRule => tiptapMarkInputRule({ find: new RegExp(regExp.source + '$'), type });

/**
 * @param regExp The {@link RegExp} that will be turned into an {@link PasteRule} for the desired {@link MarkType}
 * @param type The {@link MarkType} for which a new {@link PasteRule} will be created
 * @returns a {@link PasteRule} for the corresponding {@link MarkType} without
 *          {@link RegExp} duplication
 */
// REF: https://tiptap.dev/guide/custom-extensions
export const markPasteRule = (regExp: RegExp, type: MarkType): PasteRule => tiptapMarkPasteRule({ find: new RegExp(regExp.source, 'g'), type });

// == Selection ===================================================================
/** Gets all the ascendants of the current selected Node */
export const getAllMarksFromSelection = (state: EditorState): readonly ProseMirrorMark[] => {
  const { selection } = state;
  const { $anchor } = selection;

  return $anchor.marks();
};
