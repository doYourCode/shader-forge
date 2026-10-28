<script setup lang="ts">
import type { EditorTab, EditorTabId } from '@/core/models/editorTab';

const props = defineProps<{
  tabs: EditorTab[];
  active: EditorTabId;
}>();

const emit = defineEmits<{
  (e: 'switch', id: EditorTabId): void;
  (e: 'compile'): void;
}>();
</script>

<template>
  <div class="editor-toolbar">
    <div class="editor-toolbar__tabs">
      <button
        v-for="tab in props.tabs"
        :key="tab.id"
        class="editor-toolbar__tab"
        :class="{ 'editor-toolbar__tab--active': tab.id === props.active }"
        @click="emit('switch', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <button class="editor-toolbar__compile" @click="emit('compile')">
      Compile
    </button>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.editor-toolbar__tabs {
  display: flex;
  gap: 2px;
}

.editor-toolbar__tab {
  padding: 5px 12px;
  background: transparent;
  color: var(--fg);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
}

.editor-toolbar__tab--active {
  border-color: var(--border);
}

.editor-toolbar__compile {
  padding: 5px 14px;
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
}
</style>