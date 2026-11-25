---
title: Debugging Shaders
description: Read the error panel, use colour as printf, isolate terms one at a time, and fix the errors the diagnostics catalog already knows.
section: debugging
order: 1
difficulty: intermediate
prerequisites: gles-3-0-webgl2
editor: sandbox
example: sdf
draft: false
---

# Debugging Shaders

## Goal

Turn a black screen or a wrong colour into a specific question, answer it with a
debug output, and use the error panel instead of guessing. This page is the
debugging half of the lesson path; the [cheat sheet](/docs/cheat-sheet) has the
syntax, and the [performance page](/docs/how-the-gpu-executes-shaders)
covers the cost of the fixes.

## The two failure modes

There are only two things that can go wrong:

1. **The shader does not compile.** The preview keeps the last good program, so
   the image may still animate while the error panel shows a new error. Read the
   panel, not the canvas.
2. **The shader compiles but the result is wrong.** The program is valid, so the
   problem is a value, a coordinate space or an assumption. Debug the values.

## Reading the error panel

Each entry shows four things:

- **Kind** — `Syntax`, `Type`, `Logic`, `Link`, `Compiler`, `Timeout` or
  `Internal`.
- **Stage and line** — for example `Fragment shader · line 12, col 5`.
- **Title** — the friendly description the diagnostics catalogue produced.
- **Raw message and advice** — the driver text followed by the suggested fix.

Click an entry to reveal it in the editor when the stage has a text buffer.
`user_data` errors reveal the row in the User data table instead. A `link` error
has no single line; the advice tells you to compare the vertex output and the
fragment input.

The panel is a summary of `src/core/utils/glslDiagnostics.ts`. The rules are
ordered, most specific first, so a driver variant that contains several phrases
still gets the intended hint.

## Colour as printf

There is no `printf` in GLSL, but a colour is four numbers on screen. Replace
the final colour with the value you want to inspect:

```glsl
// Inspect a scalar in [0, 1].
fragColor = vec4(vec3(value), 1.0);

// Inspect a signed value: remap to [0, 1].
fragColor = vec4(vec3(value * 0.5 + 0.5), 1.0);

// Inspect a 2D vector as red/green.
fragColor = vec4(uv, 0.0, 1.0);

// Inspect a normal.
fragColor = vec4(normal * 0.5 + 0.5, 1.0);

// Inspect a boolean mask.
fragColor = vec4(vec3(step(0.5, value)), 1.0);
```

The last one is the most useful for "is this branch ever taken?" questions: a
boolean becomes black or white, with no ramp to interpret.

## Isolating terms

When a lighting result is wrong, do not stare at the final colour. Reduce the
shader to one term at a time:

```glsl
float NdotL = max(dot(N, L), 0.0);
fragColor = vec4(vec3(NdotL), 1.0);   // first: is the diffuse term correct?

float NdotV = max(dot(N, V), 1e-3);
fragColor = vec4(vec3(NdotV), 1.0);   // then: is the view term correct?

fragColor = vec4(F, 1.0);             // then: is Fresnel in range?
```

If `NdotL` is black on a surface that should be lit, the problem is `N` or `L`,
not the specular maths. If `NdotL` is correct but the final colour is wrong, the
bug is downstream.

## Five questions that localise almost anything

1. **Is the shader running?** Output a constant red. If the canvas is still
   black, the stage is not executing or the program failed to link.
2. **Is the input what I think?** Output `vUv`, `vWorldNormal`, a sampled
   texture or a uniform directly.
3. **Is the coordinate space what I think?** Output `normal * 0.5 + 0.5`; a
   world-space normal and a view-space normal look different when the camera
   moves.
4. **Is the branch taken?** Output `step(condition, 0.5)` or a boolean mask.
5. **Is the value in range?** Negative values and values above `1.0` both clamp
   when written to an LDR target. Remap signed values and use the Screen Space
   editor when you need to see HDR.

## The error catalogue

The table mirrors the rules in `glslDiagnostics.ts`. The driver text is shown
next to the friendly title, so this is a lookup, not a replacement.

