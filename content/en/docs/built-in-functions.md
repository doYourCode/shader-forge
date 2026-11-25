---
title: Built-in Functions
description: The GLSL ES 3.00 functions you will use most, with argument ranges, common idioms and the differences from GLSL ES 1.00.
section: glsl
order: 2
difficulty: beginner
prerequisites: data-types
draft: false
---

# Built-in Functions

## Goal

Know which built-in to reach for, what its arguments mean, and which ones are
easy to misuse. This page is a tour; the [cheat sheet](/docs/cheat-sheet) is the
printable list.

## Trigonometry and interpolation

| Function | Result | Notes |
| --- | --- | --- |
| `sin(x)`, `cos(x)` | sine/cosine in radians | `sin` is periodic; animate with `time` |
| `atan(y, x)` | angle in radians | two-argument form preserves the quadrant |
| `radians(deg)` | degrees to radians | use it for readability |
| `mix(a, b, t)` | `a * (1 - t) + b * t` | `t` is not clamped |
| `step(edge, x)` | `0` if `x < edge`, else `1` | hard edge |
| `smoothstep(e0, e1, x)` | smooth `0..1` ramp | undefined if `e0 >= e1` |
| `clamp(x, lo, hi)` | clamped value | very common after lighting |
| `saturate(x)` | **not** GLSL | use `clamp(x, 0.0, 1.0)` |

`mix` with a `bool` third argument selects one of two values (GLSL ES 3.00):

```glsl
vec3 color = mix(colorA, colorB, useB);
```

## Powers, exponentials and roots

| Function | Result |
| --- | --- |
| `pow(x, y)` | `x` to the power `y`; undefined for negative `x` |
| `exp(x)` / `log(x)` | natural exponential / logarithm |
| `sqrt(x)` / `inversesqrt(x)` | square root / `1 / sqrt(x)` |
| `abs(x)` / `sign(x)` | absolute value / sign |
| `floor(x)` / `ceil(x)` | round down / up |
| `fract(x)` | `x - floor(x)`, the fractional part |
| `mod(x, y)` | remainder, `x - y * floor(x / y)` |

`fract` and `floor` are the basis of tiling:

```glsl
vec2 cell = floor(uv * 8.0);
vec2 local = fract(uv * 8.0);
```

## Geometry

| Function | Meaning |
| --- | --- |
| `dot(a, b)` | scalar projection; cosine for unit vectors |
| `cross(a, b)` | perpendicular vector (3D only) |
| `normalize(v)` | unit vector |
| `length(v)` | Euclidean length |
| `distance(a, b)` | `length(a - b)` |
| `reflect(i, n)` | reflection of incident `i` around normal `n` |
| `refract(i, n, eta)` | refraction; returns zero on total internal reflection |
| `faceforward(n, i, nref)` | flips `n` when it faces away |
| `transpose(m)` / `inverse(m)` | matrix operations |

For a view direction `V` and a surface normal `N`, the reflected direction is:

```glsl
vec3 R = reflect(-V, N);
```

The incoming direction must point *towards* the surface, hence `-V`.

## Vector and component helpers

| Function | Example |
| --- | --- |
| `min(a, b)` / `max(a, b)` | component-wise |
| `clamp(v, lo, hi)` | vector or scalar |
| `mix` | component-wise with a scalar or vector `t` |
| `step` / `smoothstep` | component-wise |
| `any(bvec)` / `all(bvec)` | boolean reductions |
| `equal(a, b)` / `lessThan(a, b)` | component-wise booleans |
| `vec2`, `vec3`, `vec4` | constructors |

## Texture sampling

| Function | Use |
| --- | --- |
| `texture(sampler2D, vec2)` | 2D texture, with implicit derivatives |
| `texture(samplerCube, vec3)` | cubemap, direction is the lookup |
| `textureLod(sampler, coord, lod)` | explicit mip level |
| `textureGrad` | explicit derivatives |
| `texelFetch` | integer coordinates, no filtering |

`texture` is the GLSL ES 3.00 name. The ES 1.00 `texture2D`/`textureCube` names
are removed; the diagnostics panel reports that mistake with a dedicated hint.

## From GLSL ES 1.00

If you have written WebGL 1 shaders, these are the changes you will hit first:

| GLSL ES 1.00 | GLSL ES 3.00 |
| --- | --- |
| `attribute` | `in` in the vertex shader |
| `varying` | `out` in the vertex shader, `in` in the fragment shader |
| `gl_FragColor` | `layout(location = 0) out vec4 fragColor;` |
| `texture2D(s, uv)` | `texture(s, uv)` |
| `textureCube(s, dir)` | `texture(s, dir)` |
| `#version 100` | `#version 300 es` |

The editor accepts GLSL ES 1.00 snippets in the diagnostics code path, but the
preview compiles GLSL ES 3.00. If a snippet uses the old names, read the error
panel's advice rather than guessing.

## Minimal example: shaping a wave

```glsl run=sandbox title="Wave shaping"
#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float radius = length(p);
    float wave = sin(radius * 18.0 - uTime * 3.0);

    // smoothstep turns the wave into a soft ring.
    float ring = smoothstep(0.85, 1.0, wave);
    vec3 color = mix(vec3(0.03, 0.05, 0.1), vec3(0.95, 0.75, 0.35), ring);

    fragColor = vec4(color, 1.0);
}
```

## Exercises

1. Replace `smoothstep(0.85, 1.0, wave)` with `step(0.0, wave)` and describe
   the edge quality.
2. Use `fract(radius * 8.0)` to draw concentric rings. What does multiplying by
   `8.0` control?
3. Build a colour with `mix` in linear space, then apply `pow(colour, vec3(1.0 / 2.2))`.
   Does the sandbox look correct or washed out?
4. Why does `reflect(V, N)` look wrong when `V` points from the surface to the
   camera?

::: solution Solution 1
`step` produces a hard, aliased edge. `smoothstep` interpolates over an
interval, so the ring has a soft width you control.
:::

::: solution Solution 2
The multiplier sets the number of rings across the radius range: larger values
produce more, thinner rings.
:::

::: solution Solution 3
The sandbox already writes the final image; adding an sRGB encode is a second
encode, so it looks washed out. Use the Screen Space editor's output transform to
compare properly.
:::

::: solution Solution 4
`reflect` expects the incident direction pointing *towards* the surface, so you
pass `-V` when `V` points from the surface to the camera.
:::

## Common mistakes

- Calling `pow` on a negative base.
- Using `smoothstep` with `edge0 >= edge1`; the result is undefined.
- Forgetting that `mix` does not clamp the factor.
- Using `texture2D` in a `#version 300 es` shader.
- Sampling a cubemap with a `vec2`.

## Next

- [Cheat sheet](/docs/cheat-sheet)
- [First shaders in the sandbox](/docs/first-shaders)
- [Textures and data](/docs/textures-and-data)
