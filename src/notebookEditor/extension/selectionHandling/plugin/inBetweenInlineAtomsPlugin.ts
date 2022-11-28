import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';


// ********************************************************************************
// REF: https://discuss.prosemirror.net/t/cursor-appears-in-the-wrong-position-in-chrome-98/4409
/**
 * this Plugin prevents wrong cursor position when the Selection is between two
 * inline Nodes that are not Text, which is a bug that happens on Chrome
 * (SEE: REF above) by adding two empty span tags in between them through Node
 * Decorations, and also managing the behavior of typing in between them
 */


// == Class =======================================================================
class InBetweenInlineAtomsState {
  constructor(public inBetweenInlineNodes: boolean) {/*nothing additional*/}

  apply(tr: Transaction, thisPluginState: InBetweenInlineAtomsState, oldEditorState: EditorState, newEditorState: EditorState) { /*produce a new plugin state*/
    if(!tr.selection.empty) {
      this.inBetweenInlineNodes = false/*by definition*/;
      return this;
    } /* else -- selection empty */

    const { $anchor } = tr.selection;
    const { nodeBefore, nodeAfter } = $anchor;
    if(nodeBefore && nodeAfter && isInlineAtom(nodeBefore) && isInlineAtom(nodeAfter)) {
      this.inBetweenInlineNodes = true;
      return this;
    } /* else -- not in the middle of two inline Nodes with Content */

    this.inBetweenInlineNodes = false/*default*/;
    return this/*default*/;
  }
}

// == Plugin ======================================================================
const inBetweenInlineAtomsKey = new PluginKey<InBetweenInlineAtomsState>('inBetweenInlineAtomsPluginKey');

export const inBetweenInlineAtomsPlugin = () => {
  // differentiate between the state where the User is composing an input
  // (e.g. inserting a special character after inserting a '~' symbol)
  let composingInput = false/*default*/;

  const plugin = new Plugin<InBetweenInlineAtomsState>({
    // -- Definition --------------------------------------------------------------
    key: inBetweenInlineAtomsKey,

    // -- State -------------------------------------------------------------------
    state: {
      init(_, state) { return new InBetweenInlineAtomsState(false/*default not in between inline Nodes with Content*/); },
      apply(transaction, thisPluginState, oldState, newState) { return thisPluginState.apply(transaction, thisPluginState, oldState, newState); },
    },

    // -- Props -------------------------------------------------------------------
    // NOTE: this is inspired by https://github.com/Saul-Mirone/milkdown/blob/main/packages/preset-commonmark/src/plugin/inline-nodes-cursor.ts
    props: {
      handleDOMEvents: {
        // REF: https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event
        //      ensure that the composingInput flag is set whenever the selection
        //      is between inline Nodes with Content
        compositionstart: (view: EditorView) => {
          const state = getInlineNodeWithContentState(view.state);

          if(state.inBetweenInlineNodes) {
            composingInput = true/*an input is being composed in between inline Nodes with Content*/;
          } /* else -- not in between inline Nodes with Content, let PM handle the event */

          // NOTE: the compositionend event will set the flag back to false by contract
          //       (SEE: compositionend below)
          return false/*let PM handle the event*/;
        },

        // REF: https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event
        //      ensure there are no duplicate inputs when the composition event
        //      ends, (i.e. the right input is set, and it is only set once into
        //      the editor)
        compositionend: (view: EditorView, event: CompositionEvent) => {
          try {
            if(composingInput) {
              // REF: https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
              // insert text before next browser repaint
              requestAnimationFrame(() => {
                const state = getInlineNodeWithContentState(view.state);
                if(state.inBetweenInlineNodes) {
                  event.preventDefault();
                  view.dispatch(view.state.tr.insertText(event.data, view.state.selection.from));
                } /* else -- not in between inline Nodes with Content, do nothing */
              });

              return true/*event handled*/;
            } /* else -- not composing an input, let PM handle the event */
          } catch(error) {
            console.warn(`Something went wrong while inserting composed input: ${error}`);
          } finally {
            composingInput = false/*default*/;
          }
          return false/*let PM handle the event*/;
        },

        // REF: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/beforeinput_event
        // ensure that typing in between inline Nodes with Content gets
        // the input inserted correctly into the editor
        beforeinput: (view: EditorView, event: InputEvent) => {
          const state = getInlineNodeWithContentState(view.state);

          if(state.inBetweenInlineNodes && event.data && !composingInput/*if input is being composed, handlers above deal with it*/) {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText(event.data, view.state.selection.from));

            return true/*event handled*/;
          } /* else -- not in between inline Nodes with Content, event has no data, or not composing an input */

          return false/*let PM handle the event*/;
        },
      },

      // add empty span decorations when cursor is in between inline Nodes with
      // Content so that the Cursor does not get displayed incorrectly
      decorations(state: EditorState) {
        const pluginState = getInlineNodeWithContentState(state);

        if(pluginState.inBetweenInlineNodes) {
          const { pos: anchorPos } = state.selection.$anchor;

          const leftSpan = document.createElement('span'),
                leftDecoration = Decoration.widget(anchorPos, leftSpan, { side: -1/*appear before the next Decoration*/ });

          const rightSpan = document.createElement('span'),
                rightDecoration = Decoration.widget(anchorPos, rightSpan);

          // NOTE: Using setTimeout to make the change happen after the view is updated
          setTimeout(() => {
            leftSpan.setAttribute('contenteditable', 'true');
            rightSpan.setAttribute('contenteditable', 'true');
          });

          return DecorationSet.create(state.doc, [leftDecoration, rightDecoration]);
        } /* else -- not in between inline Nodes with Content, do not add any extra Decorations */

        return DecorationSet.empty/*no Decorations to add*/;
      },

    },
  });

  return plugin;
};

// == Util ========================================================================
// NOTE: defined by contract given the way the state for the Plugin is computed
//       (SEE: InBetweenInlineAtomsState#apply)
const getInlineNodeWithContentState = (state: EditorState) => inBetweenInlineAtomsKey.getState(state) as InBetweenInlineAtomsState/*by contract*/;

/**
 * check to see if the given {@link ProseMirrorNode}
 * is a Node that could cause the cursor to disappear if adjacent to another
 * Node of the same type
 * */
const isInlineAtom = (node: ProseMirrorNode) => node.isInline && !node.isText;
