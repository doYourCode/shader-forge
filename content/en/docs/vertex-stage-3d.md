---
title: The 3D Vertex Stage
description: The MVP chain, normalMatrix, varyings and vertex displacement. How a mesh becomes clip-space triangles and how to move it safely.
section: lessons
order: 3
difficulty: intermediate
prerequisites: math-for-shaders, first-shaders
editor: editor
example: displacement
draft: false
---

# The 3D Vertex Stage

## Goal

Write a vertex stage that transforms positions and normals correctly, forwards
interpolated values to the fragment shader, and displaces geometry along its
normal without breaking the lighting.

## The MVP chain

Every 3D vertex shader ends with a clip-space position:

```glsl
gl_Position = projection * view * world * vec4(position, 1.0);
```

Read right to left:

1. `world` moves the mesh from object space into world space.
2. `view` moves the world into camera-relative view space.
3. `projection` produces clip space.

The GPU divides by `w` and rasterises. You never do that division yourself.

```mermaid
flowchart LR
  P[position: object] -->|world| W[world position]
  W -->|view| V[view position]
  V -->|projection| C[clip]
  C -->|divide by w| N[NDC]
```

## Normals need the normal matrix

A normal is a direction. If the mesh is scaled non-uniformly, multiplying it by
`mat3(world)` gives the wrong direction. The normal matrix is the
inverse-transpose of the world matrix:

```glsl
vWorldNormal = normalize(normalMatrix * normal);
```

The preview binds `normalMatrix` as a `mat3`. If you only rotate and uniformly
scale, `mat3(world)` happens to work, which is why the mistake often goes
unnoticed until a stretched mesh appears.

## Varyings

An `out` in the vertex stage becomes an `in` in the fragment stage with the same
name and type:

```glsl
// vertex
out vec3 vWorldPosition;
out vec3 vWorldNormal;

// fragment
in vec3 vWorldPosition;
in vec3 vWorldNormal;
```

Varyings are interpolated across the triangle with perspective correction. That
is why they are usually world-space positions and normals, not clip-space
values.

## Displacement

Displacing a vertex means changing `position` before the MVP transform. Move it
along the normal, not along an arbitrary axis, so the surface expands outward:

```glsl
float wave = sin(position.x * 4.0 + time * 2.0) * cos(position.z * 4.0);
vec3 displaced = position + normal * wave * amplitude;

vec4 worldPosition = world * vec4(displaced, 1.0);
gl_Position = projection * view * worldPosition;
```

`amplitude` is a vertex-stage user uniform in the example. `time` is ABI-provided.

The hard part is the normal. The true displaced normal depends on how the wave
changes across neighbouring vertices. The example keeps the original normal and
notes the approximation; a production shader would either recompute it from
partial derivatives (`dFdx`/`dFdy` of the world position in the fragment stage)
or use a lower-frequency displacement that does not need an exact normal.

## A complete pair

```glsl example=displacement title="Vertex displacement (open the example for the full pair)"
#version 300 es
precision highp float;

// Vertex stage
in vec3 position;
in vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix;
uniform float time;
uniform float amplitude;

out vec3 vWorldPosition;
out vec3 vWorldNormal;
out float vHeight;

void main(void)
{
    float wave = sin(position.x * 4.0 + time * 2.0) * cos(position.z * 4.0);
    vec3 displaced = position + normal * wave * amplitude;

    vec4 worldPosition = world * vec4(displaced, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(normalMatrix * normal);
    vHeight = wave;

    gl_Position = projection * view * worldPosition;
}

// Fragment stage
// in vec3 vWorldPosition;
// in vec3 vWorldNormal;
// in float vHeight;
// uniform vec3 lightDir;
// void main(void) { ... }
```

## Expected result

![Displacement: a monkey whose surface waves along its normals](/images/content/lessons/displacement.png)

The crests are lighter and the troughs darker because the fragment stage mixes
between two albedo tints using `vHeight`.

## Exercises

1. Change the wave to depend only on `position.y` and describe the direction the
   surface moves.
2. Set `amplitude` to `0.0` from the User data tab. Which stage still runs, and
   what does the mesh look like?
3. Forward `vHeight` to the fragment shader and use it to tint the crests. The
   example already does this; change the tint colours.
4. Replace `normalMatrix * normal` with `mat3(world) * normal` and scale the
   mesh non-uniformly. What happens to the lighting?
5. Add `vUv` to the vertex outputs and pass it through to the fragment.

::: solution Solution 1
The wave becomes a function of height, so the surface compresses and expands
vertically. The displacement is still applied along each vertex normal, not
along world up, so the result follows the surface orientation.
:::

::: solution Solution 2
The fragment stage still runs; the vertex positions are unchanged, so the mesh
looks like the original sphere/monkey and the lighting is the undisplaced one.
:::

::: solution Solution 3
`vec3 base = mix(albedo * 0.35, albedo, smoothstep(-1.0, 1.0, vHeight));` — swap
the two colours or add a third `mix` with a highlight colour.
:::

::: solution Solution 4
The normals are transformed by the wrong matrix, so a stretched mesh lights as if
it were unstretched. On a uniform scale the error is only a scale factor, which
`normalize` hides; that is why the bug is easy to miss.
:::

::: solution Solution 5
Add `in vec2 uv;`, `out vec2 vUv;`, then `vUv = uv;` in the vertex stage. In the
fragment, `in vec2 vUv;` and use it.
:::

## Common mistakes

- Forgetting `vec4(position, 1.0)`; the `w` component must be `1` for a position.
- Transforming a normal by `world` instead of `normalMatrix`.
- Mismatched varying names or types between stages.
- Forgetting to normalise the interpolated normal in the fragment shader.
- Writing a displacement into `gl_Position` directly, bypassing the camera.

## Next

- [Lighting: Lambert](/docs/lighting-lambert)
- [Textures and data](/docs/textures-and-data)
- [The 3D Shader Editor reference](/docs/3d-editor)
