<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import {
  TONEMAP_MODES,
  type PostEffectDocument,
  type TonemapMode,
} from '@/core/models/postEffect';

const props = withDefaults(
  defineProps<{
    effects: readonly PostEffectDocument[];
    activeId: string;
    tonemap: TonemapMode;
    /** Screen-space effects get their own copy; defaults keep the 3D editor. */
    titleKey?: string;
    descriptionKey?: string;
  }>(),
  {
    titleKey: 'postEffects.title',
    descriptionKey: 'postEffects.description',
  },
);

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'add'): void;
  (e: 'remove', id: string): void;
  (e: 'move', id: string, offset: number): void;
  (e: 'toggle', id: string, enabled: boolean): void;
  (e: 'tonemap', mode: TonemapMode): void;
}>();

const { t } = useI18n();

function onToggle(effect: PostEffectDocument, event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  emit('toggle', effect.id, input.checked);
}

function onTonemap(event: Event): void {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;

  const mode = TONEMAP_MODES.find((candidate) => candidate === select.value);
  if (mode) emit('tonemap', mode);
}
</script>

<template>
  <section class="post-effects" :aria-label="t(props.titleKey)">
    <header class="post-effects__header">
      <div class="post-effects__heading">
        <h2 class="post-effects__title">{{ t(props.titleKey) }}</h2>
        <p class="post-effects__description">
          {{ t(props.descriptionKey) }}
        </p>
      </div>

      <button type="button" class="post-effects__add" @click="emit('add')">
        {{ t('postEffects.add') }}
      </button>
    </header>

    <ul class="post-effects__list">
      <li
        v-for="(effect, index) in props.effects"
        :key="effect.id"
        class="post-effects__item"
        :class="{ 'post-effects__item--active': effect.id === props.activeId }"
      >
        <input
          type="checkbox"
          class="post-effects__enabled"
          :checked="effect.enabled"
          :aria-label="t('postEffects.enable', { name: effect.name })"
          @change="onToggle(effect, $event)"
        />

        <button
          type="button"
          class="post-effects__select"
          :aria-pressed="effect.id === props.activeId"
          @click="emit('select', effect.id)"
        >
          {{ effect.name }}
        </button>

        <span v-if="!effect.enabled" class="post-effects__disabled">
          {{ t('postEffects.disabled') }}
        </span>

        <span class="post-effects__actions">
          <button
            type="button"
            class="post-effects__action"
            :disabled="index === 0"
            :aria-label="t('postEffects.moveUp', { name: effect.name })"
            @click="emit('move', effect.id, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="post-effects__action"
            :disabled="index === props.effects.length - 1"
            :aria-label="t('postEffects.moveDown', { name: effect.name })"
            @click="emit('move', effect.id, 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="post-effects__action post-effects__action--danger"
            :aria-label="t('postEffects.remove', { name: effect.name })"
            @click="emit('remove', effect.id)"
          >
            ×
          </button>
        </span>
      </li>
    </ul>

    <label class="post-effects__tonemap">
      <span>{{ t('postEffects.tonemap') }}</span>
      <select :value="props.tonemap" @change="onTonemap">
        <option v-for="mode in TONEMAP_MODES" :key="mode" :value="mode">
          {{ t(`postEffects.tonemapModes.${mode}`) }}
        </option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.post-effects {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.post-effects__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.post-effects__title {
  margin: 0;
  color: var(--fg-strong);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.post-effects__description {
  margin: 3px 0 0;
  max-width: 64ch;
  color: var(--fg-muted);
  font-size: 11px;
  line-height: 1.45;
}

.post-effects__add {
  flex: 0 0 auto;
  padding: 4px 10px;
  background: #404754;
  color: var(--fg-strong);
  border: 1px solid #4b5263;
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 11px;
  cursor: pointer;
}

.post-effects__add:hover {
  background: #4b5263;
  border-color: var(--accent-ui);
}

.post-effects__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.post-effects__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  border: 1px solid transparent;
  border-radius: 3px;
}

.post-effects__item--active {
  background: rgba(152, 195, 121, 0.1);
  border-color: rgba(152, 195, 121, 0.35);
}

.post-effects__enabled {
  flex: 0 0 auto;
  cursor: pointer;
}

.post-effects__select {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  overflow: hidden;
  background: transparent;
  color: var(--fg);
  border: none;
  font-family: var(--font-ui);
  font-size: 12px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.post-effects__select:hover {
  color: var(--fg-strong);
}

.post-effects__disabled {
  color: var(--fg-subtle);
  font-family: var(--font-ui);
  font-size: var(--font-size-label);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.post-effects__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
}

.post-effects__action {
  width: 20px;
  height: 20px;
  padding: 0;
  background: var(--bg-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.post-effects__action:hover:not(:disabled) {
  border-color: var(--accent-ui);
  color: var(--fg-strong);
}

.post-effects__action:disabled {
  opacity: 0.35;
  cursor: default;
}

.post-effects__action--danger:hover:not(:disabled) {
  border-color: var(--accent-red);
  color: var(--accent-red);
}

.post-effects__tonemap {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 11px;
}

.post-effects__tonemap select {
  padding: 3px 6px;
  background: var(--bg-input);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 11px;
}
</style>
