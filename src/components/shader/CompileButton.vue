<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { CirclePlay } from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'compile'): void;
}>();
</script>

<template>
  <button type="button" class="compile-button" @click="emit('compile')">
    <CirclePlay :size="13" aria-hidden="true" />
    <span>{{ t('editor.compile') }}</span>
  </button>
</template>

<style scoped>
.compile-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  background: var(--action-primary);
  color: var(--action-primary-contrast);
  border: 1px solid var(--action-primary);
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(152, 195, 121, 0.3);
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}

.compile-button:hover {
  background: var(--action-primary-hover);
  border-color: var(--action-primary-hover);
}

.compile-button:active {
  background: var(--action-primary-active);
  border-color: var(--action-primary-active);
}
</style>
