# Preview load performance

This document records the asset-loading work done on branch `perf/asset-loading`
and the measurements taken with it. It is intentionally factual: the numbers are
from a headless Chromium run on SwiftShader (software GL), so they are useful as
a relative signal, not as absolute expectations for a user's GPU.

## What changed

| Area | Change |
| --- | --- |
| Environment assets | The five panoramas are baked offline into Babylon's prefiltered `.env` container. The app now loads radiance mips + irradiance directly instead of decoding a 6 MB RGBE panorama, converting it to a cubemap in JS and running IBL filters on every load. |
| Catalog | `PreviewHdri` gained a `format: 'env' \| 'hdr'` field; the loader dispatches on it. `.env` entries skip `env:filter` entirely. |
| Bake tool | New dev-only page `bake.html` + `src/tools/bakeEnv.ts` (`npm run bake:env`) reusing the runtime filter function, so a baked asset is produced by the same pipeline the app used to run live. |
| Instrumentation | `src/services/perf/LoadProfiler.ts` records named load phases; `SceneManager`, `EnvironmentController` and the editor report through a `LoadTimer` port. Dev builds (and `?perf` in production) expose `window.__shaderForgePerf`. |
| Loading UX | The editor shows a progress overlay for the initial load, environment swaps and model swaps. |
| Engine | `preserveDrawingBuffer` is off (it forced a drawing-buffer copy per frame). The render loop is now idempotent: `setPaused(false)` and `start()` both used to register a callback, so the scene rendered twice per frame. |
| Cleanup | Removed the unused `public/mesh/sphere.glb` duplicate and `SphereMeshProvider`. |

## Asset payload

| Environment | Before (`.hdr`) | After (`.env`) | Ratio |
| --- | ---: | ---: | ---: |
| Wooden Studio 17 (default) | 6,077,732 B | 320,615 B | 19.0× |
| Peppermint Powerplant | 6,962,633 B | 537,473 B | 13.0× |
| Pergola Walkway | 6,892,672 B | 798,009 B | 8.6× |
| Qwantani Sunrise | 6,119,459 B | 609,975 B | 10.0× |
| Mossy Forest | 7,599,867 B | 1,002,434 B | 7.6× |
| **Total environments** | **33,652,363 B** | **3,268,506 B** | **10.3×** |
| **Total shipped assets** (environments + meshes) | **39,765,495 B** | **9,381,638 B** | **4.2×** |

The source `.hdr` files stay in the repository as the reproducible input of the
bake, but they are no longer part of the production bundle: they are referenced
only from `src/tools/hdriSources.ts`, which is reachable from `bake.html` alone.
A production build now emits **zero `.hdr` files**.

## Measured load phases

`node perf/bench-load.mjs --url http://localhost:5197`, headless Chromium,
SwiftShader, `vite preview`:

```
navigation → canvas      92 ms
navigation → preview   1,316 ms

Initial load phases:
  mesh:load          48.1 ms
  env:load          415.0 ms
  scene:init        447.4 ms

HDRI swap (settled)      381 ms
  env:load           366.2 ms
  env:swap           366.7 ms

Model swap (settled)     101 ms
  mesh:load           43.6 ms
  model:swap          45.5 ms
```

Transferred assets on the editor route (file sizes):

| Asset | Bytes |
| --- | ---: |
| `monkey.glb` (default) | 476 kB |
| `wooden-studio-17.env` (default) | 313 kB |
| `mossy-forest.env` (largest, on demand) | 979 kB |
| `Dragon.glb` (heaviest, on demand) | 4,047 kB |

Run-to-run spread on this machine is about ±20 % (`env:load` 297–435 ms,
`scene:init` 398–466 ms, HDRI swap 243–381 ms, model swap 70–101 ms).
`env:filter` is **absent** from the profile: baked environments never run the HDR
filters. It remains in the profiler because the raw `.hdr` fallback still uses
it.

### Before / after, same harness

| Metric | Before | After |
| --- | ---: | ---: |
| Default environment bytes | 6.08 MB | 320 kB |
| Environment work at load (decode + convert + filter) | ~1.2 s decode + GPU filter (measured offline with the same Babylon code) | 0.37 s (fetch + WebP decode + upload) |
| Environment swap, time to visible change | 3,002 ms | 923–1,250 ms |
| Initial content on screen (`canvas` + first frame) | 4,832 ms | 1,316–1,691 ms |
| Model swap (Dragon, pipeline unchanged) | 1,954 ms | 752–1,302 ms (noise; `mesh:load` is ~40–50 ms) |

