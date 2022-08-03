import { generateNodeId, Attributes, HeadingLevel } from 'common';

import { DEFAULT_NODE_ID } from 'notebookEditor/extension/uniqueNodeId/UniqueNodeId';

// ********************************************************************************
// == Type ========================================================================
// -- Options ---------------------------------------------------------------------
export interface HeadingOptions {
  levels: HeadingLevel[];
  HTMLAttributes: Attributes;
}

// ................................................................................
export const createDefaultHeadingAttributes = (level: number) =>
  ({
    id: generateNodeId()/*unique for each invocation*/,

    level,
  });

// -- Defaults --------------------------------------------------------------------
export const HEADING_ID = `${DEFAULT_NODE_ID} Heading ID`;
export const DEFAULT_HEADING_LEVEL: HeadingLevel = HeadingLevel.One;
export const DEFAULT_HEADING_STYLE_SET = false;
