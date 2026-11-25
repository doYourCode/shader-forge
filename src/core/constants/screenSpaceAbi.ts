/**
 * The uniform/sampler contract for the Screen Space GLSL Editor.
 *
 * It is deliberately separate from the surface-shader post-effect ABI: that
 * contract is built around a single preview mesh and an LDR scene colour,
 * while this one exposes an HDR scene and a data-rich scene G-buffer.
 *
 * `materialTexture` carries Babylon's PBR reflectivity attachment:
 *   rgb = specular F0, a = glossiness (1 - roughness).
 * The metallic/roughness model is reconstructed by the helpers documented in
 * the default effect and by the debug view: roughness = 1 - a, metallic is
 * derived from F0 versus albedo.
 *
 * The specs are the single source of truth for the generated ABI reference
 * (`content/en/docs/abi-reference.md`). Keep the type and hint beside the name
 * so the documentation cannot drift from the binder.
 */

import { GLSL_RESERVED_WORDS } from './glslReservedWords.ts';

export interface ScreenSpaceUniformSpec {
  readonly glslType: 'float' | 'vec2' | 'vec3' | 'mat4';
  /** Description shown by the generated ABI reference. */
  readonly hint: string;
}

export interface ScreenSpaceSamplerSpec {
  readonly glslType: 'sampler2D';
  /** Description shown by the generated ABI reference. */
  readonly hint: string;
}

export const SCREEN_SPACE_UNIFORM_SPECS = {
  time: {
    glslType: 'float',
    hint: 'Seconds since the preview started.',
  },
  resolution: {
    glslType: 'vec2',
    hint: 'Render-target size in pixels.',
  },
  texelSize: {
    glslType: 'vec2',
    hint: '1.0 / resolution, for one-texel screen-space offsets.',
  },
  cameraNear: {
    glslType: 'float',
    hint: 'Camera near clip plane, in world units.',
  },
  cameraFar: {
    glslType: 'float',
    hint: 'Camera far clip plane, in world units.',
  },
  cameraPosition: {
    glslType: 'vec3',
    hint: 'Camera position in world space.',
  },
  projection: {
    glslType: 'mat4',
    hint: 'Camera projection matrix (view space to clip space).',
  },
  inverseProjection: {
    glslType: 'mat4',
    hint: 'Inverse projection, for reconstructing view-space position from depth.',
  },
  view: {
    glslType: 'mat4',
    hint: 'Camera view matrix (world space to view space).',
  },
  inverseView: {
    glslType: 'mat4',
    hint: 'Inverse view matrix (view space to world space).',
  },
  viewProjection: {
    glslType: 'mat4',
    hint: 'Combined view * projection matrix (world space to clip space).',
  },
  inverseViewProjection: {
    glslType: 'mat4',
    hint: 'Inverse of viewProjection, for reconstructing world-space position from depth.',
  },
  previousViewProjection: {
    glslType: 'mat4',
    hint: 'Last frame’s viewProjection, used to reproject motion vectors.',
  },
  frameIndex: {
    glslType: 'float',
    hint: 'Monotonic frame counter, useful for temporal noise and jitter.',
  },
  deltaTime: {
    glslType: 'float',
    hint: 'Seconds elapsed since the previous frame.',
  },
} as const satisfies Record<string, ScreenSpaceUniformSpec>;

export const SCREEN_SPACE_SAMPLER_SPECS = {
  textureSampler: {
    glslType: 'sampler2D',
    hint: 'Output of the previous pass; the first pass receives the HDR scene colour.',
  },
  sceneColorTexture: {
    glslType: 'sampler2D',
    hint: 'The original, unmodified HDR scene colour (not the previous pass).',
  },
  depthTexture: {
    glslType: 'sampler2D',
    hint: 'Linear view-space depth in world units (positive distance); background is the far plane.',
  },
  normalTexture: {
    glslType: 'sampler2D',
    hint: 'View-space normal encoded as n * 0.5 + 0.5 in rgb; a = geometry mask (1 on geometry, 0 on background).',
  },
  albedoTexture: {
    glslType: 'sampler2D',
    hint: 'sqrt-encoded linear base colour in rgb (square it to decode); a = geometry mask.',
  },
  materialTexture: {
    glslType: 'sampler2D',
    hint: 'PBR reflectivity: rgb = specular F0, a = glossiness (1 - roughness). Reconstruct metallic from F0 versus albedo.',
  },
  velocityTexture: {
    glslType: 'sampler2D',
    hint: 'Linear UV-space motion vectors in rg; values may be negative.',
  },
} as const satisfies Record<string, ScreenSpaceSamplerSpec>;

