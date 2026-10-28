import type { ITreeNode } from '@/core/models/treeNode';

export const docsTree: ITreeNode[] = [
  {
    id: 'api',
    label: 'API Reference',
    children: [
      {
        id: 'api-editor',
        label: 'ShaderEditor',
        content:
          'The ShaderEditor class manages the CodeMirror instance, exposes getValue()/setValue(), and emits compile events.',
      },
      {
        id: 'api-scene',
        label: 'SceneManager',
        content:
          'SceneManager owns the Babylon.js Engine and Scene. It exposes init(), resize(), updateShader(), and dispose().',
      },
    ],
  },
  {
    id: 'guides',
    label: 'Guides',
    children: [
      {
        id: 'guides-first-shader',
        label: 'Your First Shader',
        content:
          'Start with a minimal pass-through vertex shader and a fragment shader that outputs a solid color. Compile. Then iterate.',
      },
    ],
  },
];