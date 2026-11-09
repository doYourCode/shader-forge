import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import {
  EditorManager,
  type EditorDiagnostic,
} from '@/services/codemirror/EditorManager';
import {
  SceneManager,
  type CompileResult,
  type MaterialBlueprint,
  type ShaderSource,
} from '@/services/babylon/SceneManager';
import type { EditorTabId } from '@/core/models/editorTab';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';
import type { ShaderError } from '@/core/models/shaderError';
import type {
  UserDataDocument,
  UserUniformKind,
  UserUniformStage,
  UserUniformValue,
} from '@/core/models/userUniform';
import { createEmptyUserDataDocument } from '@/core/models/userUniform';
import {
  defaultPreviewModel,
  findPreviewModel,
  previewModels,
} from '@/core/constants/previewModels';
import {
  defaultPreviewHdri,
  findPreviewHdri,
  previewHdris,
} from '@/core/constants/previewHdris';
import {
  defaultVertexShader,
  defaultFragmentShader,
  defaultUniformsDoc,
  defaultIoDoc,
} from '@/core/constants/defaultShaders';
import {
  UserDataController,
  type AddUserUniformResult,
  type UserDataCommandResult,
} from '@/services/userdata/UserDataController';

export type EditorStatus = 'idle' | 'ready' | 'error' | 'compiling';

type EditableTabId = 'vertex' | 'fragment';
type TextTabId = Exclude<EditorTabId, 'user_data'>;

