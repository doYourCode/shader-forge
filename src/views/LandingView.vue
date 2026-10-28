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

// Separate cards by layout intent.
// Tall cards occupy the left/middle columns and span every row.
// Stacked cards each occupy one row of the right column.
const tallCards = computed(() => cardsWithState.value.slice(0, 2));
const stackedCards = computed(() => cardsWithState.value.slice(2));
</script>

<template>
  <section class="landing">
    <div class="landing__grid">
      <!-- Left & Middle Columns: Tall Cards -->
      <FeatureCard
        v-for="{ card, enabled } in tallCards"
        :key="card.id"
        :card="card"
        :enabled="enabled"
        :disabled-reason="webGpuReason"
        class="feature-card--tall"
      />

      <!-- Right Column: Stacked Cards -->
      <FeatureCard
        v-for="{ card, enabled } in stackedCards"
        :key="card.id"
        :card="card"
        :enabled="enabled"
        :disabled-reason="webGpuReason"
        class="feature-card--stacked"
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

/*
  Explicit layout:
  - 3 columns
  - The number of rows equals the number of stacked cards on the right.
  - The two tall cards span every row (grid-row: 1 / -1).
  - Each stacked card occupies one row.
*/
.landing__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  /* Three rows for the three stacked cards. Change this if you add more. */
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
  min-height: 600px;
}

/* Tall cards: left column, middle column; span all rows. */
.feature-card--tall:nth-child(1) {
  grid-column: 1;
  grid-row: 1 / -1;
}

.feature-card--tall:nth-child(2) {
  grid-column: 2;
  grid-row: 1 / -1;
}

/* Stacked cards: right column, one row each (auto-placed into rows 1, 2, 3). */
.feature-card--stacked {
  grid-column: 3;
  min-height: 0;
}

/* Responsive: single column stack on narrow screens. */
@media (max-width: 900px) {
  .landing__grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    min-height: auto;
  }

  .feature-card--tall:nth-child(1),
  .feature-card--tall:nth-child(2),
  .feature-card--stacked {
    grid-column: auto;
    grid-row: auto;
    min-height: 18rem;
  }
}
</style>