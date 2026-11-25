// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

import ContentBrowser from './ContentBrowser.vue';
import { router as appRouter } from '@/router';
import { i18n } from '@/i18n';
import {
  CONTENT_LOOKUP,
  createContentLookup,
} from '@/services/content/contentProvider';

// Mermaid needs a real SVG engine. Its placeholder contract is covered by
// markdown.test.ts and its rendering by MermaidService.test.ts.
vi.mock('@/services/mermaid', () => ({
  mermaidService: { renderAll: vi.fn(async () => {}) },
}));

let wrapper: VueWrapper | undefined;

/** The content port is injected by App at runtime; tests provide it directly. */
const contentLookup = createContentLookup();

function makeRouter(): Router {
  // Reuse the application's route table so URL shapes are exercised for real.
  return createRouter({
    history: createMemoryHistory(),
    routes: appRouter.options.routes,
  });
}

async function settle(): Promise<void> {
  // One flush for the tree/document watchers, one for their async tail.
  await flushPromises();
  await flushPromises();
}

async function mountAt(path: string): Promise<VueWrapper> {
  const router = makeRouter();
  await router.push(path);
  await router.isReady();

  wrapper = mount(ContentBrowser, {
    props: { kind: 'docs' },
    global: {
      plugins: [router, i18n],
      provide: { [CONTENT_LOOKUP]: contentLookup },
    },
  });

  await settle();
  return wrapper;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  i18n.global.locale.value = 'en';
  document.documentElement.lang = 'en';
});

describe('ContentBrowser', () => {
  it('follows the header selector: pt-BR loads the translation and lang="pt-BR"', async () => {
    i18n.global.locale.value = 'pt-BR';

    const page = await mountAt('/docs/the-rendering-pipeline');

    expect(page.find('.fallback-notice').exists()).toBe(false);
    expect(page.text()).toContain('O pipeline de renderização');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('swaps the document body when the existing selector changes language', async () => {
    const page = await mountAt('/docs/shader-editor');

    expect(page.find('.fallback-notice').exists()).toBe(false);
    expect(page.text()).toContain('Overview');
    expect(document.documentElement.lang).toBe('en');

    i18n.global.locale.value = 'pt-BR';
    await settle();

    expect(page.find('.fallback-notice').exists()).toBe(false);
    expect(page.text()).toContain('Visão geral');
    expect(document.documentElement.lang).toBe('pt-BR');

    i18n.global.locale.value = 'en';
    await settle();

    expect(page.text()).toContain('Overview');
    expect(document.documentElement.lang).toBe('en');
  });

  it('opens the editors overview when /docs has no slug', async () => {
    const page = await mountAt('/docs');

    expect(page.text()).toContain('Editors Overview');
    expect(page.text()).toContain('3D Shader Editor');
  });

  it('renders the in-app 404 when a slug exists in neither locale', async () => {
    i18n.global.locale.value = 'pt-BR';

    const page = await mountAt('/docs/not-a-real-page');

    expect(page.text()).toContain('404');
    expect(page.text()).toContain('Page not found');
    expect(page.find('.fallback-notice').exists()).toBe(false);
  });

  it('renders the merged learning sections inside the docs tree', async () => {
    const page = await mountAt('/docs/the-rendering-pipeline');

    expect(page.text()).toContain('The Rendering Pipeline');
    expect(page.text()).toContain('Shader Basics');
    expect(page.text()).toContain('Lighting');
    expect(document.documentElement.lang).toBe('en');
  });
});
