# Spector.js investigation harness

[Spector.js](https://spector.babylonjs.com) captures a WebGL frame and records
every command, its arguments, its state and whether the call was redundant. This
folder drives the real Screen Space Editor in a browser, captures frames for a
fixed set of scenarios and stores the results as JSON, so a performance or
stability claim can be checked against the actual GL stream instead of a guess.

The tool is development-only: `spectorjs` and `playwright-core` are
devDependencies and nothing here is imported by the application.

## Quick start

```bash
# 1. Serve the app (any port works)
npm run dev -- --port 5199

# 2. Capture every scenario into tools/spector/out/
npm run spector:capture -- --url http://localhost:5199

# 3. Re-render the markdown summary from the stored JSON
npm run spector:analyze

# Optional: the same interactions with no Spector in the page, to separate tool
# noise from application noise
npm run spector:control
```

A single scenario can be captured with `--scenario=idle` (comma-separated for
several). Raw captures land in `tools/spector/out/`, which is gitignored. A full
sweep takes roughly 15-20 minutes on software GL: every scenario loads the scene
once, and a captured frame costs about a minute.

## What a run does

1. Launches Chromium with ANGLE/SwiftShader, so WebGL 2 works without a GPU.
   Absolute frame times are meaningless on software GL; the command stream is
   not.
2. Waits for the editor's preview to reach steady state.
3. Injects the Spector browser bundle, drives the UI, captures the next rendered
   frame and detaches the spy again.
4. Writes `out/<scenario>.json` (summary plus the trimmed command stream) and a
   screenshot, then `analyze.mjs` turns those into `out/summary.md`.

Each scenario gets a fresh browser. Spector attaches its spy to the canvas
context; re-attaching it after the editor recompiled its effect chain has
stalled on software GL, and a fresh page also guarantees the same starting state
for every scenario.

The spy is detached after each capture on purpose: while it is attached Spector
tags and records every GL call, which drops the preview to under one frame per
second. Captures use Spector's _quick_ mode, which skips the per-texture
`readPixels` it performs for its own UI thumbnails — on software GL those
readbacks dominate the capture time.

## Scenarios

| id                | state captured                                          |
| ----------------- | ------------------------------------------------------- |
| `idle`            | one passthrough effect, no G-buffer debug view          |
| `effect-added`    | two fullscreen passes                                   |
| `effect-disabled` | no user passes, display pass only                       |
| `gbuffer-depth`   | PrePass with the single depth attachment                |
| `gbuffer-normal`  | PrePass with the normal attachment as well              |
| `resize`          | viewport shrunk while the PrePass is active             |
| `compile-error`   | invalid effect source, diagnostics, previous chain kept |

Add a scenario by appending to `SCENARIOS` in `capture.mjs`: `prepare(page)`
performs the UI steps, the runner captures one frame afterwards.

## Output

`out/<scenario>.json` contains:

- `capture.draws` — draw calls and instances, split by command name;
- `capture.uniqueObjects` — distinct programs, textures, buffers, framebuffers
  and vertex arrays used in the frame;
- `capture.uploads` — texture/buffer uploads per frame;
- `capture.redundant` — calls Spector flagged as redundant, with the top stack
  frame that issued them;
- `capture.shaders` / `capture.programs` — compile and link status with info
  logs, when the frame compiled something;
- `capture.glErrors` — results of any `getError` call in the frame;
- `console.webGlFaults` — `WebGL: INVALID_*` style messages Chrome logged while
  the scenario ran;
- `capture.commands` — the trimmed command stream (`n` name, `t` text, `s`
  Spector status, `d` microseconds) for pass-level analysis.

## Environment

| variable                | default                 | meaning                                                     |
| ----------------------- | ----------------------- | ----------------------------------------------------------- |
| `SPECTOR_URL`           | `http://localhost:5199` | app origin (also `--url`)                                   |
| `SPECTOR_READY_TIMEOUT` | `300000`                | ms to wait for the preview                                  |
| `SPECTOR_SETTLE_MS`     | `2500`                  | quiet time after the preview starts                         |
| `SPECTOR_CHROME`        | Playwright's Chromium   | explicit browser executable                                 |
| `SPECTOR_HEADFUL`       | unset                   | `1` shows the browser window                                |
| `SPECTOR_CONTROL`       | unset                   | `1` runs the baseline without Spector (same as `--control`) |

The baseline writes `out/control.json` with the WebGL faults Chrome reported
during the same interactions, so tool-induced messages stay distinguishable from
application ones.

## Caveats

- Spector's spy inflates CPU time and frame time, so `clock.wallMs` is a capture
  cost, not a frame budget. Use the editor's own stats overlay for frame time.
- `getTranslatedShaderSource` on already-deleted shaders is emitted by Spector
  itself when it attaches to the context; it is not an application fault.
- One captured frame is one `requestAnimationFrame` tick of Babylon's render
  loop. A frame that Babylon aborted while material effects were still compiling
  shows almost no commands; the runner retries those.
