<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@/core/content/markdown';

const props = withDefaults(
  defineProps<{
    content?: string | null;
    /** Empty-state text when content is null/empty */
    emptyText?: string;
  }>(),
  {
    content: null,
    emptyText: 'Select an entry from the tree on the left.',
  },
);

const html = computed(() =>
  props.content ? renderMarkdown(props.content) : '',
);
</script>

<template>
  <article class="content-pane">
    <div v-if="html" class="content-pane__body" v-html="html" />
    <p v-else class="content-pane__empty">{{ emptyText }}</p>
  </article>
</template>

<style scoped>
.content-pane {
  max-width: 100%;
  padding-left: 1rem;  /* Evita que o texto cole na esquerda */
  padding-right: 1rem; /* Evita que o texto cole na direita */
  box-sizing: border-box;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--fg);
}

.content-pane__body :deep(h1),
.content-pane__body :deep(h2),
.content-pane__body :deep(h3) {
  margin-top: 1.2em;
  color: var(--fg-strong);
}

.content-pane__body :deep(a) {
  color: var(--accent-blue);
}

.content-pane__body :deep(code) {
  background: var(--bg-raised);
  color: var(--accent-orange);
  padding: 0 0.25em;
  border-radius: 3px;
}

.content-pane__body :deep(pre) {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0.75rem;
  overflow: auto;
}

.content-pane__empty {
  color: var(--fg-subtle);
  font-style: italic;
}

.content-pane__body :deep(p),
.content-pane__body :deep(ul),
.content-pane__body :deep(ol),
.content-pane__body :deep(blockquote),
.content-pane__body :deep(pre),
.content-pane__body :deep(table) {
  margin: 0.8em 0;
}

.content-pane__body :deep(ul),
.content-pane__body :deep(ol) {
  padding-left: 1.4em;
}

.content-pane__body :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
}

.content-pane__body :deep(blockquote) {
  padding: 0.2em 0.9em;
  border-left: 2px solid var(--accent-blue);
  color: var(--fg-muted);
}

.content-pane__body :deep(table) {
  border-collapse: collapse;
  width: 100%;
}

.content-pane__body :deep(th),
.content-pane__body :deep(td) {
  border: 1px solid var(--border);
  padding: 0.3em 0.5em;
  text-align: left;
}

.content-pane__body :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>