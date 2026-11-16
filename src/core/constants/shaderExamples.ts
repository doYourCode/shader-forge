import type {
  UserColor3Value,
  UserUniformKind,
  UserUniformStage,
  UserUniformValue,
} from '@/core/models/userUniform';

import iblCommonVertex from '@/assets/examples/ibl-common.vert?raw';
import basiclmCommonVertex from '@/assets/examples/basiclm-common.vert?raw';
import lambertFragment from '@/assets/examples/lambert.frag?raw';
import phongFragment from '@/assets/examples/phong.frag?raw';
import blinnPhongFragment from '@/assets/examples/blinn-phong.frag?raw';
import orenNayarFragment from '@/assets/examples/oren-nayar.frag?raw';
import cookTorranceFragment from '@/assets/examples/cook-torrance.frag?raw';
import iblMetalnessRoughnessFragment from '@/assets/examples/ibl-metalness-roughness.frag?raw';
import iblSpecularGlossinessFragment from '@/assets/examples/ibl-specular-glossiness.frag?raw';

/**
 * A parameter an example expects the User data tab to own.
 *
 * The shader body only *uses* these names: the declaration is generated from
 * the document, so an example must never declare them itself — that would
 * duplicate the generated block and fail to link.
 */
export interface ShaderExampleUniform {
  /** GLSL identifier; must be free of reserved words and engine bindings. */
  readonly name: string;
  /** Kind decides the generated type and the value widget. */
  readonly kind: UserUniformKind;
  /** Stage that receives the generated declaration. */
  readonly stages: UserUniformStage;
  /** Value seeded into the document when the example loads. */
  readonly value: UserUniformValue;
}

/**
 * One loadable example: a vertex/fragment pair that only uses the attributes
 * and uniforms the preview already binds, plus the material parameters it
 * hands to the User data tab.
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
  /** Editable parameters, in User data row order. */
  readonly uniforms: readonly ShaderExampleUniform[];
}

/** Material parameters are read by the fragment stage only. */
const MATERIAL_STAGE: UserUniformStage = 'fragment';

/** Colour parameters are `vec3` in the generated declaration. */
function colorUniform(
  name: string,
  value: UserColor3Value,
): ShaderExampleUniform {
  return { name, kind: 'color', stages: MATERIAL_STAGE, value };
}

function floatUniform(name: string, value: number): ShaderExampleUniform {
  return { name, kind: 'float', stages: MATERIAL_STAGE, value };
}

/**
 * Shader examples offered by the editor's loader, in menu order.
 *
 * Adding an example means dropping `<id>.vert` and `<id>.frag` into
 * `src/assets/examples` and appending one record here. Its material parameters
 * are listed in `uniforms` and referenced (never declared) by the shaders: the
 * loader seeds them into the User data document, which generates the
 * declarations at compile time. The menu, the loader and the coverage test all
 * read this list, so nothing else has to know about the new pair.
 */
const examples: readonly ShaderExample[] = [
  {
    id: 'lambert',
    label: 'Lambert',
    description: 'Diffuse: N dot L only',
    group: 'Lighting',
    vertex: basiclmCommonVertex,
    fragment: lambertFragment,
    uniforms: [colorUniform('albedo', { r:0.83, g:0.39, b:0.28 })],
  },
  {
    id: 'phong',
    label: 'Phong',
    description: 'Specular: reflection vector',
    group: 'Lighting',
    vertex: basiclmCommonVertex,
    fragment: phongFragment,
    uniforms: [
      colorUniform('albedo', { r: 0.72, g: 0.31, b: 0.22 }),
      colorUniform('specularColor', { r: 0.35, g: 0.35, b: 0.35 }),
      floatUniform('shininess', 48),
    ],
  },
  {
    id: 'blinn-phong',
    label: 'Blinn-Phong',
    description: 'Specular: half vector',
    group: 'Lighting',
    vertex: basiclmCommonVertex,
    fragment: blinnPhongFragment,
    uniforms: [
      colorUniform('albedo', { r: 0.72, g: 0.31, b: 0.22 }),
      colorUniform('specularColor', { r: 0.35, g: 0.35, b: 0.35 }),
      floatUniform('shininess', 48),
    ],
  },
  {
    id: 'oren-nayar',
    label: 'Oren-Nayar',
    description: 'Rough diffuse: facet slope',
    group: 'Lighting',
    vertex: basiclmCommonVertex,
    fragment: orenNayarFragment,
    uniforms: [
      colorUniform('albedo', { r: 0.72, g: 0.31, b: 0.22 }),
      floatUniform('sigma', 0.7),
    ],
  },
  {
    id: 'cook-torrance',
    label: 'Cook-Torrance',
    description: 'Specular: GGX microfacets',
    group: 'Lighting',
    vertex: basiclmCommonVertex,
    fragment: cookTorranceFragment,
    uniforms: [
      colorUniform('baseColor', { r: 0.72, g: 0.31, b: 0.22 }),
      floatUniform('roughness', 0.35),
      floatUniform('metallic', 0),
    ],
  },
  {
    id: 'ibl-metalness-roughness',
    label: 'IBL Metalness / Roughness',
    description: 'Image-based: metallic workflow',
    group: 'Image-based lighting',
    vertex: iblCommonVertex,
    fragment: iblMetalnessRoughnessFragment,
    uniforms: [
      colorUniform('baseColor', { r: 0.85, g: 0.36, b: 0.24 }),
      floatUniform('metallic', 1),
      floatUniform('roughness', 0.25),
    ],
  },
  {
    id: 'ibl-specular-glossiness',
    label: 'IBL Specular / Glossiness',
    description: 'Image-based: specular workflow',
    group: 'Image-based lighting',
    vertex: iblCommonVertex,
    fragment: iblSpecularGlossinessFragment,
    uniforms: [
      colorUniform('diffuseColor', { r: 0.16, g: 0.38, b: 0.62 }),
      colorUniform('specularColor', { r: 0.6, g: 0.6, b: 0.6 }),
      floatUniform('glossiness', 0.75),
    ],
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
