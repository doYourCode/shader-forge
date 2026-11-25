import normalFragment from '@/assets/screen-space-examples/gbuffer-normal.frag?raw';
import depthFragment from '@/assets/screen-space-examples/gbuffer-depth.frag?raw';
import albedoFragment from '@/assets/screen-space-examples/gbuffer-albedo.frag?raw';
import roughnessFragment from '@/assets/screen-space-examples/gbuffer-roughness.frag?raw';
import velocityFragment from '@/assets/screen-space-examples/gbuffer-velocity.frag?raw';
import outlineFragment from '@/assets/screen-space-examples/edge-outline.frag?raw';
import ssaoFragment from '@/assets/screen-space-examples/ssao.frag?raw';

/**
 * One bundled Screen Space effect. These fragments target the screen-space
 * ABI (the HDR scene plus the scene G-buffer), not the surface post-effect ABI.
 */
export interface ScreenSpaceExample {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly group: string;
  readonly fragment: string;
}

const examples: readonly ScreenSpaceExample[] = [
  {
    id: 'gbuffer-normal',
    label: 'Normals',
    description: 'View-space normal as RGB',
    group: 'G-buffer views',
    fragment: normalFragment,
  },
  {
    id: 'gbuffer-depth',
    label: 'Depth',
    description: 'Linear view-space depth in world units',
    group: 'G-buffer views',
    fragment: depthFragment,
  },
  {
    id: 'gbuffer-albedo',
    label: 'Albedo',
    description: 'Linear base colour (decode the sqrt encoding)',
    group: 'G-buffer views',
    fragment: albedoFragment,
  },
  {
    id: 'gbuffer-roughness',
    label: 'Roughness / metallic',
    description: 'Reconstruct roughness and metallic from F0',
    group: 'G-buffer views',
    fragment: roughnessFragment,
  },
  {
    id: 'gbuffer-velocity',
    label: 'Motion vectors',
    description: 'UV-space velocity, amplified for display',
    group: 'G-buffer views',
    fragment: velocityFragment,
  },
  {
    id: 'edge-outline',
    label: 'Edge outline',
    description: 'Depth and normal edges over the scene',
    group: 'Effects',
    fragment: outlineFragment,
  },
  {
    id: 'ssao',
    label: 'SSAO',
    description: 'A simplified screen-space ambient occlusion pass',
    group: 'Effects',
    fragment: ssaoFragment,
  },
];

export const screenSpaceExamples: readonly ScreenSpaceExample[] =
  Object.freeze(examples);

const byId = new Map(
  screenSpaceExamples.map((example) => [example.id, example] as const),
);

export function findScreenSpaceExample(
  id: string,
): ScreenSpaceExample | undefined {
  return byId.get(id);
}
