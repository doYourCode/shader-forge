<script setup lang="ts">
import { computed } from 'vue';
import FeatureCard from '@/components/landing/FeatureCard.vue';
import { landingCards } from '@/core/constants/landingCards';
import { useWebGpuAvailability } from '@/composables/useWebGpuAvailability';

const { supported: webGpuSupported, reason: webGpuReason } = useWebGpuAvailability();

/**
 * For each card, decide its tri-state enablement.
 * Cards without `requiresWebGpu` are always enabled (true).
 */
function cardEnabled(requiresWebGpu: boolean | undefined): boolean | null {
  if (!requiresWebGpu) return true;
  return webGpuSupported.value; // null while probing, true/false afterwards
}

const cardsWithState = computed(() =>
  landingCards.map((card) => ({
    card,
    enabled: cardEnabled(card.requiresWebGpu),
  })),
);
</script>

<template>
  <section class="landing">
    <div class="landing__grid">
      <FeatureCard
        v-for="{ card, enabled } in cardsWithState"
        :key="card.id"
        :card="card"
        :enabled="enabled"
        :disabled-reason="webGpuReason"
      />
    </div>
  </section>
</template>

<style scoped>
.landing {
  flex: 1 1 auto;
  overflow: auto;
  padding: 2rem;
}

/* 3-column grid matching the sketch:
   Left column: GLSL Editor (tall)
   Middle column: WGSL Editor (tall)
   Right column: two stacked cards (Reference & Docs, Base of Knowledge) */
.landing__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: auto auto;
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
}

/* Card 1 (GLSL) spans both rows */
.landing__grid > :nth-child(1) {
  grid-row: 1 / span 2;
}

/* Card 2 (WGSL) spans both rows */
.landing__grid > :nth-child(2) {
  grid-row: 1 / span 2;
}

/* Cards 3 (Docs) and 4 (Knowledge) stack in the right column,
   auto-flowing into rows 1 and 2 of column 3. */

/* Responsive: collapse to single column on narrow screens */
@media (max-width: 900px) {
  .landing__grid {
    grid-template-columns: 1fr;
  }
  .landing__grid > :nth-child(1),
  .landing__grid > :nth-child(2) {
    grid-row: auto;
  }
}
.landing__grid > :nth-child(3),
.landing__grid > :nth-child(4) {
  min-height: 8.5rem; /* half of the tall card */
}
</style>