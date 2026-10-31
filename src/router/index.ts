import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import type { ContentKind } from '@/lib/ContentResolver';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/locales';

declare module 'vue-router' {
  interface RouteMeta {
    /** Translation key for the header title */
    headerTitleKey?: string;
    id?: string;
    /**
     * Content locale pinned by the URL prefix (e.g. `/pt-BR/docs/...`).
     * Absent on unprefixed routes, which follow the UI locale.
     */
    locale?: Locale;
    contentKind?: ContentKind;
  }
}

/**
 * One route (plus one prefixed route per non-default locale) per content kind.
 *
 * `/docs` and `/docs/:slug` share a record: the optional slug drives the
 * content pane, so every document is addressable and shareable.
 */
const contentRoutes: RouteRecordRaw[] = [];

for (const locale of LOCALES) {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const suffix = locale === DEFAULT_LOCALE ? '' : `-${locale}`;
  const localeMeta = locale === DEFAULT_LOCALE ? {} : { locale };

  contentRoutes.push(
    {
      path: `${prefix}/docs/:slug?`,
      name: `documentation${suffix}`,
      component: () => import('@/views/DocumentationView.vue'),
      meta: {
        headerTitleKey: 'navigation.documentation',
        id: 'documentation',
        contentKind: 'docs',
        ...localeMeta,
      },
    },
    {
      path: `${prefix}/knowledge/:slug?`,
      name: `knowledge${suffix}`,
      component: () => import('@/views/KnowledgeView.vue'),
      meta: {
        headerTitleKey: 'app.tagline',
        id: 'knowledge',
        contentKind: 'knowledge',
        ...localeMeta,
      },
    },
  );
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { headerTitleKey: 'app.tagline', id: 'landing' },
  },
  ...contentRoutes,
  {
    path: '/editor',
    name: 'editor',
    component: () => import('@/views/ShaderEditorView.vue'),
    meta: { headerTitleKey: '', id: 'editor' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
