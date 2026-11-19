import { inject, provide, type InjectionKey } from 'vue';

import {
  ContentResolver,
  type ContentLookup,
  type ContentResolverOptions,
} from '@/core/content/ContentResolver';
import { DEFAULT_LOCALE } from '@/core/content/locales';
import { loadContentSource } from './contentSource';

/**
 * The content port, injected once at the application root. Views never import
 * the resolver or the Vite glob, so tests can substitute a different source.
 */
export const CONTENT_LOOKUP: InjectionKey<ContentLookup> =
  Symbol('content-lookup');

/** Production resolver: the bundled `content/<locale>/**` trees. */
export function createContentLookup(
  options: ContentResolverOptions = {},
): ContentLookup {
  return new ContentResolver(DEFAULT_LOCALE, loadContentSource(), options);
}

export function provideContentLookup(lookup: ContentLookup): void {
  provide(CONTENT_LOOKUP, lookup);
}

export function useContentLookup(): ContentLookup {
  const lookup = inject(CONTENT_LOOKUP, null);

  if (!lookup) {
    throw new Error(
      'useContentLookup() requires provideContentLookup() in an ancestor component.',
    );
  }

  return lookup;
}
