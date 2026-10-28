<script setup lang="ts">
import { computed } from 'vue';
import type { EditorStatus } from '@/composables/useShaderEditor';

const props = defineProps<{
  line: number;
  col: number;
  status: EditorStatus;
  message: string;
}>();

const statusLabel = computed(() => {
  switch (props.status) {
    case 'ready': return '🟢 Ready';
    case 'error': return '🔴 Error';
    case 'compiling': return '🟡 Compiling';
    default: return '⚪ Idle';
  }
});
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
  border-top: 1px solid var(--border);
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg);
}

.status-bar__pos {
  opacity: 0.85;
}

.status-bar__message {
  opacity: 0.7;
}
</style>