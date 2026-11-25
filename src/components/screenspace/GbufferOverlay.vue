<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import {
  availableDebugModes,
  type GbufferDebugMode,
} from '@/core/constants/screenSpaceDebug';

const props = defineProps<{
  active: GbufferDebugMode;
}>();

const emit = defineEmits<{
  (e: 'change', mode: GbufferDebugMode): void;
}>();

const { t } = useI18n();

const modes = availableDebugModes();

function onChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;

  const mode = modes.find((option) => option.id === target.value);
  if (mode) emit('change', mode.id);
}
</script>

<template>
  <label class="gbuffer-overlay">
    <span class="gbuffer-overlay__label">{{
      t('screenSpace.debug.overlay')
    }}</span>
    <select :value="props.active" @change="onChange">
      <option v-for="mode in modes" :key="mode.id" :value="mode.id">
        {{ t(mode.labelKey) }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.gbuffer-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: rgba(33, 37, 43, 0.82);
  border: 1px solid var(--border);
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.gbuffer-overlay__label {
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.gbuffer-overlay select {
  max-width: 170px;
  padding: 3px 5px;
  background: var(--bg-input);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 11px;
}
</style>
