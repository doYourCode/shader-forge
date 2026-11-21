<script setup lang="ts">
/**
 * Decorative landing backdrop: a deep-space vignette, a soft star field, a
 * perspective grid and the neon ribbon that anchors the right edge. Everything
 * here is presentational, so the whole layer is hidden from assistive tech and
 * ignores pointer input.
 */

/** Parallel dotted strands that give the ribbon its woven-mesh density. */
const ribbonStrands = [
  { x: 0, y: 0, width: 2.1, dash: '0.7 7', opacity: 0.95 },
  { x: -7, y: 2, width: 1.7, dash: '0.7 9', opacity: 0.72 },
  { x: -14, y: 4, width: 1.5, dash: '0.7 8', opacity: 0.6 },
  { x: -21, y: 6, width: 1.8, dash: '0.7 10', opacity: 0.55 },
  { x: -28, y: 8, width: 1.4, dash: '0.7 9', opacity: 0.5 },
  { x: -35, y: 10, width: 1.6, dash: '0.7 11', opacity: 0.42 },
  { x: -42, y: 12, width: 1.2, dash: '0.7 10', opacity: 0.34 },
  { x: -49, y: 14, width: 1.4, dash: '0.7 12', opacity: 0.28 },
  { x: -56, y: 16, width: 1.1, dash: '0.7 11', opacity: 0.22 },
] as const;
</script>

<template>
  <div class="landing-backdrop" aria-hidden="true">
    <div class="landing-backdrop__vignette" />
    <div class="landing-backdrop__stars" />
    <div class="landing-backdrop__grid" />

    <svg
      class="landing-backdrop__mesh"
      viewBox="0 0 760 820"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="landing-mesh-gradient"
          x1="270"
          y1="780"
          x2="730"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#54f0c8" stop-opacity="0.2" />
          <stop offset="0.35" stop-color="#76f9ff" />
          <stop offset="0.68" stop-color="#9b8cff" />
          <stop offset="1" stop-color="#f1a6ff" />
        </linearGradient>

        <radialGradient id="landing-mesh-cyan" cx="0.5" cy="0.5" r="0.5">
          <stop stop-color="#42e9ff" stop-opacity="0.42" />
          <stop offset="1" stop-color="#42e9ff" stop-opacity="0" />
        </radialGradient>

        <radialGradient id="landing-mesh-violet" cx="0.5" cy="0.5" r="0.5">
          <stop stop-color="#ad74ff" stop-opacity="0.34" />
          <stop offset="1" stop-color="#ad74ff" stop-opacity="0" />
        </radialGradient>

        <filter
          id="landing-mesh-blur"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feGaussianBlur stdDeviation="26" />
        </filter>

        <path
          id="landing-ribbon-path"
          d="M720 20C590 90 520 180 570 270c50 90 130 160 60 260-70 100-160 190-210 290"
        />
      </defs>

      <ellipse
        cx="646"
        cy="180"
        rx="245"
        ry="295"
        fill="url(#landing-mesh-cyan)"
      />
      <ellipse
        cx="620"
        cy="555"
        rx="230"
        ry="280"
        fill="url(#landing-mesh-violet)"
      />

      <g
        stroke="url(#landing-mesh-gradient)"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <use
          href="#landing-ribbon-path"
          stroke-width="96"
          opacity="0.16"
          filter="url(#landing-mesh-blur)"
        />

        <use
          v-for="strand in ribbonStrands"
          :key="`${strand.x}-${strand.y}`"
          href="#landing-ribbon-path"
          :transform="`translate(${strand.x} ${strand.y})`"
          :stroke-width="strand.width"
          :stroke-dasharray="strand.dash"
          :opacity="strand.opacity"
        />

        <use
          href="#landing-ribbon-path"
          transform="translate(-30 7)"
          stroke-width="0.8"
          opacity="0.22"
        />
        <use
          href="#landing-ribbon-path"
          transform="translate(-62 15)"
          stroke-width="0.7"
          opacity="0.15"
        />

        <path
          d="M760 150C676 216 628 294 652 376c22 80 61 151 26 231"
          stroke-width="0.8"
          opacity="0.22"
        />
        <path
          d="M760 330c-84 68-112 146-85 229 23 71 14 141-32 211"
          stroke-width="0.7"
          opacity="0.18"
        />
        <path
          d="M786 512c-72 51-109 119-102 194 5 55-7 100-32 144"
          stroke-width="0.9"
          opacity="0.15"
        />
      </g>

      <g fill="#bdf8ff" opacity="0.9">
        <circle cx="700" cy="62" r="1.7" />
        <circle cx="610" cy="127" r="2.1" />
        <circle cx="541" cy="208" r="1.4" />
        <circle cx="571" cy="287" r="1.8" />
        <circle cx="605" cy="376" r="2" />
        <circle cx="662" cy="454" r="1.3" />
        <circle cx="641" cy="532" r="1.7" />
        <circle cx="575" cy="631" r="2" />
        <circle cx="493" cy="718" r="1.4" />
        <circle cx="430" cy="806" r="1.6" />
        <circle cx="760" cy="212" r="1.1" />
        <circle cx="540" cy="390" r="1" />
        <circle cx="704" cy="500" r="1.3" />
        <circle cx="500" cy="660" r="1.1" />
      </g>

      <g fill="#f0b3ff" opacity="0.8">
        <circle cx="682" cy="176" r="1.6" />
        <circle cx="705" cy="308" r="1.2" />
        <circle cx="618" cy="440" r="1.9" />
        <circle cx="652" cy="566" r="1.4" />
        <circle cx="535" cy="665" r="1.7" />
        <circle cx="441" cy="765" r="1.2" />
      </g>
    </svg>

    <div class="landing-backdrop__grain" />
  </div>
