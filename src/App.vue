<script setup lang="ts">
import AppLayout from '@/components/layout/AppLayout.vue';
import {
  createContentLookup,
  provideContentLookup,
} from '@/services/content/contentProvider';

/**
 * The application composition root owns the one content resolver instance and
 * provides it as a port; views never import the resolver or Vite's glob.
 *
 * English drafts stay previewable in `npm run dev`, matching the previous
 * behaviour. Draft translations are never served (see ContentResolver).
 */
provideContentLookup(
  createContentLookup({ includeDrafts: import.meta.env.DEV }),
);
</script>

<template>
  <AppLayout>
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>
  </AppLayout>
</template>