The "time to visible change" figure includes a ~0.7–1.0 s floor from the
screenshot-polling detector under SwiftShader, so the underlying environment gap
is larger than the table suggests. The model row is included only to show that
the model pipeline was deliberately not changed in this phase; its delta is
measurement noise.

The remaining initial-load budget is dominated by the **6.5 MB editor JS chunk**
(Babylon + glTF loader), which this phase did not touch. That is the next
independent win (subpath/`.pure` imports and chunk splitting — see the roadmap
below).

## Visual verification

Baked environments were compared against the raw-HDR build by rendering the same
scene, camera and selection, then diffing the canvas pixels:

| Comparison | Mean abs. difference | Pixels differing by > 16/255 |
| --- | ---: | ---: |
| Default environment (Wooden Studio 17) | 1.68 | 1.26 % |
| Mossy Forest (largest bake) | 3.11 | 2.99 % |
| Dragon model | 1.26 | 0.28 % |

No orientation, rotation or gamma differences were visible; the residual comes
from the RGBD/WebP encode-decode round trip (lossy colour) versus the previous
float path. If that residual ever matters, re-bake with `imageQuality: 1` in
`src/tools/bakeEnv.ts` (bigger files) or move to a lossless container.

## Baking

```bash
npm run bake:env   # opens /bake.html; press "Bake all environments"
```

Save the downloads to `src/assets/hdri/env/`. One-time cost measured on
SwiftShader for the five environments:

| Environment | HDR decode → cubemap | IBL filter | RGBD/WebP encode | Total |
| --- | ---: | ---: | ---: | ---: |
| Wooden Studio 17 | 1,185 ms | 42 ms | 2,420 ms | 3,646 ms |
| Peppermint Powerplant | 1,187 ms | 21 ms | 2,009 ms | 3,216 ms |
| Pergola Walkway | 1,250 ms | 33 ms | 2,274 ms | 3,557 ms |
| Qwantani Sunrise | 1,208 ms | 22 ms | 2,221 ms | 3,451 ms |
| Mossy Forest | 1,161 ms | 30 ms | 2,419 ms | 3,609 ms |

(The filter time appears small because GPU commands are only flushed by the
readback in the encode step; the total is what matters.) Baking is done once, on
a developer machine with a real GPU it takes a fraction of this.

`src/tools/hdriSources.test.ts` fails if the bake source list and the catalog
drift apart, so adding an environment cannot silently produce a stale asset.

## Reproducing the numbers

```bash
npm run build
npm run preview -- --port 4173
npm i -D playwright && npx playwright install chromium   # one-time
node perf/bench-load.mjs --url http://127.0.0.1:4173
```

See [perf/README.md](perf/README.md) for the phase definitions. Without
Playwright the benchmark exits with the install instructions; nothing in the app
depends on it.

## Deliberately out of scope

- **Model geometry was not decimated.** Lossless meshopt compression of the GLBs
  is the agreed follow-up (it changes asset bytes and needs the decoder wired up,
  so it was kept separate).
- **Bundle splitting** (Babylon subpath/`.pure` imports, `manualChunks`). This is
  the largest remaining load-time cost and has its own risk profile because
  Babylon's side-effect registrations must be preserved.
- **Persistent caching / prefetch** (Cache API or service worker, intent
  prefetch, decoded-resource cache) and the `AsyncResourceSlot` extraction that
  would give `EnvironmentController` and `TextureRegistry` one shared latest-wins
  resource state machine.

## Risks / notes

- `.env` assets embed the irradiance cubemap. A `.env` baked without it would
  leave `irradianceMap` unbound; the bake tool always runs irradiance first.
- WebP support is required for the baked assets (universal in current browsers).
  The bake tool is the only place that would need changing to move to PNG or
  KTX2.
- `?perf` exposes a small read-only profiler object on `window` in production
  builds; it records phase timings only when that parameter is present.
- The branch also contains the pre-existing deletion of `pnpm-lock.yaml` from the
  working tree (unrelated to this work; the project builds with
  `package-lock.json`).
