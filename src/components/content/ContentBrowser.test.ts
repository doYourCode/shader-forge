// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

import ContentBrowser from './ContentBrowser.vue';
import { router as appRouter } from '@/router';
import { i18n } from '@/i18n';
import type { ContentKind } from '@/lib/ContentResolver';

let wrapper: VueWrapper | undefined;

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

async function mountAt(
  path: string,
  kind: ContentKind = 'docs',
): Promise<VueWrapper> {
  const router = makeRouter();
  await router.push(path);
  await router.isReady();

  wrapper = mount(ContentBrowser, {
    props: { kind },
    global: { plugins: [router, i18n] },
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
  it('follows the header selector: pt-BR falls back with notice and lang="en"', async () => {
    i18n.global.locale.value = 'pt-BR';

    const page = await mountAt(
      '/knowledge/the-rendering-pipeline',
      'knowledge',
    );

    expect(page.find('.fallback-notice').exists()).toBe(true);
    expect(page.text()).toContain(
      'Este conteúdo ainda não foi traduzido. Exibindo o original em inglês.',
    );
    expect(page.text()).toContain('The short version');
    expect(document.documentElement.lang).toBe('en');
  });

  it('swaps the document body when the existing selector changes language', async () => {
    const page = await mountAt('/docs/shader-editor');

    expect(page.find('.fallback-notice').exists()).toBe(false);
    expect(page.text()).toContain('Overview');
    expect(document.documentElement.lang).toBe('en');

    i18n.global.locale.value = 'pt-BR';
    await settle();

    expect(page.find('.fallback-notice').exists()).toBe(false);
    expect(page.text()).toContain('Visão Geral');
    expect(document.documentElement.lang).toBe('pt-BR');

    i18n.global.locale.value = 'en';
    await settle();

    expect(page.text()).toContain('Overview');
    expect(document.documentElement.lang).toBe('en');
  });

  it('renders the in-app 404 when a slug exists in neither locale', async () => {
    i18n.global.locale.value = 'pt-BR';

    const page = await mountAt('/docs/not-a-real-page');

    expect(page.text()).toContain('404');
    expect(page.text()).toContain('Page not found');
    expect(page.find('.fallback-notice').exists()).toBe(false);
  });

  it('builds the knowledge tree for the requested kind', async () => {
    const page = await mountAt(
      '/knowledge/the-rendering-pipeline',
      'knowledge',
    );

    expect(page.text()).toContain('The Rendering Pipeline');
    expect(document.documentElement.lang).toBe('en');
  });
});
