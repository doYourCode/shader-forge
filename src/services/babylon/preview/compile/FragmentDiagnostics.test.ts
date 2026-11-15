import { describe, expect, it, vi } from 'vitest';
import type { Mesh } from '@babylonjs/core';

import type { ShaderError } from '@/core/models/shaderError';
import type { MaterialBlueprint } from '../PreviewTypes';
import { FragmentDiagnostics } from './FragmentDiagnostics';
import type { ShaderCompiler } from './ShaderCompiler';

const VALIDATION_VERTEX = 'void main() {}';

const BLUEPRINT: MaterialBlueprint = {
  vertex: '// compiled vertex',
  fragment: '// compiled fragment',
  editorSource: {
    vertex: '// editor vertex',
    fragment: '// editor fragment',
  },
  extraUniforms: [],
  extraSamplers: [],
  userData: {
    vertex: null,
    fragment: { injected: { startLine: 2, endLine: 4 }, declarationRowByLine: [] },
  },
};

const FRAGMENT_ERROR: ShaderError = {
  stage: 'fragment',
  line: 7,
  column: 3,
  kind: 'syntax',
  title: 'Syntax error',
  message: "'foo' : syntax error",
  advice: null,
};

const VERTEX_ERROR: ShaderError = {
  ...FRAGMENT_ERROR,
  stage: 'vertex',
};

function createHarness(errors: ShaderError[], ok = false) {
  const attempt = {
    ok,
    errors,
    release: vi.fn(),
  };
  const compiler = {
    tryCompile: vi.fn(async () => attempt),
  };
  const diagnostics = new FragmentDiagnostics(
    compiler as unknown as ShaderCompiler,
    VALIDATION_VERTEX,
  );

  return { diagnostics, compiler, attempt };
}

describe('FragmentDiagnostics', () => {
  it('reuses the blueprint editor sources and user-data record', async () => {
    const { diagnostics, compiler } = createHarness([FRAGMENT_ERROR]);
    const mesh = {} as Mesh;

    await diagnostics.collect(BLUEPRINT, mesh);

    // A diagnostic from this fallback pass must still map back to the editor
    // and attribute block errors to a User data row, so the full diagnostic
    // context travels with the recompiled fragment source.
    expect(compiler.tryCompile).toHaveBeenCalledWith(
      {
        ...BLUEPRINT,
        vertex: VALIDATION_VERTEX,
      },
      mesh,
    );
  });

  it('returns only fragment diagnostics and releases a failed attempt', async () => {
    const { diagnostics, attempt } = createHarness([
      VERTEX_ERROR,
      FRAGMENT_ERROR,
    ]);

    const errors = await diagnostics.collect(BLUEPRINT, {} as Mesh);

    expect(errors).toEqual([FRAGMENT_ERROR]);
    expect(attempt.release).toHaveBeenCalledWith(true);
  });

  it('releases a successful attempt without reporting errors', async () => {
    const { diagnostics, attempt } = createHarness([], true);

    const errors = await diagnostics.collect(BLUEPRINT, {} as Mesh);

    expect(errors).toEqual([]);
    expect(attempt.release).toHaveBeenCalledWith(false);
  });
});
