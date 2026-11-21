<script setup lang="ts">
import ShaderEditorView from './ShaderEditorView.vue';
</script>

<template>
  <!-- The screen-space harness is the existing editor, opened on its view-space
       post-effect document instead of the surface fragment. -->
  <ShaderEditorView initial-tab="post" />
</template>
