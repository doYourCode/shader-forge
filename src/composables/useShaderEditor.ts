import { ref, onBeforeUnmount } from 'vue';
import { EditorManager } from '@/services/codemirror/EditorManager';
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

  sceneManager.onError = (msg) => {
    status.value = 'error';
    statusMessage.value = msg;
  };

  function isEditableTab(tab: EditorTabId): tab is EditableTabId {
    return tab === 'vertex' || tab === 'fragment';
  }

  function storeActiveDocument() {
    if (isEditableTab(activeTab.value)) {
      tabDocs[activeTab.value] = editorManager.getValue();
    }
  }

  function errorLinesFor(tab: EditorTabId): number[] {
    if (!isEditableTab(tab)) return [];

    return errors.value
      .filter((error) => error.stage === tab && error.line !== null)
      .map((error) => error.line as number);
  }

  function applyTab(tab: EditorTabId) {
    activeTab.value = tab;

    const readOnly = !isEditableTab(tab);
    editorManager.setValue(tabDocs[tab]);
    editorManager.setReadOnly(readOnly);
    editorManager.setErrorLines(errorLinesFor(tab));

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
            message,
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
      editorManager.setErrorLines(errorLinesFor(activeTab.value));
      return;
    }

    status.value = 'error';
    statusMessage.value =
      result.errors.length > 0
        ? `${result.errors.length} shader ${
            result.errors.length === 1 ? 'error' : 'errors'
          }`
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
      editorManager.setErrorLines(errorLinesFor(activeTab.value));
      return;
    }

    // Persist whatever is currently in the editor (the user may have switched
    // tabs while the shader was compiling) before jumping to the error.
    storeActiveDocument();

    if (firstLocated.stage !== activeTab.value) {
      applyTab(firstLocated.stage);
    } else {
      editorManager.setErrorLines(errorLinesFor(activeTab.value));
    }

    editorManager.revealLine(firstLocated.line);
  }

  function revealError(error: ShaderError) {
    if (error.stage !== 'vertex' && error.stage !== 'fragment') return;

    storeActiveDocument();

    if (error.stage !== activeTab.value) {
      applyTab(error.stage);
    }

    if (error.line !== null) {
      editorManager.revealLine(error.line);
    }
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
