export type EditorTabId = 'vertex' | 'fragment' | 'user_data' | 'uniforms' | 'io';

export interface EditorTab {
  id: EditorTabId;
  label: string;
  readOnly: boolean;
}

/**
 * A set of related tabs collapsed into one dropdown trigger. The label is
 * rendered around the trigger so the group's purpose stays visible while the
 * individual documents are hidden behind the menu.
 */
export interface EditorTabGroup {
  label: string;
  tabs: readonly EditorTab[];
}

/**
 * The text documents backed by the code editor. `user_data` is deliberately
 * absent: it is a structured table panel, not a text buffer.
 */
export const editableTabs: readonly EditorTab[] = [
  { id: 'vertex', label: 'Vertex', readOnly: false },
  { id: 'fragment', label: 'Fragment', readOnly: false },
];

/**
 * The structured user-data tab. Kept separate from `editableTabs` so the model
 * never claims it is an editable text document.
 */
export const userDataTab: EditorTab = {
  id: 'user_data',
  label: 'User data',
  readOnly: false,
};

export const builtInTabGroup: EditorTabGroup = {
  label: 'Built-in',
  tabs: [
    { id: 'uniforms', label: 'Uniforms', readOnly: true },
    { id: 'io', label: 'Attributes', readOnly: true },
  ],
};
