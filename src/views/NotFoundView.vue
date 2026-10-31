<template>
  <section class="not-found" role="alert">
    <p class="not-found__code">404</p>
    <h1 class="not-found__title">Page not found</h1>
    <p class="not-found__text">
      This document does not exist in any locale.
    </p>
    <RouterLink to="/" class="not-found__link">Back to home</RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 2rem;
  padding: 1.5rem 2rem;
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent-red);
  border-radius: 4px;
  background: var(--bg-elevated);
  font-family: var(--font-mono);
}

.not-found__code {
  margin: 0;
  color: var(--accent-red);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.not-found__title {
  margin: 0;
  color: var(--fg-strong);
  font-size: 1.1rem;
}

.not-found__text {
  margin: 0;
  color: var(--fg-muted);
}

.not-found__link {
  margin-top: 0.5rem;
  color: var(--accent-blue);
}
</style>
