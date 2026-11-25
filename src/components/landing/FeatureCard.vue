<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Box,
  FileCode2,
  MonitorUp,
  Scan,
  TriangleAlert,
} from 'lucide-vue-next';
import type { ILandingCard, LandingIconName } from '@/core/models/landingCard';
import LandingCardMedia from './LandingCardMedia.vue';

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

const { t } = useI18n();

const iconComponents = {
  cube: Box,
  scan: Scan,
  screen: MonitorUp,
  docs: FileCode2,
} satisfies Record<LandingIconName, typeof Box>;

const iconComponent = computed(() => iconComponents[props.card.icon]);

const isChecking = computed(() => props.enabled === null);
const isDisabled = computed(() => props.enabled === false);
const isLink = computed(
  () =>
    props.card.enabled &&
    !isChecking.value &&
    !isDisabled.value &&
    props.card.to !== undefined,
);

const noteText = computed(() => {
  if (isChecking.value) return t('landing.status.checking');

  if (isDisabled.value) {
    return (
      props.disabledReason ??
      (props.card.note ? t(props.card.note) : t('landing.status.unavailable'))
    );
  }

  return props.card.note ? t(props.card.note) : null;
});

/** Hover/focus notice for cards that ship unfinished behaviour. */
const warningText = computed(() =>
  props.card.warning ? t(props.card.warning) : null,
);
const warningId = computed(() => `feature-card-warning-${props.card.id}`);
</script>

<template>
  <component
    :is="isLink ? RouterLink : 'div'"
    :to="isLink ? card.to : undefined"
    :aria-describedby="warningText ? warningId : undefined"
    class="feature-card"
    :class="[
      `feature-card--accent-${card.accent}`,
      {
        'feature-card--disabled': isDisabled,
        'feature-card--checking': isChecking,
        'feature-card--static': !isLink,
      },
    ]"
  >
    <span class="feature-card__sheen" aria-hidden="true" />

    <div class="feature-card__top">
      <span class="feature-card__icon" aria-hidden="true">
        <component :is="iconComponent" :size="16" :stroke-width="1.7" />
      </span>

      <span
        v-if="warningText"
        class="feature-card__warning-mark"
        aria-hidden="true"
      >
        <TriangleAlert :size="15" :stroke-width="1.8" />
      </span>
    </div>

    <LandingCardMedia :kind="card.media" class="feature-card__media" />

    <div class="feature-card__body">
      <h3 class="feature-card__title">{{ t(card.title) }}</h3>
      <p class="feature-card__description">{{ t(card.description) }}</p>
      <p v-if="noteText" class="feature-card__note">{{ noteText }}</p>
    </div>

    <span
      v-if="warningText"
      :id="warningId"
      class="feature-card__warning"
      role="tooltip"
    >
      <TriangleAlert :size="12" :stroke-width="1.8" aria-hidden="true" />
      <span>{{ warningText }}</span>
    </span>
  </component>
</template>

<style scoped>
.feature-card {
  --card-edge: rgba(118, 249, 255, 0.38);
  --card-edge-2: rgba(84, 240, 200, 0.26);
  --card-glow: rgba(82, 220, 255, 0.22);
  --card-accent: #76f9ff;

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  padding: 0.75rem;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(
        155deg,
        var(--landing-surface-raised) 0%,
        var(--landing-surface) 52%,
        var(--landing-surface-deep) 100%
      )
      padding-box,
    linear-gradient(
        135deg,
        var(--card-edge) 0%,
        var(--landing-border) 35%,
        var(--landing-border) 65%,
        var(--card-edge-2) 100%
      )
      border-box;
  box-shadow:
    0 28px 60px -36px rgba(0, 0, 0, 0.9),
    0 22px 48px -30px var(--card-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  color: var(--landing-text);
  font-family: var(--font-ui);
  text-decoration: none;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.feature-card--accent-cyan {
  --card-edge: rgba(118, 249, 255, 0.36);
  --card-edge-2: rgba(84, 240, 200, 0.24);
  --card-glow: rgba(82, 220, 255, 0.28);
  --card-accent: #76f9ff;
}

.feature-card--accent-violet {
  --card-edge: rgba(187, 151, 255, 0.34);
  --card-edge-2: rgba(241, 166, 255, 0.22);
  --card-glow: rgba(176, 112, 255, 0.3);
  --card-accent: #d0a7ff;
}

.feature-card--accent-teal {
  --card-edge: rgba(142, 243, 255, 0.34);
  --card-edge-2: rgba(84, 240, 200, 0.25);
  --card-glow: rgba(84, 240, 200, 0.26);
  --card-accent: #8ef3ff;
}

/* A one-pixel filament on the top edge catches the light the same way the
   mockup's glass cards do without requiring a second border element. */
.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 9%;
  left: 9%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--card-accent),
    transparent
  );
  opacity: 0.38;
  pointer-events: none;
}

