<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import type { ContentEditor } from '@/core/content/contentMetadata';
import { editorPath } from '@/core/navigation/editorLinks';

const props = defineProps<{
  editor: ContentEditor;
  /** Bundled example id; omitted when the page only opens the editor. */
  example?: string | null;
}>();

const EDITOR_LABELS: Record<ContentEditor, string> = {
  editor: '3D Shader Editor',
  sandbox: '2D Sandbox',
  'screen-space': 'Screen Space GLSL Editor',
};

const label = computed(() => EDITOR_LABELS[props.editor]);

const description = computed(() =>
  props.example
    ? `Opens the bundled ${props.example} example in the ${label.value}.`
    : `Opens the ${label.value}.`,
);
</script>

<template>
  <aside class="editor-callout" :data-editor="editor">
    <div class="editor-callout__text">
      <p class="editor-callout__eyebrow">Try it in the editor</p>
      <p class="editor-callout__description">{{ description }}</p>
    </div>

    <RouterLink
      class="editor-callout__action"
      :to="editorPath({ target: editor, example })"
    >
      Open in {{ label }}
      <span aria-hidden="true">→</span>
    </RouterLink>
  </aside>
</template>

<style scoped>
.editor-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.75rem 1rem 0;
  padding: 0.65rem 0.8rem;
  border: 1px solid rgba(97, 175, 239, 0.35);
  border-left-width: 4px;
  border-radius: 5px;
  background: var(--bg-elevated);
  font-family: var(--font-ui);
}

.editor-callout[data-editor='sandbox'] {
  border-left-color: var(--accent-green);
}

.editor-callout[data-editor='editor'] {
  border-left-color: var(--accent-orange);
}

.editor-callout[data-editor='screen-space'] {
  border-left-color: var(--accent-purple);
}

.editor-callout__text {
  min-width: 0;
}

.editor-callout__eyebrow {
  margin: 0 0 0.15rem;
  color: var(--fg-subtle);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.editor-callout__description {
  margin: 0;
  color: var(--fg);
  font-size: 0.78rem;
  line-height: 1.4;
}

.editor-callout__action {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--accent-ui);
  border-radius: 4px;
  background: rgba(152, 195, 121, 0.12);
  color: var(--fg-strong);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
}

.editor-callout__action:hover {
  background: rgba(152, 195, 121, 0.2);
  color: var(--fg-strong);
}

@media (max-width: 720px) {
  .editor-callout {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
