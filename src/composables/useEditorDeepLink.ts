import { getCurrentInstance } from 'vue';
import { useRoute } from 'vue-router';

import {
  parseEditorQuery,
  type EditorQuery,
} from '@/core/navigation/editorLinks';

/**
 * Reads the editor deep-link query when a router is installed.
 *
 * The view tests mount the editor in isolation, without `app.use(router)`.
 * Calling `useRoute()` there injects nothing and logs a warning, so this
 * composable checks the router global property first and falls back to an empty
 * query. In the real app the router is always present.
 */
export function useEditorDeepLink(): EditorQuery {
  const globals = getCurrentInstance()?.appContext.config.globalProperties;
  const hasRouter = Boolean(globals?.['$router']);
  if (!hasRouter) return parseEditorQuery({});

  const route = useRoute();
  return parseEditorQuery(route?.query ?? {});
}
