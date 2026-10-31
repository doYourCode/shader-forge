<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, type RouteLocationRaw } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { contentResolver } from '@/lib/content';
import { contentPath, relativePathFor } from '@/lib/contentPaths';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/locales';
import type { ContentKind } from '@/lib/ContentResolver';

const props = defineProps<{
  kind: ContentKind;
  slug: string;
  /** Locale requested by the URL (not necessarily the body's locale). */
  currentLocale: Locale;
}>();

const route = useRoute();
const { t } = useI18n();

/** Exact-locale availability per target; `undefined` while still checking. */
const available = ref<Partial<Record<Locale, boolean>>>({});
let token = 0;

watch(
  () => [props.kind, props.slug, props.currentLocale] as const,
  async ([kind, slug, currentLocale]) => {
    const current = ++token;
    // Drop stale availability while the new check runs.
    available.value = {};
    const relativePath = relativePathFor(kind, slug);
    const targets = LOCALES.filter((locale) => locale !== currentLocale);
    const entries = await Promise.all(
      targets.map(
        async (locale) =>
          [
            locale,
            await contentResolver.hasTranslation(relativePath, locale),
          ] as const,
      ),
    );

    if (current !== token) return;
    available.value = Object.fromEntries(entries) as Partial<
      Record<Locale, boolean>
    >;
  },
  { immediate: true },
);

function targetPath(locale: Locale): RouteLocationRaw {
  return {
    path: contentPath(locale, props.kind, props.slug),
    // Keep the current query/hash, matching the app's link behaviour.
    query: route.query,
    hash: route.hash,
  };
}
</script>

<template>
  <nav class="locale-switcher" :aria-label="t('app.language')">
    <span class="locale-switcher__label">{{ t('app.language') }}</span>
    <ul class="locale-switcher__list">
      <li
        v-for="locale in LOCALES"
        :key="locale"
        class="locale-switcher__item"
      >
        <span
          v-if="locale === currentLocale"
          class="locale-switcher__current"
          aria-current="true"
        >
          {{ LOCALE_LABELS[locale] }}
        </span>
        <RouterLink
          v-else-if="available[locale]"
          class="locale-switcher__link"
          :to="targetPath(locale)"
          :hreflang="locale"
        >
          {{ LOCALE_LABELS[locale] }}
        </RouterLink>
        <span
          v-else
          class="locale-switcher__disabled"
          title="Not yet translated"
          aria-disabled="true"
        >
          {{ LOCALE_LABELS[locale] }}
        </span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.locale-switcher {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.9rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.locale-switcher__label {
  color: var(--fg-subtle);
}

.locale-switcher__list {
  display: flex;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.locale-switcher__item {
  margin: 0;
}

.locale-switcher__current,
.locale-switcher__link,
.locale-switcher__disabled {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 3px;
  text-decoration: none;
}

.locale-switcher__current {
  border-color: var(--accent-blue);
  color: var(--fg-strong);
  background: var(--bg-selected);
}

.locale-switcher__link {
  color: var(--accent-blue);
}

.locale-switcher__link:hover {
  border-color: var(--accent-blue);
  background: var(--bg-raised);
}

.locale-switcher__disabled {
  color: var(--fg-subtle);
  border-style: dashed;
  cursor: not-allowed;
}
</style>
