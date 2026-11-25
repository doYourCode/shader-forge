# Load-time performance

The preview publishes named load-phase timings through
`window.__shaderForgePerf`. Development builds expose it automatically;
production builds require `?perf` on the editor URL:

```
http://localhost:5173/editor?perf
```

Inspect the samples from the browser console:

```js
window.__shaderForgePerf.report(); // one line per finished phase
window.__shaderForgePerf.samples(); // { phase, ms }[] in completion order
```

`report()` returns `"no load phases recorded"` until a phase finishes.

## Phase names

Emitted by `src/core/utils/LoadProfiler`:

| Phase | Starts when | Ends when |
| --- | --- | --- |
| `scene:init` | the editor mounts its canvas | mesh, material and environment are ready and the first frame is requested |
| `env:load` | a texture request is issued | the texture reports ready (fetch + decode + GPU upload) |
| `env:filter` | IBL filtering starts | irradiance + GGX radiance filtering finish (raw `.hdr` sources only) |
| `env:swap` | an environment selection is confirmed | the new environment is published |
| `mesh:load` | an import is requested | the GLB is parsed and its buffers are ready |
| `model:swap` | a model selection is confirmed | the new mesh replaces the old one |
| `shader:compile` | a compile starts | the effect is ready (or fails) |

## Screen-space preview

The Screen Space editor's frame is fill-bound, so its cost follows the pixel
count rather than the effect count. Three controls keep it inside budget:

- **Adaptive render scale.** The preview measures its frame interval and walks a
  resolution scale between `1.0` and `0.5` (see
  `src/core/screenspace/renderScale.ts`). It drops a step when the average frame
  misses the 60 fps budget by 20 %, and only raises the scale with real
  headroom. The stats overlay prints the current scale as `({scale}%)`.
- **On-demand G-buffer attachments.** Babylon's PrePass MRT is built from the
  attachments the *linked* effect programs read, plus the ones the active debug
  view needs. A passthrough requests none, which skips the PrePass entirely;
  depth-only effects request one `R32F` target. `velocity` is requested only
  when an effect samples it, because it also turns on per-instance previous
  transform tracking.
- **No transparent overlay by default.** Transmissive and alpha-blended surfaces
  render in the main pass (`TRANSPARENT_OVERLAY_ENABLED` in
  `src/core/constants/screenSpaceRender.ts`). Refraction is disabled either way,
  so the separate HDR target, its depth buffer and its clear bought no visible
  difference. The `transparent` debug view is hidden while the overlay is off.
- **Dynamic sun with cascaded shadows.** `SunController` adds one directional
  light and a two-cascade `CascadedShadowGenerator` (2048², PCF medium,
  `shadowMaxZ` 220) so shadows stay sharp near the camera while the far end
  falls back to the IBL. Casters are the opaque source meshes only — the
  container lists one entry per node, and listing instances would add a draw
  per instance. Every cascade re-renders the casters each frame, and the shadow
  passes are *not* covered by the adaptive render scale: on a slow GPU reduce
  the cascade count or map size first. The viewport overlay exposes sun and HDRI
  intensity sliders, applied live without a recompile.

Scene assets still dominate: the bundled Bistro scene is ~550 meshes, ~2 900
mesh nodes and ~1.9 GB of decoded textures. If the frame stays slow at `0.5`
scale, the bottleneck is the scene, not the effect stack. A Spector.js capture
quantifies that split: see `docs/spector-investigation.md` and the harness in
`tools/spector`.

## Measuring a frame

`docs/spector-investigation.md` records a full command-level audit of this
preview. To repeat it, capture the GL stream of a scenario and read the summary:

```
npm run dev -- --port 5199
npm run spector:capture -- --url http://localhost:5199
npm run spector:analyze
```

The capture reports per-frame draw calls, distinct programs/textures, GL state
churn and WebGL errors. Spector inflates frame time, so use these captures for
structure and the editor's stats overlay for timing; the overlay's draw count is
per frame.

## Caveats

- Timing on software GL (for example headless Chromium with SwiftShader) is only
  meaningful relative to another run on the same machine. Do not treat those
  numbers as user-facing expectations.
- There is no automated benchmark in this repository. Measure manually when a
  change touches asset loading, environment or model swapping, or shader
  compilation.
