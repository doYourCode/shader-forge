/**
 * The uniform/sampler contract shared by view-space effects, the preview
 * binder and the built-in reference shown to users. Every name here is
 * reserved: user data cannot declare a uniform that collides with it.
 */

export const POST_EFFECT_UNIFORM_NAMES = {
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
} as const;

export const POST_EFFECT_SAMPLER_NAMES = {
  /** Output of the previous pass (linear scene colour for the first effect). */
  scene: 'textureSampler',
  /** View-space normal of the scene (rgb, encoded as n * 0.5 + 0.5). */
  gbuffer: 'gbufferTexture',
  /**
   * Normalised linear view depth in r: 0 = near plane, 1 = far plane and the
   * cleared background. World units are `cameraNear + r * (cameraFar - cameraNear)`.
   */
  depth: 'depthTexture',
} as const;

export const POST_EFFECT_UNIFORMS: readonly string[] = [
  ...Object.values(POST_EFFECT_UNIFORM_NAMES),
];

export const POST_EFFECT_SAMPLERS: readonly string[] = [
  ...Object.values(POST_EFFECT_SAMPLER_NAMES),
];

/** Uniform the internal display pass uses to pick the output transform. */
export const POST_EFFECT_TONEMAP_UNIFORM = 'toneMappingMode';

/** Varyings and outputs Babylon's post process pipeline owns. */
const RESERVED_FRAGMENT_NAMES: readonly string[] = [
  'vUV',
  'fragColor',
  'gl_FragColor',
];

/**
 * Everything a user uniform must not be called: the ABI, the post-process
 * internals and the display pass parameter.
 */
export const POST_EFFECT_RESERVED_NAMES: ReadonlySet<string> = new Set([
  ...POST_EFFECT_UNIFORMS,
  ...POST_EFFECT_SAMPLERS,
  ...RESERVED_FRAGMENT_NAMES,
  POST_EFFECT_TONEMAP_UNIFORM,
  'scale',
]);
