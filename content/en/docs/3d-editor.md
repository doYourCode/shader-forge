---
title: 3D Shader Editor
description: Write a vertex and fragment pair for a mesh, compile it, and preview it on a model under an HDR environment.
section: editors
order: 2
draft: false
---

# 3D Shader Editor

The 3D Shader Editor is the surface-material workbench. You write a vertex and
fragment pair, the app supplies the mesh, camera, light and environment inputs,
and Babylon.js renders the result live. It is also labelled **3D GLSL Editor** on
the landing page.

## What it is

You are shading a surface, not building a scene. The model, camera, directional
light and HDR environment are chosen from a fixed catalogue; your shader decides
how the surface responds to them. The two stages are compiled together, so the
fragment stage can only read varyings the vertex stage actually writes.

Use it when you want to:

- build a material from scratch and see it on a real mesh;
- experiment with lighting models, normals, tangents and texture coordinates;
- read an HDR environment for diffuse and specular image-based lighting;
- expose a few parameters as live controls in **User data**;
- stack post effects on top of the shaded scene.

For a fullscreen shader with no geometry, use the [2D Sandbox](/docs/2d-sandbox).
For post-processing an existing scene, open the Screen Space editor; it is this
same screen started on the post-effect document.

## The screen

The screen is split into a document area on the left and a live preview on the
right, with a status bar across the bottom.

| Region        | Control                                   | What it does                                                        |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Left toolbar  | Brand                                     | Returns to the landing page.                                        |
| Left toolbar  | **Shader Stages**                         | Opens the **Vertex** and **Fragment** documents.                    |
| Left toolbar  | **Post effect**                           | Opens the fragment of the selected effect in the post-effect stack. |
| Left toolbar  | **Shader Data**                           | Opens **User data**, **Attributes** and **Uniforms**.               |
| Left toolbar  | **Examples**                              | Opens the bundled example picker.                                   |
| Left pane     | Copy source                               | Copies the active document with the generated user-data block.      |
| Right toolbar | **Compile**                               | Compiles the document family of the active tab.                     |
| Right toolbar | **Cfg** → **Toggle Wireframe**            | Draws the mesh as wireframe.                                        |
| Right toolbar | **Pause** / **Resume**                    | Stops or restarts rendering.                                        |
| Right toolbar | Language switch                           | Switches the interface language.                                    |
| Preview       | **Model**                                 | Switches the mesh.                                                  |
| Preview       | **Environment**                           | Switches the HDR environment.                                       |
| Status bar    | Cursor position and status                | Shows line/column and the last compile state.                       |

The preview also shows a loading overlay while a model or environment is
loading, and an error panel when a compile fails. `Cfg`, `Model`, `Environment`
and `Toggle Wireframe` are currently English-only labels.

## Documents

| Document    | Editable | Holds                                                                 |
| ----------- | -------- | --------------------------------------------------------------------- |
| Vertex      | Yes      | Vertex stage: attributes in, varyings and `gl_Position` out.          |
| Fragment    | Yes      | Fragment stage: varyings and uniforms in, `fragColor` out.            |
| Post effect | Yes      | Fragment of the effect selected in the stack.                         |
| User data   | Table    | Uniforms and textures; the app generates and injects their GLSL.      |
| Attributes  | No       | Built-in reference generated from the material ABI.                   |
| Uniforms    | No       | Built-in reference generated from the material ABI.                   |

The **Attributes** and **Uniforms** documents are read-only. They describe the
names the engine binds; they are not extra code you can edit.

## Workflow

1. Pick a **Model** and an **Environment** if the defaults do not suit the
   material. The environment feeds the image-based lighting samplers.
2. Start from the default pair, or load an **Example**. Loading an example is
   destructive: it replaces both stages and the whole User data document.
3. Edit the **Vertex** and **Fragment** documents. Keep their varyings in sync.
4. Press **Compile**. The first compile happens automatically when the preview
   is ready; after that the button is the trigger.
5. If the compile fails, read the error panel. Click an error to jump to its
   line; the previous image stays on screen.
6. Add **User data** entries for the values you want to tweak without editing
   code. Value changes bind immediately; structural changes rebuild the shader.
7. Add **Post effects** if the surface needs grading, blur or another
   screen-space pass.
8. Use **Copy source** to take the active document away, generated block
   included.

## The shader contract

### Stage pairing

The vertex and fragment stages are compiled as one program. A varying must have
the same name and type in both stages, and attributes are only visible in the
vertex stage. If you replace one stage, check the other one's declarations.

### Attributes

Vertex inputs supplied by the mesh:

| Name       | Type   | Meaning                                      |
| ---------- | ------ | -------------------------------------------- |
| `position` | `vec3` | Vertex position in object/local space.       |
| `normal`   | `vec3` | Vertex normal.                               |
| `tangent`  | `vec3` | Tangent direction, for normal mapping.       |
| `uv`       | `vec2` | Primary texture coordinates.                 |
| `uv2`      | `vec2` | Secondary texture coordinates.               |
| `color`    | `vec4` | Vertex colour (RGBA).                        |

### Uniforms

Values the engine writes every frame:

