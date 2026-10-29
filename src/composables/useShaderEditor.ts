import { ref, onBeforeUnmount } from 'vue';
import {
  EditorManager,
  type EditorDiagnostic,
} from '@/services/codemirror/EditorManager';
import {
  SceneManager,
  type CompileResult,
} from '@/services/babylon/SceneManager';
import type { EditorTabId } from '@/core/models/editorTab';
import type { ShaderError } from '@/core/models/shaderError';
import {
  defaultVertexShader,
  defaultFragmentShader,
  defaultUniformsDoc,
  defaultIoDoc,
} from '@/core/constants/defaultShaders';

export type EditorStatus = 'idle' | 'ready' | 'error' | 'compiling';

type EditableTabId = 'vertex' | 'fragment';

export function useShaderEditor() {
  const editorManager = new EditorManager();
  const sceneManager = new SceneManager();

  const activeTab = ref<EditorTabId>('vertex');
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  const status = ref<EditorStatus>('idle');
  const statusMessage = ref('');
  const source = ref(defaultVertexShader);
  const wireframe = ref(false);
  const paused = ref(false);
  const errors = ref<ShaderError[]>([]);

  const tabDocs: Record<EditorTabId, string> = {
    vertex: defaultVertexShader,
    fragment: defaultFragmentShader,
    uniforms: defaultUniformsDoc,
    io: defaultIoDoc,
  };

  let compileInFlight = false;

  sceneManager.onError = (shaderErrors) => {
    errors.value = shaderErrors;
    status.value = 'error';
    statusMessage.value = formatErrorStatus(shaderErrors);
    editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
  };

  function isEditableTab(tab: EditorTabId): tab is EditableTabId {
    return tab === 'vertex' || tab === 'fragment';
  }

  function storeActiveDocument() {
    if (isEditableTab(activeTab.value)) {
      tabDocs[activeTab.value] = editorManager.getValue();
    }
  }

  function diagnosticsFor(tab: EditorTabId): EditorDiagnostic[] {
    if (!isEditableTab(tab)) return [];

    return errors.value
      .filter(
        (error): error is ShaderError & { line: number } =>
          error.stage === tab && error.line !== null,
      )
      .map((error) => ({
        line: error.line,
        column: error.column,
        message: [error.title, error.message, error.advice]
          .filter((part): part is string => Boolean(part))
          .join('\n'),
      }));
  }

  function applyTab(tab: EditorTabId) {
    activeTab.value = tab;

    const readOnly = !isEditableTab(tab);
    editorManager.setValue(tabDocs[tab]);
    editorManager.setReadOnly(readOnly);
    editorManager.setDiagnostics(diagnosticsFor(tab));

    if (!readOnly) {
      source.value = tabDocs[tab];
    }
  }

  function mountEditor(host: HTMLElement) {
    editorManager.mount(
      host,
      tabDocs.vertex,
      (pos) => {
        cursorLine.value = pos.line;
        cursorCol.value = pos.col;
      },
      false,
    );

    status.value = 'ready';
    statusMessage.value = 'Editor ready';
  }

  function mountCanvas(canvas: HTMLCanvasElement) {
    sceneManager.init(canvas, {
      vertex: tabDocs.vertex,
      fragment: tabDocs.fragment,
    });
    sceneManager.setPaused(false);
  }

  function switchTab(tab: EditorTabId) {
    if (tab === activeTab.value) return;

    storeActiveDocument();
    applyTab(tab);

    status.value = 'idle';
    statusMessage.value = `Switched to ${tab}`;
  }

  async function compile() {
    if (compileInFlight) return;

    compileInFlight = true;
    storeActiveDocument();

    status.value = 'compiling';
    statusMessage.value = 'Compiling…';

    let result: CompileResult;
    try {
      result = await sceneManager.compile({
        vertex: tabDocs.vertex,
        fragment: tabDocs.fragment,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        ok: false,
        message,
        errors: [
          {
            stage: 'program',
            line: null,
            column: null,
            kind: 'internal',
            title: 'Shader compilation failed',
            message,
            advice: null,
          },
        ],
      };
    } finally {
      compileInFlight = false;
    }

    errors.value = result.errors;

    if (result.ok) {
      status.value = 'ready';
      statusMessage.value = 'Compiled successfully';
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
      return;
    }

    status.value = 'error';
    statusMessage.value =
      result.errors.length > 0
        ? formatErrorStatus(result.errors)
        : result.message;

    const firstLocated = result.errors.find(
      (
        error,
      ): error is ShaderError & {
        stage: EditableTabId;
        line: number;
      } =>
        error.line !== null &&
        (error.stage === 'vertex' || error.stage === 'fragment'),
    );

    if (!firstLocated) {
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
      return;
    }

    // Persist whatever is currently in the editor (the user may have switched
    // tabs while the shader was compiling) before jumping to the error.
    storeActiveDocument();

    if (firstLocated.stage !== activeTab.value) {
      applyTab(firstLocated.stage);
    } else {
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
    }

    editorManager.revealPosition(firstLocated.line, firstLocated.column);
  }

  function revealError(error: ShaderError) {
    if (error.stage !== 'vertex' && error.stage !== 'fragment') return;

    storeActiveDocument();

    if (error.stage !== activeTab.value) {
      applyTab(error.stage);
    }

    if (error.line !== null) {
      editorManager.revealPosition(error.line, error.column);
    }
  }

  function formatErrorStatus(shaderErrors: readonly ShaderError[]): string {
    const first = shaderErrors.find((error) => error.line !== null);
    const suffix = first?.line != null ? ` · line ${first.line}` : '';
    return `${shaderErrors.length} shader ${
      shaderErrors.length === 1 ? 'error' : 'errors'
    }${suffix}`;
  }

  function resize() {
    sceneManager.resize();
  }

  function setWireframe(on: boolean) {
    wireframe.value = on;
    sceneManager.setWireframe(on);
  }

  function setPaused(on: boolean) {
    paused.value = on;
    sceneManager.setPaused(on);
  }

  onBeforeUnmount(() => {
    editorManager.dispose();
    sceneManager.dispose();
  });

  return {
    activeTab,
    cursorLine,
    cursorCol,
    status,
    statusMessage,
    source,
    wireframe,
    paused,
    errors,
    mountEditor,
    mountCanvas,
    switchTab,
    compile,
    revealError,
    resize,
    setWireframe,
    setPaused,
  };
}
