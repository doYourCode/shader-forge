export type EditorTabId = 'vertex' | 'fragment' | 'uniforms' | 'io';

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

export const editableTabs: readonly EditorTab[] = [
  { id: 'vertex', label: 'Vertex', readOnly: false },
  { id: 'fragment', label: 'Fragment', readOnly: false },
];

export const builtInTabGroup: EditorTabGroup = {
  label: 'Built-in',
  tabs: [
    { id: 'uniforms', label: 'Uniforms', readOnly: true },
    { id: 'io', label: 'Attributes', readOnly: true },
  ],
};
