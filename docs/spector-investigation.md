# Screen Space Editor: a Spector.js performance and stability audit

**Date:** 2026-11-25 · **Scope:** `/screen-space` (`ScreenSpaceEditorView` +
`ScreenSpaceSceneManager` + `ScreenSpacePostPipeline` + `ScreenSpaceGbuffer`).

Spector.js was installed as a development tool and used to capture the real
WebGL 2 command stream of the editor. This document records what was measured,
what it means, and what was changed as a result.

## Method

| Aspect      | Value                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| Tool        | [Spector.js](https://spector.babylonjs.com) 0.9.33, devDependency          |
| Harness     | `tools/spector` — Playwright injects Spector, drives the UI, captures one frame per scenario |
| Browser     | Chrome 158 headless, ANGLE + SwiftShader (software WebGL 2)                |
| Scene       | bundled Bistro GLB, Wooden Studio 17 HDRI, 1600×1000 window               |
| Captures    | `idle`, `effect-added`, `effect-disabled`, `gbuffer-depth`, `gbuffer-normal`, `resize`, `compile-error` |
| Control     | the same interactions without Spector                                      |

Every capture is one `requestAnimationFrame` tick of Babylon's render loop, so
the draw counts are per frame. The summary tables are produced by
`tools/spector/analyze.mjs`, which recomputes draws from the saved command
stream (and, unlike a naive `name.startsWith("draw")` count, excludes
`gl.drawBuffers`). Spector inflates CPU/frame *time* (a captured
frame took ~50 s on software GL), so the audit uses it for structure — draw
calls, object churn, GL state, errors — not for absolute timings. Software GL
also makes the editor's 1 fps meaningless as a user-facing number.

Reproduce with:

```bash
npm run dev -- --port 5199
npm run spector:capture -- --url http://localhost:5199
npm run spector:analyze
```

## Frame shape (steady state, one passthrough effect)

| Metric                         | Value                                           |
| ------------------------------ | ----------------------------------------------- |
| GL commands per frame          | 10 294                                          |
| Draw calls                     | 1 611                                           |
| – shadow cascades (2 × 2048²)  | 1 058 (66 %)                                    |
| – opaque scene pass            | 551                                             |
| – fullscreen post passes       | 2 (effect + display)                            |
| Triangles per frame            | 15 723 360                                      |
| Instances drawn                | 2 653 (295 instanced draws)                     |
| Distinct programs              | 314                                             |
| Distinct textures              | 1 099                                           |
| Distinct vertex arrays         | 1 609                                           |
| Texture uploads per frame      | 0                                               |
| `bufferSubData` per frame      | 299                                             |
| Redundant GL calls (Spector)   | 13 (clear state and `depthMask`)                |
| `gl.getError` results          | 0                                               |

The frame is overwhelmingly scene rendering. The effect chain contributes two
draw calls; the cascaded shadow map contributes two thirds of every draw call.

## Findings

### 1. The stats overlay reported a lifetime draw-call total, not a frame count — fixed

The overlay under the canvas read `engine._drawCalls.current`, a Babylon
`PerfCounter`. That counter only resets in `fetchNewFrame()`, which Babylon's
`SceneInstrumentation` calls once per frame — and this app never enables scene
instrumentation. The value therefore grew for as long as the preview ran.

Evidence: two samples from the overlay twenty seconds apart, with no scene
change, read **21 511** and **23 122 draws** at 1 fps, while Spector measured
**1 611 draws in every frame**.

`takeFrameDrawCalls()` in `src/services/babylon/screenspace/ScreenSpaceSceneManager.ts`
now reads the counter and rolls it over, so the overlay reports the frame that
just finished. After the change the overlay and Spector agree exactly across the
sweep (1 611 / 1 612 / 1 610 draws).

Why it matters: the number is the primary performance readout in the editor. A
lifetime total makes a healthy frame look catastrophic and hides real
regressions.

### 2. Shadow cascades dominate the frame; adaptive scaling cannot reach them

Measured per frame: 1 058 of 1 611 draw calls (66 %) come from the two cascaded
shadow passes, which re-render every caster at a fixed 2048² per cascade. They
are independent of the canvas resolution.

`docs/performance.md` already warns that shadow passes are not covered by the
adaptive render scale, and the capture confirms the magnitude: at 0.5 scale the
scene and post passes lose pixels, but the shadow map keeps its full cost. On a
slow device the lever is the cascade count or the map size in `SunController`
(`CASCADE_COUNT`, `SHADOW_MAP_SIZE`), not the render scale.

No code change: this is a deliberate quality/performance trade-off, not a bug.

### 3. Enabling the G-buffer adds 1 105 `glDrawBuffers` state calls per frame, and no draw calls — Babylon PrePass behaviour

With a G-buffer debug view active (PrePass on), the command stream grows by
1 116 commands and **1 105 `drawBuffers`** calls (three at pass setup, two per
scene draw), while draw calls and triangles stay identical (1 611 / 15 723 360).
The per-draw pattern is:

```
bindFramebuffer(PrePass RT)          // once per pass
  bindVertexArray(null)
  drawBuffers([...])                 // before the submesh
  useProgram(...) … drawElements     // submesh
  drawBuffers([...])                 // restore
```

`MaterialHelperGeometryRendering._BindAttachmentsForEffect` and
`_RestoreAttachments` (`@babylonjs/core/Materials/materialHelper.geometryrendering.js`)
each call `engine.bindAttachments()`, which always calls `gl.drawBuffers`. That
is two driver state calls per submesh draw, for an MRT layout that does not
change between draws.

The depth-only and depth+normal layouts are indistinguishable in the command
stream (both 11 410 commands, 1 611 draw calls, 1 105 `drawBuffers`): the extra
attachment costs bandwidth, not GL calls.

No code change: the cost is inside Babylon's PrePass. The app already keeps the
PrePass off unless an effect or debug view requests scene data, which is the
right mitigation.

### 4. Each effect pass costs one draw call; the stack is fill-bound, not call-bound

| Scenario        | Effects | Draws | Programs | Textures |
| --------------- | ------- | ----- | -------- | -------- |
| `effect-disabled` | 0     | 1 610 | 313      | 1 098    |
| `idle`            | 1     | 1 611 | 314      | 1 099    |
| `effect-added`    | 2     | 1 612 | 315      | 1 100    |

Each fullscreen pass adds exactly one draw, one program and one texture. Adding
or removing effects does not meaningfully change CPU submission; their cost is
pixel shading, which is why the adaptive render scale is the right control and
why the docs call the frame fill-bound.

### 5. Per-frame uploads are stable, and resize retargets every pass — stable

- No texture re-uploads in any steady frame (`texImage2D`/`texSubImage2D` = 0):
  the streaming cost is load-time only.
- 299 `bufferSubData` calls per frame are uniform-buffer updates, not texture
  churn.
- `resize` captured after shrinking the window to 1100×700: the main pass
  viewport follows the canvas (550×634 at 100 % scale), the shadow cascades stay
  2048², and no stale 800×934 viewport or framebuffer remains. The scene draw
  count is unchanged (1 611).
- Redundant-call volume is low (8–17 per frame, mostly `clear*` and
  `depthMask`). There is no state-change thrash to fix.

### 6. A failed compile keeps the previous chain and generates no GL errors — stable

`compile-error` typed an invalid fragment and compiled it. The frame that
followed is **identical to `idle`** (10 294 commands, 1 611 draws, 314 programs,
15 723 360 triangles, 0 GL errors): the previously installed chain keeps
rendering, `getError` stays clean, and the UI reports the syntax error with a
the stage, message and advice. The atomic-install/rollback path in
`ScreenSpacePostPipeline.install()` behaves as designed under failure.

### 7. Console noise: instance warnings — fixed

`SunController.bind()` wrote `receiveShadows = true` on every mesh, including
instances. Babylon discards the write on an instance and logs
*"Setting receiveShadows on an instanced mesh has no effect"*, hundreds of times
per scene load, burying real warnings. `shadowReceivers()` now filters
instances out; their source mesh already carries the flag. The control run after
the change logs no such warning.

### 8. `getTranslatedShaderSource` errors are Spector's, not the editor's

When the spy attaches, Spector reads the source of every tracked shader,
including shaders Babylon deleted after linking. That produces
`WebGL: INVALID_OPERATION: getTranslatedShaderSource: attempt to use a deleted
object` (252–256 occurrences) in the capture runs. The same interactions without
Spector produce **0** WebGL faults, so this is tool noise and is documented in
`tools/spector/README.md`.

## Recommendations (not implemented)

1. **Cascade budget on weak devices.** Two 2048² cascades over the whole Bistro
   street cost two thirds of the draw calls in a frame. Dropping to one cascade, or 1024² with
   `shadowMaxZ` trimmed, is the largest single lever and is already named in
   `docs/performance.md`.
2. **Keep the G-buffer opt-in.** The PrePass is free when no effect samples scene
   data and costs ~1.1 k extra state calls when it is on. Any future feature that
   samples depth/normals by default would add that to every frame.
3. **Scene budget, not effect budget.** At 15.7 M triangles and ~1 k shadow
   draws per frame, adding effect passes is nearly free while scene traversal is
   not. Optimise the asset split (instancing, caster list) before the chain.

## Files

- `tools/spector/` — capture harness, analyzer, README.
- `src/services/babylon/screenspace/ScreenSpaceSceneManager.ts` —
  `takeFrameDrawCalls()`.
- `src/services/babylon/screenspace/SunController.ts` — `shadowReceivers()`.
- Tests: `ScreenSpaceSceneManager.test.ts`, `SunController.test.ts`.
