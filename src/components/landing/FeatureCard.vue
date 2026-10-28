<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { ILandingCard } from '@/core/models/landingCard';

const props = withDefaults(
  defineProps<{
    card: ILandingCard;
    /** null = still probing, true/false = resolved */
    enabled?: boolean | null;
    /** If disabled, why (e.g., WebGPU unavailable) */
    disabledReason?: string | null;
  }>(),
  {
    enabled: true,
    disabledReason: null,
  },
);

const isChecking = computed(() => props.enabled === null);
const isDisabled = computed(() => props.enabled === false);

const noteText = computed(() => {
  if (isChecking.value) return 'Checking availability…';
  if (isDisabled.value) return props.disabledReason ?? props.card.note ?? 'Unavailable.';
  return props.card.note ?? null;
});
</script>

<template>
  <component
    :is="isDisabled ? 'div' : RouterLink"
    :to="isDisabled ? undefined : card.to"
    class="feature-card"
    :class="{
      'feature-card--disabled': isDisabled,
      'feature-card--checking': isChecking,
      'feature-card--static': !card.to || isDisabled,
    }"
  >
    <div class="feature-card__body">
      <h3 class="feature-card__title">{{ card.title }}</h3>
      <p class="feature-card__description">{{ card.description }}</p>
    </div>

    <p
      v-if="noteText"
      class="feature-card__note"
    >
      {{ noteText }}
    </p>
  </component>
</template>

<style scoped>
.feature-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 18rem;
  border: 2px solid var(--border);
  background: var(--bg-elevated);
  color: var(--fg);
  text-decoration: none;
  padding: 1rem;
  font-family: var(--font-mono);
  transition: transform 0.12s ease, box-shadow 0.12s ease,
    border-color 0.12s ease, color 0.12s ease;
}

.feature-card:not(.feature-card--static):not(.feature-card--disabled):hover {
  transform: translateY(-2px);
  border-color: var(--accent-blue);
  box-shadow: 4px 4px 0 var(--border-subtle);
  color: var(--fg);
}

.feature-card:not(.feature-card--static):not(.feature-card--disabled):hover
  .feature-card__title {
  color: var(--accent-blue);
}

.feature-card__title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--fg-strong);
  border-bottom: 2px solid var(--border);
  padding-bottom: 0.5rem;
  transition: color 0.12s ease;
}

.feature-card__description {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--fg);
}

.feature-card__note {
  margin: 1rem 0 0;
  font-size: 0.75rem;
  font-style: italic;
  color: var(--accent-orange);
}

.feature-card--disabled {
  background: var(--bg-input);
  color: var(--fg-subtle);
  border-color: var(--border-subtle);
  cursor: not-allowed;
}

.feature-card--disabled .feature-card__title {
  color: var(--accent-red);
  border-bottom-color: var(--accent-red);
}

.feature-card--disabled .feature-card__description {
  color: var(--fg-subtle);
}

.feature-card--checking {
  opacity: 0.6;
}
</style>