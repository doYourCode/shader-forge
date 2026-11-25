---
title: User data
description: Declare uniforms and textures in a table. ShaderForge generates the GLSL, injects it at compile time, and binds the values live.
section: reference
order: 20
draft: false
---

# User data

**User data** is the structured way to add your own uniforms and textures
without editing declarations into the shader. You fill a table; ShaderForge
generates the GLSL, injects it at compile time, and binds the current values
every frame.

## What it is

The panel has one row per definition. Each row has a name, a kind, one or more
target stages and a value control. The generated declarations are shown in the
editor as a read-only block, and the same block is inserted into the source that
is actually compiled.

The editor buffer is never rewritten. The generated block is a preview widget,
not document text, so line numbers and diagnostics keep matching what you wrote.

## How the generated block works

The app inserts the block after the leading header run of a stage: after
`#version`, `precision` and `#extension`, tolerating blank lines and comments in
between. Nothing else moves.

For a `float` named `speed` with value `1.5`, the block is:

```glsl
// >>> ShaderForge user data (managed block — edit it in the User data tab)
uniform float speed; // float
// current values: speed = 1.5
// <<< end ShaderForge user data >>>
```

The block never contains initializers; the values live in the table and are
bound through uniforms. Do not retype the block, and do not declare the same
name yourself: that would produce a duplicate declaration when the block is
injected.

In the 3D editor, **Copy source** copies the active document with the block
included. The sandbox has no copy control.

## Kinds

| Kind shown in the table | Generated GLSL | Control      | Notes                                                        |
| ----------------------- | -------------- | ------------ | ------------------------------------------------------------ |
| Float                   | `float`        | Number       |                                                              |
| Vec2                    | `vec2`         | Two numbers  |                                                              |
| Vec3                    | `vec3`         | Three numbers|                                                              |
| Vec4                    | `vec4`         | Four numbers |                                                              |
| Color                   | `vec3`         | Colour picker| RGB, no alpha                                                |
| Color (RGBA)            | `vec4`         | Colour picker| RGBA                                                         |
| Direction               | `vec3`         | Three numbers| Normalised when bound; a zero vector binds as `(0, 0, 0)`    |
| Position                | `vec3`         | Three numbers| Documented as object-space; the app passes the value through |
| Texture 2D              | `sampler2D`    | Texture picker | 3D and sandbox                                            |
| Cube texture            | `samplerCube`  | Texture picker | 3D only                                                    |

There are no matrix, array or struct kinds. For a matrix, build it in the shader
from vectors, or use the engine matrices directly.

## Stages

The stage decides which generated block receives the declaration. The labels in
the table are the ones the panel shows.

| Stage shown | 3D Shader Editor         | 2D Sandbox                |
| ----------- | ------------------------ | ------------------------- |
| Frag        | Fragment stage           | Base fragment             |
| Vert        | Vertex stage             | Not offered               |
| All         | Vertex **and** fragment  | Base fragment **and** post effects |
| Post        | Post-effect passes       | Post-effect passes        |

Two details matter:

- In the 3D editor, **All** means "both material stages". It does **not**
  include post effects. To reach the vertex stage, the fragment stage and post
  effects, add two definitions with different names: one **All** and one
  **Post**.
- In the sandbox, **All** includes the base fragment and every post pass,
  because the sandbox has no vertex stage.

Declarations targeting a stage that the shader does not use are harmless but
invisible; if a uniform seems to do nothing, check its stage first.

## Value edits vs structural edits

| Edit                                             | Effect                                                    |
| ------------------------------------------------ | --------------------------------------------------------- |
| Changing a value (number, vector, colour, texture) | Binds live. No recompile. Textures load asynchronously.  |
| Adding or removing a definition                  | Recompiles after a short debounce (about 300 ms).         |
| Renaming a definition                            | Recompiles.                                               |
| Changing the kind                                | Recompiles; the value resets to the new kind's default.   |
| Changing the stage                               | Recompiles.                                               |

Because value edits do not recompile, you can animate or tune a parameter while
the preview keeps running. Structural edits must rebuild the program because the
declarations themselves change.

