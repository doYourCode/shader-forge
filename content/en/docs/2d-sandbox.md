---
title: 2D Sandbox
description: A fragment-only fullscreen shader editor with vUv, uResolution and uTime, and no scene to set up.
section: editors
order: 3
draft: false
---

# 2D Sandbox

The 2D Sandbox is a fullscreen fragment playground. It draws one triangle that
covers the whole viewport and lets you write the fragment shader that fills it.
There is no mesh, camera, light or environment to configure. It is also labelled
**2D GLSL Sandbox** on the landing page.

## What it is

The sandbox is a small, purpose-built WebGL 2 renderer. Its vertex stage is
internal and fixed: it generates a fullscreen triangle without vertex buffers or
attributes. You edit exactly one document, the fragment shader, and the engine
gives it three inputs.

Use it when you want to:

- learn or teach GLSL with the shortest possible feedback loop;
- write patterns, gradients, noise, SDFs or raymarched scenes;
- prototype a fullscreen effect before moving it into a post-effect pass;
- work without thinking about meshes, cameras or lighting.

If you need geometry or an environment, use the
[3D Shader Editor](/docs/3d-editor). If you need the scene's depth or normals,
use the Screen Space editor.

## What "2D" means here

"2D" means **one fragment shader over the viewport**, not the Canvas 2D API and
not a sprite scene. You are computing a colour for every pixel from coordinates,
time and whatever uniforms you declare. The output is a single RGBA image.

## The screen

| Region        | Control                 | What it does                                                   |
| ------------- | ----------------------- | -------------------------------------------------------------- |
| Left toolbar  | Brand                   | Returns to the landing page.                                   |
| Left toolbar  | **Shader Stages**       | Contains only **Fragment**.                                    |
| Left toolbar  | **Post effect**         | Opens the fragment of the selected effect in the stack.        |
| Left toolbar  | **Shader Data**         | Contains only **User data**.                                   |
| Right toolbar | **Compile**             | Compiles the active document family.                           |
| Right toolbar | **Pause** / **Resume**  | Freezes or resumes rendering and `uTime`.                      |
| Right toolbar | Language switch         | Switches the interface language.                               |
| Preview       | ABI badge               | Shows `vUv · uResolution · uTime · user data · post effects`.  |
| Status bar    | Cursor position, status | Shows line/column and the last compile state.                  |

The sandbox deliberately has **no** Examples button, copy-source control,
wireframe toggle, model menu or environment menu. Its stage group has no Vertex
document, because the vertex stage is not editable.

## Your first fragment

The default document is an animated ripple. Replace it with this smaller example
to see the contract:

```glsl
#version 300 es
precision highp float;

in vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    // -1..1, corrected so circles stay circular on any canvas shape.
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;

    float radius = length(p);
    float ring = 1.0 - smoothstep(0.50, 0.55, radius);

    vec3 color = mix(vec3(0.04, 0.07, 0.12), vec3(0.15, 0.85, 0.95), ring);
    color *= 0.85 + 0.15 * sin(uTime + radius * 12.0);

    fragColor = vec4(color, 1.0);
}
```

What each part does:

- `vUv` runs from `(0, 0)` at the bottom-left to `(1, 1)` at the top-right.
- `uResolution` is the drawing-buffer size in pixels, so the aspect correction
  keeps the ring circular when the pane is not square.
- `uTime` advances in seconds while the preview is running and stops when you
  pause.
- `fragColor` is the only output. Keep the alpha at `1.0`; the canvas is opaque
  and alpha is not composited against the page.
- `#version 300 es` must be the first line, and the float precision must be
  declared before any float declaration.

Press **Compile**. If the fragment compiles, the preview updates immediately; if
it fails, the previous image stays and the error panel explains why.

## The shader contract

### Inputs

| Name          | Type   | Meaning                                                                 |
| ------------- | ------ | ----------------------------------------------------------------------- |
| `vUv`         | `vec2` | Normalised screen coordinate. `(0, 0)` bottom-left, `(1, 1)` top-right. |
| `uResolution` | `vec2` | Drawing-buffer size in pixels.                                          |
| `uTime`       | `float`| Seconds; frozen while the preview is paused.                            |

Declare each input you use; the engine binds values by name but does not declare
the uniforms for you. The example above declares `vUv`, `uResolution` and
`uTime`.

### Output

```glsl
out vec4 fragColor;
```

A single RGBA output. The canvas is opaque, so alpha is not composited against
the page.

### What you cannot declare

- There is no vertex document, so you cannot add attributes or write custom
  varyings. `vUv` is the only varying.
- `uResolution` and `uTime` are reserved names; user data cannot reuse them.
- `samplerCube` is not available in the sandbox's User data panel, because the
  sandbox has no cube texture source. Use `sampler2D`.
- There are no per-mesh inputs: no normals, tangents, UV sets or vertex colours.

User data is the supported way to add your own uniforms and samplers. See
[User data](/docs/user-data).

## Coordinates and aspect ratio

`vUv` is normalised, so it is independent of the canvas size. Convert it to a
centred coordinate range before doing anything radial:

```glsl
vec2 p = vUv * 2.0 - 1.0;          // -1..1 on both axes
p.x *= uResolution.x / uResolution.y; // correct for non-square panes
```

`uResolution` is measured in **device pixels**, not CSS pixels. The sandbox
caps the device pixel ratio at 2 to keep large panes affordable, so on a
high-density display `uResolution` is twice the CSS size at most.

## Time and pause

`uTime` starts at zero for the session and accumulates only while the preview is
running. **Pause** stops the animation entirely; **Resume** continues from the
same value. This is different from the 3D editor, where the shader clock is
wall-clock and jumps forward after a pause.

A compile made while paused still draws one frame, so you can iterate on a
frozen image.

## User data in the sandbox

The User data panel is the same table as in the 3D editor, with two differences:

- The kinds exclude `samplerCube`.
- The stages are **Frag**, **Post** and **All** only. **Frag** targets the base
  fragment; **Post** targets every effect pass; **All** targets both.

Declarations generated for the base fragment are injected after the
`#version`/precision header. Declarations for post effects are injected into
each effect pass instead.

## Post effects in the sandbox

The sandbox has the same post-effect stack as the 3D editor, and the same ABI.
However, there is no scene geometry behind it, so the geometry inputs are
neutral:

- `gbufferTexture` is a 1×1 texture containing a neutral normal.
- `depthTexture` is a 1×1 texture; `cameraNear` is `0` and `cameraFar` is `1`.
- All camera matrices are identity.

Effects that only use `textureSampler`, `resolution`, `texelSize`, `time` and
your own uniforms work normally. Effects that read normals, depth or camera
matrices have nothing meaningful to read and will look like no-ops. See
[Post effects](/docs/post-effects).

## Limits

- One fragment document and one post-effect stack. No vertex stage, no scene, no
  built-in assets.
- No copy source, no export, no save. Reloading the page resets the document.
- WebGL 2 is required.
- Below 860 px of viewport width the panes stack vertically, and the preview
  keeps its own row.

See [Limits and troubleshooting](/docs/limits-and-troubleshooting).

## Related

- [3D Shader Editor](/docs/3d-editor)
- [User data](/docs/user-data)
- [Post effects](/docs/post-effects)
- [Compiling and errors](/docs/compiling-and-errors)
