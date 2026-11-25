---
title: ABI Reference
description: Every attribute, uniform and sampler the three editors bind, generated from materialAbi.ts, postEffectAbi.ts and screenSpaceAbi.ts.
section: api
order: 0
generated: true
draft: false
---

<!-- GENERATED FILE: run `npm run docs:abi` after changing an ABI declaration. Do not edit by hand. -->

# ABI Reference

This page is the contract between your GLSL and the renderer. Every name below
is declared by the engine before your source is compiled, so declaring it again
in the editor produces a duplicate declaration. The tables are generated from
the same TypeScript declarations the binders use: if a name is not here, the
editor does not provide it.

| Editor | Route | ABI source |
| --- | --- | --- |
| 3D Shader Editor | `/editor` | `src/core/constants/materialAbi.ts` |
| 2D Sandbox | `/sandbox` | `src/core/constants/sandboxAbi.ts` |
| Post effects (3D and sandbox) | Post effect tab | `src/core/constants/postEffectAbi.ts` |
| Screen Space GLSL Editor | `/screen-space` | `src/core/constants/screenSpaceAbi.ts` |

## 3D Shader Editor: surface shader

### Vertex attributes

Attributes are vertex inputs, declared with `in`. They arrive from the mesh, not
from a uniform block.

| Name | GLSL type | Description |
| --- | --- | --- |
| `position` | `vec3` | Vertex position in object/local space; |
| `normal` | `vec3` | Surface normal direction; |
| `tangent` | `vec3` | Tangent direction for normal mapping; |
| `uv` | `vec2` | Primary texture coordinates; |
| `uv2` | `vec2` | Secondary texture coordinates; |
| `color` | `vec4` | Vertex color (RGBA). |

### Uniforms

| Name | GLSL type | Description |
| --- | --- | --- |
| `world` | `mat4` | Mesh world matrix; |
| `view` | `mat4` | Camera view matrix; |
| `projection` | `mat4` | Camera projection matrix; |
| `time` | `float` | Seconds since the animation started; |
| `cameraPos` | `vec3` | Camera position in world space; |
| `lightDir` | `vec3` | Direction vector of the directional light, in world space. |
| `normalMatrix` | `mat3` | Inverse-transpose world matrix, applied to normals. |

### Samplers

| Name | GLSL type | Description |
| --- | --- | --- |
| `environmentMap` | `samplerCube` | Active scene HDRI; |
| `irradianceMap` | `samplerCube` | Diffuse irradiance (cosine-convolved environment cubemap); |
| `prefilteredEnvironmentMap` | `samplerCube` | GGX-prefiltered specular cubemap (higher mip levels = rougher); |
| `brdfLUT` | `sampler2D` | Split-sum LUT (R = bias, G = albedo); sample at (NdotV, roughness), then mix(R, G, F0). |

## Post effects (3D Shader Editor and 2D Sandbox)

Each effect is a fullscreen fragment pass. `textureSampler` is the previous
pass's output; `textureSampler`, `gbufferTexture` and `depthTexture` are the
surface-scene variants. The screen-space editor has its own, richer G-buffer
listed below.

### Uniforms

| Name | GLSL type | Description |
| --- | --- | --- |
| `time` | `float` | Seconds since the preview started. |
| `resolution` | `vec2` | Render-target size in pixels. |
| `texelSize` | `vec2` | 1.0 / resolution, for one-texel screen-space offsets. |
| `cameraNear` | `float` | Camera near clip plane, in world units. |
| `cameraFar` | `float` | Camera far clip plane, in world units. |
| `cameraPosition` | `vec3` | Camera position in world space. |
| `projection` | `mat4` | Camera projection matrix (view space to clip space). |
| `inverseProjection` | `mat4` | Inverse projection, for reconstructing view-space position from depth. |
| `view` | `mat4` | Camera view matrix (world space to view space). |
| `inverseView` | `mat4` | Inverse view matrix (view space to world space). |

### Samplers

| Name | GLSL type | Description |
| --- | --- | --- |
| `textureSampler` | `sampler2D` | Output of the previous pass; linear scene colour for the first effect. |
| `gbufferTexture` | `sampler2D` | View-space normal in rgb, encoded as n * 0.5 + 0.5; a = geometry mask. |
| `depthTexture` | `sampler2D` | Normalised linear view depth in r: 0 = near plane, 1 = far plane and the cleared background. World units: cameraNear + r * (cameraFar - cameraNear). |

The internal display pass additionally owns `toneMappingMode`
and reserves `vUV`, `fragColor` and `gl_FragColor`. Do not redeclare them.

## Screen Space GLSL Editor

Screen-space effects run over the whole HDR scene. They can read the previous
pass, the untouched scene colour and every G-buffer attachment.

### Uniforms