| Name           | Type   | Meaning                                                       |
| -------------- | ------ | ------------------------------------------------------------- |
| `world`        | `mat4` | Mesh world matrix.                                            |
| `view`         | `mat4` | Camera view matrix.                                           |
| `projection`   | `mat4` | Camera projection matrix.                                     |
| `normalMatrix` | `mat3` | Inverse-transpose world matrix, used for normals.             |
| `time`         | `float`| Seconds on the preview clock.                                 |
| `cameraPos`    | `vec3` | Camera position in world space.                               |
| `lightDir`     | `vec3` | World-space direction of the directional light (see the note below). |

Babylon defines `lightDir` as the direction the light travels. The bundled
examples use it directly as `L` in `dot(N, L)`, which treats it as the direction
toward the light; negate it if you want the physically based convention.

### Samplers

Textures bound by the preview:

| Name                        | Type        | Meaning                                                                 |
| --------------------------- | ----------- | ----------------------------------------------------------------------- |
| `environmentMap`            | `samplerCube` | The active HDR environment cubemap.                                   |
| `irradianceMap`             | `samplerCube` | Cosine-convolved environment, used as diffuse irradiance.             |
| `prefilteredEnvironmentMap` | `samplerCube` | GGX-prefiltered specular cubemap; higher mip levels are rougher.      |
| `brdfLUT`                   | `sampler2D` | Split-sum lookup texture: `R` is bias, `G` is albedo. Sample at `(NdotV, roughness)`, then combine with `F0`. |

The engine binds these names, but each stage must still declare the inputs it
reads: a fragment that uses the light needs `uniform vec3 lightDir;`, and a
vertex stage that uses positions needs `in vec3 position;`.

### Output

The fragment stage writes one colour:

```glsl
layout(location = 0) out vec4 fragColor;
```

Start every stage with `#version 300 es` and declare a float precision, for
example `precision highp float;`.

### Coordinates

Babylon.js uses a **left-handed** coordinate system. The default vertex stage
builds clip space as `projection * view * world * vec4(position, 1.0)`. Normals
are transformed with `normalMatrix`, not with `world`.

### A minimal pair

These two documents form a complete, compilable pair. Use them together: the
varying `vWorldNormal` is written by the vertex stage and read by the fragment
stage.

```glsl
// Vertex
#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix;

out vec3 vWorldNormal;

void main(void)
{
    vec4 worldPosition = world * vec4(position, 1.0);
    vWorldNormal = normalize(normalMatrix * normal);
    gl_Position = projection * view * worldPosition;
}
```

```glsl
// Fragment
#version 300 es
precision highp float;

in vec3 vWorldNormal;

uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(lightDir);
    float ndl = max(dot(N, L), 0.0);
    fragColor = vec4(vec3(ndl), 1.0);
}
```

This pair ignores the environment and the camera position; it is a starting
point, not a replacement for the default material. Like the bundled examples, it
treats `lightDir` as the direction toward the light.

The default pair on first load is richer: it reads the prefiltered environment
and irradiance maps, adds a Fresnel term, and applies an ACES curve. Open both
stages and read them before changing one in isolation.

## Scene and assets

The preview offers five models: **Monkey** (the default), **Sphere**, **Cube**,
**Bunny** and **Dragon**. It offers five prebaked environments: **Wooden Studio
17** (the default), **Peppermint Powerplant**, **Pergola Walkway**, **Qwantani
Sunrise** and **Mossy Forest**.

- Drag on the preview to orbit the camera; use the wheel to zoom. The camera
  distance is clamped.
- The model rotates continuously while rendering. **Pause** stops the render
  loop, so the rotation stops too.
- Switching a model or environment loads asynchronously. A failed load restores
  the previous selection.
- The environment drives `environmentMap`, `irradianceMap` and
  `prefilteredEnvironmentMap`. `brdfLUT` is generated once and is independent of
  the selected environment.

## Examples

**Examples** opens seven bundled materials in two folders:

- **Lighting**: Lambert, Phong, Blinn-Phong, Oren-Nayar, Cook-Torrance.
- **Image-based lighting**: IBL Metalness / Roughness, IBL Specular /
  Glossiness.

Loading an example **replaces** both editable stages and the entire User data
document. It does not merge with your current work. The example's parameters are
seeded into User data, which generates the declarations its source expects; the
example source must not declare them itself.

## Compiling, errors and state

- The first compile runs automatically when the preview is ready.
- **Compile** targets the active document family: material for
  Vertex/Fragment/Attributes/Uniforms, post chain for Post effect.
- Typing does not compile. User-data value changes bind without a compile;
  structural changes recompile after a short debounce.
- A failed compile leaves the last successful image on screen and reports the
  error in the preview panel and the status bar.
- `time` is wall-clock. Pausing stops rendering, but animation jumps forward
  when you resume.

See [Compiling and errors](/docs/compiling-and-errors) for the full behaviour.

## Limits

- The model and environment catalogues are fixed; you cannot upload a GLB or an
  HDR file.
- There is no save, export or sharing. **Copy source** is the only way to take
  code out of the 3D editor.
- One material is active at a time. Examples replace it.
- WebGL 2 is required.

See [Limits and troubleshooting](/docs/limits-and-troubleshooting) for the
complete list.

## Related

- [2D Sandbox](/docs/2d-sandbox)
- [User data](/docs/user-data)
- [Post effects](/docs/post-effects)
- [Compiling and errors](/docs/compiling-and-errors)
- [The rendering pipeline](/knowledge/the-rendering-pipeline)
