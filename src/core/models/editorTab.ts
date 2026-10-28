export type EditorTabId = 'vertex' | 'fragment' | 'uniforms' | 'io';

export interface EditorTab {
  id: EditorTabId;
  label: string;
  readOnly: boolean;
}

export const editorTabs: EditorTab[] = [
  { id: 'vertex', label: 'Vertex', readOnly: false },
  { id: 'fragment', label: 'Fragment', readOnly: false },
  { id: 'uniforms', label: 'Uniforms', readOnly: true },
  { id: 'io', label: 'in/out', readOnly: true },
];