/**
 * The uniform/sampler contract shared by view-space effects, the preview
 * binder and the built-in reference shown to users. Every name here is
 * reserved: user data cannot declare a uniform that collides with it.
 *
 * The specs are the single source of truth for the generated ABI reference
 * (`content/en/docs/abi-reference.md`). Keep the type and hint beside the name
 * so the documentation cannot drift from the binder.
 */

export interface PostEffectUniformSpec {
  readonly glslType: 'float' | 'vec2' | 'vec3' | 'mat4';
  /** Description shown by the generated ABI reference. */
  readonly hint: string;
}

export interface PostEffectSamplerSpec {
  readonly glslType: 'sampler2D';
  /** Description shown by the generated ABI reference. */
  readonly hint: string;
}

export const POST_EFFECT_UNIFORM_SPECS = {
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
} as const satisfies Record<string, PostEffectUniformSpec>;

export const POST_EFFECT_SAMPLER_SPECS = {
  textureSampler: {
    glslType: 'sampler2D',
    hint: 'Output of the previous pass; linear scene colour for the first effect.',
  },
  gbufferTexture: {
    glslType: 'sampler2D',
    hint: 'View-space normal in rgb, encoded as n * 0.5 + 0.5; a = geometry mask.',
  },
  depthTexture: {
    glslType: 'sampler2D',
    hint: 'Normalised linear view depth in r: 0 = near plane, 1 = far plane and the cleared background. World units: cameraNear + r * (cameraFar - cameraNear).',
  },
} as const satisfies Record<string, PostEffectSamplerSpec>;

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
