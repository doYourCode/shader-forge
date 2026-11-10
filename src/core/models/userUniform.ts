/**
 * The user-defined uniform model. A `UserDataDocument` is the single source of
 * truth for the "User data" tab: the GLSL block and the table are projections
 * of it. Values and definitions live together so a rewrite always regenerates
 * both from the same snapshot.
 */

export type UserUniformKind =
  | 'float'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'color'
  | 'color4'
  | 'direction'
  | 'position'
  | 'sampler2D'
  | 'samplerCube';

/** Which stage the declaration must be emitted into. */
export type UserUniformStage = 'fragment' | 'vertex' | 'both';

/** The texture kinds are the only kinds whose value is a texture source. */
export type SamplerKind = 'sampler2D' | 'samplerCube';

/**
 * Where a texture uniform's pixels come from. `file` sources are materialised
 * as an ObjectURL by the texture registry, which also revokes it. `repository`
 * sources store a stable catalog id; the registry resolves it to the bundled
 * asset URL, so the value never depends on Vite's hashed filenames.
 */
export type UserTextureSource =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'file'; readonly file: File }
  | { readonly kind: 'repository'; readonly textureId: string };

export interface UserVector2Value {
  x: number;
  y: number;
}

export interface UserVector3Value {
  x: number;
  y: number;
  z: number;
}

