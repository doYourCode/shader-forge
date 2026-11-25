<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  renderMarkdownDocument,
  type MarkdownHeading,
} from '@/core/content/markdown';
import type { ContentDifficulty } from '@/core/content/contentMetadata';
import {
  editorPath,
  isEditorTarget,
} from '@/core/navigation/editorLinks';
import { useMermaid } from '@/composables/useMermaid';
import { writeClipboard } from '@/services/clipboard';

export interface ContentPaneLink {
  readonly id: string;
  readonly label: string;
}

const props = withDefaults(
  defineProps<{
    content?: string | null;
    /** Precomputed headings; falls back to the ones parsed from `content`. */
    headings?: readonly MarkdownHeading[];
    difficulty?: ContentDifficulty | null;
    description?: string | null;
    printable?: boolean;
    /** Generated pages are rebuilt by a script and must not be edited by hand. */
    generated?: boolean;
    previous?: ContentPaneLink | null;
    next?: ContentPaneLink | null;
    /** Empty-state text when content is null/empty */
    emptyText?: string;
  }>(),
  {
    content: null,
    headings: undefined,
    difficulty: null,
    description: null,
    printable: false,
    generated: false,
    previous: null,
    next: null,
    emptyText: 'Select an entry from the tree on the left.',
  },
);

const emit = defineEmits<{
  (e: 'navigate', id: string): void;
}>();

const router = useRouter();

const rendered = computed(() =>
  props.content
    ? renderMarkdownDocument(props.content)
    : { html: '', headings: [] },
);

const html = computed(() => rendered.value.html);
const headings = computed(() =>
  props.headings && props.headings.length > 0
    ? props.headings
    : rendered.value.headings,
);

const difficultyLabel = computed(() => {
  if (!props.difficulty) return 'Reference';
  return props.difficulty.charAt(0).toUpperCase() + props.difficulty.slice(1);
});

const body = ref<HTMLElement | null>(null);

// Markdown emits inert Mermaid placeholders; this hydrates them to SVG after
// every content change (including locale switches).
useMermaid(body, () => props.content);

/* ------------------------- code block interactions ------------------------ */

function codeElement(button: HTMLElement): HTMLElement | null {
  return button.closest('.code-block')?.querySelector('code') ?? null;
}

async function copyCode(button: HTMLButtonElement): Promise<void> {
  const code = codeElement(button)?.textContent ?? '';
  const copied = await writeClipboard(code);

  button.textContent = copied ? 'Copied' : 'Copy failed';
  window.setTimeout(() => {
    button.textContent = 'Copy';
  }, 1600);
}

function runCode(button: HTMLButtonElement): void {
  const target = button.dataset.runTarget;
  if (!isEditorTarget(target)) return;

  const example = button.dataset.example ?? null;
  const effect = button.dataset.effect ?? null;
  const code = example || effect ? null : (codeElement(button)?.textContent ?? '');
  if (!example && !effect && !code) return;

  void router.push(editorPath({ target, example, effect, code }));
}

async function onBodyClick(event: MouseEvent): Promise<void> {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest<HTMLButtonElement>('button[data-code-action]');
  if (!button) return;

  if (button.dataset.codeAction === 'copy') {
    await copyCode(button);
    return;
  }

  if (button.dataset.codeAction === 'run') {
    runCode(button);
  }
}

function printPage(): void {
  window.print();
}
</script>

