<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import SplitViewLayout from '@/components/layout/SplitViewLayout.vue';
import TreeView from './TreeView.vue';
import ContentPane from './ContentPane.vue';
import EditorCallout from './EditorCallout.vue';
import FallbackNotice from './FallbackNotice.vue';
import NotFoundView from '@/views/NotFoundView.vue';

import { buildContentTree } from '@/core/content/contentTrees';
import { contentPath, relativePathFor } from '@/core/content/contentPaths';
import {
  noContentResult,
  showsFallbackNotice,
  type ContentKind,
  type ResolveResult,
} from '@/core/content/ContentResolver';
import { resolveLocale, type Locale } from '@/core/content/locales';
import { useContentLookup } from '@/services/content/contentProvider';
import { findFirstLeaf, flattenLeaves } from '@/core/utils/treeUtils';
import type { ITreeNode } from '@/core/models/treeNode';

const props = defineProps<{ kind: ContentKind }>();

const route = useRoute();
const router = useRouter();
const { locale: uiLocale } = useI18n();
const contentLookup = useContentLookup();

/**
 * The header language selector (vue-i18n `locale`) is the single source of
 * truth for both UI strings and content. Switching it re-resolves the current
 * document; URLs stay locale-neutral and therefore stable across languages.
 */
const contentLocale = computed<Locale>(() =>
  resolveLocale(uiLocale.value),
);

const slug = computed<string | null>(() => {
  const value = route.params.slug;
  return typeof value === 'string' && value.length > 0 ? value : null;
});

/* ----------------------------- navigation tree ---------------------------- */

const tree = shallowRef<ITreeNode[]>([]);
let treeToken = 0;

watch(
  [() => props.kind, contentLocale],
  async ([kind, locale]) => {
    const token = ++treeToken;
    const next = await buildContentTree(contentLookup, kind, locale);
    if (token === treeToken) tree.value = next;
  },
  { immediate: true },
);

/* --------------------------------- search --------------------------------- */

const query = ref('');
const trimmedQuery = computed(() => query.value.trim());

/**
 * Search runs over the resolved tree, so it respects the same fallback policy
 * as navigation: an untranslated page is searchable under its English title.
 */
const searchResults = computed<ITreeNode[]>(() => {
  const needle = trimmedQuery.value.toLowerCase();
  if (needle.length < 2) return [];

  return flattenLeaves(tree.value)
    .filter((node) => {
      const haystack = [node.label, node.description, node.content]
        .filter((value): value is string => Boolean(value))
        .join('\n')
        .toLowerCase();
      return haystack.includes(needle);
    })
    .slice(0, 40);
});

/* ------------------------------ resolved doc ------------------------------ */

const result = shallowRef<ResolveResult>(noContentResult());
const resolving = shallowRef(false);
let documentToken = 0;

watch(
  [slug, contentLocale],
  async ([nextSlug, locale]) => {
    if (!nextSlug) {
      result.value = noContentResult();
      resolving.value = false;
      return;
    }

    const token = ++documentToken;
    resolving.value = true;
    const next = await contentLookup.resolve(
      relativePathFor(props.kind, nextSlug),
      locale,
    );
    if (token !== documentToken) return;

    result.value = next;
    resolving.value = false;
  },
  { immediate: true },
);

// `/docs` (no slug) selects the first readable entry, then replaces the URL so
// every document has a shareable address.
watch(
  [tree, slug],
  ([nodes, currentSlug]) => {
    if (currentSlug || nodes.length === 0) return;
    const first = findFirstLeaf(nodes);
    if (first) {
      void router.replace(contentPath(props.kind, first.id));
    }
  },
  { immediate: true },
);

const notFound = computed(
  () => slug.value !== null && !resolving.value && result.value.content === null,
);

const fallbackVisible = computed(() => showsFallbackNotice(result.value));

/* ------------------------------ prev / next ------------------------------- */

const leaves = computed(() => flattenLeaves(tree.value));

const currentIndex = computed(() =>
  leaves.value.findIndex((node) => node.id === slug.value),
);

