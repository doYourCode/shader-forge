export type EditorTabId =
  'vertex' | 'fragment' | 'post' | 'user_data' | 'uniforms' | 'io';

export interface EditorTab {
  id: EditorTabId;
  /** UI-message key; core stays framework- and locale-free. */
  labelKey: string;
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
  /** UI-message key; core stays framework- and locale-free. */
  labelKey: string;
  tabs: readonly EditorTab[];
}

/**
 * The text documents backed by the code editor. `user_data` is deliberately
 * absent: it is a structured table panel, not a text buffer.
 */
export const editableTabs: readonly EditorTab[] = [
  { id: 'vertex', labelKey: 'editor.tabs.vertex', readOnly: false },
  { id: 'fragment', labelKey: 'editor.tabs.fragment', readOnly: false },
];

/**
 * The structured user-data tab. Kept separate from `editableTabs` so the model
 * never claims it is an editable text document.
 */
export const userDataTab: EditorTab = {
  id: 'user_data',
  labelKey: 'editor.tabs.userData',
  readOnly: false,
};

/**
 * The view-space effect tab. Its document is not fixed: it shows the fragment
 * of the effect selected in the effect stack, so it is kept out of
 * `editableTabs` like the user-data panel.
 */
export const postTab: EditorTab = {
  id: 'post',
  labelKey: 'editor.tabs.post',
  readOnly: false,
};

/**
 * The two shader stages, collapsed into the toolbar's first dropdown. They stay
 * the editable text documents; only their presentation is grouped.
 */
export const stageTabGroup: EditorTabGroup = {
  id: 'stages',
  labelKey: 'editor.tabGroups.stages',
  tabs: editableTabs,
};

/**
 * Everything that describes the shader's data: the structured user-data panel
 * plus the read-only built-in reference documents.
 */
export const dataTabGroup: EditorTabGroup = {
  id: 'data',
  labelKey: 'editor.tabGroups.data',
  tabs: [
    userDataTab,
    { id: 'io', labelKey: 'editor.tabs.io', readOnly: true },
    { id: 'uniforms', labelKey: 'editor.tabs.uniforms', readOnly: true },
  ],
};
