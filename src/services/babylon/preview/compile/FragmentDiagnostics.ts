import type { Mesh } from '@babylonjs/core';
import type { ShaderError } from '@/core/models/shaderError';
import type { ShaderSource } from '../PreviewTypes';
import type { ShaderCompiler } from './ShaderCompiler';

/**
 * Recompiles the fragment stage against a known-good vertex shader so a link
 * failure can still surface the fragment diagnostics the driver reported.
 */
export class FragmentDiagnostics {
  private readonly compiler: ShaderCompiler;
  private readonly validationVertex: string;

  constructor(compiler: ShaderCompiler, validationVertex: string) {
    this.compiler = compiler;
    this.validationVertex = validationVertex;
  }

  async collect(source: ShaderSource, mesh: Mesh): Promise<ShaderError[]> {
    const attempt = await this.compiler.tryCompile(
      {
        vertex: this.validationVertex,
        fragment: source.fragment,
      },
      mesh,
    );

    attempt.release(!attempt.ok);

    if (attempt.ok) return [];

    return attempt.errors.filter((error) => error.stage === 'fragment');
  }
}
