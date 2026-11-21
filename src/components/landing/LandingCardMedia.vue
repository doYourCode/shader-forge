<script setup lang="ts">
import type { LandingMediaKind } from '@/core/models/landingCard';

defineProps<{
  kind: LandingMediaKind;
}>();
</script>

<template>
  <div class="media" :class="`media--${kind}`" aria-hidden="true">
    <svg
      v-if="kind === 'sphere'"
      class="media__svg"
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <defs>
        <radialGradient id="landing-sphere-glow" cx="50%" cy="50%" r="50%">
          <stop stop-color="#7ee9ff" stop-opacity="0.32" />
          <stop offset="0.65" stop-color="#3979a6" stop-opacity="0.08" />
          <stop offset="1" stop-color="#3979a6" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="landing-sphere-body" cx="38%" cy="30%" r="72%">
          <stop stop-color="#395a72" stop-opacity="0.55" />
          <stop offset="1" stop-color="#08111a" stop-opacity="0.9" />
        </radialGradient>
        <clipPath id="landing-sphere-clip">
          <circle cx="160" cy="99" r="46" />
        </clipPath>
      </defs>

      <rect width="320" height="200" fill="#05080c" />
      <g stroke="#63d9ef" stroke-width="0.8" opacity="0.36">
        <path d="M0 120h320M0 139h320M0 164h320M0 196h320" />
        <path
          d="M160 105L-70 200M160 105L-10 200M160 105L50 200M160 105L105 200M160 105L160 200M160 105L215 200M160 105L270 200M160 105L330 200M160 105L400 200"
        />
      </g>

      <circle cx="160" cy="99" r="77" fill="url(#landing-sphere-glow)" />
      <circle
        cx="160"
        cy="99"
        r="46"
        fill="url(#landing-sphere-body)"
        stroke="#b9efff"
        stroke-opacity="0.7"
        stroke-width="1.1"
      />

      <g clip-path="url(#landing-sphere-clip)" stroke="#a8eaff" fill="none">
        <g opacity="0.58" stroke-width="0.8">
          <ellipse cx="160" cy="99" rx="46" ry="12" />
          <ellipse cx="160" cy="82" rx="41" ry="10" />
          <ellipse cx="160" cy="116" rx="41" ry="10" />
          <ellipse cx="160" cy="66" rx="29" ry="6" />
          <ellipse cx="160" cy="132" rx="29" ry="6" />
        </g>
        <g opacity="0.52" stroke-width="0.8">
          <ellipse cx="160" cy="99" rx="11" ry="46" />
          <ellipse cx="160" cy="99" rx="25" ry="46" />
          <ellipse cx="160" cy="99" rx="38" ry="46" />
          <ellipse cx="160" cy="99" rx="1.5" ry="46" />
        </g>
      </g>

      <circle
        cx="160"
        cy="99"
        r="46"
        stroke="#d4f8ff"
        stroke-opacity="0.85"
        stroke-width="1.2"
      />
      <circle cx="146" cy="82" r="1.6" fill="#e6fcff" opacity="0.9" />
    </svg>

    <div v-else-if="kind === 'fragment'" class="media__fragment-field">
      <span class="media__fragment-bloom" />
      <span class="media__fragment-veins" />
    </div>

    <svg
      v-else-if="kind === 'gbuffer'"
      class="media__svg"
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <defs>
        <linearGradient id="landing-gbuffer-split" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#0b0d10" />
          <stop offset="0.52" stop-color="#101419" />
          <stop offset="0.53" stop-color="#f0f1f2" />
          <stop offset="1" stop-color="#b7babf" />
        </linearGradient>
        <linearGradient id="landing-gbuffer-top" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#f7f8f9" />
          <stop offset="1" stop-color="#c8cbd0" />
        </linearGradient>
      </defs>

      <rect width="320" height="200" fill="url(#landing-gbuffer-split)" />
      <g fill="#080a0d" opacity="0.36">
        <path d="M0 0h154l-22 200H0z" />
      </g>

      <g stroke="#7d838b" stroke-width="0.7">
        <path d="M76 96l35-18 35 18-35 18z" fill="url(#landing-gbuffer-top)" />
        <path d="M76 96v48l35 18 35-18V96l-35 18z" fill="#696f77" />
        <path d="M111 114v48l35-18V96z" fill="#41464d" />

        <path d="M155 54l28-14 28 14-28 14z" fill="#f3f4f5" />
        <path d="M155 54v39l28 14 28-14V54l-28 14z" fill="#a8acb2" />
        <path d="M183 68v39l28-14V54z" fill="#686d74" />

        <path d="M128 30l19-10 19 10-19 10z" fill="#d9dbde" />
        <path d="M128 30v27l19 10 19-10V30l-19 10z" fill="#868b92" />
        <path d="M147 40v27l19-10V30z" fill="#54595f" />

        <path d="M208 113l22-11 22 11-22 11z" fill="#e8e9eb" />
        <path d="M208 113v31l22 11 22-11v-31l-22 11z" fill="#8d9298" />
        <path d="M230 124v31l22-11v-31z" fill="#555b62" />
      </g>

      <g stroke="#e8fcff" stroke-width="0.75" opacity="0.5">
        <path d="M161 0v200" />
        <path d="M82 106l28 14M82 119l28 14M82 132l28 14" />
      </g>
      <circle cx="161" cy="100" r="1.8" fill="#8ef3ff" opacity="0.8" />
    </svg>

    <svg
      v-else
      class="media__svg"
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="landing-docs-stroke"
          x1="72"
          y1="40"
          x2="256"
          y2="172"
        >
          <stop stop-color="#76f9ff" />
          <stop offset="0.52" stop-color="#a9b6ff" />
          <stop offset="1" stop-color="#f1a6ff" />
        </linearGradient>
        <linearGradient
          id="landing-docs-cap"
          x1="140"
          y1="100"
          x2="230"
          y2="160"
        >
          <stop stop-color="#97f8ff" />
          <stop offset="1" stop-color="#e2a5ff" />
        </linearGradient>
        <filter
          id="landing-docs-glow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="320" height="200" fill="#070b12" />
      <path
        d="M214 20l34 14-34 14-34-14z"
        fill="url(#landing-docs-stroke)"
        opacity="0.16"
        filter="url(#landing-docs-glow)"
      />

      <rect
        x="92"
        y="30"
        width="136"
        height="140"
        rx="9"
        fill="#0c1420"
        fill-opacity="0.78"
        stroke="url(#landing-docs-stroke)"
        stroke-width="1.4"
      />
      <rect
        x="101"
        y="39"
        width="118"
        height="122"
        rx="5"
        stroke="#a6d8ff"
        stroke-opacity="0.16"
        stroke-width="0.8"
      />

      <g stroke="url(#landing-docs-stroke)" stroke-linecap="round">
        <path d="M111 53h48" stroke-width="2.4" />
        <path d="M111 64h92" stroke-width="1.3" opacity="0.55" />
        <path d="M111 74h74" stroke-width="1.3" opacity="0.42" />
        <path d="M111 126h54" stroke-width="1.3" opacity="0.46" />
        <path d="M111 136h83" stroke-width="1.3" opacity="0.33" />
      </g>

      <g
        fill="none"
        stroke="url(#landing-docs-stroke)"
        stroke-linejoin="round"
        stroke-linecap="round"
      >
        <path d="M127 94l-13 11 13 11" stroke-width="2.4" />
        <path d="M193 94l13 11-13 11" stroke-width="2.4" />
        <path d="M174 88l-14 34" stroke-width="2" opacity="0.8" />
      </g>

      <g>
        <path
          d="M148 158l46-19 46 19-46 18z"
          fill="#0c1420"
          stroke="url(#landing-docs-cap)"
          stroke-width="1.4"
        />
        <path
          d="M194 176v15c16 6 34 2 40-8v-14"
          stroke="url(#landing-docs-cap)"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          d="M240 158v27"
          stroke="url(#landing-docs-cap)"
          stroke-width="1.3"
        />
        <circle cx="240" cy="188" r="3.2" fill="#f1a6ff" />
      </g>

      <circle
        cx="242"
        cy="39"
        r="13"
        fill="#0b111a"
        stroke="#b7ecff"
        stroke-opacity="0.22"
      />
      <path d="M239 33l8 6-8 6z" fill="#d8fbff" />
    </svg>
  </div>
