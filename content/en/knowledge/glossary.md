---
title: Glossary
description: Short definitions of the graphics and GLSL terms used across the lessons, with pointer links to the page that covers each one.
section: reference
order: 1
difficulty: beginner
draft: false
---

# Glossary

Terms are defined where they are used, but this page is the quick lookup. In
lesson prose, a term wrapped as `[[albedo|the base colour of a surface]]`
renders as a hoverable definition:

> The [[albedo|the diffuse base colour of a surface, before lighting]] is
> multiplied by the cosine term.

The definition is authored inline, so it stays editable in Pages CMS.

## A–F

| Term | Definition | Where |
| --- | --- | --- |
| **Albedo** | The diffuse base colour of a surface, before lighting. Linear in the shader. | [Textures and data](/knowledge/textures-and-data) |
| **Attribute** | Per-vertex input supplied by the mesh, declared with `in` in the vertex stage. | [ABI Reference](/docs/abi-reference) |
| **BRDF** | Bidirectional reflectance distribution function: how a surface reflects light between two directions. | [Cook-Torrance](/knowledge/lighting-cook-torrance) |
| **Clip space** | Homogeneous coordinates produced by `projection * view * world`; the GPU divides by `w`. | [Math for shaders](/knowledge/math-for-shaders) |
| **Cook-Torrance** | A microfacet BRDF built from a distribution, a geometry term and Fresnel. | [Cook-Torrance](/knowledge/lighting-cook-torrance) |
| **F0** | Fresnel reflectance at normal incidence. `0.04` for most dielectrics; the base colour for metals. | [Cook-Torrance](/knowledge/lighting-cook-torrance) |
| **Fragment** | A candidate pixel produced by rasterisation; the fragment shader runs once per covered fragment. | [Rendering pipeline](/knowledge/the-rendering-pipeline) |
| **Fresnel** | The tendency of a surface to reflect more light at grazing angles. | [Cook-Torrance](/knowledge/lighting-cook-torrance) |
| **fBm** | Fractal Brownian motion: several octaves of noise added with decreasing amplitude. | [Noise and SDFs](/knowledge/patterns-noise-sdf) |

## G–N

| Term | Definition | Where |
| --- | --- | --- |
| **G-buffer** | A set of render targets holding scene data (depth, normal, albedo, material, velocity) for later passes. | [Post-processing](/knowledge/post-processing) |
| **GGX** | A microfacet normal distribution with a long, realistic highlight tail. | [Cook-Torrance](/knowledge/lighting-cook-torrance) |
| **HDR** | High dynamic range: linear values allowed to exceed `1.0` until the display transform. | [Colour and linear space](/knowledge/color-and-linear) |
| **HDRI** | A high-dynamic-range image, usually an equirectangular environment used as a cubemap. | [IBL](/knowledge/lighting-ibl) |
| **IBL** | Image-based lighting: using an environment map as the light source. | [IBL](/knowledge/lighting-ibl) |
| **Lambert** | The cosine-law diffuse model, `albedo * max(dot(N, L), 0)`. | [Lambert](/knowledge/lighting-lambert) |
| **Linear space** | Values proportional to physical light; the space in which lighting maths is correct. | [Colour and linear space](/knowledge/color-and-linear) |
| **Metallic** | A mask where `1` means the surface is a metal (no diffuse, tinted F0). | [IBL](/knowledge/lighting-ibl) |
| **NDC** | Normalised device coordinates: `x`/`y` in `[-1, 1]` after the perspective divide. | [Math for shaders](/knowledge/math-for-shaders) |
| **Normal matrix** | The inverse-transpose of the world matrix, used to transform normals. | [Math for shaders](/knowledge/math-for-shaders) |

## O–S

| Term | Definition | Where |
| --- | --- | --- |
| **Oren-Nayar** | A rough-diffuse model with a view-dependent retro-reflection term. | [Oren-Nayar](/knowledge/lighting-oren-nayar) |
| **Overdraw** | Shading the same pixel more than once, usually from fullscreen or transparent layers. | [Performance](/knowledge/how-the-gpu-executes-shaders) |
| **Phong** | A specular model comparing the reflected light direction with the view direction. | [Phong](/knowledge/lighting-phong) |
| **Roughness** | A perceptual 0–1 parameter; GGX squares it to get the distribution's `alpha`. | [Cook-Torrance](/knowledge/lighting-cook-torrance) |
| **sRGB** | The perceptual encoding used by images and the canvas. Decode to linear before maths. | [Colour and linear space](/knowledge/color-and-linear) |
| **SDF** | Signed distance field: a function returning the signed distance to a shape. | [Noise and SDFs](/knowledge/patterns-noise-sdf) |
| **Specular** | The mirror-like part of a reflection, concentrated around the reflection direction. | [Phong](/knowledge/lighting-phong) |
| **Split-sum** | The approximation that makes IBL real time: prefiltered radiance times a BRDF LUT. | [IBL](/knowledge/lighting-ibl) |

## T–Z

| Term | Definition | Where |
| --- | --- | --- |
| **Tangent space** | A coordinate frame on the surface, used to store normal maps. | [Textures and data](/knowledge/textures-and-data) |
| **Texel** | A texture element; the texture equivalent of a pixel. | [Textures and data](/knowledge/textures-and-data) |
| **Tone mapping** | A curve mapping unbounded HDR colour into the displayable range. | [Colour and linear space](/knowledge/color-and-linear) |
| **UV** | Normalised texture coordinates, usually in `[0, 1]`. | [First shaders](/knowledge/first-shaders) |
| **Varying** | The old GLSL ES 1.00 name for a value interpolated between stages; now `out`/`in`. | [GLSL ES 3.00](/knowledge/gles-3-0-webgl2) |
| **View space** | Camera-relative coordinates; depth and normals in the screen-space G-buffer are view space. | [The Screen Space editor](/docs/screen-space-editor) |
| **World space** | The shared scene coordinate system in which the light direction is defined. | [Math for shaders](/knowledge/math-for-shaders) |

## Related

- [Learning path](/docs/learning-path)
- [GLSL ES 3.00](/knowledge/gles-3-0-webgl2)
- [Cheat sheet](/docs/cheat-sheet)
