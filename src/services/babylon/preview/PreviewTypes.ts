import type { ShaderError } from '@/core/models/shaderError';

/** The two GLSL stages edited by the user. */
export interface ShaderSource {
  vertex: string;
  fragment: string;
}

/** The user-facing outcome of a compile request. */
export interface CompileResult {
  ok: boolean;
  message: string;
  errors: ShaderError[];
}