| Name | GLSL type | Description |
| --- | --- | --- |
| `time` | `float` | Seconds since the preview started. |
| `resolution` | `vec2` | Render-target size in pixels. |
| `texelSize` | `vec2` | 1.0 / resolution, for one-texel screen-space offsets. |
| `cameraNear` | `float` | Camera near clip plane, in world units. |
| `cameraFar` | `float` | Camera far clip plane, in world units. |
| `cameraPosition` | `vec3` | Camera position in world space. |
| `projection` | `mat4` | Camera projection matrix (view space to clip space). |
| `inverseProjection` | `mat4` | Inverse projection, for reconstructing view-space position from depth. |
| `view` | `mat4` | Camera view matrix (world space to view space). |
| `inverseView` | `mat4` | Inverse view matrix (view space to world space). |
| `viewProjection` | `mat4` | Combined view * projection matrix (world space to clip space). |
| `inverseViewProjection` | `mat4` | Inverse of viewProjection, for reconstructing world-space position from depth. |
| `previousViewProjection` | `mat4` | Last frame’s viewProjection, used to reproject motion vectors. |
| `frameIndex` | `float` | Monotonic frame counter, useful for temporal noise and jitter. |
| `deltaTime` | `float` | Seconds elapsed since the previous frame. |

### G-buffer samplers

| Name | GLSL type | Description |
| --- | --- | --- |
| `textureSampler` | `sampler2D` | Output of the previous pass; the first pass receives the HDR scene colour. |
| `sceneColorTexture` | `sampler2D` | The original, unmodified HDR scene colour (not the previous pass). |
| `depthTexture` | `sampler2D` | Linear view-space depth in world units (positive distance); background is the far plane. |
| `normalTexture` | `sampler2D` | View-space normal encoded as n * 0.5 + 0.5 in rgb; a = geometry mask (1 on geometry, 0 on background). |
| `albedoTexture` | `sampler2D` | sqrt-encoded linear base colour in rgb (square it to decode); a = geometry mask. |
| `materialTexture` | `sampler2D` | PBR reflectivity: rgb = specular F0, a = glossiness (1 - roughness). Reconstruct metallic from F0 versus albedo. |
| `velocityTexture` | `sampler2D` | Linear UV-space motion vectors in rg; values may be negative. |

### Display-only names

The internal display pass adds these names on top of the public ABI. They are
visible in the compiled display shader, never in your effect source, and are
reserved so user data cannot collide with them.

| Name | GLSL type | Description |
| --- | --- | --- |
| `toneMappingMode` | `float` | Output transform selected in the effect stack: 0 = linear to sRGB, 1 = Reinhard, 2 = ACES. |
| `debugMode` | `float` | G-buffer debug view selector. 0 = final image; the values are declared in screenSpaceDebug.ts. |

| Name | GLSL type | Description |
| --- | --- | --- |
| `transparentTexture` | `sampler2D` | Transparent/transmissive overlay colour. Present only when TRANSPARENT_OVERLAY_ENABLED is true; otherwise those surfaces render in the main pass. |

The display pass also reserves `vUV`, `fragColor` and `gl_FragColor`.

## 2D Sandbox

The sandbox has no editable vertex stage. An internal fullscreen triangle
provides `vUv`, and the engine provides the resolution and time uniforms.

| Name | Declaration | Description |
| --- | --- | --- |
| `vUv` | `in vec2` | Normalised screen coordinate from the internal fullscreen triangle; xy in [0, 1]. |
| `uResolution` | `uniform vec2` | Drawing-buffer size in pixels (already multiplied by the capped device pixel ratio). |
| `uTime` | `uniform float` | Seconds since the preview started; frozen while paused. |

The sandbox also reserves every post-effect name, because the same User data
table can target both the base fragment and the post-effect chain.

## Derived helper names

The default screen-space effect declares helper functions on top of the
samplers above. They are not engine uniforms, but they document the encoding
the G-buffer uses:

| Helper | Returns |
| --- | --- |
| `gbufferAlbedo(uv)` | Linear albedo (the attachment is sqrt-encoded). |
| `gbufferRoughness(uv)` | `1.0 - materialTexture.a`. |
| `gbufferMetallic(uv)` | Metallic reconstructed from F0 and albedo. |
| `gbufferViewPosition(uv)` | View-space position reconstructed from depth and the inverse projection. |

## Related

- [Screen Space GLSL Editor](/docs/screen-space-editor)
- [Post effects](/docs/post-effects)
- [User data](/docs/user-data)
- [GLSL ES 3.00](/docs/gles-3-0-webgl2)
- [Debugging shaders](/docs/debugging-shaders)
- [Cheat sheet](/docs/cheat-sheet)

## Regenerating this page

```bash
npm run docs:abi
```

`predev`, `prebuild` and `pretest` run the same command, so the page is rebuilt
before the app, the production bundle and the test suite. The drift test
`src/core/content/abiReference.test.ts` compares the committed file with this
builder and fails if they diverge.
