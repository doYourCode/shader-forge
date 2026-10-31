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

  // Two flushes: one for the tree/document watchers, one for the switcher.
  await flushPromises();
  await flushPromises();

  return wrapper;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.documentElement.lang = 'en';
});

describe('ContentBrowser', () => {
  it('renders the English body, fallback notice and lang="en" for an untranslated pt-BR page', async () => {
    const page = await mountAt('/pt-BR/docs/shader-editor');

    expect(page.find('.fallback-notice').exists()).toBe(true);
    expect(page.text()).toContain(
      'Este conteúdo ainda não foi traduzido. Exibindo o original em inglês.',
    );
    expect(page.text()).toContain('Overview');
    expect(document.documentElement.lang).toBe('en');
  });

  it('offers the English translation on the switcher from a pt-BR page', async () => {
    const page = await mountAt('/pt-BR/docs/shader-editor');
    const links = page.findAll('.locale-switcher__link');

    expect(links).toHaveLength(1);
    expect(links[0].text()).toBe('English');
    expect(links[0].attributes('href')).toBe('/docs/shader-editor');
  });

  it('disables the pt-BR switcher target when no translation exists', async () => {
    const page = await mountAt('/docs/shader-editor');
    const disabled = page.findAll('.locale-switcher__disabled');

    expect(page.find('.fallback-notice').exists()).toBe(false);
    expect(disabled).toHaveLength(1);
    expect(disabled[0].text()).toBe('Português');
    expect(disabled[0].attributes('title')).toBe('Not yet translated');
    expect(page.findAll('.locale-switcher__link')).toHaveLength(0);
  });

  it('renders the in-app 404 when a slug exists in neither locale', async () => {
    const page = await mountAt('/pt-BR/docs/not-a-real-page');

    expect(page.text()).toContain('404');
    expect(page.text()).toContain('Page not found');
    expect(page.find('.fallback-notice').exists()).toBe(false);
  });

  it('builds the knowledge tree for the requested kind', async () => {
    const page = await mountAt('/knowledge/the-rendering-pipeline', 'knowledge');

    expect(page.text()).toContain('The Rendering Pipeline');
    expect(document.documentElement.lang).toBe('en');
  });
});