export interface UserVector4Value {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface UserColor3Value {
  r: number;
  g: number;
  b: number;
}

export interface UserColor4Value {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Maps each kind to the shape of its editable value, so the table, the binder
 * and the codegen can share one definition of "a value for this kind".
 */
export interface UserUniformValueTypes {
  float: number;
  vec2: UserVector2Value;
  vec3: UserVector3Value;
  vec4: UserVector4Value;
  color: UserColor3Value;
  color4: UserColor4Value;
  direction: UserVector3Value;
  position: UserVector3Value;
  sampler2D: UserTextureSource;
  samplerCube: UserTextureSource;
}

export type UserUniformValue = UserUniformValueTypes[UserUniformKind];

export interface UserUniformDefinition {
  /** Stable identity; survives renames so texture registrations stay valid. */
  readonly id: string;
  name: string;
  kind: UserUniformKind;
  stages: UserUniformStage;
  value: UserUniformValue;
}

export interface UserDataDocument {
  /** Incremented on every value or structural edit. */
  revision: number;
  definitions: UserUniformDefinition[];
}

/** GLSL ES identifiers only: a letter or underscore, then word characters. */
export const UNIFORM_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * GLSL ES keywords and reserved words (1.00 plus the 3.00 additions). Names in
 * this list are rejected before the shader reaches the compiler.
 */
export const GLSL_RESERVED_WORDS: readonly string[] = [
  // Preprocessor and qualifiers.
  'attribute',
  'const',
  'uniform',
  'varying',
  'buffer',
  'shared',
  'coherent',
  'volatile',
  'restrict',
  'readonly',
  'writeonly',
  'layout',
  'centroid',
  'flat',
  'smooth',
  'noperspective',
  'patch',
  'sample',
  'invariant',
  'precise',
  'subroutine',
  'lowp',
  'mediump',
  'highp',
  'precision',
  'in',
  'out',
  'inout',
  // Control flow.
  'break',
  'continue',
  'do',
  'for',
  'while',
  'switch',
  'case',
  'default',
  'if',
  'else',
  'return',
  'discard',
  // Types.
  'void',
  'bool',
  'true',
  'false',
  'float',
  'double',
  'int',
  'uint',
  'struct',
  'vec2',
  'vec3',
  'vec4',
  'dvec2',
  'dvec3',
  'dvec4',
  'bvec2',
  'bvec3',
  'bvec4',
  'ivec2',
  'ivec3',
  'ivec4',
  'uvec2',
  'uvec3',
  'uvec4',
  'mat2',
  'mat3',
  'mat4',
  'mat2x2',
  'mat2x3',
  'mat2x4',
  'mat3x2',
  'mat3x3',
  'mat3x4',
  'mat4x2',
  'mat4x3',
  'mat4x4',
  'dmat2',
  'dmat3',
  'dmat4',
  'dmat2x2',
  'dmat2x3',
  'dmat2x4',
  'dmat3x2',
  'dmat3x3',
  'dmat3x4',
  'dmat4x2',
  'dmat4x3',
  'dmat4x4',
  // Samplers.
  'sampler1D',
  'sampler2D',
  'sampler3D',
  'samplerCube',
  'sampler1DShadow',
  'sampler2DShadow',
  'samplerCubeShadow',
  'sampler1DArray',
  'sampler2DArray',
  'sampler1DArrayShadow',
  'sampler2DArrayShadow',
  'sampler2DRect',
  'sampler2DRectShadow',
  'samplerBuffer',
  'sampler2DMS',
  'sampler2DMSArray',
  'isampler1D',
  'isampler2D',
  'isampler3D',
  'isamplerCube',
  'isampler1DArray',
  'isampler2DArray',
  'isampler2DRect',
  'isamplerBuffer',
  'isampler2DMS',
  'isampler2DMSArray',
  'usampler1D',
  'usampler2D',
  'usampler3D',
  'usamplerCube',
  'usampler1DArray',
  'usampler2DArray',
  'usampler2DRect',
  'usamplerBuffer',
  'usampler2DMS',
  'usampler2DMSArray',
  // Reserved for future use by the language.
  'asm',
  'class',
  'union',
  'enum',
  'typedef',
  'template',
  'this',
  'packed',
  'goto',
  'inline',
  'noinline',
  'public',
  'static',
  'extern',
  'external',
  'interface',
  'long',
  'short',
  'half',
  'fixed',
  'unsigned',
  'superp',
  'input',
  'output',
  'hvec2',
  'hvec3',
  'hvec4',
  'fvec2',
  'fvec3',
  'fvec4',
  'sizeof',
  'cast',
  'namespace',
  'using',
  'main',
];

export type NameValidationReason = 'invalid' | 'reserved' | 'duplicate';

export type NameValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: NameValidationReason };

export function isSamplerKind(kind: UserUniformKind): kind is SamplerKind {
  return kind === 'sampler2D' || kind === 'samplerCube';
}

export function isTextureSource(value: UserUniformValue): value is UserTextureSource {
  if (typeof value !== 'object' || value === null) return false;

  const source = value as {
    kind?: unknown;
    url?: unknown;
    file?: unknown;
    textureId?: unknown;
  };

  switch (source.kind) {
    case 'file':
      return source.file instanceof File;
    case 'url':
      return typeof source.url === 'string';
    case 'repository':
      return typeof source.textureId === 'string';
    default:
      return false;
  }
}

/** True when the source points at something that can actually be loaded. */
export function hasTextureContent(value: UserUniformValue): boolean {
  if (!isTextureSource(value)) return false;

  switch (value.kind) {
    case 'file':
      return true;
    case 'url':
      return value.url.trim().length > 0;
    case 'repository':
      return value.textureId.trim().length > 0;
  }
}

/**
 * Validates a candidate uniform name against the identifier grammar, the
 * built-in/reserved word sets and the names already in use.
 *
 * Callers pass `takenNames` without the row being renamed so a rename can keep
 * its own name.
 */
export function validateUniformName(
  name: string,
  takenNames: ReadonlySet<string>,
  reservedNames: ReadonlySet<string>,
): NameValidationResult {
  if (!UNIFORM_NAME_PATTERN.test(name)) return { ok: false, reason: 'invalid' };
  if (reservedNames.has(name)) return { ok: false, reason: 'reserved' };
  if (takenNames.has(name)) return { ok: false, reason: 'duplicate' };
  return { ok: true };
}

export function createEmptyUserDataDocument(): UserDataDocument {
  return { revision: 0, definitions: [] };
}

/** Narrows a union value to the shape expected by `kind`. */
export function isValueForKind(
  kind: UserUniformKind,
  value: UserUniformValue,
): boolean {
  switch (kind) {
    case 'float':
      return typeof value === 'number' && Number.isFinite(value);
    case 'vec2':
      return hasFiniteNumbers(value, ['x', 'y']);
    case 'vec3':
    case 'direction':
    case 'position':
      return hasFiniteNumbers(value, ['x', 'y', 'z']);
    case 'vec4':
      return hasFiniteNumbers(value, ['x', 'y', 'z', 'w']);
    case 'color':
      return hasFiniteNumbers(value, ['r', 'g', 'b']);
    case 'color4':
      return hasFiniteNumbers(value, ['r', 'g', 'b', 'a']);
    case 'sampler2D':
    case 'samplerCube':
      return isTextureSource(value);
  }
}

function hasFiniteNumbers(value: UserUniformValue, keys: readonly string[]) {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;
  return keys.every(
    (key) => typeof record[key] === 'number' && Number.isFinite(record[key]),
  );
}
