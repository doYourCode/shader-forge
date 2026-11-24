import type { CompileResult } from '@/core/models/compileResult';
import type {
  MaterialBlueprint,
  ShaderSource,
} from '@/core/models/shaderSource';
import type { PostEffectStack } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import {
  useShaderCompilation,
  type EditorStatusMessage,
} from './useShaderCompilation';

export interface ScreenSpaceCompilationDeps {
  readonly compilePostEffects: (
    stack: PostEffectStack,
  ) => Promise<CompileResult>;
  readonly getPostStack: () => PostEffectStack;
  readonly onBeforeCompile: () => void;
  readonly onOutcome: (result: CompileResult) => void;
  readonly onExternalErrors: (errors: readonly ShaderError[]) => void;
}

const EMPTY_SOURCE: ShaderSource = { vertex: '', fragment: '' };

const EMPTY_BLUEPRINT: MaterialBlueprint = {
  vertex: '',
  fragment: '',
  editorSource: EMPTY_SOURCE,
  extraUniforms: [],
  extraSamplers: [],
};

/**
 * Reuses the editor's serialized compile queue and status/error state, but
 * only exposes the screen-space post-effect path. There is no material
 * document in this editor, so a material compile can never be requested.
 */
export function useScreenSpaceCompilation(deps: ScreenSpaceCompilationDeps) {
  return useShaderCompilation({
    compileMaterial: () =>
      Promise.resolve({
        status: 'unavailable',
        reason: 'scene-not-initialized',
      }),
    compilePostEffects: deps.compilePostEffects,
    getMaterialBlueprint: () => EMPTY_BLUEPRINT,
    getPostStack: deps.getPostStack,
    onBeforeCompile: deps.onBeforeCompile,
    onOutcome: deps.onOutcome,
    onExternalErrors: deps.onExternalErrors,
  });
}

export type ScreenSpaceStatus = ReturnType<
  typeof useScreenSpaceCompilation
>['status'];
export type ScreenSpaceStatusMessage = EditorStatusMessage;