.feature-card__sheen {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(
      120% 52% at 50% -8%,
      rgba(215, 218, 224, 0.08),
      transparent 62%
    ),
    radial-gradient(80% 42% at 50% 108%, var(--card-glow), transparent 68%);
  opacity: 0.9;
  pointer-events: none;
}

.feature-card__top,
.feature-card__media,
.feature-card__body {
  position: relative;
  z-index: 1;
}

.feature-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
}

.feature-card__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
  color: var(--card-accent);
}

.feature-card__media {
  transition: transform 0.35s cubic-bezier(0.22, 0.8, 0.32, 1);
}

.feature-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.35rem 0.15rem 0.25rem;
}

.feature-card__title {
  margin: 0;
  color: var(--landing-text);
  font-family: var(--font-ui);
  font-size: clamp(1.08rem, 1.45vw, 1.24rem);
  font-weight: 600;
  letter-spacing: -0.022em;
  line-height: 1.18;
  text-wrap: balance;
}

.feature-card__description {
  margin: 0;
  color: var(--landing-muted);
  font-family: var(--font-ui);
  font-size: 0.82rem;
  line-height: 1.55;
  text-wrap: pretty;
}

.feature-card__note {
  margin: auto 0 0;
  color: var(--landing-faint);
  font-size: 0.72rem;
  font-style: italic;
  line-height: 1.45;
}

.feature-card__warning-mark {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 184, 108, 0.28);
  border-radius: 6px;
  background: rgba(255, 184, 108, 0.07);
  color: #ffc27a;
}

/* Revealed on hover and on keyboard focus; `aria-describedby` on the card keeps
   the same text available to assistive technology while it is invisible. */
.feature-card__warning {
  position: absolute;
  z-index: 2;
  top: 2.9rem;
  right: 0.6rem;
  left: 0.6rem;
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(255, 184, 108, 0.42);
  border-radius: 7px;
  background: rgba(30, 23, 16, 0.96);
  color: #ffd7a8;
  font-size: 0.71rem;
  line-height: 1.4;
  text-align: left;
  opacity: 0;
  transform: translateY(-3px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  pointer-events: none;
}

.feature-card__warning svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.feature-card:not(.feature-card--static):hover .feature-card__warning,
.feature-card:focus-visible .feature-card__warning {
  opacity: 1;
  transform: translateY(0);
}

.feature-card:not(.feature-card--static):not(.feature-card--disabled):hover {
  transform: translateY(-4px);
  box-shadow:
    0 34px 70px -36px rgba(0, 0, 0, 0.95),
    0 28px 58px -26px var(--card-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.feature-card:not(.feature-card--static):not(.feature-card--disabled):hover
  .feature-card__media {
  transform: scale(1.025);
}

.feature-card:not(.feature-card--static):not(
    .feature-card--disabled
  ):focus-visible {
  outline: 2px solid var(--card-accent);
  outline-offset: 4px;
}

.feature-card--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  filter: saturate(0.6);
}

.feature-card--checking {
  opacity: 0.72;
}

@media (prefers-reduced-motion: reduce) {
  .feature-card,
  .feature-card__media {
    transition: none;
  }

  .feature-card__warning {
    transform: none;
    transition: none;
  }

  .feature-card:not(.feature-card--static):not(.feature-card--disabled):hover {
    transform: none;
  }

  .feature-card:not(.feature-card--static):not(.feature-card--disabled):hover
    .feature-card__media {
    transform: none;
  }
}
</style>
