<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { USER_UNIFORM_KIND_MAP } from '@/core/constants/userUniformKinds';
import type {
  UserColor3Value,
  UserColor4Value,
  UserTextureSource,
  UserUniformKind,
  UserUniformValue,
} from '@/core/models/userUniform';

const props = defineProps<{
  kind: UserUniformKind;
  value: UserUniformValue;
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

const colorHex = computed(() => {
  const color = props.value as UserColor3Value;
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
});

const texture = computed<UserTextureSource>(
  () => props.value as UserTextureSource,
);

const textureUrl = computed(() =>
  texture.value.kind === 'url' ? texture.value.url : '',
);

const textureLabel = computed(() => {
  if (texture.value.kind === 'file') return texture.value.file.name;
  if (texture.value.url.trim().length > 0) return texture.value.url;
  return t('userData.texture.noTexture');
});

function toHex(channel: number): string {
  const clamped = Math.min(1, Math.max(0, channel));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
}

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

function onColorInput(event: Event): void {
  const rgb = parseHex((event.target as HTMLInputElement).value);
  if (!rgb) return;

  if (hasAlpha.value) {
    emit('change', { ...rgb, a: alphaValue.value });
    return;
  }

  emit('change', rgb);
}

function onAlphaInput(event: Event): void {
  const value = readNumber(event);
  if (value === null) return;

  emit('change', { ...(props.value as UserColor4Value), a: value });
}

function onUrlInput(event: Event): void {
  emit('change', {
    kind: 'url',
    url: (event.target as HTMLInputElement).value,
  });
}

function onFileInput(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) emit('change', { kind: 'file', file });
}

function parseHex(
  hex: string,
): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return null;

  return {
    r: parseInt(match[1], 16) / 255,
    g: parseInt(match[2], 16) / 255,
    b: parseInt(match[3], 16) / 255,
  };
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
      <input
        class="uniform-value__color-input"
        type="color"
        :value="colorHex"
        @input="onColorInput"
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
          @input="onAlphaInput"
        />
      </label>
    </div>

    <div v-else class="uniform-value__texture">
      <input
        class="uniform-value__url"
        type="text"
        :placeholder="t('userData.texture.urlPlaceholder')"
        :value="textureUrl"
        @input="onUrlInput"
      />
      <label class="uniform-value__file">
        <input
          class="uniform-value__file-input"
          type="file"
          accept="image/*"
          @change="onFileInput"
        />
        <span class="uniform-value__file-label">
          {{ t('userData.texture.chooseFile') }}
        </span>
      </label>
      <span class="uniform-value__texture-name">{{ textureLabel }}</span>
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
.uniform-value__alpha-input,
.uniform-value__url {
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

.uniform-value__color-input {
  width: 34px;
  height: 24px;
  padding: 0;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
}

.uniform-value__alpha {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.uniform-value__texture {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.uniform-value__url {
  width: 180px;
}

.uniform-value__file {
  position: relative;
  overflow: hidden;
}

.uniform-value__file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.uniform-value__file-label {
  display: inline-block;
  padding: 3px 8px;
  background: #404754;
  color: var(--fg-strong);
  border: 1px solid #4b5263;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.uniform-value__texture-name {
  max-width: 140px;
  overflow: hidden;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
