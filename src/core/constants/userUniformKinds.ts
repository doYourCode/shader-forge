import {
  type UserUniformKind,
  type UserUniformValue,
} from '@/core/models/userUniform';

/**
 * How the value cell renders for a kind. The table maps these descriptors onto
 * the widgets in `UniformValueInput.vue`.
 */
export type UserUniformWidget = 'number' | 'vector' | 'color' | 'texture';

export interface UserUniformKindMeta {
  readonly kind: UserUniformKind;
  /** vue-i18n key for the human-readable kind name. */
  readonly labelKey: string;
  /** GLSL type emitted in the generated declaration. */
  readonly glslType: string;
  /** Short hint appended to the generated declaration. */
  readonly hint: string;
  readonly widget: UserUniformWidget;
  /** Fresh default so definitions never share mutable value objects. */
  readonly createDefault: () => UserUniformValue;
}

export const USER_UNIFORM_KINDS: readonly UserUniformKindMeta[] = [
  {
    kind: 'float',
    labelKey: 'userData.kinds.float',
    glslType: 'float',
    hint: 'float',
    widget: 'number',
    createDefault: () => 0,
  },
  {
    kind: 'vec2',
    labelKey: 'userData.kinds.vec2',
    glslType: 'vec2',
    hint: 'vec2',
    widget: 'vector',
    createDefault: () => ({ x: 0, y: 0 }),
  },
  {
    kind: 'vec3',
    labelKey: 'userData.kinds.vec3',
    glslType: 'vec3',
    hint: 'vec3',
    widget: 'vector',
    createDefault: () => ({ x: 0, y: 0, z: 0 }),
  },
  {
    kind: 'vec4',
    labelKey: 'userData.kinds.vec4',
    glslType: 'vec4',
    hint: 'vec4',
    widget: 'vector',
    createDefault: () => ({ x: 0, y: 0, z: 0, w: 0 }),
  },
  {
    kind: 'color',
    labelKey: 'userData.kinds.color',
    glslType: 'vec3',
    hint: 'color (RGB)',
    widget: 'color',
    createDefault: () => ({ r: 1, g: 1, b: 1 }),
  },
  {
    kind: 'color4',
    labelKey: 'userData.kinds.color4',
    glslType: 'vec4',
    hint: 'color (RGBA)',
    widget: 'color',
    createDefault: () => ({ r: 1, g: 1, b: 1, a: 1 }),
  },
  {
    kind: 'direction',
    labelKey: 'userData.kinds.direction',
    glslType: 'vec3',
    hint: 'direction (normalized)',
    widget: 'vector',
    createDefault: () => ({ x: 0, y: 1, z: 0 }),
  },
  {
    kind: 'position',
    labelKey: 'userData.kinds.position',
    glslType: 'vec3',
    hint: 'position (object-space)',
    widget: 'vector',
    createDefault: () => ({ x: 0, y: 0, z: 0 }),
  },
  {
    kind: 'sampler2D',
    labelKey: 'userData.kinds.sampler2D',
    glslType: 'sampler2D',
    hint: 'texture 2D',
    widget: 'texture',
    createDefault: () => ({ kind: 'url', url: '' }),
  },
  {
    kind: 'samplerCube',
    labelKey: 'userData.kinds.samplerCube',
    glslType: 'samplerCube',
    hint: 'cube texture',
    widget: 'texture',
    createDefault: () => ({ kind: 'url', url: '' }),
  },
];

export const USER_UNIFORM_KIND_MAP: Record<UserUniformKind, UserUniformKindMeta> =
  USER_UNIFORM_KINDS.reduce(
    (map, meta) => {
      map[meta.kind] = meta;
      return map;
    },
    {} as Record<UserUniformKind, UserUniformKindMeta>,
  );

/** Components edited for each vector-like kind, in GLSL order. */
export const USER_UNIFORM_VECTOR_COMPONENTS: Record<
  'vec2' | 'vec3' | 'vec4' | 'direction' | 'position',
  readonly string[]
> = {
  vec2: ['x', 'y'],
  vec3: ['x', 'y', 'z'],
  vec4: ['x', 'y', 'z', 'w'],
  direction: ['x', 'y', 'z'],
  position: ['x', 'y', 'z'],
};

export function defaultUniformValue(kind: UserUniformKind): UserUniformValue {
  return USER_UNIFORM_KIND_MAP[kind].createDefault();
}

export function uniformKindMeta(kind: UserUniformKind): UserUniformKindMeta {
  return USER_UNIFORM_KIND_MAP[kind];
}
