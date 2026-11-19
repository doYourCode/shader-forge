/**
 * The surface-shader ABI: the vertex attributes, uniforms and samplers the
 * preview material always provides.
 *
 * This module is pure data on purpose. The post-effect ABI lives beside it in
 * `postEffectAbi.ts`, and the user-data validator and the built-in reference
 * both read these declarations, so neither may pull Babylon into the domain.
 *
 * Each family is declared once, keyed by its GLSL identifier. The exported
 * lists are derived from those keys, so a name can never be registered in one
 * place and be missing from another.
 */

export interface ShaderAttributeSpec {
  readonly glslType: 'vec2' | 'vec3' | 'vec4';
  /** Description shown by the built-in `Attributes` reference tab. */
  readonly hint: string;
}

export type ShaderAttributeName =
  'position' | 'normal' | 'tangent' | 'uv' | 'uv2' | 'color';

export const SHADER_ATTRIBUTE_SPECS = {
  position: {
    glslType: 'vec3',
    hint: 'Vertex position in object/local space;',
  },
  normal: { glslType: 'vec3', hint: 'Surface normal direction;' },
  tangent: { glslType: 'vec3', hint: 'Tangent direction for normal mapping;' },
  uv: { glslType: 'vec2', hint: 'Primary texture coordinates;' },
  uv2: { glslType: 'vec2', hint: 'Secondary texture coordinates;' },
  color: { glslType: 'vec4', hint: 'Vertex color (RGBA).' },
} as const satisfies Record<ShaderAttributeName, ShaderAttributeSpec>;

export interface ShaderUniformSpec {
  readonly glslType: 'mat3' | 'mat4' | 'float' | 'vec3';
  /** Description shown by the built-in `Uniforms` reference tab. */
  readonly hint: string;
}

export type ShaderUniformName =
  | 'world'
  | 'view'
  | 'projection'
  | 'normalMatrix'
  | 'time'
  | 'cameraPos'
  | 'lightDir';

export const SHADER_UNIFORM_SPECS = {
  world: { glslType: 'mat4', hint: 'Mesh world matrix;' },
  view: { glslType: 'mat4', hint: 'Camera view matrix;' },
  projection: { glslType: 'mat4', hint: 'Camera projection matrix;' },
  time: { glslType: 'float', hint: 'Seconds since the animation started;' },
  cameraPos: {
    glslType: 'vec3',
    hint: 'Camera position in world space;',
  },
  lightDir: {
    glslType: 'vec3',
    hint: 'Direction vector of the directional light, in world space.',
  },
  normalMatrix: {
    glslType: 'mat3',
    hint: 'Inverse-transpose world matrix, applied to normals.',
  },
} as const satisfies Record<ShaderUniformName, ShaderUniformSpec>;

export interface ShaderSamplerSpec {
  readonly glslType: 'sampler2D' | 'samplerCube';
  /** Description shown by the built-in `Uniforms` reference tab. */
  readonly hint: string;
}

export type ShaderSamplerName =
  'environmentMap' | 'irradianceMap' | 'prefilteredEnvironmentMap' | 'brdfLUT';

export const SHADER_SAMPLER_SPECS = {
  environmentMap: {
    glslType: 'samplerCube',
    hint: 'Active scene HDRI;',
  },
  irradianceMap: {
    glslType: 'samplerCube',
    hint: 'Diffuse irradiance (cosine-convolved environment cubemap);',
  },
  prefilteredEnvironmentMap: {
    glslType: 'samplerCube',
    hint: 'GGX-prefiltered specular cubemap (higher mip levels = rougher);',
  },
  brdfLUT: {
    glslType: 'sampler2D',
    hint: 'Split-sum LUT (R = bias, G = albedo); sample at (NdotV, roughness), then mix(R, G, F0).',
  },
} as const satisfies Record<ShaderSamplerName, ShaderSamplerSpec>;

/** Names the material registers as vertex attributes, in declaration order. */
export const SHADER_ATTRIBUTES: string[] = Object.keys(SHADER_ATTRIBUTE_SPECS);

/** Names the material registers as uniforms, in declaration order. */
export const SHADER_UNIFORMS: string[] = Object.keys(SHADER_UNIFORM_SPECS);

/** Names the material registers as samplers, in declaration order. */
export const SHADER_SAMPLERS: string[] = Object.keys(SHADER_SAMPLER_SPECS);

/**
 * Uniforms the animator writes every frame, by symbolic key. Typed as a subset
 * of the ABI so a renamed uniform fails to compile instead of silently
 * unbinding.
 */
export const SHADER_UNIFORM_NAMES = {
  time: 'time',
  cameraPos: 'cameraPos',
  lightDir: 'lightDir',
  normalMatrix: 'normalMatrix',
} as const satisfies Record<string, ShaderUniformName>;

/** Samplers the animator/IBL binder writes every frame, by symbolic key. */
export const SHADER_SAMPLER_NAMES = {
  environment: 'environmentMap',
  irradiance: 'irradianceMap',
  prefilteredEnvironment: 'prefilteredEnvironmentMap',
  brdfLut: 'brdfLUT',
} as const satisfies Record<string, ShaderSamplerName>;
