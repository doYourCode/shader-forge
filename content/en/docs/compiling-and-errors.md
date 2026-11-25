---
title: Compiling and errors
description: When compilation runs, what the Compile button targets, how the queue behaves, and how to read shader diagnostics.
section: reference
order: 3
draft: false
---

# Compiling and errors

ShaderForge compiles GLSL in the browser with the WebGL 2 driver. This page
explains when a compile happens, what it targets, what the status bar means and
how to get from an error message to the offending line.

## When compilation happens

| Trigger                                   | What compiles                                              |
| ----------------------------------------- | ---------------------------------------------------------- |
| First load of an editor                   | The initial material and post-effect chain.                |
| **Compile** on Vertex, Fragment, Attributes or Uniforms | The material.                              |
| **Compile** on Post effect                | The post-effect chain.                                     |
| Adding, removing, moving, enabling or disabling an effect | The post-effect chain.                    |
| Adding, removing, renaming, re-kinding or re-targeting a User data definition | The material after a short debounce, then the chain if the material succeeded. |
| Loading an example                        | The material, after replacing the stages and User data.    |
| Switching tabs                            | Nothing; it only changes which document is open.           |
| Typing in the editor                      | Nothing.                                                   |
| Changing a User data value                | Nothing; the value is bound live.                          |
| Changing the output transform             | Nothing; the display pass reads it as a uniform.           |

The first compile is automatic because the preview cannot render without a
program. After that, compilation is explicit: edit, then press **Compile**.

## What the Compile button targets

The editor compiles the document family of the active tab:

| Active tab                        | Compile target       |
| --------------------------------- | -------------------- |
| Vertex                            | Material             |
| Fragment                          | Material             |
| Attributes                        | Material             |
| Uniforms                          | Material             |
| Post effect                       | Post-effect chain    |
| User data                         | The previous target  |

The User data tab is a table, not a shader document, so it does not change the
target. If you were on Fragment, Compile still compiles the material; if you
were on Post effect, it compiles the chain.

## The compile queue

- Only one compile runs at a time. Material and post-effect compiles share one
  WebGL log recorder, so overlapping them would misattribute driver messages.
- A newer request of the same family replaces an older one that has not started
  yet. The latest request wins.
- When a structural User data edit requests both, the material compiles first
  and the chain is compiled only if the material succeeded. A broken material
  therefore does not hide behind a successful post-effect compile.
- Pressing **Compile** on the Post effect tab compiles the chain directly; it
  does not recompile the material.

## The last-good rule

A failed compile never destroys the working image. The previous program keeps
rendering while the new diagnostics are shown. This applies to the material and
to the post-effect chain: a chain is installed only when every pass compiled.

A consequence: a blank canvas is not the normal result of a shader error. If the
canvas is blank, look for a failure before the first successful compile, a lost
WebGL context, or a shader that returns a background colour.

## Status states

The status bar shows one of four states:

| State       | Label        | Meaning                                                     |
| ----------- | ------------ | ----------------------------------------------------------- |
| `idle`      | Idle         | No compile has run for the current document, or a tab was switched. |
| `ready`     | Ready        | The last compile succeeded.                                 |
| `compiling` | Compiling    | A compile is running.                                       |
| `error`     | Error        | The last compile failed, or the preview is unavailable.     |

Common messages include **Editor ready**, **Compiled successfully**,
**Compiling…**, **Compiling post effects…**, **Loaded example: …** and
**Shader program failed to link**. The bar also shows the cursor line and
column.

## Reading the error panel

The panel appears at the top of the preview after a failure. Each entry shows:

- a **kind** badge: Syntax, Type, Logic, Link, Compiler, Timeout or Internal;
- a **stage and location**, such as "Fragment shader · line 12, col 5" or
  "User data · row 2";
- a short **title**, the driver **message**, and an **advice** line when the
  app can suggest a fix;
- a click target that opens the right document and moves the caret.

Shader failures also appear as a red line highlight, a gutter marker and a wavy
underline in the editor. Hovering the underline shows the message. A User data
failure is shown by highlighting the blamed row instead.

### Where a click takes you

| Error stage     | Click behaviour                                                        |
| --------------- | ---------------------------------------------------------------------- |
| Vertex          | Opens **Vertex**, reveals the line and column.                         |
| Fragment        | Opens **Fragment**, reveals the line and column.                       |
| Post effect     | Selects the failing effect, opens **Post effect**, reveals the line.   |
| User data       | Opens **User data** and highlights the blamed row.                     |
| Shader program  | No line is reported; the entry is not clickable.                       |

An error without a line cannot be revealed. That usually means the failure is at
link time, or the driver did not report a position.

## Error kinds

| Kind       | Shown as   | Typical cause                                                          |
| ---------- | ---------- | ---------------------------------------------------------------------- |
| `syntax`   | Syntax     | Missing semicolon or brace, stray character, unfinished statement.     |
| `type`     | Type       | Assigning a `vec4` to a `vec3`, wrong argument type, wrong return type.|
| `logic`    | Logic      | The driver rejects a construct that parses but is not valid here.      |
| `link`     | Link       | Vertex and fragment interfaces disagree, or a name is declared twice.  |
| `program`  | Compiler   | Program-level failure without a single attributable line.              |
| `timeout`  | Timeout    | The driver did not finish compiling within the watchdog window (15 s). |
| `internal` | Internal   | An app-side failure: allocation, context loss or an unexpected throw.  |

## Common failures and fixes

| Message or symptom                              | Likely cause                                                     | Fix                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `'foo' : undeclared identifier`                 | The declaration is missing from this stage                       | Add a User data entry targeting this stage, or declare the engine input yourself.      |
| `'foo' : redefinition`                          | You declared a name that User data also generates                | Remove the manual declaration; keep only the table row.                               |
| `syntax error` near a line                      | Missing `;`, `)`, `}` or an extra character                      | Check the reported line and the line above it.                                        |
| Cannot convert `vec4` to `vec3`                 | Vector width mismatch                                            | Use `.rgb`/`.xyz`, or build the missing component explicitly.                         |
| Program fails to link, no line                  | Varyings differ between vertex and fragment                      | Make names and types identical in both stages.                                        |
| Fragment cannot read a varying                  | The vertex stage does not write it                              | Add the matching `out` in the vertex stage.                                           |
| A uniform has no effect                         | Wrong stage, or the shader does not read it                     | Check the stage column; in 3D use **Post** for post effects.                          |
| Texture looks black                             | No source, still loading, or the wrong sampler kind             | Choose a valid source; use **Texture 2D** for a 2D image.                             |
| Timeout                                         | A very large or pathological shader, or a stalled driver         | Reduce the shader, reload the page, and try again.                                    |
| Internal error                                  | Context loss or allocation failure                               | Reload the page. If it persists, record the message and the browser/GPU details.      |

## What compilation does not do

- It does not save your work. Reloading resets every document.
- It does not compile on every keystroke.
- It does not compile WGSL. The editors compile GLSL ES 3.00.
- It does not reset the camera, the selected model or the environment.
- It does not replace a failed shader with a fallback image; the last good image
  remains.

## Related

- [Debugging shaders](/knowledge/debugging-shaders) — colour-as-printf and the full error catalogue.
- [3D Shader Editor](/docs/3d-editor)
- [2D Sandbox](/docs/2d-sandbox)
- [Screen Space GLSL Editor](/docs/screen-space-editor)
- [User data](/docs/user-data)
- [Post effects](/docs/post-effects)
- [Limits and troubleshooting](/docs/limits-and-troubleshooting)
