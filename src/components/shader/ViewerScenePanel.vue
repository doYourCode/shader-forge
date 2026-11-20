<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { assetLabelKey } from '@/core/assets/labels';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';
import SceneAssetMenu from './SceneAssetMenu.vue';

const { t } = useI18n();

const props = defineProps<{
  models: readonly PreviewModel[];
  activeModelId: string;
  hdris: readonly PreviewHdri[];
  activeHdriId: string;
}>();

const emit = defineEmits<{
  (e: 'select-model', id: string): void;
  (e: 'select-hdri', id: string): void;
}>();

const modelItems = computed(() =>
  props.models.map((model) => ({
    id: model.id,
    label: t(assetLabelKey('models', model.id)),
    thumbnailUrl: model.thumbnailUrl,
  })),
);

const hdriItems = computed(() =>
  props.hdris.map((hdri) => ({
    id: hdri.id,
    label: t(assetLabelKey('hdris', hdri.id)),
    thumbnailUrl: hdri.thumbnailUrl,
  })),
);
</script>

<template>
  <div class="viewer-scene-panel">
    <SceneAssetMenu
      label="Model"
      :items="modelItems"
      :active-id="props.activeModelId"
      @select="emit('select-model', $event)"
    />

    <SceneAssetMenu
      label="Environment"
      :items="hdriItems"
      :active-id="props.activeHdriId"
      @select="emit('select-hdri', $event)"
    />
  </div>
</template>

<style scoped>
.viewer-scene-panel {
  position: absolute;
  bottom: 12px;
  left: 50%;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  max-width: calc(100% - 24px);
  padding: 4px;
  background: rgba(33, 37, 43, 0.72);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 8px 24px var(--shadow);
  transform: translateX(-50%);
}
</style>