export function useShaderEditor() {
  const editorManager = new EditorManager();
  const sceneManager = new SceneManager();

  const activeTab = ref<EditorTabId>('vertex');
  const activeModel = ref<PreviewModel>(defaultPreviewModel);
  const activeModelId = computed(() => activeModel.value.id);
  const activeHdri = ref<PreviewHdri>(defaultPreviewHdri);
  const activeHdriId = computed(() => activeHdri.value.id);
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  const status = ref<EditorStatus>('idle');
  const statusMessage = ref('');
  const source = ref(defaultVertexShader);
  const wireframe = ref(false);
  const paused = ref(false);
  const errors = ref<ShaderError[]>([]);
  const highlightedUserRow = ref<number | null>(null);

  const tabDocs: Record<TextTabId, string> = {
    vertex: defaultVertexShader,
    fragment: defaultFragmentShader,
    uniforms: defaultUniformsDoc,
    io: defaultIoDoc,
  };

  const userDataDoc: UserDataDocument = reactive(createEmptyUserDataDocument());
  const userData = new UserDataController(
    {
      getSources: () => currentSources(),
      onCompileRequested: (blueprint) => {
        void compile(blueprint);
      },
    },
    userDataDoc,
  );

  let compileInFlight = false;
  let queuedCompile: MaterialBlueprint | 'current' | null = null;
  let confirmedModel = defaultPreviewModel;
  let modelSelection = 0;
  let confirmedHdri = defaultPreviewHdri;
  let hdriSelection = 0;

  sceneManager.onError = (shaderErrors) => {
    errors.value = shaderErrors;
    status.value = 'error';
    statusMessage.value = formatErrorStatus(shaderErrors);
    highlightedUserRow.value = firstUserDataRow(shaderErrors);
    editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
  };

  function currentSources(): ShaderSource {
    return { vertex: tabDocs.vertex, fragment: tabDocs.fragment };
  }

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

  function firstUserDataRow(
    shaderErrors: readonly ShaderError[],
  ): number | null {
    const match = shaderErrors.find(
      (error) => error.stage === 'user_data' && error.row != null,
    );

    return match?.row ?? null;
  }

  function applyTab(tab: EditorTabId) {
    activeTab.value = tab;

    if (tab === 'user_data') {
      // The structured panel replaces the text editor. Leaving the editor
      // buffer alone keeps the exact document when switching back.
      editorManager.setReadOnly(true);
      return;
    }

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
    sceneManager.init(
      canvas,
      userData.buildBlueprint(currentSources()),
      activeModel.value,
      activeHdri.value,
      userData,
    );
    sceneManager.setPaused(false);
  }

  async function selectModel(id: string) {
    if (id === activeModel.value.id) return;

    const model = findPreviewModel(id);
    if (!model) return;

    const request = ++modelSelection;
    const previous = confirmedModel;
    activeModel.value = model;

    const loaded = await sceneManager.loadModel(model);

    if (loaded) {
      confirmedModel = model;
      return;
    }

    // A newer selection owns the dropdown now; don't revert over it.
    if (request === modelSelection) {
      activeModel.value = previous;
    }
  }

  async function selectHdri(id: string) {
    if (id === activeHdri.value.id) return;

    const hdri = findPreviewHdri(id);
    if (!hdri) return;

    const request = ++hdriSelection;
    const previous = confirmedHdri;
    activeHdri.value = hdri;

    const loaded = await sceneManager.loadEnvironment(hdri);

    if (loaded) {
      confirmedHdri = hdri;
      return;
    }

    // A newer selection owns the dropdown now; don't revert over it.
    if (request === hdriSelection) {
      activeHdri.value = previous;
    }
  }

  function switchTab(tab: EditorTabId) {
    if (tab === activeTab.value) return;

    storeActiveDocument();
    applyTab(tab);

    status.value = 'idle';
    statusMessage.value = `Switched to ${tab}`;
  }

  async function compile(blueprint?: MaterialBlueprint) {
    // A structural edit may land while a compile is in flight; the latest
    // request is replayed after the current one settles.
    if (compileInFlight) {
      queuedCompile = blueprint ?? 'current';
      return;
    }

    compileInFlight = true;
    storeActiveDocument();

    const target = blueprint ?? userData.buildBlueprint(currentSources());

    status.value = 'compiling';
    statusMessage.value = 'Compiling…';

    let result: CompileResult;
    try {
      result = await sceneManager.compile(target);
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

    applyCompileResult(result);

    const next = queuedCompile;
    queuedCompile = null;
    if (next !== null) {
      void compile(next === 'current' ? undefined : next);
    }
  }

  function applyCompileResult(result: CompileResult): void {
    errors.value = result.errors;
    highlightedUserRow.value = firstUserDataRow(result.errors);

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
    if (error.stage === 'user_data') {
      if (error.row == null) return;

      if (activeTab.value !== 'user_data') {
        storeActiveDocument();
        applyTab('user_data');
      }
      highlightedUserRow.value = error.row;
      return;
    }

    if (error.stage !== 'vertex' && error.stage !== 'fragment') return;

    storeActiveDocument();

    if (error.stage !== activeTab.value) {
      applyTab(error.stage);
    }

    if (error.line !== null) {
      editorManager.revealPosition(error.line, error.column);
    }
  }

  function addUserUniform(request: {
    name: string;
    kind: UserUniformKind;
    stages?: UserUniformStage;
  }): AddUserUniformResult {
    return userData.add(request);
  }

  function removeUserUniform(id: string): UserDataCommandResult {
    return userData.remove(id);
  }

  function renameUserUniform(
    id: string,
    name: string,
  ): UserDataCommandResult {
    return userData.rename(id, name);
  }

  function changeUserUniformKind(
    id: string,
    kind: UserUniformKind,
  ): UserDataCommandResult {
    return userData.changeKind(id, kind);
  }

  function changeUserUniformStages(
    id: string,
    stages: UserUniformStage,
  ): UserDataCommandResult {
    return userData.changeStages(id, stages);
  }

  function setUserUniformValue(
    id: string,
    value: UserUniformValue,
  ): UserDataCommandResult {
    return userData.setValue(id, value);
  }

  function validateUserUniformName(name: string, exceptId?: string) {
    return userData.validateName(name, exceptId);
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
    userData.dispose();
  });

  return {
    activeTab,
    activeModelId,
    activeHdriId,
    models: previewModels,
    hdris: previewHdris,
    cursorLine,
    cursorCol,
    status,
    statusMessage,
    source,
    wireframe,
    paused,
    errors,
    userDataDoc,
    highlightedUserRow,
    mountEditor,
    mountCanvas,
    switchTab,
    selectModel,
    selectHdri,
    compile,
    revealError,
    resize,
    setWireframe,
    setPaused,
    addUserUniform,
    removeUserUniform,
    renameUserUniform,
    changeUserUniformKind,
    changeUserUniformStages,
    setUserUniformValue,
    validateUserUniformName,
  };
}
