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
</script>

<template>
  <section class="gbuffer-panel" :aria-label="t('screenSpace.debug.title')">
    <header class="gbuffer-panel__header">
      <h2 class="gbuffer-panel__title">{{ t('screenSpace.debug.title') }}</h2>
      <p class="gbuffer-panel__description">
        {{ t('screenSpace.debug.description') }}
      </p>
    </header>

    <div class="gbuffer-panel__modes" role="group">
      <button
        v-for="mode in modes"
        :key="mode.id"
        type="button"
        class="gbuffer-panel__mode"
        :class="{ 'gbuffer-panel__mode--active': mode.id === props.active }"
        :aria-pressed="mode.id === props.active"
        @click="emit('change', mode.id)"
      >
        {{ t(mode.labelKey) }}
      </button>
    </div>

    <dl class="gbuffer-panel__contract">
      <div>
        <dt>depthTexture</dt>
        <dd>R32F · linear view-space depth in world units</dd>
      </div>
      <div>
        <dt>normalTexture</dt>
        <dd>RGBA16F · view-space normal (encoded), alpha = geometry mask</dd>
      </div>
      <div>
        <dt>albedoTexture</dt>
        <dd>
          RGBA8 · sqrt-encoded linear base colour (square it), alpha = geometry
          mask
        </dd>
      </div>
      <div>
        <dt>materialTexture</dt>
        <dd>
          RGBA8 · F0.rgb + glossiness.a; roughness = 1 - a, metallic is derived
          against albedo
        </dd>
      </div>
      <div>
        <dt>velocityTexture</dt>
        <dd>RG16F · linear UV-space motion vectors</dd>
      </div>
      <div>
        <dt>objectIdTexture</dt>
        <dd>R32F · per-object id, 0 = background</dd>
      </div>
      <div>
        <dt>sceneColorTexture</dt>
        <dd>RGBA16F · original HDR opaque scene colour</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.gbuffer-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 14px 16px 20px;
  overflow: auto;
  background: var(--bg);
}

.gbuffer-panel__title {
  margin: 0;
  color: var(--fg-strong);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.gbuffer-panel__description {
  margin: 4px 0 0;
  max-width: 72ch;
  color: var(--fg-muted);
  font-size: 12px;
  line-height: 1.5;
}

.gbuffer-panel__modes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gbuffer-panel__mode {
  padding: 6px 11px;
  background: var(--bg-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: 12px;
  cursor: pointer;
}

.gbuffer-panel__mode:hover {
  color: var(--fg-strong);
  border-color: var(--accent-ui);
}

.gbuffer-panel__mode--active {
  background: rgba(152, 195, 121, 0.12);
  border-color: rgba(152, 195, 121, 0.5);
  color: var(--fg-strong);
}

.gbuffer-panel__contract {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
}

.gbuffer-panel__contract div {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 10px;
}

.gbuffer-panel__contract dt {
  color: var(--fg-strong);
  font-family: var(--font-mono);
  font-size: 11px;
}

.gbuffer-panel__contract dd {
  margin: 0;
  color: var(--fg-muted);
  font-size: 11px;
  line-height: 1.45;
}
</style>
