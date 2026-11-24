<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import CompileButton from '@/components/shader/CompileButton.vue';
import LanguageSwitch from '@/components/layout/LanguageSwitch.vue';
import AppBrand from '@/components/layout/AppBrand.vue';
import type { PreviewScene } from '@/core/models/previewScene';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { ScreenSpaceTab } from '@/composables/usePostEffectNavigation';

const props = defineProps<{
  activeTab: ScreenSpaceTab;
  scenes: readonly PreviewScene[];
  activeSceneId: string;
  hdris: readonly PreviewHdri[];
  activeHdriId: string;
  paused: boolean;
}>();

const emit = defineEmits<{
  (e: 'switch', tab: ScreenSpaceTab): void;
  (e: 'compile'): void;
  (e: 'select-scene', id: string): void;
  (e: 'select-hdri', id: string): void;
  (e: 'toggle-pause'): void;
}>();

const { t } = useI18n();

const tabs: readonly { id: ScreenSpaceTab; labelKey: string }[] = [
  { id: 'post', labelKey: 'screenSpace.tabs.post' },
  { id: 'user_data', labelKey: 'screenSpace.tabs.userData' },
  { id: 'gbuffer', labelKey: 'screenSpace.tabs.gbuffer' },
];

function onSceneChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) {
    emit('select-scene', event.target.value);
  }
}

function onHdriChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) {
    emit('select-hdri', event.target.value);
  }
}
</script>

<template>
  <header class="ss-toolbar">
    <div class="ss-toolbar__lead">
      <AppBrand />

      <nav class="ss-toolbar__tabs" :aria-label="t('screenSpace.tabs.label')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="ss-toolbar__tab"
          :class="{ 'ss-toolbar__tab--active': tab.id === props.activeTab }"
          @click="emit('switch', tab.id)"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>
    </div>

    <div class="ss-toolbar__actions">
      <label class="ss-toolbar__select">
        <span>{{ t('screenSpace.scene') }}</span>
        <select :value="props.activeSceneId" @change="onSceneChange">
          <option
            v-for="scene in props.scenes"
            :key="scene.id"
            :value="scene.id"
          >
            {{ scene.label }}
          </option>
        </select>
      </label>

      <label class="ss-toolbar__select">
        <span>{{ t('screenSpace.environment') }}</span>
        <select :value="props.activeHdriId" @change="onHdriChange">
          <option v-for="hdri in props.hdris" :key="hdri.id" :value="hdri.id">
            {{ hdri.label }}
          </option>
        </select>
      </label>

      <CompileButton @compile="emit('compile')" />

      <button
        type="button"
        class="ss-toolbar__button"
        @click="emit('toggle-pause')"
      >
        {{ props.paused ? t('editor.resume') : t('editor.pause') }}
      </button>

      <LanguageSwitch />
    </div>
  </header>
</template>

<style scoped>
.ss-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.ss-toolbar__lead,
.ss-toolbar__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.ss-toolbar__tabs {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ss-toolbar__tab,
.ss-toolbar__button {
  padding: 5px 11px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  white-space: nowrap;
  cursor: pointer;
}

.ss-toolbar__tab:hover,
.ss-toolbar__button:hover {
  background: var(--bg-raised);
  color: var(--fg-strong);
}

.ss-toolbar__tab--active {
  background: var(--bg);
  border-color: var(--border);
  color: var(--fg-strong);
  box-shadow: inset 0 -2px 0 var(--accent-ui);
}

.ss-toolbar__select {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 11px;
}

.ss-toolbar__select select {
  max-width: 150px;
  padding: 4px 6px;
  background: var(--bg-input);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 11px;
}

.ss-toolbar__button {
  border-color: var(--border);
  background: var(--bg-raised);
}
</style>
