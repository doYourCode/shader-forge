<script setup lang="ts">
import SplitViewLayout from '@/layouts/SplitViewLayout.vue';
import TreeView from '@/components/knowledge/TreeView.vue';
import ContentPane from '@/components/knowledge/ContentPane.vue';
import { docsTree } from '@/core/constants/docsTree';
import { useTreeContent } from '@/composables/useTreeContent';

const { selectedId, content, select } = useTreeContent(docsTree);
</script>

<template>
  <SplitViewLayout left-label="Tree view" right-label="Content">
    <template #left>
      <TreeView :nodes="docsTree" :selected-id="selectedId" @select="select" />
    </template>
    <template #right>
      <ContentPane :content="content" />
    </template>
  </SplitViewLayout>
</template>