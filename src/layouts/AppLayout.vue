
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { APP_NAME } from '@/core/constants/app';

const route = useRoute();
const { locale, t } = useI18n();

const headerTitle = computed(() => {
  const key = route.meta.headerTitleKey;
  return key ? t(key) : '';
});

const footerText = computed(() => t('app.footer'));

import { setLocale, type AppLocale } from '@/i18n/setLocale';

const fillViewport = computed(() => route.meta.id === 'editor');

const selectedLocale = computed<AppLocale>({
  get: () => locale.value as AppLocale,
  set: setLocale,
});
</script>


<template>
  <div class="app-shell" :class="{ 'app-shell--fill': fillViewport }">
    <!-- HEADER -->

  <header class="app-header">
    <RouterLink to="/" class="app-header__brand" :aria-label="t('app.home')">
      <img
        src="@/assets/images/favicon.ico"
        alt=""
        class="app-header__logo"
      />
      <span class="app-header__name">{{ APP_NAME }}</span>
    </RouterLink>

    <div class="app-header__actions">
      <span v-if="headerTitle" class="app-header__title">
        {{ headerTitle }}
      </span>

      <select
        v-model="selectedLocale"
        class="app-header__language"
        :aria-label="t('app.language')"
      >
        <option value="en">English</option>
        <option value="pt-BR">Português</option>
      </select>
    </div>
  </header>


    <!-- BODY (routed view lives here) -->
    <main class="app-body" :class="{ 'app-body--fill': fillViewport }">
      <slot />
    </main>

    <!-- FOOTER -->
    <footer class="app-footer">
      <p>{{ footerText }}</p>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  color: var(--fg);
  background: var(--bg);
}

/* The editor is a full-bleed workspace: size the shell to the viewport so the
   routed view can fill the space between the header and the footer. */
.app-shell--fill {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

.app-shell--fill .app-header,
.app-shell--fill .app-footer {
  flex: 0 0 auto;
}

/* ---------- Header ---------- */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-header__language {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  cursor: pointer;
}

.app-header__language:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: var(--fg);
}

.app-header__brand:hover {
  color: var(--fg);
}

.app-header__logo {
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
}

.app-header__name {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--fg-strong);
}

.app-header__brand:hover .app-header__name {
  color: var(--accent-blue);
}

.app-header__title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--fg-muted);
}

/* ---------- Body ---------- */
.app-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;      /* critical: allow shrink */
  overflow: hidden;   /* panes manage their own scroll */
  background: var(--bg);
}

.app-body--fill {
  flex: 1 1 0;
}

.app-body--fill > * {
  flex: 1 1 auto;
  min-height: 0;
}

/* Landing still wants page scroll — it uses a plain section,
   so let it be the exception: */
.app-body > * {
  min-height: 0;
}

/* ---------- Footer ---------- */
.app-footer {
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  color: var(--fg-muted);
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.8rem;
  padding: 1rem 1.5rem;
  white-space: pre-wrap;
}
</style>