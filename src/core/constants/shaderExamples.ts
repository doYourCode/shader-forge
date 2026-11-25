import { resolveExampleThumbnailUrl } from '@/core/assets/assetUrls';
import { createCatalog } from '@/core/assets/catalog';
import type {
  UserColor3Value,
  UserUniformKind,
  UserUniformStage,
  UserUniformValue,
} from '@/core/models/userUniform';

import iblCommonVertex from '@/assets/examples/ibl-common.vert?raw';
import basiclmCommonVertex from '@/assets/examples/basiclm-common.vert?raw';
import tangentCommonVertex from '@/assets/examples/tangent-common.vert?raw';
import displacementVertex from '@/assets/examples/displacement.vert?raw';
import lambertFragment from '@/assets/examples/lambert.frag?raw';
import phongFragment from '@/assets/examples/phong.frag?raw';
import blinnPhongFragment from '@/assets/examples/blinn-phong.frag?raw';
import orenNayarFragment from '@/assets/examples/oren-nayar.frag?raw';
import cookTorranceFragment from '@/assets/examples/cook-torrance.frag?raw';
import toonFragment from '@/assets/examples/toon.frag?raw';
import rimLightFragment from '@/assets/examples/rim-light.frag?raw';
import normalMapFragment from '@/assets/examples/normal-map.frag?raw';
import displacementFragment from '@/assets/examples/displacement.frag?raw';
import reflectionsFragment from '@/assets/examples/reflections.frag?raw';
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
  /** Stable id; also the base name of the fragment stage file. */
  readonly id: string;
  /** Name shown in the picker grid. */
  readonly label: string;
  /** One-line summary of the technique. */
  readonly description: string;
  /** Picker folder; examples sharing a label share one folder. */
  readonly group: string;
  /**
   * Baked grid preview. `undefined` until `npm run bake:examples` produced
   * `src/assets/examples/thumbs/<id>.webp`; the picker then shows the
   * extension badge instead.
   */
  readonly thumbnailUrl?: string;
  readonly vertex: string;
  readonly fragment: string;
  /** Editable parameters, in User data row order. */
  readonly uniforms: readonly ShaderExampleUniform[];
}

/** One picker folder: every example sharing a group label. */
export interface ShaderExampleGroup {
  /** Stable folder id used by the picker's storage tree. */
  readonly id: string;
  /** Authored group label, used as the folder name. */
  readonly label: string;
  readonly examples: readonly ShaderExample[];
}

/**
 * Read-only catalog port over the bundled examples. Consumers (the picker
 * adapter) depend on this shape rather than on the module-level array, so the
 * registry can grow without touching them.
 */
export interface ShaderExampleCatalog {
  readonly all: readonly ShaderExample[];
  readonly groups: readonly ShaderExampleGroup[];
  find(id: string): ShaderExample | undefined;
}

/** Material parameters are read by the fragment stage only. */
const MATERIAL_STAGE: UserUniformStage = 'fragment';

/** The displacement example owns a vertex-stage parameter. */
const VERTEX_STAGE: UserUniformStage = 'vertex';

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

function vertexFloatUniform(name: string, value: number): ShaderExampleUniform {
  return { name, kind: 'float', stages: VERTEX_STAGE, value };
}

/**
 * Shader examples offered by the editor's loader, in picker order.
 *
 * Adding an example means dropping a fragment stage into
 * `src/assets/examples` (reusing a shared vertex stage when the technique
 * allows it), baking its preview with `npm run bake:examples`, and appending
 * one record here. Its material parameters are listed in `uniforms` and
 * referenced (never declared) by the shaders: the loader seeds them into the
 * User data document, which generates the declarations at compile time. The
 * picker, the loader and the coverage test all read this list, so nothing else
 * has to know about the new pair.
 */
