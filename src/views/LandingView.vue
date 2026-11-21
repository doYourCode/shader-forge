<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import FeatureCard from '@/components/landing/FeatureCard.vue';
import LandingBackdrop from '@/components/landing/LandingBackdrop.vue';
import { landingCards } from '@/core/constants/landingCards';

const { t } = useI18n();
</script>

<template>
  <section class="landing">
    <LandingBackdrop />

    <div class="landing__scroll">
      <div class="landing__content">
        <header class="landing__hero">
          <h1 class="landing__title">{{ t('landing.hero.title') }}</h1>
          <p class="landing__subtitle">{{ t('landing.hero.subtitle') }}</p>
        </header>

        <div class="landing__grid">
          <FeatureCard
            v-for="card in landingCards"
            :key="card.id"
            :card="card"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.landing {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--landing-bg);
}

.landing__scroll {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

.landing__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(2.4rem, 8vh, 3.6rem);
  width: min(100%, 1004px);
  min-height: 100%;
  margin: 0 auto;
  padding: clamp(2.75rem, 9vh, 4.5rem) 2rem 2rem;
}

.landing__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  text-align: center;
}

.landing__title {
  margin: 0;
  color: var(--landing-cyan);
  font-family: var(--landing-display);
  font-size: clamp(3.25rem, 6.6vw, 5.25rem);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 0.98;
  text-wrap: balance;
}

@supports (background-clip: text) or (-webkit-background-clip: text) {
  .landing__title {
    background: linear-gradient(100deg, #76f9ff 0%, #aee7ff 43%, #f1a6ff 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 18px rgba(118, 249, 255, 0.3))
      drop-shadow(0 0 46px rgba(241, 166, 255, 0.2));
  }
}

.landing__subtitle {
  margin: 0;
  color: #c8ccd4;
  font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
  font-size: clamp(1.2rem, 2vw, 1.85rem);
  font-weight: 400;
  letter-spacing: 0.005em;
  line-height: 1.2;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.55);
}

.landing__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  align-items: stretch;
  width: 100%;
}

@media (max-width: 1040px) {
  .landing__content {
    width: min(100%, 860px);
  }

  .landing__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.1rem;
  }
}

@media (max-width: 640px) {
  .landing__content {
    gap: 2.2rem;
    width: min(100%, 430px);
    padding: 2.5rem 1.15rem 1.5rem;
  }

  .landing__title {
    font-size: clamp(2.9rem, 15vw, 4rem);
  }

  .landing__subtitle {
    font-size: 1.15rem;
  }

  .landing__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 760px) and (min-width: 641px) {
  .landing__content {
    gap: 2rem;
    padding-top: 2rem;
  }

  .landing__title {
    font-size: clamp(3rem, 6vw, 4.5rem);
  }
}
</style>
