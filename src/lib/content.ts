import { ContentResolver } from './ContentResolver';
import { loadContentSource } from './contentSource';
import { DEFAULT_LOCALE } from './locales';

/**
 * The app-wide resolver instance. This is the single access point to content;
 * views never read `content/**` directly.
 */
export const contentResolver = new ContentResolver(
  DEFAULT_LOCALE,
  loadContentSource(),
  {
    // English drafts stay previewable in `npm run dev`, matching the previous
    // behaviour. Draft translations are never served (see ContentResolver).
    includeDrafts: import.meta.env.DEV,
  },
);
