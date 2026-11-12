# Load benchmarks

Two tools, both optional and dev-only:

| Tool | What it measures | Cost |
| --- | --- | --- |
| `npm run bench:load` | end-to-end load phases of the built app in headless Chromium (initial load, environment swap, model swap, transferred bytes) | needs `playwright` + a Chromium download |
| `npm run bake:env` | regenerates the prefiltered `.env` environments from the source panoramas | none beyond the app dependencies |

## End-to-end benchmark

```bash
npm run build
npm run preview -- --port 4173        # in another terminal
npm i -D playwright && npx playwright install chromium   # one-time
node perf/bench-load.mjs --url http://127.0.0.1:4173
```

`bench-load.mjs` appends `?perf=1`, which makes the app publish its load
phases on `window.__shaderForgePerf`. Add `--json` to get machine-readable
output.

### Phase names

Emitted by `src/services/perf/LoadProfiler`:

| Phase | Starts when | Ends when |
| --- | --- | --- |
| `scene:init` | the editor mounts its canvas | mesh, material and environment are ready and the first frame is requested |
| `env:load` | a texture request is issued | the texture reports ready (fetch + decode + GPU upload) |
| `env:filter` | IBL filtering starts | irradiance + GGX radiance filtering finish (raw `.hdr` sources only) |
| `env:swap` | an environment selection is confirmed | the new environment is published |
| `mesh:load` | an import is requested | the GLB is parsed and its buffers are ready |
| `model:swap` | a model selection is confirmed | the new mesh replaces the old one |
| `shader:compile` | a compile starts | the effect is ready (or fails) |

Headless Chromium runs on SwiftShader (software GL), so treat the absolute
numbers as a relative signal — useful to compare a change against the numbers in
[PERF.md](../PERF.md), not as user-facing expectations.

## Environment bake

```bash
npm run bake:env
```

Opens `/bake.html` in a browser tab. Press **Bake all environments** and save the
downloaded files to `src/assets/hdri/env/`. The tool runs the same pipeline the
runtime used to run on every load (HDR decode → panorama to cubemap → irradiance
convolution → GGX prefilter → RGBD/WebP encode), but only once, offline.

The source panoramas in `src/assets/hdri/*.hdr` are not part of the production
bundle: they are referenced only from `src/tools/hdriSources.ts`, which is
reachable from `bake.html` alone. `src/tools/hdriSources.test.ts` keeps that list
in sync with the catalog in `src/core/constants/previewHdris.ts`.
