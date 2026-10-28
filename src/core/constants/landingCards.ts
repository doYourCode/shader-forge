import type { ILandingCard } from '@/core/models/landingCard';

export const landingCards: ILandingCard[] = [
  {
    id: 'glsl-editor',
    title: 'GLSL Editor',
    description: 'GLES 3.0 · Write and compile shaders live in the browser.',
    to: '/editor',
    requiresWebGpu: false,
  },
  {
    id: 'wgsl-editor',
    title: 'WGSL (WebGPU)',
    description: 'Write WGSL shaders powered by the WebGPU backend.',
    note: 'Requires WebGPU.',
    to: '/editor',
    requiresWebGpu: true,
  },
  {
    id: 'reference-docs',
    title: 'Reference & Docs',
    description: 'API reference, guides, and built-in function cheatsheets.',
    to: '/docs',
    requiresWebGpu: false,
  },
  {
    id: 'base-of-knowledge',
    title: 'Base of Knowledge',
    description: 'Curated articles on graphics techniques and shader theory.',
    to: '/knowledge',
    requiresWebGpu: false,
  },
  {
    id: 'fragment-sandbox',
    title: 'Fragment Sandbox',
    description: 'Experiment with fragment shaders in an isolated playground.',
    to: '/editor',
    requiresWebGpu: false,
  },
];