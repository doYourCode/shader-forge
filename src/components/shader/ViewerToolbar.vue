<script setup lang="ts">
const props = defineProps<{
  wireframe: boolean;
  paused: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-wireframe'): void;
  (e: 'toggle-pause'): void;
}>();
</script>

<template>
  <div class="viewer-toolbar">
    <div class="viewer-toolbar__group">
      <button class="viewer-toolbar__btn">Models</button>
      <button class="viewer-toolbar__btn">HDRs</button>
    </div>

    <div class="viewer-toolbar__group">
      <button
        class="viewer-toolbar__btn"
        :class="{ 'viewer-toolbar__btn--active': props.wireframe }"
        @click="emit('toggle-wireframe')"
      >
        Wireframe
      </button>
      <button class="viewer-toolbar__btn">Cfg</button>
      <button class="viewer-toolbar__btn">Social</button>
      <button
        class="viewer-toolbar__btn"
        :class="{ 'viewer-toolbar__btn--active': props.paused }"
        @click="emit('toggle-pause')"
      >
        {{ props.paused ? 'Resume' : 'Pause' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.viewer-toolbar__group {
  display: flex;
  gap: 4px;
}

.viewer-toolbar__btn {
  padding: 5px 10px;
  background: var(--bg-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease,
    border-color 0.12s ease;
}

.viewer-toolbar__btn:hover {
  background: #3a404d;
  border-color: #4b5263;
  color: var(--fg-strong);
}

.viewer-toolbar__btn--active {
  background: #404754;
  border-color: var(--accent-blue);
  color: var(--fg-strong);
}
</style>