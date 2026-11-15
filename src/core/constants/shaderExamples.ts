import lambertVertex from '@/assets/examples/lambert.vert?raw';
import lambertFragment from '@/assets/examples/lambert.frag?raw';
import phongVertex from '@/assets/examples/phong.vert?raw';
import phongFragment from '@/assets/examples/phong.frag?raw';
import blinnPhongVertex from '@/assets/examples/blinn-phong.vert?raw';
import blinnPhongFragment from '@/assets/examples/blinn-phong.frag?raw';
import orenNayarVertex from '@/assets/examples/oren-nayar.vert?raw';
import orenNayarFragment from '@/assets/examples/oren-nayar.frag?raw';
import cookTorranceVertex from '@/assets/examples/cook-torrance.vert?raw';
import cookTorranceFragment from '@/assets/examples/cook-torrance.frag?raw';
import iblMetalnessRoughnessVertex from '@/assets/examples/ibl-metalness-roughness.vert?raw';
import iblMetalnessRoughnessFragment from '@/assets/examples/ibl-metalness-roughness.frag?raw';
import iblSpecularGlossinessVertex from '@/assets/examples/ibl-specular-glossiness.vert?raw';
import iblSpecularGlossinessFragment from '@/assets/examples/ibl-specular-glossiness.frag?raw';

/**
 * One loadable example: a vertex/fragment pair that only uses the attributes
 * and uniforms the preview already binds, so selecting it never has to extend
 * the material.
 */
export interface ShaderExample {
  /** Stable id; also the base name of the paired `.vert`/`.frag` files. */
  readonly id: string;
  /** Name shown in the loader menu. */
  readonly label: string;
  /** One-line summary shown under the label. */
  readonly description: string;
  /** Menu section the example is listed under; consecutive entries group. */
  readonly group: string;
  readonly vertex: string;
  readonly fragment: string;
}

/**
 * Shader examples offered by the editor's loader, in menu order.
 *
 * Adding an example means dropping `<id>.vert` and `<id>.frag` into
 * `src/assets/examples` and appending one record here. The loader, the menu and
 * the coverage test all read this list, so nothing else has to know about the
 * new pair.
 */
const examples: readonly ShaderExample[] = [
  {
    id: 'lambert',
    label: 'Lambert',
    description: 'Diffuse: N dot L only',
    group: 'Lighting',
    vertex: lambertVertex,
    fragment: lambertFragment,
  },
  {
    id: 'phong',
    label: 'Phong',
    description: 'Specular: reflection vector',
    group: 'Lighting',
    vertex: phongVertex,
    fragment: phongFragment,
  },
  {
    id: 'blinn-phong',
    label: 'Blinn-Phong',
    description: 'Specular: half vector',
    group: 'Lighting',
    vertex: blinnPhongVertex,
    fragment: blinnPhongFragment,
  },
  {
    id: 'oren-nayar',
    label: 'Oren-Nayar',
    description: 'Rough diffuse: facet slope',
    group: 'Lighting',
    vertex: orenNayarVertex,
    fragment: orenNayarFragment,
  },
  {
    id: 'cook-torrance',
    label: 'Cook-Torrance',
    description: 'Specular: GGX microfacets',
    group: 'Lighting',
    vertex: cookTorranceVertex,
    fragment: cookTorranceFragment,
  },
  {
    id: 'ibl-metalness-roughness',
    label: 'IBL Metalness / Roughness',
    description: 'Image-based: metallic workflow',
    group: 'Image-based lighting',
    vertex: iblMetalnessRoughnessVertex,
    fragment: iblMetalnessRoughnessFragment,
  },
  {
    id: 'ibl-specular-glossiness',
    label: 'IBL Specular / Glossiness',
    description: 'Image-based: specular workflow',
    group: 'Image-based lighting',
    vertex: iblSpecularGlossinessVertex,
    fragment: iblSpecularGlossinessFragment,
  },
];

/** Every bundled example, frozen so the menu cannot reorder the source list. */
export const shaderExamples: readonly ShaderExample[] = Object.freeze(examples);

const byId = new Map(
  shaderExamples.map((example) => [example.id, example] as const),
);

export function findShaderExample(id: string): ShaderExample | undefined {
  return byId.get(id);
}
