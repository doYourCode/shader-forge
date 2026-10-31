# Content i18n (en / pt-BR)

This document describes how documentation and knowledge content is translated.
It covers the layout convention, the resolver contract, the CMS configuration,
and the steps for adding a future locale.

> UI-string i18n (`vue-i18n` messages in `src/i18n/`) is a separate system and
> is not described here. Content i18n never reads or writes those files.

## Layout convention

Content lives in one directory per locale, with **identical relative paths and
filenames** in every tree:

```
content/
├── en/
│   ├── docs/
│   │   └── shader-editor.md
│   └── knowledge/
│       └── the-rendering-pipeline.md
└── pt-BR/
    ├── docs/
    │   └── shader-editor.md
    └── knowledge/
        └── the-rendering-pipeline.md
```

**The relative path is the translation key.** `content/en/docs/shader-editor.md`
and `content/pt-BR/docs/shader-editor.md` are the same document in two
languages. There are no filename suffixes (`foo.pt-BR.md` is forbidden) and no
`translationKey` frontmatter field.

## Frontmatter rules

Every locale variant of a document keeps the **same keys** as the English
original:

| Field         | Translated? | Notes                                          |
| ------------- | ----------- | ---------------------------------------------- |
| `title`       | yes         | Human-readable.                                |
| `description` | yes         | Human-readable.                                |
| `body`        | yes         | The markdown after the frontmatter.            |
| `section`     | no          | Structural; must match the English file.       |
| `order`       | no          | Structural; must match the English file.       |
| `draft`       | per locale  | Publication state of *this* locale's version.  |

`draft` is deliberately the one structural field allowed to differ: a new
translation is created as `draft: true` (a stub), and becomes live when the
translator sets it to `false`. English drafts are only previewable in the dev
server; draft translations are never served.

## Adding a translation

1. Copy the English file to the same path under `content/pt-BR/` (or use the
   matching collection in Pages CMS).
2. Translate `title`, `description`, and the body.
3. Keep `section` and `order` byte-for-byte identical to the English file.
4. Replace the body placeholder `<!-- TODO(pt-BR): translate -->` with the real
   translation and set `draft: false`.
5. Run `npm test` — the integration test verifies that the trees still load.

Do not machine-translate body content. A stub that falls back to English is
better than a bad translation, and the UI already shows a fallback notice.

## Runtime model

`src/lib/ContentResolver.ts` is the only module that knows about fallback:

```ts
const result = await contentResolver.resolve('docs/shader-editor.md', 'pt-BR');
```

- Try `content/<locale>/<relativePath>`.
- If missing and the locale is not the default, try the default locale and
  return `{ locale: 'en', isFallback: true }`.
- If both are missing, return `{ content: null, locale: null, isFallback: false }`.
- **Unknown locale codes are treated as the default locale** (`en`) rather than
  rejected — a stale URL still renders the English original.
- `hasTranslation(relativePath, locale)` checks the *exact* locale only and
  never counts the fallback as a translation.
- Drafts in a non-default locale are treated as missing, so they fall back.

The resolver is constructed once in `src/lib/content.ts` from Vite's native
`import.meta.glob` loader (`src/lib/contentSource.ts`). No new dependency is
involved.

The navigation tree (`src/lib/contentTrees.ts`) is built through the resolver,
so it shows exactly what the content pane will show.

## Routes and UI behaviour

Content URLs are locale-neutral. The header language selector in `AppLayout`
(backed by vue-i18n) is the single source of truth for both UI strings and
document language; there is no second selector.

| URL                       | Content locale                      |
| ------------------------- | ----------------------------------- |
| `/docs`, `/docs/:slug`    | Selected language (header selector) |
| `/knowledge`, `.../:slug` | Selected language (header selector) |

- Switching the selector re-resolves the current document in place. The URL
  does not change, so links stay stable across languages.
- `/docs` without a slug redirects to the first readable entry, so every
  document has a shareable URL.
- A missing document renders the in-app 404 view. This is a client-side SPA on
  static hosting, so the HTTP response is still `200`; the 404 is visual and
  `role="alert"` rather than a server status code.
- `<html lang>` is set to the **effective** content locale (the body actually
  shown), so a pt-BR selection that falls back renders `<html lang="en">`.
- When `isFallback` is true, `FallbackNotice.vue` renders the dismissible
  message “Este conteúdo ainda não foi traduzido. Exibindo o original em
  inglês.”
- The selector itself is never disabled per document: it also controls UI
  strings, and an untranslated body falls back with a notice instead of a
  broken link.

## Pages CMS

`.pages.yml` declares one collection per locale and kind — `docs_en`,
`docs_pt_br`, `knowledge_en`, `knowledge_pt_br` — pointing at
`content/<locale>/<kind>`. Every collection has an identical field schema, so
editors see the same fields in every language. The CMS only writes files; it
does not match translations. The path convention above is the matching
mechanism.

## Adding a future locale

1. Add the code to `LOCALES` in `src/lib/locales.ts`. This is the single source
   of truth; do not hard-code locale strings elsewhere.
2. Add translated section labels in `src/lib/contentTrees.ts`. The
   `Record<Locale, string>` type will fail to compile until every locale has
   them.
3. Create `content/<locale>/{docs,knowledge}/` and add the translated files
   with the same relative paths.
4. Add two collections (e.g. `docs_xx`, `knowledge_xx`) to `.pages.yml` with
   the same field schema as the existing ones.
5. Add the UI-string messages under `src/i18n/locales/` and the option in the
   header selector in `src/layouts/AppLayout.vue`.
6. Run `npm test` and `npm run build`.
