import { useToast, Button, FormControl, FormLabel, FormErrorMessage, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from '@chakra-ui/react';
import { useFormik, Field, FormikProvider } from 'formik';
import { useState } from 'react';
import * as Validate from 'yup';

import { urlSchema, AttributeType, LinkTarget, SetTextSelectionDocumentUpdate, DEFAULT_LINK_ATTRIBUTES } from 'common';

import { insertLinkCommand, SetLinkDocumentUpdate } from 'notebookEditor/extension/link/command';
import { applyDocumentUpdates } from 'notebookEditor/command/update';
import { Editor } from 'notebookEditor/editor';
import { useIsMounted } from 'notebookEditor/shared/hook/useIsMounted';

// ********************************************************************************
// == Schema ======================================================================
// TODO: Move to a better place.
const LinkDialog_Create_Schema = Validate.object({
  /*the href of the link*/
  href: urlSchema
      .required(),
});
type LinkDialog_Create = Validate.InferType<typeof LinkDialog_Create_Schema>;

// == Interface ===================================================================
interface Props {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
}

// == Component ===================================================================
export const LinkDialog: React.FC<Props> = ({ editor, isOpen, onClose }) => {
  // == State =====================================================================
  const [isLoading, setIsLoading] = useState(false);

  // ------------------------------------------------------------------------------
  const toast = useToast();
  const isMounted = useIsMounted();

  // == Handler ===================================================================
  // -- Form ----------------------------------------------------------------------
  const handleSubmit = async ({ href }: LinkDialog_Create) => {
    try {
      setIsLoading(true);
      const { selection } = editor.view.state;
      const { empty, to } = selection,
      linkAttrs = { ...DEFAULT_LINK_ATTRIBUTES, [AttributeType.Href]: href.trim(), [AttributeType.Target]: LinkTarget.BLANK };

      if(empty) {
        insertLinkCommand(href.trim(), linkAttrs)(editor.view.state, editor.view.dispatch);
      } else {
        applyDocumentUpdates(editor/*starting state*/, [
          new SetLinkDocumentUpdate(linkAttrs),
          new SetTextSelectionDocumentUpdate({ from: to, to }),
        ]);
      }

    } catch(error) {
      console.error(`Error loading link with href (${href}). Reason: `, error);
      // REF: https://chromestatus.com/feature/5629709824032768
      if(!isMounted()) return/*nothing to do*/;

      toast({ title: 'Unexpected error happened while inserting link.', status: 'warning', duration: 3000/*ms*/ });
    } finally {
      if(!isMounted()) return/*nothing to do*/;

      setIsLoading(false);
      onClose();
    }
  };
  const formik = useFormik<LinkDialog_Create>({
    initialValues: { href: '' },
    validationSchema: LinkDialog_Create_Schema,
    onSubmit: handleSubmit,
  });

  // -- Dialog --------------------------------------------------------------------
  const handleClose = () => {
    onClose();
  };

  // == UI ========================================================================
  return (
    <Modal isOpen={isOpen} onClose={onClose} onEsc={onClose}>
      <ModalOverlay />

      <ModalContent>
        <FormikProvider value={formik}>
          <form onSubmit={formik.handleSubmit}>
            <fieldset disabled={isLoading}>

              <ModalHeader>Add a link</ModalHeader>
              <ModalCloseButton onClick={onClose} />

              <ModalBody>
                <FormControl isInvalid={!!formik.errors.href}>
                  <FormLabel htmlFor='href'>Link url</FormLabel>
                  <Field
                    as={Input}
                    id='href'
                    name='href'
                    value={formik.values.href ?? ''/*explicit controlled component*/}
                    type='href'
                    variant='filled'
                    autoFocus
                  />
                  <FormErrorMessage>{formik.errors.href}</FormErrorMessage>
                </FormControl>
              </ModalBody>

              <ModalFooter>
                <Button
                  variant='ghost'
                  colorScheme='blue'
                  isLoading={isLoading}
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  disabled={formik.status === 'loading' || !(formik.isValid && formik.dirty)}
                  type='submit'
                  colorScheme='purple'
                  width={120}
                >
                  {formik.status === 'loading' ? 'Loading' : 'Create' }
                </Button>
              </ModalFooter>
            </fieldset>
          </form>
        </FormikProvider>
      </ModalContent>
    </Modal>
  );
};