const examples: readonly ShaderExample[] = [
  {
    id: 'lambert',
    label: 'Lambert',
    description: 'Diffuse: N dot L only',
    group: 'Lighting',
    thumbnailUrl: resolveExampleThumbnailUrl('examples/thumbs/lambert.webp'),
    vertex: basiclmCommonVertex,
    fragment: lambertFragment,
    uniforms: [colorUniform('albedo', { r: 0.83, g: 0.39, b: 0.28 })],
  },
  {
    id: 'phong',
    label: 'Phong',
    description: 'Specular: reflection vector',
    group: 'Lighting',
    thumbnailUrl: resolveExampleThumbnailUrl('examples/thumbs/phong.webp'),
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
    thumbnailUrl: resolveExampleThumbnailUrl(
      'examples/thumbs/blinn-phong.webp',
    ),
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
    thumbnailUrl: resolveExampleThumbnailUrl('examples/thumbs/oren-nayar.webp'),
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
    thumbnailUrl: resolveExampleThumbnailUrl(
      'examples/thumbs/cook-torrance.webp',
    ),
    vertex: basiclmCommonVertex,
    fragment: cookTorranceFragment,
    uniforms: [
      colorUniform('baseColor', { r: 0.72, g: 0.31, b: 0.22 }),
      floatUniform('roughness', 0.35),
      floatUniform('metallic', 0),
    ],
  },
  {
    id: 'toon',
    label: 'Toon',
    description: 'Quantised N dot L bands',
    group: 'Surface',
    thumbnailUrl: resolveExampleThumbnailUrl('examples/thumbs/toon.webp'),
    vertex: basiclmCommonVertex,
    fragment: toonFragment,
    uniforms: [
      colorUniform('albedo', { r: 0.34, g: 0.58, b: 0.86 }),
      floatUniform('bands', 3),
    ],
  },
  {
    id: 'rim-light',
    label: 'Rim light',
    description: 'Fresnel edge glow',
    group: 'Surface',
    thumbnailUrl: resolveExampleThumbnailUrl('examples/thumbs/rim-light.webp'),
    vertex: basiclmCommonVertex,
    fragment: rimLightFragment,
    uniforms: [
      colorUniform('albedo', { r: 0.16, g: 0.18, b: 0.24 }),
      colorUniform('rimColor', { r: 0.4, g: 0.8, b: 1.0 }),
      floatUniform('rimPower', 2.5),
    ],
  },
  {
    id: 'normal-map',
    label: 'Normal map',
    description: 'Procedural TBN perturbation',
    group: 'Surface',
    thumbnailUrl: resolveExampleThumbnailUrl('examples/thumbs/normal-map.webp'),
    vertex: tangentCommonVertex,
    fragment: normalMapFragment,
    uniforms: [
      colorUniform('albedo', { r: 0.62, g: 0.44, b: 0.3 }),
      floatUniform('normalStrength', 1.4),
    ],
  },
  {
    id: 'displacement',
    label: 'Displacement',
    description: 'Vertex wave along the normal',
    group: 'Surface',
    thumbnailUrl: resolveExampleThumbnailUrl(
      'examples/thumbs/displacement.webp',
    ),
    vertex: displacementVertex,
    fragment: displacementFragment,
    uniforms: [
      vertexFloatUniform('amplitude', 0.09),
      colorUniform('albedo', { r: 0.3, g: 0.62, b: 0.44 }),
    ],
  },
  {
    id: 'reflections',
    label: 'Environment reflection',
    description: 'Cubemap reflection with Fresnel-free mix',
    group: 'Surface',
    thumbnailUrl: resolveExampleThumbnailUrl(
      'examples/thumbs/reflections.webp',
    ),
    vertex: basiclmCommonVertex,
    fragment: reflectionsFragment,
    uniforms: [
      colorUniform('albedo', { r: 0.14, g: 0.16, b: 0.2 }),
      floatUniform('reflectivity', 0.65),
    ],
  },
  {
    id: 'ibl-metalness-roughness',
    label: 'IBL Metalness / Roughness',
    description: 'Image-based: metallic workflow',
    group: 'Image-based lighting',
    thumbnailUrl: resolveExampleThumbnailUrl(
      'examples/thumbs/ibl-metalness-roughness.webp',
    ),
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
    thumbnailUrl: resolveExampleThumbnailUrl(
      'examples/thumbs/ibl-specular-glossiness.webp',
    ),
    vertex: iblCommonVertex,
    fragment: iblSpecularGlossinessFragment,
    uniforms: [
      colorUniform('diffuseColor', { r: 0.16, g: 0.38, b: 0.62 }),
      colorUniform('specularColor', { r: 0.6, g: 0.6, b: 0.6 }),
      floatUniform('glossiness', 0.75),
    ],
  },
];

const catalog = createCatalog('shaderExamples', examples);

/** Every bundled example, frozen so the picker cannot reorder the source list. */
export const shaderExamples: readonly ShaderExample[] = catalog.all;

/** Every picker folder, in first-seen order. */
export const shaderExampleGroups: readonly ShaderExampleGroup[] =
  groupExamples(shaderExamples);

/** Catalog over the bundled examples, for the picker's adapter. */
export const shaderExampleCatalog: ShaderExampleCatalog = Object.freeze({
  all: shaderExamples,
  groups: shaderExampleGroups,
  find: (id: string) => catalog.find(id),
});

export function findShaderExample(id: string): ShaderExample | undefined {
  return catalog.find(id);
}

/** Consecutive examples sharing a group label become one picker folder. */
function groupExamples(
  entries: readonly ShaderExample[],
): readonly ShaderExampleGroup[] {
  const grouped = new Map<string, ShaderExample[]>();

  for (const example of entries) {
    const list = grouped.get(example.group);

    if (list) {
      list.push(example);
    } else {
      grouped.set(example.group, [example]);
    }
  }

  return Object.freeze(
    [...grouped].map(([label, groupedExamples]) =>
      Object.freeze({
        id: groupSlug(label),
        label,
        examples: Object.freeze(groupedExamples),
      }),
    ),
  );
}

/** Folder id derived from the group label; stable as long as the label is. */
function groupSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
