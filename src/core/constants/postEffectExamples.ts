import vignetteFragment from '@/assets/post-examples/vignette.frag?raw';
import blurFragment from '@/assets/post-examples/blur.frag?raw';
import outlineFragment from '@/assets/post-examples/outline.frag?raw';
import depthFogFragment from '@/assets/post-examples/depth-fog.frag?raw';
import ssaoFragment from '@/assets/post-examples/ssao.frag?raw';

/**
 * One bundled view-space effect for the 3D editor's and the sandbox's effect
 * stack. These target the surface post-effect ABI, which is smaller than the
 * screen-space G-buffer ABI.
 */
export interface PostEffectExample {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly fragment: string;
}

const examples: readonly PostEffectExample[] = [
  {
    id: 'vignette',
    label: 'Vignette',
    description: 'Darken the frame edges',
    fragment: vignetteFragment,
  },
  {
    id: 'blur',
    label: 'Gaussian blur',
    description: 'Nine-tap separable blur',
    fragment: blurFragment,
  },
  {
    id: 'outline',
    label: 'Outline',
    description: 'Depth and normal edges',
    fragment: outlineFragment,
  },
  {
    id: 'depth-fog',
    label: 'Depth fog',
    description: 'Exponential-squared distance fog',
    fragment: depthFogFragment,
  },
  {
    id: 'ssao',
    label: 'SSAO',
    description: 'Simplified screen-space ambient occlusion',
    fragment: ssaoFragment,
  },
];

export const postEffectExamples: readonly PostEffectExample[] =
  Object.freeze(examples);

const byId = new Map(
  postEffectExamples.map((example) => [example.id, example] as const),
);

export function findPostEffectExample(
  id: string,
): PostEffectExample | undefined {
  return byId.get(id);
}
