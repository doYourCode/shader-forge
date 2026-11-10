<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import iro from '@jaames/iro';

import type {
  UserColor3Value,
  UserColor4Value,
} from '@/core/models/userUniform';
import {
  byteToUnit,
  clampUnit,
  parseHexColor,
  rgbToHex,
  rgbaToHex,
  unitToByte,
} from '@/core/utils/color';

/** iro is byte-based; treat sub-byte alpha drift as the same value. */
const ALPHA_EPSILON = 1e-3;
const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 6;
const PANEL_FALLBACK_WIDTH = 244;
const PANEL_FALLBACK_HEIGHT = 320;

type ColorPickerConstructor = new (
  host: HTMLElement,
  options: Parameters<typeof iro.ColorPicker>[1],
) => iro.ColorPicker;

// iro's declarations only describe the callable widget factory, while the
// runtime value is also a constructor. Keep the explicit `new` and give it the
// construct signature the implementation actually has.
const ColorPicker = iro.ColorPicker as unknown as ColorPickerConstructor;

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

const isOpen = ref(false);
const hexDraft = ref('');
const hexFocused = ref(false);
const hexDirty = ref(false);
const hexInvalid = ref(false);

const panelId = useId();

const hasAlpha = computed(() => props.alpha !== undefined);
const alphaUnit = computed(() => clampUnit(props.alpha ?? 1));
const uniformName = computed(
  () => props.label ?? t('userData.kinds.color'),
);

// The trigger stays compact with the RGB hex; the alpha is shown next to it
// and the editable field carries the full #rrggbbaa form for color4.
const triggerHex = computed(() => rgbToHex(props.color));

const currentHex = computed(() => {
  if (hasAlpha.value) {
    return rgbaToHex({
      r: props.color.r,
      g: props.color.g,
      b: props.color.b,
      a: alphaUnit.value,
    });
  }

  return triggerHex.value;
});

hexDraft.value = currentHex.value;

const swatchStyle = computed(() => ({
  backgroundColor: `rgba(${unitToByte(props.color.r)}, ${unitToByte(
    props.color.g,
  )}, ${unitToByte(props.color.b)}, ${
    hasAlpha.value ? alphaUnit.value : 1
  })`,
}));

let picker: iro.ColorPicker | null = null;

/**
 * iro reports byte channels; the document stores unit floats. Rounding RGB
 * makes a drag that stays inside the same byte a no-op for Vue.
 */
function onColorChange(color: iro.Color): void {
  const rgb: UserColor3Value = {
    r: byteToUnit(color.red),
    g: byteToUnit(color.green),
    b: byteToUnit(color.blue),
  };
  const next: UserColor3Value | UserColor4Value = hasAlpha.value
    ? { ...rgb, a: clampUnit(color.alpha) }
    : rgb;

  if (matchesCurrent(next)) return;

  // The picker is the source of this edit, so its value owns the draft.
  hexDraft.value = formatHex(next);
  hexDirty.value = false;
  hexInvalid.value = false;

  emit('change', next);
}

function matchesCurrent(value: UserColor3Value | UserColor4Value): boolean {
  const sameRgb =
    unitToByte(value.r) === unitToByte(props.color.r) &&
    unitToByte(value.g) === unitToByte(props.color.g) &&
    unitToByte(value.b) === unitToByte(props.color.b);

  if (!sameRgb || !hasAlpha.value) return sameRgb;
  if (!('a' in value)) return false;

  return Math.abs(clampUnit(value.a) - alphaUnit.value) <= ALPHA_EPSILON;
}

function formatHex(value: UserColor3Value | UserColor4Value): string {
  return 'a' in value ? rgbaToHex(value) : rgbToHex(value);
}

function ensurePicker(): void {
  const host = pickerHostRef.value;
  if (picker || !host) return;

  const r = unitToByte(props.color.r);
  const g = unitToByte(props.color.g);
  const b = unitToByte(props.color.b);

  const instance = new ColorPicker(host, {
    width: 220,
    color: hasAlpha.value
      ? { r, g, b, a: alphaUnit.value }
      : { r, g, b },
    layout: [
      { component: iro.ui.Wheel },
      { component: iro.ui.Slider, options: { sliderType: 'value' } },
      ...(hasAlpha.value
        ? [{ component: iro.ui.Slider, options: { sliderType: 'alpha' } }]
        : []),
    ],
    borderWidth: 0,
    margin: 10,
    handleRadius: 7,
  });

  instance.on('color:change', onColorChange);
  picker = instance;
}

