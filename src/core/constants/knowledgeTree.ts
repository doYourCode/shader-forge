import type { ITreeNode } from '@/core/models/treeNode';

export const knowledgeTree: ITreeNode[] = [
  {
    id: 'basics',
    label: 'Shader Basics',
    children: [
      {
        id: 'basics-pipeline',
        label: 'The Rendering Pipeline',
        content:
          'The rendering pipeline takes vertex data, transforms it through the vertex shader, rasterizes primitives, and runs the fragment shader per pixel.',
      },
      {
        id: 'basics-gpu',
        label: 'How the GPU Executes Shaders',
        content:
          'Modern GPUs execute shaders in massive parallel batches called warps/waves. Branching is expensive; prefer math over conditionals.',
      },
    ],
  },
  {
    id: 'glsl',
    label: 'GLSL',
    children: [
      {
        id: 'glsl-types',
        label: 'Data Types',
        content:
          'vec2, vec3, vec4, mat3, mat4, sampler2D — GLSL types map closely to GPU registers. Avoid mixing precisions unless required.',
      },
      {
        id: 'glsl-builtins',
        label: 'Built-in Functions',
        content:
          'mix(), smoothstep(), fract(), length(), dot(), cross() — these map to hardware-accelerated instructions and should be preferred over manual math.',
      },
    ],
  },
  {
    id: 'webgl',
    label: 'WebGL & WebGPU',
    children: [
      {
        id: 'webgl-gles',
        label: 'GLES 3.0 (WebGL2)',
        content:
          'WebGL2 exposes GLSL ES 3.00 — supports instancing, UBOs, MRT, and texture arrays. This is what shaderForge targets by default.',
      },
      {
        id: 'webgl-wgsl',
        label: 'WGSL (WebGPU)',
        content:
          'WGSL is the shader language for WebGPU. Availability depends on the browser and GPU; shaderForge degrades gracefully when WebGPU is missing.',
      },
    ],
  },
];