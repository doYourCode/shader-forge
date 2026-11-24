import sandboxVertexShader from '@/assets/internal-shaders/sandbox.vert.glsl?raw';
import sandboxFragmentShader from '@/assets/internal-shaders/sandbox.frag.glsl?raw';
import { GLSL_RESERVED_WORDS } from '@/core/constants/glslReservedWords';
import type {
  UserUniformKind,
  UserUniformStage,
} from '@/core/models/userUniform';

/**
 * The 2D sandbox deliberately uses a smaller ABI than the 3D material: a
 * fullscreen triangle and a fragment document with `vUv`, `uResolution` and
 * `uTime`. Keeping the vertex stage internal means the sandbox can never
 * produce a mismatched vertex/fragment pair.
 */
export const sandboxVertexSource = sandboxVertexShader;
export const defaultSandboxFragmentShader = sandboxFragmentShader;

/**
 * Names the sandbox ABI already owns. A user uniform colliding with one of
 * these would produce a duplicate declaration, so validation rejects them
 * before code generation.
 */
export const SANDBOX_RESERVED_UNIFORM_NAMES: ReadonlySet<string> = new Set([
  ...GLSL_RESERVED_WORDS,
  'uResolution',
  'uTime',
  'vUv',
  'fragColor',
]);

/**
 * The user-data kinds the sandbox can bind. Cube maps are deliberately absent:
 * the sandbox has no cube source model and no cube assets.
 */
export const SANDBOX_USER_DATA_KINDS: readonly UserUniformKind[] = [
  'float',
  'vec2',
  'vec3',
  'vec4',
  'color',
  'color4',
  'direction',
  'position',
  'sampler2D',
];

/**
 * The sandbox is one fullscreen fragment pass, so fragment, post and the
 * combined option all address that pass. The vertex stage does not exist here.
 */
export const SANDBOX_USER_DATA_STAGES: readonly UserUniformStage[] = [
  'fragment',
  'post',
  'both',
];
