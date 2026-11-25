// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';

import { i18n } from '@/i18n';
import { router as appRouter } from '@/router';
import AppLayout from './AppLayout.vue';

const StubView = { template: '<div />' };

/**
 * Mirrors the application's real paths and `meta` while replacing the lazy
 * view components with a stub: this test is about the layout, and importing
 * the heavy editor view (Babylon) would only slow it down.
 */
function makeRouter(): Router {
  const routes = appRouter.options.routes.map((record): RouteRecordRaw => {
    const base = { path: record.path, name: record.name, meta: record.meta };

    if (record.redirect) {
      return { ...base, redirect: record.redirect };
    }

    return { ...base, component: StubView };
  });

  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

async function mountAt(path: string) {
  const router = makeRouter();
  await router.push(path);
  await router.isReady();

  return mount(AppLayout, {
    slots: { default: '<p class="routed-view">view</p>' },
    global: { plugins: [router, i18n] },
  });
}

describe('AppLayout footer', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  afterEach(() => {
    i18n.global.locale.value = 'en';
  });

  it('does not render the header or the footer on the editor page', async () => {
    const wrapper = await mountAt('/editor');

    expect(wrapper.find('.app-footer').exists()).toBe(false);
    expect(wrapper.find('.app-header').exists()).toBe(false);
    expect(wrapper.find('.routed-view').exists()).toBe(true);

    wrapper.unmount();
  });

  it('keeps the branded header on the other screens', async () => {
    const wrapper = await mountAt('/docs/shader-editor');

    expect(wrapper.find('.app-header').exists()).toBe(true);
    expect(wrapper.find('.app-brand').exists()).toBe(true);
    expect(wrapper.find('.language-switch').exists()).toBe(true);

    wrapper.unmount();
  });

  it('omits the tagline from the landing header', async () => {
    const wrapper = await mountAt('/');

    expect(wrapper.find('.app-header__title').exists()).toBe(false);
    expect(wrapper.find('.app-header').text()).not.toContain(
      'Shaders Body of Knowledge',
    );

    wrapper.unmount();
  });

  it('keeps the documentation title in the header', async () => {
    const wrapper = await mountAt('/docs/shader-editor');

    expect(wrapper.find('.app-header__title').text()).toBe(
      'Reference & Documentation',
    );

    wrapper.unmount();
  });

  it('keeps the footer on the other screens', async () => {
    for (const path of [
      '/',
      '/docs/shader-editor',
      '/docs/the-rendering-pipeline',
    ]) {
      const wrapper = await mountAt(path);

      expect(wrapper.find('.app-footer').exists()).toBe(true);
      expect(wrapper.find('.app-footer').text()).toContain('GitHub');

      wrapper.unmount();
    }
  });

  it('uses the deep-space shell only on the landing', async () => {
    const landing = await mountAt('/');
    expect(landing.find('.app-shell').classes()).toContain(
      'app-shell--landing',
    );
    landing.unmount();

    const docs = await mountAt('/docs/shader-editor');
    expect(docs.find('.app-shell').classes()).not.toContain(
      'app-shell--landing',
    );
    docs.unmount();
  });

  it('lets the documentation screen scroll with the window', async () => {
    const docs = await mountAt('/docs/shader-editor');
    expect(docs.find('.app-shell').classes()).toContain(
      'app-shell--window-scroll',
    );
    docs.unmount();

    for (const path of ['/', '/editor']) {
      const wrapper = await mountAt(path);
      expect(wrapper.find('.app-shell').classes()).not.toContain(
        'app-shell--window-scroll',
      );
      wrapper.unmount();
    }
  });

  it('keeps the editor shell full-bleed with the footer removed', async () => {
    const wrapper = await mountAt('/editor');

    expect(wrapper.find('.app-shell').classes()).toContain('app-shell--fill');
    expect(wrapper.find('.app-body').classes()).toContain('app-body--fill');

    wrapper.unmount();
  });
});
