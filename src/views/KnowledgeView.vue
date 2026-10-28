<script setup lang="ts">
import SplitViewLayout from '@/layouts/SplitViewLayout.vue';
import TreeView from '@/components/knowledge/TreeView.vue';
import ContentPane from '@/components/knowledge/ContentPane.vue';
import { knowledgeTree } from '@/core/constants/knowledgeTree';
import { useTreeContent } from '@/composables/useTreeContent';

const { selectedId, content, select } = useTreeContent(knowledgeTree);
</script>

<template>
  <SplitViewLayout left-label="Tree view" right-label="Content">
    <template #left>
      <TreeView
        :nodes="knowledgeTree"
        :selected-id="selectedId"
        @select="select"
      />
    </template>
    <template #right>
      <ContentPane :content="content" />
    </template>
  </SplitViewLayout>
</template>