<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  ref,
} from 'vue';
import { useI18n } from 'vue-i18n';

import { previewTextureCatalog } from '@/core/constants/previewTextures';
import type {
  SamplerKind,
  UserTextureSource,
} from '@/core/models/userUniform';
import type {
  TexturePickerPort,
  TexturePickerSession,
  TexturePickRejection,
  TexturePickResult,
} from '@/services/texturepicker/TexturePicker';
import { TEXTURE_PICKER } from './texturePickerContext';

const props = defineProps<{
  kind: SamplerKind;
  value: UserTextureSource;
  /** Uniform name, used to make the dialog label specific. */
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'change', value: UserTextureSource): void;
}>();

const { t } = useI18n();

const picker: TexturePickerPort = (() => {
  const injected = inject(TEXTURE_PICKER);
  if (!injected) {
    throw new Error(
      'TextureSourceInput requires a TexturePickerPort provided as TEXTURE_PICKER.',
    );
  }
  return injected;
})();

const isOpen = ref(false);
const error = ref<'rejected' | 'unavailable' | null>(null);
const hostRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);

let activeSession: TexturePickerSession | null = null;
let previouslyFocused: HTMLElement | null = null;
let previousBodyOverflow = '';
let modalStateActive = false;
let unmounted = false;

const repositoryTexture = computed(() =>
  props.value.kind === 'repository'
    ? previewTextureCatalog.find(props.value.textureId)
    : undefined,
);

const missingTextureId = computed(() =>
  props.value.kind === 'repository' && !repositoryTexture.value
    ? props.value.textureId
    : undefined,
);

const textureUrl = computed(() =>
  props.value.kind === 'url' ? props.value.url : '',
);

const currentLabel = computed(() => {
  const source = props.value;

  if (source.kind === 'file') return source.file.name;

  if (source.kind === 'repository') {
    return repositoryTexture.value?.label ?? t('userData.texture.missing');
  }

  return source.url.trim().length > 0
    ? source.url
    : t('userData.texture.noTexture');
});

const chooseLabel = computed(() =>
  props.value.kind === 'url' && props.value.url.trim().length === 0
    ? t('userData.texture.choose')
    : t('userData.texture.change'),
);

const hasBundledTextures = computed(
  () => previewTextureCatalog.forSampler(props.kind).length > 0,
);

const errorMessage = computed(() =>
  error.value === null ? '' : t(`userData.texture.${error.value}`),
);

function rejectionKey(reason: TexturePickRejection): 'rejected' | 'unavailable' {
  return reason === 'unsupported-asset' ? 'rejected' : 'unavailable';
}

function openPicker(): void {
  if (isOpen.value) return;

  error.value = null;
  enterModalState();
  isOpen.value = true;
  void mountPicker();
}

async function mountPicker(): Promise<void> {
  await nextTick();
  if (unmounted || !isOpen.value) return;

  const host = hostRef.value;
  if (!host) {
    closeModal(false);
    return;
  }

  // AssetPicker's own controls are pointer-oriented; land focus on the dialog.
  dialogRef.value?.focus({ preventScroll: true });

  let session: TexturePickerSession;
  try {
    session = picker.open({ sampler: props.kind }, host);
  } catch {
    error.value = 'unavailable';
    closeModal(true);
    return;
  }

  activeSession = session;

  let result: TexturePickResult;
  try {
    result = await session.result;
  } catch {
    // The port contract says the promise never rejects; be defensive anyway.
    result = { status: 'rejected', reason: 'picker-unavailable' };
  }

  session.dispose();
  if (activeSession === session) activeSession = null;
  if (unmounted) return;

  if (result.status === 'picked') {
    emit('change', result.source);
    closeModal(true);
    return;
  }

  if (result.status === 'rejected') {
    error.value = rejectionKey(result.reason);
  }

  closeModal(true);
}

function closeModal(restoreFocus: boolean): void {
  if (isOpen.value) {
    isOpen.value = false;

    const session = activeSession;
    activeSession = null;
    session?.dispose();
  }

  leaveModalState(restoreFocus);
}

