<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Library } from 'lucide-vue-next';

import { useModalDialog } from '@/composables/useModalDialog';
import type {
  ExamplePickRejection,
  ExamplePickerPort,
  ExamplePickerSession,
  ExamplePickResult,
} from '@/services/examplepicker/ExamplePicker';
import { EXAMPLE_PICKER } from './examplePickerContext';

const emit = defineEmits<{
  (e: 'pick', exampleId: string): void;
}>();

const { t } = useI18n();

const picker: ExamplePickerPort = (() => {
  const injected = inject(EXAMPLE_PICKER);
  if (!injected) {
    throw new Error(
      'ShaderExamplePicker requires an ExamplePickerPort provided as EXAMPLE_PICKER.',
    );
  }
  return injected;
})();

const isOpen = ref(false);
const isLoading = ref(false);
const error = ref<'rejected' | 'unavailable' | null>(null);
const hostRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);

const modal = useModalDialog();

let activeSession: ExamplePickerSession | null = null;
let unmounted = false;

const errorMessage = computed(() =>
  error.value === null ? '' : t(`editor.examples.${error.value}`),
);

function preloadPicker(): void {
  picker.preload();
}

function openPicker(): void {
  if (isOpen.value) return;

  error.value = null;
  isLoading.value = true;
  modal.enter();
  isOpen.value = true;
  void mountPicker();
}

async function mountPicker(): Promise<void> {
  await nextTick();
  if (unmounted || !isOpen.value) return;

  const host = hostRef.value;
  if (!host) {
    closeDialog(false);
    return;
  }

  // AssetPicker's own controls are pointer-oriented; land focus on the dialog.
  dialogRef.value?.focus({ preventScroll: true });

  let session: ExamplePickerSession;
  try {
    session = picker.open(host);
  } catch {
    isLoading.value = false;
    error.value = 'unavailable';
    return;
  }

  activeSession = session;

  // `ready` never rejects, but guard the callback anyway so a misbehaving
  // implementation cannot leave the skeleton on screen forever.
  const releaseLoading = (): void => {
    if (!unmounted && activeSession === session) isLoading.value = false;
  };
  void session.ready.then(releaseLoading, releaseLoading);

  let result: ExamplePickResult;
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
    emit('pick', result.exampleId);
    closeDialog(true);
    return;
  }

  if (result.status === 'cancelled') {
    closeDialog(true);
    return;
  }

  // Keep the dialog open on failure: closing it would swallow the only hint
  // about why nothing was picked.
  isLoading.value = false;
  error.value = rejectionKey(result.reason);
}

function rejectionKey(
  reason: ExamplePickRejection,
): 'rejected' | 'unavailable' {
  return reason === 'unsupported-example' ? 'rejected' : 'unavailable';
}

function closeDialog(restoreFocus: boolean): void {
  isLoading.value = false;

  if (isOpen.value) {
    isOpen.value = false;

    const session = activeSession;
    activeSession = null;
    session?.dispose();
  }

  modal.leave(restoreFocus, triggerRef.value);
}

onBeforeUnmount(() => {
  unmounted = true;
  isLoading.value = false;

  const session = activeSession;
  activeSession = null;
  session?.dispose();

  modal.leave(false);
});
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="example-picker__trigger"
    :disabled="isOpen"
    :aria-label="t('editor.examples.open')"
    @pointerenter="preloadPicker"
    @focus="preloadPicker"
    @click="openPicker"
  >
    <Library :size="13" aria-hidden="true" />
    <span>{{ t('editor.examples.open') }}</span>
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="example-picker__overlay sf-picker__overlay"
      @click.self="closeDialog(true)"
      @keydown.esc.stop.prevent="closeDialog(true)"
    >
      <div
        ref="dialogRef"
        class="example-picker__dialog sf-picker__dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('editor.examples.dialog')"
        tabindex="-1"
      >
        <header class="example-picker__header sf-picker__header">
          <h2 class="example-picker__title sf-picker__title">
            {{ t('editor.examples.dialog') }}
          </h2>
          <button
            type="button"
            class="example-picker__close sf-picker__close"
            :aria-label="t('editor.examples.close')"
            @click="closeDialog(true)"
          >
            ×
          </button>
        </header>

        <p v-if="error" class="example-picker__error" role="alert">
          {{ errorMessage }}
        </p>

        <div
          class="example-picker__body sf-picker__body"
          :aria-busy="isLoading"
        >
          <div
            ref="hostRef"
            class="example-picker__host sf-picker__host assetpicker-theme"
          />
          <div
            v-if="isLoading"
            class="example-picker__loading sf-picker__loading"
            role="status"
            aria-live="polite"
          >
            <span
              class="example-picker__spinner sf-picker__spinner"
              aria-hidden="true"
            />
            <span>{{ t('editor.examples.loading') }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped src="./pickerDialog.css"></style>

<style scoped>
.example-picker__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.example-picker__trigger:hover,
.example-picker__trigger:focus-visible {
  background: var(--bg-raised);
  border-color: var(--border);
  color: var(--fg-strong);
}

.example-picker__trigger:disabled {
  opacity: 0.5;
  cursor: default;
}

.example-picker__error {
  margin: 0;
  padding: 8px 12px;
  color: var(--accent-red);
  background: rgba(224, 108, 117, 0.12);
  border-bottom: 1px solid rgba(224, 108, 117, 0.4);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
}
</style>