export const SCREEN_SPACE_UNIFORM_NAMES = {
  time: 'time',
  resolution: 'resolution',
  texelSize: 'texelSize',
  cameraNear: 'cameraNear',
  cameraFar: 'cameraFar',
  cameraPosition: 'cameraPosition',
  projection: 'projection',
  inverseProjection: 'inverseProjection',
  view: 'view',
  inverseView: 'inverseView',
  viewProjection: 'viewProjection',
  inverseViewProjection: 'inverseViewProjection',
  previousViewProjection: 'previousViewProjection',
  frameIndex: 'frameIndex',
  deltaTime: 'deltaTime',
} as const;

export const SCREEN_SPACE_SAMPLER_NAMES = {
  /** Output of the previous pass; the first pass receives the HDR scene. */
  scene: 'textureSampler',
  /** The original, unmodified HDR scene colour (not the previous pass). */
  sceneColor: 'sceneColorTexture',
  /** Linear view-space depth in world units (positive distance). */
  depth: 'depthTexture',
  /** View-space normal, encoded as n * 0.5 + 0.5; a = geometry mask. */
  normal: 'normalTexture',
  /** Linear base colour; a = geometry mask. */
  albedo: 'albedoTexture',
  /** PBR reflectivity: rgb = F0, a = glossiness. */
  material: 'materialTexture',
  /** Linear UV-space motion vectors. */
  velocity: 'velocityTexture',
} as const;

export const SCREEN_SPACE_UNIFORMS: readonly string[] = [
  ...Object.values(SCREEN_SPACE_UNIFORM_NAMES),
];

export const SCREEN_SPACE_SAMPLERS: readonly string[] = [
  ...Object.values(SCREEN_SPACE_SAMPLER_NAMES),
];

/** Uniforms the internal display pass adds on top of the public contract. */
export const SCREEN_SPACE_DISPLAY_UNIFORM_NAMES = {
  toneMappingMode: 'toneMappingMode',
  debugMode: 'debugMode',
} as const;

/** Display-only uniforms, with the same type/hint contract as the public ABI. */
export const SCREEN_SPACE_DISPLAY_UNIFORM_SPECS = {
  toneMappingMode: {
    glslType: 'float',
    hint: 'Output transform selected in the effect stack: 0 = linear to sRGB, 1 = Reinhard, 2 = ACES.',
  },
  debugMode: {
    glslType: 'float',
    hint: 'G-buffer debug view selector. 0 = final image; the values are declared in screenSpaceDebug.ts.',
  },
} as const satisfies Record<string, ScreenSpaceUniformSpec>;

export const SCREEN_SPACE_DISPLAY_UNIFORMS: readonly string[] = [
  ...SCREEN_SPACE_UNIFORMS,
  ...Object.values(SCREEN_SPACE_DISPLAY_UNIFORM_NAMES),
];

/** Samplers only the internal display pass sees. */
export const SCREEN_SPACE_DISPLAY_SAMPLER_NAMES = {
  transparent: 'transparentTexture',
} as const;

export const SCREEN_SPACE_DISPLAY_SAMPLER_SPECS = {
  transparentTexture: {
    glslType: 'sampler2D',
    hint: 'Transparent/transmissive overlay colour. Present only when TRANSPARENT_OVERLAY_ENABLED is true; otherwise those surfaces render in the main pass.',
  },
} as const satisfies Record<string, ScreenSpaceSamplerSpec>;

export const SCREEN_SPACE_DISPLAY_SAMPLERS: readonly string[] = [
  ...SCREEN_SPACE_SAMPLERS,
  ...Object.values(SCREEN_SPACE_DISPLAY_SAMPLER_NAMES),
];

/** Varyings and outputs the post-process pipeline owns. */
const RESERVED_FRAGMENT_NAMES: readonly string[] = [
  'vUV',
  'fragColor',
  'gl_FragColor',
];

/**
 * Every name a screen-space user uniform may not use. Includes the GLSL
 * reserved words so a user cannot declare `uniform`, `precision`, etc.
 */
export const SCREEN_SPACE_RESERVED_NAMES: ReadonlySet<string> = new Set([
  ...GLSL_RESERVED_WORDS,
  ...SCREEN_SPACE_UNIFORMS,
  ...SCREEN_SPACE_SAMPLERS,
  ...SCREEN_SPACE_DISPLAY_UNIFORMS,
  ...SCREEN_SPACE_DISPLAY_SAMPLERS,
  ...RESERVED_FRAGMENT_NAMES,
  'scale',
]);
