<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  UserColor3Value,
  UserColor4Value,
} from '@/core/models/userUniform';
import { useColorPicker } from '@/composables/useColorPicker';

const props = defineProps<{
  color: UserColor3Value;
  /** Defined only for color4 widgets; undefined means a plain color value. */
  alpha?: number;
  /** Uniform name, used to make the trigger and dialog labels unique. */
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'change', value: UserColor3Value | UserColor4Value): void;
}>();

const { t } = useI18n();

const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const pickerHostRef = ref<HTMLDivElement | null>(null);
const hexInputRef = ref<HTMLInputElement | null>(null);

const panelId = useId();
const uniformName = computed(() => props.label ?? t('userData.kinds.color'));

const {
  isOpen,
  hexDraft,
  hexInvalid,
  hasAlpha,
  alphaUnit,
  triggerHex,
  swatchStyle,
  togglePicker,
  closePicker,
  commitHex,
  onHexInput,
  onHexFocus,
  onHexBlur,
} = useColorPicker({
  trigger: triggerRef,
  panel: panelRef,
  pickerHost: pickerHostRef,
  hexInput: hexInputRef,
  color: () => props.color,
  alpha: () => props.alpha,
  onChange: (value) => emit('change', value),
});
</script>

<template>
  <div class="user-color-picker">
    <button
      ref="triggerRef"
      type="button"
      class="user-color-picker__trigger"
      :class="{ 'user-color-picker__trigger--open': isOpen }"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? panelId : undefined"
      :aria-label="t('userData.color.open', { name: uniformName })"
      @click="togglePicker"
    >
      <span class="user-color-picker__swatch" aria-hidden="true">
        <span class="user-color-picker__swatch-color" :style="swatchStyle" />
      </span>
      <span class="user-color-picker__hex">{{ triggerHex }}</span>
      <span
        v-if="hasAlpha"
        class="user-color-picker__alpha-value"
        aria-hidden="true"
      >
        a {{ alphaUnit.toFixed(2) }}
      </span>
    </button>

    <Teleport to="body">
      <div
        v-show="isOpen"
        :id="panelId"
        ref="panelRef"
        class="user-color-picker__panel"
        role="dialog"
        :aria-label="t('userData.color.dialog', { name: uniformName })"
      >
        <div class="user-color-picker__header">
          <span class="user-color-picker__name">{{ uniformName }}</span>
          <button
            type="button"
            class="user-color-picker__close"
            :aria-label="t('userData.color.close')"
            @click="closePicker(true)"
          >
            ×
          </button>
        </div>

        <div ref="pickerHostRef" class="user-color-picker__picker" />

        <label class="user-color-picker__hex-field">
          <span class="user-color-picker__hex-label">
            {{ t('userData.color.hex') }}
          </span>
          <input
            ref="hexInputRef"
            class="user-color-picker__hex-input"
            type="text"
            spellcheck="false"
            autocomplete="off"
            :value="hexDraft"
            :aria-invalid="hexInvalid ? 'true' : undefined"
            @input="onHexInput"
            @focus="onHexFocus"
            @blur="onHexBlur"
            @keydown.enter.prevent="commitHex"
          />
        </label>

        <span v-if="hexInvalid" class="user-color-picker__error" role="alert">
          {{ t('userData.color.invalidHex') }}
        </span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.user-color-picker {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.user-color-picker__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  padding: 2px 6px 2px 3px;
  background: var(--bg-input);
  color: var(--fg-strong);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
}

.user-color-picker__trigger:hover,
.user-color-picker__trigger--open {
  border-color: var(--accent-blue);
}

.user-color-picker__swatch {
  position: relative;
  width: 18px;
  height: 18px;
  flex: none;
  overflow: hidden;
  background-color: var(--bg-input);
  background-image: conic-gradient(
    var(--bg-raised) 25%,
    var(--bg-input) 0 50%,
    var(--bg-raised) 0 75%,
    var(--bg-input) 0
  );
  background-size: 8px 8px;
  border: 1px solid var(--border);
  border-radius: 2px;
}

.user-color-picker__swatch-color {
  position: absolute;
  inset: 0;
}

.user-color-picker__hex {
  flex: none;
}

.user-color-picker__alpha-value {
  color: var(--fg-subtle);
  font-size: 10px;
}

.user-color-picker__panel {
  position: fixed;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 244px;
  max-height: min(70vh, 420px);
  padding: 8px;
  overflow-y: auto;
  background: var(--bg-elevated);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 10px 28px var(--shadow);
  font-family: var(--font-mono);
  font-size: 12px;
}

.user-color-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}

.user-color-picker__name {
  overflow: hidden;
  color: var(--fg-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.user-color-picker__close {
  flex: none;
  padding: 0 4px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.2;
  cursor: pointer;
}

.user-color-picker__close:hover {
  color: var(--fg-strong);
  border-color: var(--border);
}

.user-color-picker__picker {
  display: flex;
  justify-content: center;
}

.user-color-picker__hex-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-color-picker__hex-label {
  color: var(--fg-subtle);
  font-size: 10px;
}

.user-color-picker__hex-input {
  min-width: 0;
  padding: 4px 6px;
  background: var(--bg-input);
  color: var(--fg-strong);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.user-color-picker__hex-input[aria-invalid='true'] {
  border-color: var(--accent-red);
}

.user-color-picker__error {
  color: var(--accent-red);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
}
</style>
