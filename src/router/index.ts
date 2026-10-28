import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { APP_TAGLINE } from '@/core/constants/app';

declare module 'vue-router' {
  interface RouteMeta {
    /** Title shown in the header right-side */
    headerTitle?: string;
    /** Optional id for future use (analytics, theming) */
    id?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { headerTitle: APP_TAGLINE, id: 'landing' },
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { headerTitle: APP_TAGLINE, id: 'knowledge' },
  },
  {
    path: '/docs',
    name: 'documentation',
    component: () => import('@/views/DocumentationView.vue'),
    meta: { headerTitle: 'Reference & Documentation', id: 'documentation' },
  },
  {
    path: '/editor',
    name: 'editor',
    component: () => import('@/views/ShaderEditorView.vue'),
    meta: { headerTitle: '', id: 'editor' }, // editor has no right-side title in sketch
  },
  // Fallback
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});