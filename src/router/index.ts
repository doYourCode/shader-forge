import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Translation key for the header title */
    headerTitleKey?: string;
    id?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { headerTitleKey: 'app.tagline', id: 'landing' },
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { headerTitleKey: 'app.tagline', id: 'knowledge' },
  },
  {
    path: '/docs',
    name: 'documentation',
    component: () => import('@/views/DocumentationView.vue'),
    meta: { headerTitleKey: 'navigation.documentation', id: 'documentation' },
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
