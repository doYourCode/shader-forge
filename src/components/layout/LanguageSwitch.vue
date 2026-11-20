<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { setLocale, type AppLocale } from '@/i18n/setLocale';

const { locale, t } = useI18n();

const selectedLocale = computed<AppLocale>({
  get: () => locale.value as AppLocale,
  set: setLocale,
});
</script>

<template>
  <div class="language-switch" role="group" :aria-label="t('app.language')">
    <button
      type="button"
      class="language-switch__option"
      :class="{ 'language-switch__option--active': selectedLocale === 'pt-BR' }"
      :aria-pressed="selectedLocale === 'pt-BR'"
      lang="pt-BR"
      title="Português"
      @click="selectedLocale = 'pt-BR'"
    >
      BR
    </button>
    <span class="language-switch__sep" aria-hidden="true">|</span>
    <button
      type="button"
      class="language-switch__option"
      :class="{ 'language-switch__option--active': selectedLocale === 'en' }"
      :aria-pressed="selectedLocale === 'en'"
      lang="en"
      title="English"
      @click="selectedLocale = 'en'"
    >
      EN
    </button>
  </div>
</template>

<style scoped>
.language-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-ui);
  font-size: var(--font-size-label);
}

.language-switch__option {
  padding: 0.15rem 0.3rem;
  border: 0;
  background: none;
  color: var(--fg-muted);
  font: inherit;
  cursor: pointer;
}

.language-switch__option--active {
  color: var(--accent-ui);
  font-weight: 700;
}

.language-switch__sep {
  color: var(--border);
}

.language-switch__option:focus-visible {
  outline: 2px solid var(--accent-ui);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
