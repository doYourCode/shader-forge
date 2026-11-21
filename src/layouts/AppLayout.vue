<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

import AppBrand from '@/components/layout/AppBrand.vue';
import LanguageSwitch from '@/components/layout/LanguageSwitch.vue';

const route = useRoute();
const { t } = useI18n();

const headerTitle = computed(() => {
  const key = route.meta.headerTitleKey;
  return key ? t(key) : '';
});

const footerText = computed(() => t('app.footer'));

const fillViewport = computed(() => route.meta.id === 'editor');

// The editor is a full-bleed workspace: dropping its footer gives the canvas
// and the tab panel the remaining viewport height. Other screens keep it.
const showFooter = computed(() => route.meta.id !== 'editor');

// The editor hosts the brand and the language switch inside its own toolbar,
// so the workspace starts after a single chrome row.
const showHeader = computed(() => route.meta.id !== 'editor');

// The landing is the only screen that gets the deep-space shell: its artwork
// continues behind the header and footer instead of stopping at the body.
const isLanding = computed(() => route.meta.id === 'landing');
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--fill': fillViewport,
      'app-shell--landing': isLanding,
    }"
  >
    <!-- HEADER -->

    <header v-if="showHeader" class="app-header">
      <AppBrand />

      <div class="app-header__actions">
        <span v-if="headerTitle" class="app-header__title">
          {{ headerTitle }}
        </span>

        <LanguageSwitch />
      </div>
    </header>

    <!-- BODY (routed view lives here) -->
    <main class="app-body" :class="{ 'app-body--fill': fillViewport }">
      <slot />
    </main>

    <!-- FOOTER (the editor is a full-bleed workspace and has none) -->
    <footer v-if="showFooter" class="app-footer">
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

/* Landing chrome is a tinted pane over the page artwork. Everything else keeps
   the opaque One Dark Pro header/footer. */
.app-shell--landing {
  background: var(--landing-bg);
}

.app-shell--landing .app-header,
.app-shell--landing .app-footer {
  background: rgba(33, 37, 43, 0.72);
  border-color: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px);
}

.app-shell--landing .app-header {
  padding: 0.5rem 1.25rem;
}

.app-shell--landing .app-footer {
  color: var(--landing-faint);
  font-family: var(--font-code);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  padding: 0.75rem 1.25rem;
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

/* ---------- Body ---------- */
.app-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0; /* critical: allow shrink */
  overflow: hidden; /* panes manage their own scroll */
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
  font-family: var(--font-code);
  font-size: 0.8rem;
  padding: 1rem 1.5rem;
  white-space: pre-wrap;
}
</style>
