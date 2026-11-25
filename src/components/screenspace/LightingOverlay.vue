<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import {
  ENVIRONMENT_INTENSITY_LIMITS,
  SUN_INTENSITY_LIMITS,
} from '@/core/constants/screenSpaceRender';

const props = defineProps<{
  sunIntensity: number;
  environmentIntensity: number;
}>();

const emit = defineEmits<{
  (e: 'sun-intensity', value: number): void;
  (e: 'environment-intensity', value: number): void;
}>();

const { t } = useI18n();

function readNumber(event: Event): number | null {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return null;

  const value = Number.parseFloat(target.value);
  return Number.isFinite(value) ? value : null;
}

function onSunInput(event: Event): void {
  const value = readNumber(event);
  if (value !== null) emit('sun-intensity', value);
}

function onEnvironmentInput(event: Event): void {
  const value = readNumber(event);
  if (value !== null) emit('environment-intensity', value);
}
</script>

<template>
  <section
    class="lighting-overlay"
    :aria-label="t('screenSpace.lighting.title')"
  >
    <h2 class="lighting-overlay__title">
      {{ t('screenSpace.lighting.title') }}
    </h2>

    <label class="lighting-overlay__row lighting-overlay__sun">
      <span class="lighting-overlay__label">
        {{ t('screenSpace.lighting.sun') }}
      </span>
      <input
        class="lighting-overlay__range"
        type="range"
        :min="SUN_INTENSITY_LIMITS.min"
        :max="SUN_INTENSITY_LIMITS.max"
        :step="SUN_INTENSITY_LIMITS.step"
        :value="props.sunIntensity"
        :aria-label="t('screenSpace.lighting.sun')"
        @input="onSunInput"
      />
      <output class="lighting-overlay__value">
        {{ props.sunIntensity.toFixed(2) }}
      </output>
    </label>

    <label class="lighting-overlay__row lighting-overlay__environment">
      <span class="lighting-overlay__label">
        {{ t('screenSpace.lighting.environment') }}
      </span>
      <input
        class="lighting-overlay__range"
        type="range"
        :min="ENVIRONMENT_INTENSITY_LIMITS.min"
        :max="ENVIRONMENT_INTENSITY_LIMITS.max"
        :step="ENVIRONMENT_INTENSITY_LIMITS.step"
        :value="props.environmentIntensity"
        :aria-label="t('screenSpace.lighting.environment')"
        @input="onEnvironmentInput"
      />
      <output class="lighting-overlay__value">
        {{ props.environmentIntensity.toFixed(2) }}
      </output>
    </label>
  </section>
</template>

<style scoped>
.lighting-overlay {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 216px;
  padding: 8px 9px;
  background: rgba(33, 37, 43, 0.82);
  border: 1px solid var(--border);
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.lighting-overlay__title {
  margin: 0;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lighting-overlay__row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 7px;
}

.lighting-overlay__label {
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: 11px;
}

.lighting-overlay__range {
  width: 100%;
  height: 14px;
  margin: 0;
  accent-color: var(--accent-ui);
  cursor: pointer;
}

.lighting-overlay__value {
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-align: right;
}
</style>
