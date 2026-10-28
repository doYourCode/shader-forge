<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useShaderEditor } from '@/composables/useShaderEditor';
import { editorTabs } from '@/core/models/editorTab';
import EditorToolbar from '@/components/shader/EditorToolbar.vue';
import ViewerToolbar from '@/components/shader/ViewerToolbar.vue';
import StatusBar from '@/components/shader/StatusBar.vue';

const editorHostRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const {
  activeTab,
  cursorLine,
  cursorCol,
  status,
  statusMessage,
  wireframe,
  paused,
  mountEditor,
  mountCanvas,
  switchTab,
  compile,
  resize,
  setWireframe,
  setPaused,
} = useShaderEditor();

function handleResize() {
  resize();
}

onMounted(() => {
  if (editorHostRef.value) {
    mountEditor(editorHostRef.value);
  }
  if (canvasRef.value) {
    mountCanvas(canvasRef.value);
  }
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

function toggleWireframe() {
  setWireframe(!wireframe.value);
}

function togglePause() {
  setPaused(!paused.value);
}
</script>

<template>
  <div class="shader-editor">
    <div class="shader-editor__left">
      <EditorToolbar
        :tabs="editorTabs"
        :active="activeTab"
        @switch="switchTab"
        @compile="compile"
      />
      <div ref="editorHostRef" class="shader-editor__editor-host" />
    </div>

    <div class="shader-editor__right">
      <ViewerToolbar
        :wireframe="wireframe"
        :paused="paused"
        @toggle-wireframe="toggleWireframe"
        @toggle-pause="togglePause"
      />
      <div class="shader-editor__canvas-wrap">
        <canvas ref="canvasRef" class="shader-editor__canvas" />
      </div>
    </div>

    <StatusBar
      class="shader-editor__status"
      :line="cursorLine"
      :col="cursorCol"
      :status="status"
      :message="statusMessage"
    />
  </div>
</template>

<style scoped>
.shader-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  height: 100%;
  min-height: 0;
}

.shader-editor__left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--border);
}

.shader-editor__editor-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.shader-editor__right {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.shader-editor__canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.shader-editor__canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
}

.shader-editor__status {
  grid-column: 1 / -1;
}
</style>