| Title | Typical driver text | Fix |
| --- | --- | --- |
| `#version` must be on the first line | `#version` before/after another token | Move `#version 300 es` to line 1. |
| `gl_FragColor` is not available | `gl_FragColor` / `gl_FragData` | Declare `layout(location = 0) out vec4 fragColor;` and assign to it. |
| `attribute`/`varying` is not available | `attribute`, `varying` | Use `in`/`out`; vertex out, fragment in. |
| Missing fragment output | no output declared | Add the explicit `fragColor` output and write it in `main`. |
| Unexpected token | `unexpected token '…'` | Check the previous line for a missing semicolon or an unclosed bracket. |
| Missing token | `expected ';'` / `expected ')'` | Finish the statement or close the bracket. |
| Syntax error | `syntax error` | Fix the highlighted token; check the line above. |
| Unfinished block | `unterminated`, `premature end of file` | Close the `*/`, `}`, or `)`. |
| Unknown identifier | `undeclared identifier` | Fix the spelling or declare the name before use. |
| Duplicate declaration | `redefinition`, `already defined` | Rename one declaration, or do not redeclare an ABI name. |
| No matching function | `no matching overload` | Check argument count/types; `texture(sampler, vec2)` in ES 3.00. |
| Type mismatch | `cannot convert`, `incompatible type` | Use an explicit constructor: `vec3(...)`, `float(...)`. |
| Missing precision qualifier | `precision` | Add `precision highp float;` after `#version`. |
| Missing entry point | `main` not found | Define `void main(void)`. |
| Shaders do not match | link/varying mismatch | Give the varying the same name and type in both stages. |
| Unsupported feature | `unsupported`, `version`, `extension` | Rewrite with GLSL ES 3.00 features or enable the extension. |
| Reserved word | `reserved`, `keyword` | Choose a different identifier. |
| Shader is too complex | `too many`, `out of memory`, `too complex` | Reduce loop counts, uniforms or function calls. |

## Expected result

![SDF shapes: a debug-friendly example with a clear silhouette and a stroke](/images/content/lessons/sdf.webp)

This example is a good debugging target: the stroke and the fill are separate
`step`/`smoothstep` terms, so you can output each one independently.

## Minimal example: a mask debug view

```glsl run=sandbox title="Mask debug view"
#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float distanceToCentre = length(p);
    float inside = step(distanceToCentre, 0.3);

    // Output the mask directly: white inside, black outside.
    fragColor = vec4(vec3(inside), 1.0);
}
```

## Exercises

1. Take the SDF example and output only `stroke`. Which parts turn white?
2. Output `normal * 0.5 + 0.5` in the displacement example. What do you learn
   about the normal across the wave?
3. Break the shader on purpose: remove a semicolon. Which title appears, and
   which line is highlighted?
4. Declare `uniform float time;` in a shader that also uses the ABI `time`.
   What error do you get, and why?
5. In the screen-space editor, output `texture(depthTexture, vUV).r` directly.
   Why is the result almost white at the far plane?

::: solution Solution 1
The stroke is a narrow band around the shape boundary, so only the outline turns
white; the interior and the background are black.
:::

::: solution Solution 2
The normal is mostly the undisplaced surface normal, with the wave visible as
smooth variation. The vertex normal is not recomputed from the displaced
surface, which is why the lighting is approximate.
:::

::: solution Solution 3
`Missing ';'` or `Syntax error` at the line after the missing semicolon. The
compiler reports where it noticed the problem, not always the line where it
occurred.
:::

::: solution Solution 4
A duplicate declaration. The ABI already declares `time`; declaring it again is
rejected. Remove your declaration and use the engine value.
:::

::: solution Solution 5
The depth buffer stores large world-space distances; written directly to an LDR
colour, everything above `1.0` clamps to white. Remap it (`depth / cameraFar`)
before displaying.
:::

## Common mistakes

- Debugging the canvas while the error panel is showing a compile failure.
- Outputting a signed value without remapping it, then concluding it is zero.
- Forgetting that the last good program stays on screen.
- Assuming a line number points at the cause instead of the first token the
  compiler could not parse.
- Printing a uniform that the engine never bound; it reads as zero.

## Next

- [Performance basics](/docs/how-the-gpu-executes-shaders)
- [The error catalogue in the compiler reference](/docs/compiling-and-errors)
- [Cheat sheet](/docs/cheat-sheet)
