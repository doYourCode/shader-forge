<script setup lang="ts">
withDefaults(
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
</script>

<template>
  <article class="content-pane">
    <template v-if="content">
      <!-- v-html is safe here ONLY because content is authored by us. 
           Swap for a markdown renderer or a sanitizer if content ever becomes user-provided. -->
      <div class="content-pane__body" v-html="content" />
    </template>
    <p v-else class="content-pane__empty">{{ emptyText }}</p>
  </article>
</template>

<style scoped>
.content-pane {
  max-width: 70ch;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1.55;
}

.content-pane__body :deep(h1),
.content-pane__body :deep(h2),
.content-pane__body :deep(h3) {
  margin-top: 1.2em;
}

.content-pane__body :deep(code) {
  background: #f2f2f2;
  padding: 0 0.25em;
  border-radius: 3px;
}

.content-pane__empty {
  color: #777;
  font-style: italic;
}
</style>