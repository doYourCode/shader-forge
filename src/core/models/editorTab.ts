export type EditorTabId =
  'vertex' | 'fragment' | 'post' | 'user_data' | 'uniforms' | 'io';

export interface EditorTab {
  id: EditorTabId;
  label: string;
  readOnly: boolean;
}

/**
 * A set of related tabs collapsed into one dropdown trigger. The label names
 * the group (for example "Shader Stages") while the individual documents live
 * behind the menu.
 */
export interface EditorTabGroup {
  /** Stable key used for rendering and focus handling. */
  id: string;
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

/**
 * The view-space effect tab. Its document is not fixed: it shows the fragment
 * of the effect selected in the effect stack, so it is kept out of
 * `editableTabs` like the user-data panel.
 */
export const postTab: EditorTab = {
  id: 'post',
  label: 'Post effect',
  readOnly: false,
};

/**
 * The two shader stages, collapsed into the toolbar's first dropdown. They stay
 * the editable text documents; only their presentation is grouped.
 */
export const stageTabGroup: EditorTabGroup = {
  id: 'stages',
  label: 'Shader Stages',
  tabs: editableTabs,
};

/**
 * Everything that describes the shader's data: the structured user-data panel
 * plus the read-only built-in reference documents.
 */
export const dataTabGroup: EditorTabGroup = {
  id: 'data',
  label: 'Shader Data',
  tabs: [
    userDataTab,
    { id: 'io', label: 'Attributes', readOnly: true },
    { id: 'uniforms', label: 'Uniforms', readOnly: true },
  ],
};
