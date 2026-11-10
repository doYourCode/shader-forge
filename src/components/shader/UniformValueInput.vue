<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { USER_UNIFORM_KIND_MAP } from '@/core/constants/userUniformKinds';
import {
  isSamplerKind,
  type SamplerKind,
  type UserColor3Value,
  type UserColor4Value,
  type UserTextureSource,
  type UserUniformKind,
  type UserUniformValue,
} from '@/core/models/userUniform';
import TextureSourceInput from './TextureSourceInput.vue';
import UserColorPicker from './UserColorPicker.vue';

const props = defineProps<{
  kind: UserUniformKind;
  value: UserUniformValue;
  /** Uniform name, forwarded to the color picker's accessible labels. */
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'change', value: UserUniformValue): void;
}>();

const { t } = useI18n();

const widget = computed(() => USER_UNIFORM_KIND_MAP[props.kind].widget);

const components = computed<readonly string[]>(() => {
  switch (props.kind) {
    case 'vec2':
      return ['x', 'y'];
    case 'vec3':
    case 'direction':
    case 'position':
      return ['x', 'y', 'z'];
    case 'vec4':
      return ['x', 'y', 'z', 'w'];
    default:
      return [];
  }
});

const vectorRecord = computed<Record<string, number>>(() =>
  props.value as unknown as Record<string, number>,
);

const numberValue = computed(() =>
  typeof props.value === 'number' ? props.value : 0,
);

const hasAlpha = computed(() => props.kind === 'color4');

const alphaValue = computed(() =>
  hasAlpha.value ? (props.value as UserColor4Value).a : 1,
);

const texture = computed<UserTextureSource>(
  () => props.value as UserTextureSource,
);

/** The texture branch only renders for sampler kinds; keep the type honest. */
const samplerKind = computed<SamplerKind>(() =>
  isSamplerKind(props.kind) ? props.kind : 'sampler2D',
);

function readNumber(event: Event): number | null {
  const target = event.target as HTMLInputElement;
  if (target.value.trim() === '') return null;

  const value = Number(target.value);
  return Number.isFinite(value) ? value : null;
}

function onNumberInput(event: Event): void {
  const value = readNumber(event);
  if (value !== null) emit('change', value);
}

function onComponentInput(component: string, event: Event): void {
  const value = readNumber(event);
  if (value === null) return;

  const current = vectorRecord.value;
  const next: Record<string, number> = {};
  for (const key of components.value) {
    next[key] = key === component ? value : (current[key] ?? 0);
  }

  emit('change', next as unknown as UserUniformValue);
}

function onAlphaInput(event: Event): void {
  const value = readNumber(event);
  if (value === null) return;

  emit('change', { ...(props.value as UserColor4Value), a: value });
}
</script>

<template>
  <div class="uniform-value" :data-kind="props.kind">
    <input
      v-if="widget === 'number'"
      class="uniform-value__number"
      type="number"
      step="any"
      :value="numberValue"
      @input="onNumberInput"
    />

    <div v-else-if="widget === 'vector'" class="uniform-value__vector">
      <label
        v-for="component in components"
        :key="component"
        class="uniform-value__component"
      >
        <span class="uniform-value__component-label">{{ component }}</span>
        <input
          class="uniform-value__component-input"
          type="number"
          step="any"
          :value="vectorRecord[component] ?? 0"
          @input="onComponentInput(component, $event)"
        />
      </label>
    </div>

    <div v-else-if="widget === 'color'" class="uniform-value__color">
      <UserColorPicker
        :color="props.value as UserColor3Value"
        :alpha="hasAlpha ? alphaValue : undefined"
        :label="props.label"
        @change="emit('change', $event)"
      />
      <label v-if="hasAlpha" class="uniform-value__alpha">
        <span class="uniform-value__component-label">a</span>
        <input
          class="uniform-value__alpha-input"
          type="number"
          step="0.01"
          min="0"
          max="1"
          :value="alphaValue"
          :aria-label="t('userData.color.alpha')"
          @input="onAlphaInput"
        />
      </label>
    </div>

    <div v-else class="uniform-value__texture">
      <TextureSourceInput
        :kind="samplerKind"
        :value="texture"
        :label="props.label"
        @change="emit('change', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.uniform-value {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.uniform-value__number,
.uniform-value__component-input,
.uniform-value__alpha-input {
  min-width: 0;
  padding: 3px 6px;
  background: var(--bg-input);
  color: var(--fg-strong);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.uniform-value__number {
  width: 76px;
}

.uniform-value__component-input,
.uniform-value__alpha-input {
  width: 54px;
}

.uniform-value__vector {
  display: flex;
  align-items: center;
  gap: 4px;
}

.uniform-value__component {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.uniform-value__component-label {
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.uniform-value__color {
  display: flex;
  align-items: center;
  gap: 6px;
}

.uniform-value__alpha {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.uniform-value__texture {
  min-width: 0;
}
</style>