<template>
  <article class="content-pane" :class="{ 'content-pane--printable': printable }">
    <header v-if="content" class="content-pane__header">
      <div class="content-pane__meta">
        <span
          class="content-pane__badge"
          :data-difficulty="difficulty ?? 'reference'"
        >
          {{ difficultyLabel }}
        </span>
        <span v-if="generated" class="content-pane__generated">Generated</span>
        <p v-if="description" class="content-pane__description">{{ description }}</p>
      </div>

      <button
        v-if="printable"
        type="button"
        class="content-pane__print"
        @click="printPage"
      >
        Print / Save as PDF
      </button>
    </header>

    <div v-if="html" class="content-pane__layout">
      <!-- eslint-disable vue/no-v-html -->
      <div
        ref="body"
        class="content-pane__body"
        @click="onBodyClick"
        v-html="html"
      />
      <!-- eslint-enable vue/no-v-html -->

      <aside v-if="headings.length > 0" class="content-pane__toc" aria-label="On this page">
        <p class="content-pane__toc-title">On this page</p>
        <ol class="content-pane__toc-list">
          <li
            v-for="heading in headings"
            :key="heading.id"
            :class="`content-pane__toc-item content-pane__toc-item--h${heading.level}`"
          >
            <a :href="`#${heading.id}`">{{ heading.text }}</a>
          </li>
        </ol>
      </aside>
    </div>

    <p v-else class="content-pane__empty">{{ emptyText }}</p>

    <footer
      v-if="previous || next"
      class="content-pane__pager"
      aria-label="Lesson navigation"
    >
      <button
        v-if="previous"
        type="button"
        class="content-pane__pager-link content-pane__pager-link--previous"
        @click="emit('navigate', previous.id)"
      >
        <span class="content-pane__pager-label">Previous</span>
        <span class="content-pane__pager-title">{{ previous.label }}</span>
      </button>

      <span v-else />

      <button
        v-if="next"
        type="button"
        class="content-pane__pager-link content-pane__pager-link--next"
        @click="emit('navigate', next.id)"
      >
        <span class="content-pane__pager-label">Next</span>
        <span class="content-pane__pager-title">{{ next.label }}</span>
      </button>
    </footer>
  </article>
</template>

<style scoped>
.content-pane {
  max-width: 100%;
  padding: 0 1rem 2rem;
  box-sizing: border-box;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--fg);
}

.content-pane__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.75rem 0 0.25rem;
  padding: 0 0 0.65rem;
  border-bottom: 1px solid var(--border-subtle);
}

.content-pane__meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.content-pane__badge {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-raised);
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.content-pane__badge[data-difficulty='beginner'] {
  border-color: rgba(152, 195, 121, 0.45);
  color: var(--accent-green);
}

.content-pane__badge[data-difficulty='intermediate'] {
  border-color: rgba(229, 192, 123, 0.45);
  color: var(--accent-yellow);
}

.content-pane__badge[data-difficulty='advanced'] {
  border-color: rgba(224, 108, 117, 0.45);
  color: var(--accent-red);
}

.content-pane__badge[data-difficulty='reference'] {
  border-color: var(--border);
  color: var(--fg-subtle);
}

.content-pane__generated {
  padding: 0.1rem 0.45rem;
  border: 1px dashed var(--border);
  border-radius: 999px;
  color: var(--fg-subtle);
  font-family: var(--font-ui);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.content-pane__description {
  margin: 0;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 0.8rem;
}

.content-pane__print {
  flex: 0 0 auto;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-raised);
  color: var(--fg-strong);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  cursor: pointer;
}

.content-pane__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px;
  gap: 1.5rem;
  align-items: start;
}

.content-pane__body {
  min-width: 0;
}

.content-pane__toc {
  position: sticky;
  top: 0.75rem;
  max-height: calc(100vh - 2rem);
  overflow: auto;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-elevated);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  line-height: 1.4;
}

