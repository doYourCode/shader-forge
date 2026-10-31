<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import SplitViewLayout from '@/layouts/SplitViewLayout.vue';
import TreeView from '@/components/knowledge/TreeView.vue';
import ContentPane from '@/components/knowledge/ContentPane.vue';
import ContentLanguageSwitcher from './ContentLanguageSwitcher.vue';
import FallbackNotice from './FallbackNotice.vue';
import NotFoundView from '@/views/NotFoundView.vue';

import { contentResolver } from '@/lib/content';
import { buildContentTree } from '@/lib/contentTrees';
import { contentPath, relativePathFor } from '@/lib/contentPaths';
import {
  noContentResult,
  showsFallbackNotice,
  type ContentKind,
  type ResolveResult,
} from '@/lib/ContentResolver';
import { resolveLocale, type Locale } from '@/lib/locales';
import { findFirstLeaf } from '@/core/utils/treeUtils';
import type { ITreeNode } from '@/core/models/treeNode';

const props = defineProps<{ kind: ContentKind }>();

const route = useRoute();
const router = useRouter();
const { locale: uiLocale } = useI18n();

/**
 * Content locale: an explicit URL prefix wins (`/pt-BR/docs/...`); otherwise
 * the unprefixed URL follows the UI locale.
 *
 * UI-string locale and content locale stay separate concerns: the header
 * selector owns UI strings, the content switcher owns the document language.
 */
const routeLocale = computed<Locale>(
  () => route.meta.locale ?? resolveLocale(uiLocale.value),
);

const slug = computed<string | null>(() => {
  const value = route.params.slug;
  return typeof value === 'string' && value.length > 0 ? value : null;
});

/* ----------------------------- navigation tree ---------------------------- */

const tree = shallowRef<ITreeNode[]>([]);
let treeToken = 0;

watch(
  [() => props.kind, routeLocale],
  async ([kind, locale]) => {
    const token = ++treeToken;
    const next = await buildContentTree(contentResolver, kind, locale);
    if (token === treeToken) tree.value = next;
  },
  { immediate: true },
);

/* ------------------------------ resolved doc ------------------------------ */

const result = shallowRef<ResolveResult>(noContentResult());
const resolving = shallowRef(false);
let documentToken = 0;

watch(
  [slug, routeLocale],
  async ([nextSlug, locale]) => {
    if (!nextSlug) {
      result.value = noContentResult();
      resolving.value = false;
      return;
    }

    const token = ++documentToken;
    resolving.value = true;
    const next = await contentResolver.resolve(
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
      void router.replace(
        contentPath(routeLocale.value, props.kind, first.id),
      );
    }
  },
  { immediate: true },
);

const notFound = computed(
  () => slug.value !== null && !resolving.value && result.value.content === null,
);

const fallbackVisible = computed(() => showsFallbackNotice(result.value));

function select(node: ITreeNode): void {
  void router.push(contentPath(routeLocale.value, props.kind, node.id));
}

/* ------------------------------ <html lang> ------------------------------- */

watch(
  () => result.value.locale ?? routeLocale.value,
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

  <SplitViewLayout v-else left-label="Tree view" right-label="Content">
    <template #left>
      <TreeView :nodes="tree" :selected-id="slug" @select="select" />
    </template>

    <template #right>
      <div class="content-browser">
        <ContentLanguageSwitcher
          v-if="slug"
          :kind="kind"
          :slug="slug"
          :current-locale="routeLocale"
        />

        <p v-if="resolving" class="content-browser__status">Loading…</p>

        <template v-else-if="result.content">
          <FallbackNotice
            :key="`${slug ?? ''}:${routeLocale}`"
            :visible="fallbackVisible"
          />
          <ContentPane :content="result.content.body" />
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
</style>
