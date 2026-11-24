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
 */

import { GLSL_RESERVED_WORDS } from '@/core/constants/glslReservedWords';

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
  /** Object id in r. 0 is background/unknown. */
  objectId: 'objectIdTexture',
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

export const SCREEN_SPACE_DISPLAY_UNIFORMS: readonly string[] = [
  ...SCREEN_SPACE_UNIFORMS,
  ...Object.values(SCREEN_SPACE_DISPLAY_UNIFORM_NAMES),
];

/** Samplers only the internal display pass sees. */
export const SCREEN_SPACE_DISPLAY_SAMPLER_NAMES = {
  transparent: 'transparentTexture',
} as const;

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