</template>

<style scoped>
.landing-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--landing-bg);
}

.landing-backdrop__vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      ellipse at 50% 26%,
      rgba(52, 58, 69, 0.9) 0%,
      rgba(40, 44, 52, 0.35) 42%,
      transparent 70%
    ),
    linear-gradient(
      180deg,
      rgba(40, 44, 52, 0.2) 0%,
      var(--landing-bg) 56%,
      var(--landing-bg-deep) 100%
    );
}

.landing-backdrop__stars {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image:
    radial-gradient(
      circle,
      rgba(198, 235, 255, 0.75) 0 0.8px,
      transparent 1.4px
    ),
    radial-gradient(circle, rgba(133, 191, 255, 0.55) 0 1px, transparent 1.8px),
    radial-gradient(
      circle,
      rgba(255, 255, 255, 0.45) 0 0.7px,
      transparent 1.3px
    );
  background-size:
    138px 146px,
    214px 198px,
    92px 108px;
  background-position:
    18px 32px,
    66px 14px,
    0 0;
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.95),
    rgba(0, 0, 0, 0.42) 62%,
    transparent 98%
  );
}

.landing-backdrop__stars::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.6;
  background:
    radial-gradient(
      circle at 72% 18%,
      rgba(98, 220, 255, 0.12) 0 1px,
      transparent 2px
    ),
    radial-gradient(
      circle at 18% 62%,
      rgba(139, 178, 255, 0.18) 0 1px,
      transparent 2.5px
    ),
    radial-gradient(
      circle at 44% 36%,
      rgba(255, 255, 255, 0.12) 0 1px,
      transparent 2px
    );
  filter: blur(1px);
  background-size: 340px 290px;
}

.landing-backdrop__grid {
  position: absolute;
  left: -24%;
  right: 18%;
  bottom: -22%;
  height: 62%;
  opacity: 0.34;
  transform: perspective(520px) rotateX(63deg) scale(1.25);
  transform-origin: 50% 100%;
  background-image:
    linear-gradient(rgba(101, 216, 236, 0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(101, 216, 236, 0.24) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9),
    rgba(0, 0, 0, 0.32) 48%,
    transparent 82%
  );
}

.landing-backdrop__mesh {
  position: absolute;
  top: -5%;
  right: -5%;
  width: min(68vw, 840px);
  height: auto;
  min-width: 520px;
  opacity: 0.82;
  mix-blend-mode: screen;
  filter: drop-shadow(0 0 36px rgba(88, 205, 255, 0.12));
}

.landing-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      38% 38% at 88% 24%,
      rgba(44, 219, 255, 0.16),
      transparent 72%
    ),
    radial-gradient(
      36% 40% at 85% 68%,
      rgba(176, 102, 255, 0.18),
      transparent 72%
    );
  mix-blend-mode: screen;
}

.landing-backdrop__grain {
  position: absolute;
  inset: 0;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}

@media (max-width: 900px) {
  .landing-backdrop__mesh {
    right: -28%;
    width: 700px;
    opacity: 0.55;
  }

  .landing-backdrop__grid {
    right: 0;
    opacity: 0.16;
  }
}

@media (max-width: 640px) {
  .landing-backdrop__mesh {
    top: 4%;
    right: -58%;
    opacity: 0.42;
  }

  .landing-backdrop__stars {
    opacity: 0.4;
  }
}
</style>