const previous = computed<{ id: string; label: string } | null>(() => {
  const index = currentIndex.value;
  if (index <= 0) return null;
  const node = leaves.value[index - 1];
  return node ? { id: node.id, label: node.label } : null;
});

const next = computed<{ id: string; label: string } | null>(() => {
  const index = currentIndex.value;
  if (index < 0) return null;
  const node = leaves.value[index + 1];
  return node ? { id: node.id, label: node.label } : null;
});

function select(node: ITreeNode): void {
  navigate(node.id);
}

function navigate(id: string): void {
  query.value = '';
  void router.push(contentPath(props.kind, id));
}

/* ------------------------------ <html lang> ------------------------------- */

watch(
  () => result.value.locale ?? contentLocale.value,
  (effectiveLocale) => {
    document.documentElement.lang = effectiveLocale;
  },
  { immediate: true },
);

onUnmounted(() => {
  document.documentElement.lang = resolveLocale(uiLocale.value);
});
</script>

<template>
  <NotFoundView v-if="notFound" />

  <SplitViewLayout v-else left-label="Contents" right-label="Content">
    <template #left>
      <div class="content-browser__nav">
        <label class="content-browser__search">
          <span class="content-browser__search-label">Search</span>
          <input
            v-model="query"
            type="search"
            class="content-browser__search-input"
            placeholder="Search the reference…"
            autocomplete="off"
            spellcheck="false"
          />
        </label>

        <p
          v-if="trimmedQuery.length > 0 && trimmedQuery.length < 2"
          class="content-browser__status"
        >
          Type at least two characters.
        </p>

        <ul
          v-else-if="trimmedQuery.length > 0"
          class="content-browser__results"
          aria-label="Search results"
        >
          <li v-for="node in searchResults" :key="node.id">
            <button
              type="button"
              class="content-browser__result"
              @click="select(node)"
            >
              <span class="content-browser__result-title">{{ node.label }}</span>
              <span v-if="node.description" class="content-browser__result-description">
                {{ node.description }}
              </span>
            </button>
          </li>
          <li v-if="searchResults.length === 0" class="content-browser__status">
            No pages match “{{ trimmedQuery }}”.
          </li>
        </ul>

        <TreeView
          v-else
          :nodes="tree"
          :selected-id="slug"
          @select="select"
        />
      </div>
    </template>

    <template #right>
      <div class="content-browser">
        <p v-if="resolving" class="content-browser__status">Loading…</p>

        <template v-else-if="result.content">
          <FallbackNotice
            :key="`${slug ?? ''}:${contentLocale}`"
            :visible="fallbackVisible"
          />
          <EditorCallout
            v-if="result.content.editor"
            :editor="result.content.editor"
            :example="result.content.example"
          />
          <ContentPane
            :content="result.content.body"
            :difficulty="result.content.difficulty"
            :description="result.content.description"
            :printable="result.content.printable"
            :generated="result.content.generated"
            :previous="previous"
            :next="next"
            @navigate="navigate"
          />
        </template>

        <p v-else class="content-browser__status">
          Select an entry from the tree on the left.
        </p>
      </div>
    </template>
  </SplitViewLayout>
</template>

<style scoped>
.content-browser {
  display: flex;
  flex-direction: column;
}

.content-browser__status {
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-style: italic;
}

.content-browser__nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.content-browser__search {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.content-browser__search-label {
  color: var(--fg-subtle);
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.content-browser__search-input {
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: 0.8rem;
}

.content-browser__search-input:focus {
  outline: none;
  border-color: var(--accent-ui);
}

.content-browser__results {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.content-browser__result {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  width: 100%;
  padding: 0.35rem 0.45rem;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--fg);
  text-align: left;
  cursor: pointer;
}

.content-browser__result:hover,
.content-browser__result:focus-visible {
  border-color: var(--border);
  background: var(--bg-raised);
}

.content-browser__result-title {
  color: var(--fg-strong);
  font-family: var(--font-mono);
  font-size: 0.82rem;
}

.content-browser__result-description {
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 0.72rem;
  line-height: 1.35;
}
</style>