/** Pushes external prop edits into iro without emitting back a change. */
function syncPickerFromProps(): void {
  const instance = picker;
  if (!instance) return;

  const r = unitToByte(props.color.r);
  const g = unitToByte(props.color.g);
  const b = unitToByte(props.color.b);
  const currentAlpha = clampUnit(instance.color.alpha);

  const sameRgb =
    instance.color.red === r &&
    instance.color.green === g &&
    instance.color.blue === b;
  const sameAlpha =
    !hasAlpha.value ||
    Math.abs(currentAlpha - alphaUnit.value) <= ALPHA_EPSILON;

  if (sameRgb && sameAlpha) return;

  instance.color.set(
    hasAlpha.value
      ? { r, g, b, a: alphaUnit.value }
      : { r, g, b },
  );
}

/**
 * The panel is teleported to the body, so it cannot sit next to the trigger in
 * the layout. Place it from the trigger rect and keep it inside the viewport.
 */
function updatePosition(): void {
  const trigger = triggerRef.value;
  const panel = panelRef.value;
  if (!trigger || !panel || !isOpen.value) return;

  const rect = trigger.getBoundingClientRect();
  const width = panel.offsetWidth || PANEL_FALLBACK_WIDTH;
  const height = panel.offsetHeight || PANEL_FALLBACK_HEIGHT;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    viewportWidth - width - VIEWPORT_MARGIN,
  );

  const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), maxLeft);
  let top = rect.bottom + PANEL_GAP;

  if (top + height > viewportHeight - VIEWPORT_MARGIN) {
    const above = rect.top - PANEL_GAP - height;
    top =
      above >= VIEWPORT_MARGIN
        ? above
        : Math.max(
            VIEWPORT_MARGIN,
            viewportHeight - height - VIEWPORT_MARGIN,
          );
  }

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

async function openPicker(): Promise<void> {
  if (isOpen.value) return;

  isOpen.value = true;
  await nextTick();

  ensurePicker();
  syncPickerFromProps();

  if (!hexFocused.value) {
    hexDraft.value = currentHex.value;
    hexDirty.value = false;
    hexInvalid.value = false;
  }

  updatePosition();

  // iro's own controls are pointer-only; land keyboard users on the hex field.
  hexInputRef.value?.focus({ preventScroll: true });
}

function closePicker(restoreFocus = false): void {
  if (!isOpen.value) return;

  isOpen.value = false;
  hexFocused.value = false;

  if (restoreFocus) {
    void nextTick(() => triggerRef.value?.focus());
  }
}

function togglePicker(): void {
  if (isOpen.value) {
    closePicker();
    return;
  }

  void openPicker();
}

function onHexInput(event: Event): void {
  hexDraft.value = (event.target as HTMLInputElement).value;
  hexDirty.value = true;
  hexInvalid.value = false;
}

function onHexFocus(): void {
  hexFocused.value = true;
}

function onHexBlur(): void {
  hexFocused.value = false;
  commitHex();
}

function commitHex(): void {
  if (!hexDirty.value) return;
  hexDirty.value = false;

  const parsed = parseHexColor(hexDraft.value);
  if (!parsed || (!hasAlpha.value && 'a' in parsed)) {
    rejectHex();
    return;
  }

  const next: UserColor3Value | UserColor4Value = hasAlpha.value
    ? {
        r: parsed.r,
        g: parsed.g,
        b: parsed.b,
        a: 'a' in parsed ? parsed.a : alphaUnit.value,
      }
    : { r: parsed.r, g: parsed.g, b: parsed.b };

  hexInvalid.value = false;
  hexDraft.value = formatHex(next);

  if (matchesCurrent(next)) return;

  emit('change', next);
}

function rejectHex(): void {
  hexInvalid.value = true;
  hexDraft.value = currentHex.value;

  // The error line grows the panel; re-check the flip/clamp against it.
  void nextTick(updatePosition);
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isOpen.value) return;

  event.preventDefault();
  closePicker(true);
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!isOpen.value) return;

  const target = event.target;
  if (
    target instanceof Node &&
    (panelRef.value?.contains(target) ||
      triggerRef.value?.contains(target))
  ) {
    return;
  }

  // Clicking elsewhere already moves focus; do not pull it back to the trigger.
  closePicker();
}

function onViewportChange(): void {
  if (isOpen.value) updatePosition();
}

watch(
  () => [props.color.r, props.color.g, props.color.b, props.alpha] as const,
  () => {
    syncPickerFromProps();

    if (!hexFocused.value) {
      hexDraft.value = currentHex.value;
      hexDirty.value = false;
      hexInvalid.value = false;
    }
  },
);

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onViewportChange, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown);
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);

  // iro v5 has no destroy(); unbinding and removing its root is the cleanup.
  picker?.off('color:change', onColorChange);
  picker?.base?.remove();
  picker = null;
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
        <span
          class="user-color-picker__swatch-color"
          :style="swatchStyle"
        />
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

        <span
          v-if="hexInvalid"
          class="user-color-picker__error"
          role="alert"
        >
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
