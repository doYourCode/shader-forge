import type { Mesh } from '@babylonjs/core';
import type { ShaderError } from '@/core/models/shaderError';
import type { MaterialBlueprint } from '../PreviewTypes';
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

  async collect(source: MaterialBlueprint, mesh: Mesh): Promise<ShaderError[]> {
    // Keep the blueprint's editor sources and assembly record: the recompiled
    // fragment still has to map driver lines back to the editor, and errors
    // inside its generated block still belong to a User data row.
    const attempt = await this.compiler.tryCompile(
      { ...source, vertex: this.validationVertex },
      mesh,
    );

    attempt.release(!attempt.ok);

    if (attempt.ok) return [];

    return attempt.errors.filter((error) => error.stage === 'fragment');
  }
}
