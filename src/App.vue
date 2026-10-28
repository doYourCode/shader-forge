<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
</script>

<template>
  <AppLayout>
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>
  </AppLayout>
</template>