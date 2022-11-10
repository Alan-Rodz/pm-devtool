import { AttributeType, TableAttributes } from 'common';

import { ExtensionStorageType, NodeExtensionAttributes } from 'notebookEditor/extension/type';
import { uniqueIdParsingBehavior } from 'notebookEditor/extension/util';

// ********************************************************************************
// == Attribute ===================================================================
// NOTE: extracted so that it can be used by both the attributes of the Extension
//       and added to all ParseRules of the parseDOM property
export const getTableAttrs = (storage: ExtensionStorageType): NodeExtensionAttributes<TableAttributes> =>  ({
// creates a new Id for the Node when it is created
  [AttributeType.Id]:  uniqueIdParsingBehavior(storage),
});
