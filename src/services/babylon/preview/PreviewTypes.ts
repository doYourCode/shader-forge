import type { ShaderError } from '@/core/models/shaderError';
import type { UserDataAssemblyRecord } from '@/core/shader/uniformCodegen';

/** The two GLSL stages edited by the user. */
export interface ShaderSource {
  vertex: string;
  fragment: string;
}

/**
 * Extra uniform/sampler names the material must register on top of the
 * built-in lists. They travel with the source so the compile pipeline
 * (`ShaderCompiler` -> `buildShaderMaterial`) can register them without
 * knowing about user data.
 */
export interface MaterialExtras {
  readonly extraUniforms?: readonly string[];
  readonly extraSamplers?: readonly string[];
}

/**
 * The assembled source handed to the preview: the user's documents with the
 * generated user-data blocks injected, plus the names to register and the
 * assembly record used to attribute diagnostics.
 */
export interface MaterialBlueprint extends ShaderSource, MaterialExtras {
  readonly extraUniforms: readonly string[];
  readonly extraSamplers: readonly string[];
  /** Line ranges of the injected blocks, per stage. */
  readonly userData?: UserDataAssemblyRecord;
}

/** The user-facing outcome of a compile request. */
export interface CompileResult {
  ok: boolean;
  message: string;
  errors: ShaderError[];
}
