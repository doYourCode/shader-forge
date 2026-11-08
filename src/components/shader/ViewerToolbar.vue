<script setup lang="ts">
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';

const props = defineProps<{
  models: readonly PreviewModel[];
  activeModelId: string;
  hdris: readonly PreviewHdri[];
  activeHdriId: string;
  wireframe: boolean;
  paused: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-model', id: string): void;
  (e: 'select-hdri', id: string): void;
  (e: 'toggle-wireframe'): void;
  (e: 'toggle-pause'): void;
}>();

function handleModelChange(event: Event): void {
  const select = event.currentTarget;
  if (!(select instanceof HTMLSelectElement)) return;

  emit('select-model', select.value);
}

function handleHdriChange(event: Event): void {
  const select = event.currentTarget;
  if (!(select instanceof HTMLSelectElement)) return;

  emit('select-hdri', select.value);
}
</script>

<template>
  <div class="viewer-toolbar">
    <div class="viewer-toolbar__group">
      <fieldset class="viewer-toolbar__models">
        <legend class="viewer-toolbar__models-legend">Models</legend>

        <select
          class="viewer-toolbar__model-select"
          aria-label="Preview model"
          :value="props.activeModelId"
          @change="handleModelChange"
        >
          <option
            v-for="model in props.models"
            :key="model.id"
            :value="model.id"
          >
            {{ model.label }}
          </option>
        </select>
      </fieldset>

      <fieldset class="viewer-toolbar__hdri">
        <legend class="viewer-toolbar__hdri-legend">HDRI</legend>

        <select
          class="viewer-toolbar__hdri-select"
          aria-label="Preview HDRI"
          :value="props.activeHdriId"
          @change="handleHdriChange"
        >
          <option
            v-for="hdri in props.hdris"
            :key="hdri.id"
            :value="hdri.id"
          >
            {{ hdri.label }}
          </option>
        </select>
      </fieldset>
    </div>

    <div class="viewer-toolbar__group">
      <button
        class="viewer-toolbar__btn"
        :class="{ 'viewer-toolbar__btn--active': props.wireframe }"
        @click="emit('toggle-wireframe')"
      >
        Wireframe
      </button>
      <button class="viewer-toolbar__btn">Cfg</button>
      <button class="viewer-toolbar__btn">Social</button>
      <button
        class="viewer-toolbar__btn"
        :class="{ 'viewer-toolbar__btn--active': props.paused }"
        @click="emit('toggle-pause')"
      >
        {{ props.paused ? 'Resume' : 'Pause' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  row-gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.viewer-toolbar__group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.viewer-toolbar__models,
.viewer-toolbar__hdri {
  margin: 0;
  padding: 0 4px 2px;
  min-inline-size: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.viewer-toolbar__hdri {
  max-width: 190px;
}

.viewer-toolbar__models-legend,
.viewer-toolbar__hdri-legend {
  padding: 0 4px;
  margin-left: 3px;
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  user-select: none;
  transition: color 0.12s ease;
}

.viewer-toolbar__model-select,
.viewer-toolbar__hdri-select {
  padding: 5px 12px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease,
    border-color 0.12s ease;
}

.viewer-toolbar__hdri-select {
  max-width: 100%;
}

.viewer-toolbar__model-select:hover,
.viewer-toolbar__hdri-select:hover {
  border-color: #4b5263;
  color: var(--fg-strong);
}

.viewer-toolbar__btn {
  padding: 5px 10px;
  background: var(--bg-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease,
    border-color 0.12s ease;
}

.viewer-toolbar__btn:hover {
  background: #3a404d;
  border-color: #4b5263;
  color: var(--fg-strong);
}

.viewer-toolbar__btn--active {
  background: #404754;
  border-color: var(--accent-blue);
  color: var(--fg-strong);
}
</style>
