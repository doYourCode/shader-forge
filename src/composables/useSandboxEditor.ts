import { onBeforeUnmount, reactive, ref, watch } from 'vue';

import type { CompileResult } from '@/core/models/compileResult';
import type { EditorTabId } from '@/core/models/editorTab';
import type { ShaderError } from '@/core/models/shaderError';
import type { MaterialBlueprint } from '@/core/models/shaderSource';
import {
  SANDBOX_RESERVED_UNIFORM_NAMES,
  defaultSandboxFragmentShader,
  sandboxVertexSource,
} from '@/core/constants/sandbox';
import { createEmptyUserDataDocument } from '@/core/models/userUniform';
import { buildSandboxBlueprint } from '@/core/userdata/userData';
import { generateSandboxBlock } from '@/core/shader/uniformCodegen';
import { EditorManager } from '@/services/codemirror/EditorManager';
import { internalError } from '@/services/babylon/preview/errors/shaderErrorFactory';
import { SandboxPreview } from '@/services/sandbox/SandboxPreview';
import { UserDataController } from '@/services/userdata/UserDataController';
import { useUserDataCommands } from './useUserDataCommands';
import type { EditorStatus, EditorStatusMessage } from './useShaderCompilation';

/** The sandbox only exposes its fragment document and the user-data panel. */
export type SandboxTabId = Extract<EditorTabId, 'fragment' | 'user_data'>;

/**
 * State and lifecycle for the 2D sandbox harness. It owns the text editor, the
 * fullscreen preview and the same user-data document the 3D editor uses.
 *
 * The user-data controller is platform-neutral; the WebGL texture registry and
 * uniform target are created by `SandboxPreview`, which owns the GL context.
 * Fragment, post and "both" definitions all target the sandbox's single
 * fragment pass, so `buildSandboxBlueprint` is the projection strategy.
 */
export function useSandboxEditor() {
  const editorManager = new EditorManager();

  const status = ref<EditorStatus>('idle');
  const statusMessage = ref<EditorStatusMessage | null>(null);
  const errors = ref<ShaderError[]>([]);
  const paused = ref(false);
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  const activeTab = ref<SandboxTabId>('fragment');
  const highlightedUserRow = ref<number | null>(null);

  const userDataDoc = reactive(createEmptyUserDataDocument());
  let preview: SandboxPreview | null = null;

  const userData = new UserDataController<WebGLTexture>(
    {
      getSources: () => ({
        vertex: sandboxVertexSource,
        fragment: editorManager.getValue(),
      }),
      buildBlueprint: buildSandboxBlueprint,
      reservedNames: SANDBOX_RESERVED_UNIFORM_NAMES,
      onCompileRequested: (blueprint) => compileBlueprint(blueprint),
    },
    userDataDoc,
  );
  const userDataCommands = useUserDataCommands(userData);

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

  /**
   * Lines the editor previews above the source: the same generated block the
   * compile pipeline injects. Kept in sync with value edits as well as
   * structural ones, so the read-only preview never drifts.
   */
  function updateInjectedBlock(): void {
    editorManager.setInjectedBlock(
      generateSandboxBlock(userDataDoc)?.lines ?? null,
    );
  }

  function applyResult(result: CompileResult): void {
    if (result.status === 'ok') {
      errors.value = [];
      highlightedUserRow.value = null;
      status.value = 'ready';
      statusMessage.value = { key: 'editor.status.messages.compiled' };
      setDiagnostics();
      return;
    }

    if (result.status === 'unavailable') {
      errors.value = [];
      highlightedUserRow.value = null;
      status.value = 'error';
      statusMessage.value = {
        key: 'editor.status.messages.unavailable.sceneNotInitialized',
      };
      setDiagnostics();
      return;
    }

    errors.value = [...result.errors];
    highlightedUserRow.value =
      result.errors.find(
        (error) => error.stage === 'user_data' && error.row != null,
      )?.row ?? null;
    status.value = 'error';
    statusMessage.value = {
      key: 'editor.status.messages.shaderErrors',
      params: { count: result.errors.length },
    };
    setDiagnostics();
  }

  function compileBlueprint(blueprint: MaterialBlueprint): void {
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
    applyResult(preview.compile(blueprint));
  }

  function compile(): void {
    compileBlueprint(userData.buildBlueprint());
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

    updateInjectedBlock();
    status.value = 'ready';
    statusMessage.value = { key: 'editor.status.messages.editorReady' };
  }

  function mountCanvas(canvas: HTMLCanvasElement): void {
    preview?.dispose();
    preview = new SandboxPreview(canvas);
    preview.attachUserData(userData);
    compile();
  }

  function switchTab(tab: EditorTabId): void {
    if (tab !== 'fragment' && tab !== 'user_data') return;
    activeTab.value = tab;
  }

  function revealError(error: ShaderError): void {
    if (error.stage === 'user_data') {
      if (error.row == null) return;
      activeTab.value = 'user_data';
      highlightedUserRow.value = error.row;
      return;
    }

    if (error.stage !== 'fragment' || error.line === null) return;
    activeTab.value = 'fragment';
    editorManager.revealPosition(error.line, error.column);
  }

  function togglePaused(): void {
    paused.value = !paused.value;
    preview?.setPaused(paused.value);
  }

  // Definitions and values change the generated declarations and the values
  // comment; the read-only preview follows them immediately.
  watch(() => userDataDoc.revision, updateInjectedBlock);

  onBeforeUnmount(() => {
    editorManager.dispose();
    preview?.dispose();
    preview = null;
    userData.dispose();
  });

  return {
    status,
    statusMessage,
    errors,
    paused,
    cursorLine,
    cursorCol,
    activeTab,
    highlightedUserRow,
    userDataDoc,
    userDataCommands,
    compile,
    mountEditor,
    mountCanvas,
    switchTab,
    revealError,
    togglePaused,
  };
}
