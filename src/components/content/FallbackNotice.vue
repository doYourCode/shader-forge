<script setup lang="ts">
import { ref } from 'vue';

import { PT_BR_LOCALE } from '@/lib/locales';

const props = withDefaults(
  defineProps<{
    /** Whether the page is currently showing a fallback (untranslated) body. */
    visible?: boolean;
  }>(),
  {
    visible: false,
  },
);

const dismissed = ref(false);
</script>

<template>
  <aside
    v-if="props.visible && !dismissed"
    class="fallback-notice"
    role="status"
    :lang="PT_BR_LOCALE"
  >
    <p class="fallback-notice__text">
      Este conteúdo ainda não foi traduzido. Exibindo o original em inglês.
    </p>
    <button
      type="button"
      class="fallback-notice__close"
      aria-label="Fechar aviso"
      @click="dismissed = true"
    >
      ×
    </button>
  </aside>
</template>

<style scoped>
.fallback-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--accent-yellow);
  border-left-width: 4px;
  border-radius: 4px;
  background: var(--bg-raised);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.4;
}

.fallback-notice__text {
  flex: 1 1 auto;
  margin: 0;
}

.fallback-notice__close {
  flex: 0 0 auto;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.1rem 0.25rem;
  cursor: pointer;
}

.fallback-notice__close:hover {
  color: var(--fg-strong);
}
</style>