Loading an example replaces the whole document, so any definitions you added are
discarded.

## Names

A name must be a valid GLSL identifier: letters, digits and underscores, not
starting with a digit. It must also be unique and must not collide with a name
the engine owns:

- GLSL reserved words.
- Material attributes, uniforms and samplers (`position`, `world`,
  `normalMatrix`, `environmentMap`, ...).
- Post-effect names (`textureSampler`, `gbufferTexture`, `depthTexture`,
  `resolution`, `texelSize`, `cameraNear`, `cameraFar`, `cameraPosition`,
  `projection`, `inverseProjection`, `view`, `inverseView`, `time`, `vUV`,
  `fragColor`, ...).
- Sandbox names (`uResolution`, `uTime`, `vUv`).
- Any other definition in the same table.

The panel rejects a bad name before it reaches the compiler, with a message for
an invalid identifier, a reserved name or a duplicate.

## Textures

Texture kinds use a texture picker with three sources:

- **Repository texture**: the bundled checkers, **UV Checker 01** and **UV
  Checker 02**.
- **Custom URL…**: any image URL the browser can load.
- **Upload image**: a local file, kept in memory for the session.

A `sampler2D` reads a 2D image. A `samplerCube` reads a cube map and is only
offered in the 3D editor. Choose a source that matches the declaration: a cube
sampler cannot read a 2D checker, and a 2D sampler cannot read a cube map.

Textures load asynchronously and the preview redraws when one is ready. A
definition without a source has nothing to bind, and a texture that has not
finished loading is not bound yet; do not judge the shader until the texture
appears.

## Recipes

### A colour control

1. Add a definition named `tint`, kind **Color**, stage **Frag**.
2. In the fragment stage, use it:

```glsl
vec3 shaded = baseColor * tint;
fragColor = vec4(shaded, 1.0);
```

`tint` is declared by the generated block, so the fragment must not declare it.
`baseColor` stands for whatever surface colour your shader already computes.

### An animated parameter

1. Add `speed`, kind **Float**, stage **Frag**, value `2.0`.
2. Use it with the engine clock:

```glsl
float pulse = 0.5 + 0.5 * sin(uTime * speed);
```

`uTime` is a sandbox input, so the fragment must declare `uniform float uTime;`
(the default sandbox fragment already does). For the 3D editor, use `time`
instead, and declare `uniform float time;` in the fragment (the default 3D
fragment already does):

```glsl
float pulse = 0.5 + 0.5 * sin(time * speed);
```

### A texture sample

1. Add `albedoMap`, kind **Texture 2D**, stage **Frag**.
2. Sample it with the stage's UV input. The 3D fragment stage receives the
   varyings your vertex stage declares; the default pair calls the primary UV
   `vUv`. The sandbox has `vUv` built in. Declare the varying in the stage that
   reads it:

```glsl
in vec2 vUv;
vec3 albedo = texture(albedoMap, vUv).rgb;
```

## Troubleshooting

| Symptom                                      | Likely cause                                                        | Fix                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| "Redefinition" or duplicate declaration      | The name is declared in the shader as well as in User data          | Remove the manual declaration; keep the table row                   |
| Uniform has no effect                        | Wrong stage, or the shader never reads it                           | Check the stage column; in 3D use **Post** for post effects         |
| Post effect cannot see a uniform             | The definition is **All**, which excludes post effects in 3D        | Add a **Post** definition (with a different name)                   |
| Texture samples black                        | No source, still loading, or the wrong sampler kind                 | Choose a source; use **Texture 2D** for a 2D image                  |
| Name is rejected                             | Invalid identifier, reserved word or duplicate                       | Rename it; avoid engine-owned names                                 |
| Value changes disappeared after loading an example | Examples replace the entire User data document                | Re-add the definition, or copy the value before loading             |

## Related

- [3D Shader Editor](/docs/3d-editor)
- [2D Sandbox](/docs/2d-sandbox)
- [Post effects](/docs/post-effects)
- [Compiling and errors](/docs/compiling-and-errors)
