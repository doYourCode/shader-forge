
import type { ILandingCard } from '@/core/models/landingCard';

export const landingCards: ILandingCard[] = [
  {
    id: 'glsl-editor',
    title: 'landing.cards.glsl.title',
    description: 'landing.cards.glsl.description',
    note: 'landing.cards.glsl.note',
    to: '/editor',
    requiresWebGpu: false,
  },
  {
    id: 'wgsl-editor',
    title: 'landing.cards.wgsl.title',
    description: 'landing.cards.wgsl.description',
    note: 'landing.cards.wgsl.note',
    to: '',
    requiresWebGpu: true,
  },
  {
    id: 'reference-docs',
    title: 'landing.cards.docs.title',
    description: 'landing.cards.docs.description',
    to: '/docs',
    requiresWebGpu: false,
  },
  {
    id: 'base-of-knowledge',
    title: 'landing.cards.knowledge.title',
    description: 'landing.cards.knowledge.description',
    to: '/knowledge',
    requiresWebGpu: false,
  },
  {
    id: 'fragment-sandbox',
    title: 'landing.cards.sandbox.title',
    description: 'landing.cards.sandbox.description',
    to: '',
    requiresWebGpu: false,
  },
];
