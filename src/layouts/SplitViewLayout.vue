<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Left column width in rem. Defaults to sketch’s ~30%. */
    leftWidth?: number;
    /** Optional label above the left pane (e.g., "Tree view") */
    leftLabel?: string;
    /** Optional label above the right pane (e.g., "Content") */
    rightLabel?: string;
  }>(),
  {
    leftWidth: 22,
    leftLabel: '',
    rightLabel: '',
  },
);
</script>

<template>
  <div
    class="split-view"
    :style="{ '--left-width': `${leftWidth}rem` }"
  >
    <!-- LEFT -->
    <aside class="split-view__pane split-view__pane--left">
      <header v-if="leftLabel" class="split-view__pane-label">
        {{ leftLabel }}
      </header>
      <div class="split-view__pane-body">
        <slot name="left" />
      </div>
    </aside>

    <!-- RIGHT -->
    <section class="split-view__pane split-view__pane--right">
      <header v-if="rightLabel" class="split-view__pane-label">
        {{ rightLabel }}
      </header>
      <div class="split-view__pane-body">
        <slot name="right" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.split-view {
  display: grid;
  grid-template-columns: var(--left-width) 1fr;
  /* Fill the parent, and only this area scrolls internally */
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  background: var(--bg);
}

.split-view__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.split-view__pane--left {
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-subtle);
}

.split-view__pane--right {
  background: var(--bg);
}

.split-view__pane-label {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  color: var(--fg-muted);
  flex: 0 0 auto;
}

.split-view__pane-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 0.75rem;
}
</style>