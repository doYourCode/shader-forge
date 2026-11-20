<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { EditorStatus } from '@/composables/useShaderEditor';

const props = defineProps<{
  line: number;
  col: number;
  status: EditorStatus;
  message: string;
}>();

const { t } = useI18n();

const statusLabel = computed(() => t(`editor.status.${props.status}`));
</script>

<template>
  <div class="status-bar">
    <span class="status-bar__pos">
      Line: {{ props.line }}&nbsp;&nbsp; Col: {{ props.col }}
    </span>
    <span class="status-bar__status">
      {{ statusLabel }}
      <span v-if="props.message" class="status-bar__message">
        — {{ props.message }}
      </span>
    </span>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  color: var(--fg-muted);
}

.status-bar__pos {
  font-family: var(--font-code);
  font-size: var(--font-size-label);
  opacity: 0.85;
}

.status-bar__message {
  opacity: 0.7;
}
</style>
