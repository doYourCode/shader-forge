import { onBeforeUnmount, ref } from 'vue';

import type { CompileResult } from '@/core/models/compileResult';
import type { ShaderError } from '@/core/models/shaderError';
import { defaultSandboxFragmentShader } from '@/core/constants/sandbox';
import { EditorManager } from '@/services/codemirror/EditorManager';
import { internalError } from '@/services/babylon/preview/errors/shaderErrorFactory';
import { SandboxPreview } from '@/services/sandbox/SandboxPreview';
import type { EditorStatus, EditorStatusMessage } from './useShaderCompilation';

/**
 * State and lifecycle for the 2D sandbox harness. It owns the text editor and
 * the fullscreen preview, leaving the view responsible only for layout and
 * translated chrome. There is one document and one compile target, so none of
 * the 3D editor's tab, scene or user-data machinery is needed here.
 */
export function useSandboxEditor() {
  const editorManager = new EditorManager();

  const status = ref<EditorStatus>('idle');
  const statusMessage = ref<EditorStatusMessage | null>(null);
  const errors = ref<ShaderError[]>([]);
  const paused = ref(false);
  const cursorLine = ref(1);
  const cursorCol = ref(1);

  let preview: SandboxPreview | null = null;

  function setDiagnostics(): void {
    editorManager.setDiagnostics(
      errors.value
        .filter(
          (error): error is ShaderError & { line: number } =>
            error.stage === 'fragment' && error.line !== null,
        )
        .map((error) => ({
          line: error.line,
          column: error.column,
          message: [error.title, error.message, error.advice]
            .filter((part): part is string => Boolean(part))
            .join('\n'),
        })),
    );
  }

  function applyResult(result: CompileResult): void {
    if (result.status === 'ok') {
      errors.value = [];
      status.value = 'ready';
      statusMessage.value = { key: 'editor.status.messages.compiled' };
      setDiagnostics();
      return;
    }

    if (result.status === 'unavailable') {
      errors.value = [];
      status.value = 'error';
      statusMessage.value = {
        key: 'editor.status.messages.unavailable.sceneNotInitialized',
      };
      setDiagnostics();
      return;
    }

    errors.value = [...result.errors];
    status.value = 'error';
    statusMessage.value = {
      key: 'editor.status.messages.shaderErrors',
      params: { count: result.errors.length },
    };
    setDiagnostics();
  }

  function compile(): void {
    if (!preview) {
      errors.value = [
        internalError('The sandbox preview is not initialized yet.'),
      ];
      status.value = 'error';
      statusMessage.value = {
        key: 'editor.status.messages.unavailable.sceneNotInitialized',
      };
      return;
    }

    status.value = 'compiling';
    statusMessage.value = { key: 'editor.status.messages.compiling' };
    applyResult(preview.compile(editorManager.getValue()));
  }

  function mountEditor(host: HTMLElement): void {
    editorManager.mount(
      host,
      defaultSandboxFragmentShader,
      (position) => {
        cursorLine.value = position.line;
        cursorCol.value = position.col;
      },
      false,
    );

    status.value = 'ready';
    statusMessage.value = { key: 'editor.status.messages.editorReady' };
  }

  function mountCanvas(canvas: HTMLCanvasElement): void {
    preview?.dispose();
    preview = new SandboxPreview(canvas);
    compile();
  }

  function revealError(error: ShaderError): void {
    if (error.stage !== 'fragment' || error.line === null) return;
    editorManager.revealPosition(error.line, error.column);
  }

  function togglePaused(): void {
    paused.value = !paused.value;
    preview?.setPaused(paused.value);
  }

  onBeforeUnmount(() => {
    editorManager.dispose();
    preview?.dispose();
    preview = null;
  });

  return {
    status,
    statusMessage,
    errors,
    paused,
    cursorLine,
    cursorCol,
    compile,
    mountEditor,
    mountCanvas,
    revealError,
    togglePaused,
  };
}