function enterModalState(): void {
  if (modalStateActive) return;
  modalStateActive = true;

  previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.getElementById('app')?.setAttribute('inert', '');
}

function leaveModalState(restoreFocus: boolean): void {
  if (!modalStateActive) return;
  modalStateActive = false;

  document.body.style.overflow = previousBodyOverflow;
  document.getElementById('app')?.removeAttribute('inert');

  if (restoreFocus) {
    const target = triggerRef.value ?? previouslyFocused;
    target?.focus({ preventScroll: true });
  }

  previouslyFocused = null;
}

function clearTexture(): void {
  error.value = null;
  emit('change', { kind: 'url', url: '' });
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

onBeforeUnmount(() => {
  unmounted = true;

  const session = activeSession;
  activeSession = null;
  session?.dispose();

  leaveModalState(false);
});
</script>

<template>
  <div class="texture-source" :data-kind="props.kind">
    <div class="texture-source__summary">
      <img
        v-if="repositoryTexture"
        class="texture-source__preview"
        :src="repositoryTexture.url"
        alt=""
      />
      <span
        class="texture-source__value"
        :title="missingTextureId"
        :class="{
          'texture-source__value--missing': missingTextureId !== undefined,
        }"
      >
        {{ currentLabel }}
      </span>

      <button
        ref="triggerRef"
        type="button"
        class="texture-source__choose"
        :disabled="isOpen || !hasBundledTextures"
        @click="openPicker"
      >
        {{ chooseLabel }}
      </button>
      <button
        type="button"
        class="texture-source__clear"
        :disabled="isOpen"
        @click="clearTexture"
      >
        {{ t('userData.texture.clear') }}
      </button>
    </div>

    <p
      v-if="!hasBundledTextures"
      class="texture-source__hint"
      role="note"
    >
      {{ t('userData.texture.noBundled') }}
    </p>

    <p v-if="error" class="texture-source__error" role="alert">
      {{ errorMessage }}
    </p>

    <details class="texture-source__advanced">
      <summary class="texture-source__advanced-summary">
        {{ t('userData.texture.advanced') }}
      </summary>

      <div class="texture-source__advanced-body">
        <label class="texture-source__field">
          <span class="texture-source__field-label">
            {{ t('userData.texture.urlPlaceholder') }}
          </span>
          <input
            class="texture-source__url"
            type="text"
            spellcheck="false"
            autocomplete="off"
            :aria-label="t('userData.texture.urlPlaceholder')"
            :placeholder="t('userData.texture.urlPlaceholder')"
            :value="textureUrl"
            @input="onUrlInput"
          />
        </label>

        <label class="texture-source__file">
          <input
            class="texture-source__file-input"
            type="file"
            accept="image/*"
            :aria-label="t('userData.texture.chooseFile')"
            @change="onFileInput"
          />
          <span class="texture-source__file-label">
            {{ t('userData.texture.chooseFile') }}
          </span>
        </label>
      </div>
    </details>

    <Teleport to="body">
      <div
        v-if="isOpen"
        class="texture-source__overlay"
        @click.self="closeModal(true)"
        @keydown.esc.stop.prevent="closeModal(true)"
      >
        <div
          ref="dialogRef"
          class="texture-source__dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="t('userData.texture.dialog')"
          tabindex="-1"
        >
          <header class="texture-source__dialog-header">
            <h2 class="texture-source__dialog-title">
              {{ t('userData.texture.dialog') }}
              <span v-if="props.label" class="texture-source__dialog-name">
                · {{ props.label }}
              </span>
            </h2>
            <button
              type="button"
              class="texture-source__close"
              :aria-label="t('userData.texture.close')"
              @click="closeModal(true)"
            >
              ×
            </button>
          </header>

          <div ref="hostRef" class="texture-source__picker" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.texture-source {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.texture-source__summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.texture-source__preview {
  width: 24px;
  height: 24px;
  flex: none;
  object-fit: cover;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 2px;
}

.texture-source__value {
  max-width: 170px;
  overflow: hidden;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.texture-source__value--missing {
  color: var(--accent-red);
}

.texture-source__choose,
.texture-source__clear {
  padding: 3px 8px;
  background: #404754;
  color: var(--fg-strong);
  border: 1px solid #4b5263;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.texture-source__choose:hover,
.texture-source__clear:hover {
  background: #4b5263;
  border-color: var(--accent-blue);
}

.texture-source__choose:disabled,
.texture-source__clear:disabled {
  opacity: 0.5;
  cursor: default;
}

.texture-source__choose:disabled:hover,
.texture-source__clear:disabled:hover {
  background: #404754;
  border-color: #4b5263;
}

.texture-source__hint {
  margin: 0;
  max-width: 260px;
  color: var(--fg-subtle);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
}

.texture-source__error {
  margin: 0;
  max-width: 320px;
  color: var(--accent-red);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
}

.texture-source__advanced {
  max-width: 320px;
}

.texture-source__advanced-summary {
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  user-select: none;
}

.texture-source__advanced-body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 5px;
}

.texture-source__field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.texture-source__field-label {
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.texture-source__url {
  width: 160px;
  min-width: 0;
  padding: 3px 6px;
  background: var(--bg-input);
  color: var(--fg-strong);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.texture-source__file {
  position: relative;
  overflow: hidden;
}

.texture-source__file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.texture-source__file-label {
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

.texture-source__overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(12, 14, 18, 0.72);
}

.texture-source__dialog {
  display: flex;
  flex-direction: column;
  width: min(960px, 92vw);
  height: min(720px, 82vh);
  min-height: 0;
  overflow: hidden;
  background: var(--bg-elevated);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 18px 48px var(--shadow);
  outline: none;
}

.texture-source__dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  background: var(--bg-raised);
  border-bottom: 1px solid var(--border);
}

.texture-source__dialog-title {
  margin: 0;
  overflow: hidden;
  color: var(--fg-strong);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.texture-source__dialog-name {
  color: var(--fg-muted);
  font-weight: 400;
}

.texture-source__close {
  flex: none;
  padding: 0 6px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1.2;
  cursor: pointer;
}

.texture-source__close:hover {
  color: var(--fg-strong);
  border-color: var(--border);
}

.texture-source__picker {
  /* AssetPicker theme contract: the patched package reads these --ap-* tokens.
     Keep all picker theming here; do not target AssetPicker internals. */
  --ap-font-sans: var(--font-sans);
  --ap-font-mono: var(--font-mono);

  --ap-surface: var(--bg-elevated);
  --ap-card-surface: var(--bg-raised);
  --ap-navbar-surface: var(--bg-elevated);
  --ap-footer-surface: var(--bg-elevated);
  --ap-input-surface: var(--bg-input);
  --ap-hover-surface: var(--bg-raised);
  --ap-resize-handle: var(--border-subtle);

  --ap-border: var(--border);
  --ap-border-subtle: var(--border-subtle);
  --ap-border-strong: #4b5263;
  --ap-border-hover: var(--accent-blue);

  --ap-text: var(--fg);
  --ap-text-strong: var(--fg-strong);
  --ap-text-muted: var(--fg-muted);
  --ap-text-subtle: var(--fg-subtle);

  --ap-accent: var(--accent-blue);
  --ap-accent-strong: #7fc4f7;
  --ap-accent-contrast: var(--bg-input);
  --ap-accent-soft: rgba(97, 175, 239, 0.28);

  --ap-tree-selected-surface: var(--bg-selected);
  --ap-tree-selected-text: var(--fg-strong);

  --ap-button-surface: #404754;
  --ap-button-border: #4b5263;
  --ap-button-hover-surface: #4b5263;

  --ap-warning-surface: rgba(229, 192, 123, 0.12);
  --ap-warning-border: rgba(229, 192, 123, 0.4);
  --ap-warning-text: var(--accent-yellow);

  --ap-radius-sm: 3px;
  --ap-radius: 4px;
  --ap-radius-lg: 5px;

  flex: 1;
  min-height: 0;
  overflow: hidden;
  color-scheme: dark;
  background: var(--ap-surface);
}
</style>
