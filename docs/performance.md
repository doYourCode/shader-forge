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

## Caveats

- Timing on software GL (for example headless Chromium with SwiftShader) is only
  meaningful relative to another run on the same machine. Do not treat those
  numbers as user-facing expectations.
- There is no automated benchmark in this repository. Measure manually when a
  change touches asset loading, environment or model swapping, or shader
  compilation.
