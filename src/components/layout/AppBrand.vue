<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const appTitle = computed(() => t('app.title'));
</script>

<template>
  <RouterLink to="/" class="app-brand" :aria-label="t('app.home')">
    <img src="@/assets/images/favicon.ico" alt="" class="app-brand__logo" />
    <span class="app-brand__name">{{ appTitle }}</span>
  </RouterLink>
</template>

<style scoped>
.app-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  text-decoration: none;
  color: var(--fg);
}

.app-brand__logo {
  width: 24px;
  height: 24px;
  image-rendering: pixelated;
}

/* Branding stays quieter than any content: proportional, medium weight and
   the regular foreground, not the strong one. */
.app-brand__name {
  font-family: var(--font-ui);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
}

.app-brand:hover .app-brand__name {
  color: var(--accent-ui);
}
</style>