</template>

<style scoped>
.media {
  position: relative;
  width: 100%;
  aspect-ratio: 25 / 16;
  overflow: hidden;
  border-radius: 6px;
  background: #05080c;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  isolation: isolate;
}

.media__svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* Iridescent fragment field: layered color pools with a blurred conic ribbon,
   matching the 2D sandbox card without shipping a raster asset. */
.media--fragment {
  background:
    radial-gradient(
      60% 74% at 14% 20%,
      rgba(52, 121, 216, 0.95) 0%,
      transparent 58%
    ),
    radial-gradient(
      54% 68% at 82% 12%,
      rgba(255, 91, 216, 0.82) 0%,
      transparent 56%
    ),
    radial-gradient(
      58% 62% at 68% 86%,
      rgba(255, 179, 107, 0.9) 0%,
      transparent 56%
    ),
    radial-gradient(
      70% 78% at 36% 70%,
      rgba(44, 245, 184, 0.95) 0%,
      transparent 64%
    ),
    #05060b;
}

.media__fragment-field {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.media__fragment-bloom {
  position: absolute;
  inset: -28%;
  background: conic-gradient(
    from 130deg at 52% 46%,
    #1ef0b4,
    #2e62ff 18%,
    #d84dff 37%,
    #ff9d5c 54%,
    #46f4d0 72%,
    #1c2f97 88%,
    #1ef0b4
  );
  filter: blur(10px) saturate(1.3);
  opacity: 0.86;
  mix-blend-mode: screen;
  transform: rotate(9deg);
}

.media__fragment-veins {
  position: absolute;
  inset: -12%;
  background:
    repeating-radial-gradient(
      ellipse at 28% 72%,
      rgba(3, 5, 10, 0) 0 18px,
      rgba(3, 5, 10, 0.42) 22px 26px,
      rgba(3, 5, 10, 0) 31px 44px
    ),
    repeating-radial-gradient(
      ellipse at 78% 24%,
      rgba(255, 255, 255, 0) 0 20px,
      rgba(255, 255, 255, 0.12) 24px 27px,
      rgba(255, 255, 255, 0) 32px 46px
    );
  filter: blur(4px) contrast(1.1);
  opacity: 0.8;
  mix-blend-mode: overlay;
}

.media--fragment::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse at 50% 50%,
      transparent 45%,
      rgba(3, 5, 10, 0.52) 100%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.08),
      transparent 24% 80%,
      rgba(0, 0, 0, 0.2)
    );
  pointer-events: none;
}
</style>
