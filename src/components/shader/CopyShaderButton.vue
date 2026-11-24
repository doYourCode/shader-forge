<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, Copy } from 'lucide-vue-next';

import { writeClipboard } from '@/services/clipboard';

const props = defineProps<{
  /** Resolved on click, so unflushed keystrokes and live values are included. */
  getText: () => string;
}>();

const { t } = useI18n();
const tooltipId = useId();

const state = ref<'idle' | 'copied' | 'failed'>('idle');
let resetTimer: ReturnType<typeof setTimeout> | null = null;

const tooltip = computed(() => t(`editor.copy.${state.value}`));

async function copyShader(): Promise<void> {
  const copied = await writeClipboard(props.getText());

  state.value = copied ? 'copied' : 'failed';

  if (resetTimer !== null) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    state.value = 'idle';
    resetTimer = null;
  }, 1600);
}

onBeforeUnmount(() => {
  if (resetTimer !== null) clearTimeout(resetTimer);
});
</script>

<template>
  <div class="copy-shader">
    <button
      type="button"
      class="copy-shader__button"
      :class="`copy-shader__button--${state}`"
      :aria-label="t('editor.copy.label')"
      :aria-describedby="tooltipId"
      @click="copyShader"
    >
      <Check v-if="state === 'copied'" :size="14" aria-hidden="true" />
      <Copy v-else :size="14" aria-hidden="true" />
    </button>

    <span
      :id="tooltipId"
      class="copy-shader__tooltip"
      role="tooltip"
      aria-live="polite"
    >
      {{ tooltip }}
    </span>
  </div>
</template>

<style scoped>
.copy-shader {
  position: absolute;
  top: 8px;
  /* Clears the thin scrollbar CodeMirror paints at the very edge. */
  right: 14px;
  z-index: 3;
}

.copy-shader__button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: rgba(33, 37, 43, 0.9);
  color: var(--fg-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  backdrop-filter: blur(2px);
  transition:
    color 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.copy-shader__button:hover,
.copy-shader__button:focus-visible {
  background: var(--bg-elevated);
  border-color: rgba(152, 195, 121, 0.55);
  color: var(--accent-ui);
}

.copy-shader__button--copied {
  border-color: rgba(152, 195, 121, 0.55);
  color: var(--accent-green);
}

.copy-shader__button--failed {
  border-color: rgba(224, 108, 117, 0.55);
  color: var(--accent-red);
}

.copy-shader__tooltip {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 4;
  padding: 4px 8px;
  white-space: nowrap;
  background: var(--bg-elevated);
  color: var(--fg-strong);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 8px 24px var(--shadow);
  font-family: var(--font-ui);
  font-size: var(--font-size-label);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-2px);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.copy-shader:hover .copy-shader__tooltip,
.copy-shader:focus-within .copy-shader__tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
</style>
