import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Translation key for the header title */
    headerTitleKey?: string;
    id?: string;
  }
}

/**
 * Content URLs are locale-neutral: the header language selector decides the
 * language, so a link never has to change when the reader switches languages.
 *
 * `/docs` and `/docs/:slug` share a record: the optional slug drives the
 * content pane, so every document is addressable and shareable.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { headerTitleKey: 'app.tagline', id: 'landing' },
  },
  {
    path: '/docs/:slug?',
    name: 'documentation',
    component: () => import('@/views/DocumentationView.vue'),
    meta: { headerTitleKey: 'navigation.documentation', id: 'documentation' },
  },
  {
    path: '/knowledge/:slug?',
    name: 'knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { headerTitleKey: 'app.tagline', id: 'knowledge' },
  },
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
