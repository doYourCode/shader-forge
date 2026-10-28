import { ref, onBeforeUnmount } from 'vue';
import { EditorManager } from '@/services/codemirror/EditorManager';
import { SceneManager } from '@/services/babylon/SceneManager';
import type { EditorTabId } from '@/core/models/editorTab';
import {
  defaultVertexShader,
  defaultFragmentShader,
  defaultUniformsDoc,
  defaultIoDoc,
} from '@/core/constants/defaultShaders';

export type EditorStatus = 'idle' | 'ready' | 'error' | 'compiling';

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

  const vertexSource = ref(defaultVertexShader);
  const fragmentSource = ref(defaultFragmentShader);

  const tabDocs: Record<EditorTabId, string> = {
    vertex: defaultVertexShader,
    fragment: defaultFragmentShader,
    uniforms: defaultUniformsDoc,
    io: defaultIoDoc,
  };

  sceneManager.onError = (msg) => {
    status.value = 'error';
    statusMessage.value = msg;
  };

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
      vertex: vertexSource.value,
      fragment: fragmentSource.value,
    });
    sceneManager.setPaused(false);
  }

  function switchTab(tab: EditorTabId) {
    activeTab.value = tab;

    const readOnly = tab === 'uniforms' || tab === 'io';
    const doc = tabDocs[tab];

    editorManager.setValue(doc);
    editorManager.setReadOnly(readOnly);

    if (!readOnly) {
      source.value = doc;
    }

    status.value = 'idle';
    statusMessage.value = `Switched to ${tab}`;
  }

  function compile() {
    status.value = 'compiling';
    statusMessage.value = 'Compiling…';

    const result = sceneManager.compile({
      vertex: vertexSource.value,
      fragment: fragmentSource.value,
    });

    status.value = result.ok ? 'ready' : 'error';
    statusMessage.value = result.message;
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
    mountEditor,
    mountCanvas,
    switchTab,
    compile,
    resize,
    setWireframe,
    setPaused,
  };
}