.content-pane__toc-title {
  margin: 0 0 0.45rem;
  color: var(--fg-subtle);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.content-pane__toc-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.content-pane__toc-item {
  margin: 0.15rem 0;
}

.content-pane__toc-item--h3 {
  padding-left: 0.75rem;
  font-size: 0.7rem;
}

.content-pane__toc-item a {
  color: var(--fg-muted);
  text-decoration: none;
}

.content-pane__toc-item a:hover {
  color: var(--fg-strong);
  text-decoration: underline;
}

.content-pane__body :deep(h1),
.content-pane__body :deep(h2),
.content-pane__body :deep(h3) {
  margin-top: 1.2em;
  color: var(--fg-strong);
  scroll-margin-top: 0.75rem;
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
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
}

.content-pane__body :deep(.glossary-term) {
  border-bottom: 1px dotted var(--accent-blue);
  cursor: help;
  text-decoration: none;
}

.content-pane__body :deep(details) {
  margin: 0.75em 0;
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: var(--bg-elevated);
}

.content-pane__body :deep(summary) {
  cursor: pointer;
  color: var(--fg-strong);
}

.content-pane__body :deep(.solution summary) {
  color: var(--accent-green);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 700;
}

.content-pane__body :deep(.solution > *:not(summary)) {
  margin-top: 0.6em;
}

.content-pane__body :deep(.callout) {
  margin: 0.9em 0;
  padding: 0.55em 0.75em;
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 4px;
  background: var(--bg-elevated);
}

.content-pane__body :deep(.callout--note) {
  border-left-color: var(--accent-blue);
}

.content-pane__body :deep(.callout--warning) {
  border-left-color: var(--accent-yellow);
}

.content-pane__body :deep(.callout__title) {
  margin: 0;
  color: var(--fg-strong);
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.content-pane__body :deep(.callout > p:not(.callout__title)) {
  margin: 0.35em 0 0;
}

/* ------------------------------- code blocks ----------------------------- */

.content-pane__body :deep(.code-block) {
  margin: 0.9em 0;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.content-pane__body :deep(.code-block__toolbar) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-raised);
  font-family: var(--font-ui);
  font-size: 0.7rem;
}

.content-pane__body :deep(.code-block__lang) {
  color: var(--fg-subtle);
  font-family: var(--font-code);
  text-transform: lowercase;
}

.content-pane__body :deep(.code-block__title) {
  color: var(--fg-muted);
}

.content-pane__body :deep(.code-block__spacer) {
  flex: 1 1 auto;
}

.content-pane__body :deep(.code-block__action) {
  padding: 0.12rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-input);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: 0.7rem;
  cursor: pointer;
}

.content-pane__body :deep(.code-block__action:hover) {
  border-color: var(--accent-ui);
  color: var(--fg-strong);
}

.content-pane__body :deep(.code-block__action--primary) {
  border-color: rgba(152, 195, 121, 0.5);
  color: var(--accent-green);
}

.content-pane__body :deep(.code-block pre) {
  margin: 0;
  border: 0;
  border-radius: 0;
}

/* -------------------------------- pager ---------------------------------- */

.content-pane__pager {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.content-pane__pager-link {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-width: 45%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-elevated);
  color: var(--fg);
  font-family: var(--font-ui);
  text-align: left;
  cursor: pointer;
}

.content-pane__pager-link--next {
  margin-left: auto;
  text-align: right;
}

.content-pane__pager-link:hover {
  border-color: var(--accent-ui);
}

.content-pane__pager-label {
  color: var(--fg-subtle);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.content-pane__pager-title {
  color: var(--fg-strong);
  font-size: 0.82rem;
}

/* Mermaid placeholders become SVG diagrams; the pseudo-element covers the
   short gap while the lazily loaded renderer turns a placeholder into SVG. */
.content-pane__body :deep(.mermaid-diagram) {
  margin: 1em 0;
  padding: 0.75rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  overflow-x: auto;
  text-align: center;
}

.content-pane__body :deep(.mermaid-diagram:empty)::before {
  content: 'Rendering diagram…';
  color: var(--fg-subtle);
  font-style: italic;
}

.content-pane__body :deep(.mermaid-diagram svg) {
  max-width: 100%;
  height: auto;
}

.content-pane__body :deep(.mermaid-diagram__error-title) {
  margin: 0 0 0.5em;
  color: var(--accent-red);
}

.content-pane__body :deep(.mermaid-diagram__error pre) {
  text-align: left;
}

@media (max-width: 1100px) {
  .content-pane__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .content-pane__toc {
    position: static;
    order: -1;
    max-height: none;
  }
}
</style>
