<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { APP_NAME, FOOTER_TEXT } from '@/core/constants/app';

const route = useRoute();
const headerTitle = computed(() => route.meta.headerTitle ?? '');
const fillViewport = computed(() => route.meta.id === 'editor');
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--fill': fillViewport }">
    <!-- HEADER -->
    <header class="app-header">
      <RouterLink to="/" class="app-header__brand" aria-label="Go to home">
        <img src="@/assets/favicon.ico" alt="" class="app-header__logo" />
        <span class="app-header__name">{{ APP_NAME }}</span>
      </RouterLink>

      <span v-if="headerTitle" class="app-header__title">{{ headerTitle }}</span>
    </header>

    <!-- BODY (routed view lives here) -->
    <main class="app-body" :class="{ 'app-body--fill': fillViewport }">
      <slot />
    </main>

    <!-- FOOTER -->
    <footer class="app-footer">
      <p>{{ FOOTER_TEXT }}</p>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
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
  border-bottom: 2px solid #000;
  background: #fff;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
}

.app-header__logo {
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
}

.app-header__name {
  font-weight: 700;
  font-size: 1.25rem;
}

.app-header__title {
  font-weight: 600;
  font-size: 1rem;
}

/* ---------- Body ---------- */
.app-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;      /* critical: allow shrink */
  overflow: hidden;   /* panes manage their own scroll */
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
  border-top: 2px solid #000;
  background: #000;
  color: #fff;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.8rem;
  padding: 1rem 1.5rem;
  white-space: pre-wrap;
}
</style>