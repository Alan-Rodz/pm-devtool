import { Box, FormControl, FormErrorMessage, Input } from '@chakra-ui/react';
import { useFormik, Field, FormikProvider } from 'formik';
import { KeyboardEventHandler } from 'react';
import * as Validate from 'yup';

import { isImageNode, isNodeSelection, urlSchema, AttributeType, NodeName, SetNodeSelectionDocumentUpdate, UpdateSingleNodeAttributesDocumentUpdate, DEFAULT_IMAGE_SRC, DEFAULT_IMAGE_ERROR_SRC } from 'common';

import { applyDocumentUpdates } from 'notebookEditor/command/update';
import { InputToolItemContainer } from 'notebookEditor/extension/shared/component/InputToolItemContainer';
import { EditorToolComponentProps, TOOL_ITEM_DATA_TYPE } from 'notebookEditor/toolbar/type';

// ********************************************************************************
// == Schema ======================================================================
// TODO: move to a better place
const ImageDialog_Create_Schema = Validate.object({
  /*the src of the image*/
  src: urlSchema
      .required(),
});
type ImageDialog_Create = Validate.InferType<typeof ImageDialog_Create_Schema>;

// == Interface ===================================================================
interface Props extends EditorToolComponentProps {/*no additional*/}

// == Component ===================================================================
export const ImageSrcToolItem: React.FC<Props> = ({ editor }) => {
  const { selection } = editor.view.state;
  const { pos: updatePos } = selection.$anchor;
  if(!isNodeSelection(selection) || !isImageNode(selection.node)) throw new Error(`Invalid ImageSrcToolItem render: ${JSON.stringify(selection)}`);

  let initialValue = selection.node.attrs[AttributeType.Src];
  if(!initialValue || initialValue === DEFAULT_IMAGE_SRC || initialValue === DEFAULT_IMAGE_ERROR_SRC) {
    // set as none so that the User can change an invalid src to a valid one
    initialValue = ''/*none*/;
  } /* else -- valid src value */

  const formik = useFormik<ImageDialog_Create>({
    initialValues: { src: initialValue },
    validationSchema: ImageDialog_Create_Schema,

    // REF: https://github.com/jaredpalmer/formik/issues/811
    // explicitly re-initialize when the values change
    enableReinitialize: true,

    // NOTE: not using onSubmit since the way the input is submitted must be handled
    //       by the caller in order to control the focus of the User
    onSubmit: () => {},
  });

  // -- Handler -------------------------------------------------------------------
  // .. Form ......................................................................
  // update the Attributes and select the previous position
  const handleSubmit = ({ src: value }: ImageDialog_Create, focusEditor: boolean) => {
    applyDocumentUpdates(editor, [
      new UpdateSingleNodeAttributesDocumentUpdate(NodeName.IMAGE, updatePos, { [AttributeType.Src]: value }),
      new SetNodeSelectionDocumentUpdate(updatePos),
    ]);

    // focus the editor again
    if(focusEditor) editor.view.focus();
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    // save changes when user presses Enter
    if(event.key !== 'Enter') return/*nothing to do*/;
    if(!formik.isValid) return/*nothing to do*/;

    // prevent defaults so that PM does not handle the event
    event.preventDefault();
    event.stopPropagation();
    handleSubmit(formik.values, true/*focus editor*/);
  };

  const handleBlur = () => {
    if(formik.isValid) {
      handleSubmit(formik.values, false/*don't focus the editor*/);
      return;/*nothing else to do*/
    } /* else -- form is invalid */

    // reset to previous value
    formik.resetForm();
  };

  // -- UI ------------------------------------------------------------------------
  return (
    <FormikProvider value={formik}>
      <form onSubmit={formik.handleSubmit}>
        <FormControl isInvalid={!!formik.errors.src}>
          <InputToolItemContainer name='URL'>
            <Box width='full'>
              <Field
                as={Input}
                id='src'
                name='src'
                datatype={TOOL_ITEM_DATA_TYPE/*(SEE: notebookEditor/toolbar/type )*/}
                value={formik.values.src ?? ''/*explicit controlled component*/}
                autoComplete='off'
                placeholder='src'
                variant='outline'
                size='sm'
                width='full'
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
              />
              <FormErrorMessage>{formik.errors.src}</FormErrorMessage>
            </Box>
          </InputToolItemContainer>
        </FormControl>
      </form>
    </FormikProvider>
  );
};
