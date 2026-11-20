# ShaderForge

A browser-based GLSL shader editor with a live 3D preview. Edit a vertex and
fragment pair, declare your own uniforms and textures, stack post effects, and
see the result on a switchable model under an HDR environment — without leaving
the browser.

## Features

- **CodeMirror 6 editor** with GLSL syntax highlighting, read-only reference
  documents, and compiler diagnostics mapped back to editor lines.
- **Babylon.js preview** with switchable GLB models and HDR or prefiltered
  `.env` environments. The last successfully compiled shader stays on screen
  when a compile fails.
- **User data panel**: declare floats, vectors, colours and textures. Generated
  GLSL declarations are injected at compile time, so the buffers you edit stay
  exactly as you wrote them.
- **View-space post-effect stack** with a final output transform (Reinhard or
  ACES).
- **Examples, reference and knowledge content** rendered from Markdown,
  including Mermaid diagrams.
- **English and Brazilian Portuguese** UI and content. The app boots in pt-BR.

The preview requires a WebGL 2 capable browser.

## Requirements

- Node.js 22 or newer.
- npm 11. npm 10 fails while preparing the AssetPicker git dependency.

## Getting started

```bash
npm install
npm run dev
```

`npm install` also runs `patch-package` to apply the repository's patches.

## Scripts

| Command                 | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Start the Vite development server.                        |
| `npm run build`         | Type-check with `vue-tsc` and build for production.       |
| `npm run preview`       | Serve the production build locally.                       |
| `npm run test`          | Run the Vitest suite once.                                |
| `npm run test:watch`    | Run Vitest in watch mode.                                 |
| `npm run lint`          | Run ESLint, including the architecture import boundaries. |
| `npm run format`        | Format with Prettier.                                     |
| `npm run format:check`  | Check formatting without writing.                         |
| `npm run bench:load`    | Run the load-time benchmark.                              |
| `npm run bake:env`      | Open the HDRI-to-`.env` baking tool.                      |
| `npm run bake:examples` | Open the example-thumbnail baking tool.                   |

Append `?perf` to the editor URL to expose load timings through
`window.__shaderForgePerf`.

## Project layout

```
src/
  core/        Framework-free models, constants, codegen and pure utilities
  services/    Babylon, CodeMirror, content, asset-picker and user-data services
  composables/ Editor composition roots and shared Vue logic
  components/  Vue components
  views/       Routed screens
  i18n/        vue-i18n messages (en, pt-BR)
content/       Per-locale documentation and knowledge trees
docs/          Contributor notes
```

The dependency direction is `core` ← `services` ← UI. ESLint enforces that
`src/core` stays framework-free and that outer layers do not reach into
engines directly.

## Working on content

Documentation and knowledge are translated as parallel per-locale trees. See
[docs/i18n-content.md](docs/i18n-content.md) for the layout and frontmatter
rules, and [docs/post-effects.md](docs/post-effects.md) for the post-effect
pipeline.

## Validation

CI runs the same gate on every push and pull request:

```bash
npm run lint
npm run test
npm run build
```

## License

ShaderForge is released under the GNU General Public License v3.0. See
[LICENSE](LICENSE).
