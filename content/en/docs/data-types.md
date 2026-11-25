---
title: Types and Swizzling
description: Scalars, vectors, matrices and samplers in GLSL ES 3.00, with the swizzle rules, constructors and a few type traps.
section: fundamentals
order: 50
difficulty: beginner
prerequisites: gles-3-0-webgl2
draft: false
---

# Types and Swizzling

## Goal

Read and write GLSL declarations with confidence: know which type an expression
has, how to build a `vec4` from smaller pieces, and how to read or reorder
components with swizzles.

## Scalar types

| Type | Meaning | Literal examples |
| --- | --- | --- |
| `float` | 32-bit floating point (highp) | `1.0`, `0.5`, `3.14159` |
| `int` | 32-bit signed integer | `0`, `42`, `-3` |
| `uint` | 32-bit unsigned integer | `0u`, `7u` |
| `bool` | Boolean | `true`, `false` |

Integer literals are not floats. `1 / 2` is integer division and evaluates to
`0`; write `1.0 / 2.0` when you mean `0.5`.

## Vectors and matrices

| Type | Components | Typical use |
| --- | --- | --- |
| `vec2` | 2 floats | UVs, screen-space offsets |
| `vec3` | 3 floats | positions, normals, RGB |
| `vec4` | 4 floats | homogeneous positions, RGBA |
| `ivec2` / `uvec3` | integer vectors | texture sizes, bit tricks |
| `bvec2` | booleans | comparison results |
| `mat2` / `mat3` / `mat4` | 2×2, 3×3, 4×4 floats | rotations, transforms |
| `sampler2D` / `samplerCube` | opaque handles | textures |

A `mat3` has three columns, each a `vec3`. `m[0]` is the first column, not the
first row. This column-major layout matters when you build a matrix by hand.

## Constructors

Constructors are named after the type. You can build a larger vector from
smaller ones, and you can repeat a scalar:

```glsl
vec3 rgb = vec3(0.2, 0.4, 0.8);
vec4 rgba = vec4(rgb, 1.0);          // append alpha
vec3 grey = vec3(0.5);               // (0.5, 0.5, 0.5)
vec2 uv = vec2(0.5, 0.25);
vec2 doubled = uv * 2.0;             // component-wise multiply
mat3 identity = mat3(1.0);           // diagonal 1, off-diagonal 0
mat3 rot = mat3(cos(a), -sin(a), 0.0,
                sin(a),  cos(a), 0.0,
                0.0,     0.0,    1.0);
```

There is no implicit conversion from `int` to `float`. `float x = 1;` fails;
write `float x = 1.0;`. Use `float(i)` to convert explicitly.

## Swizzling

Swizzles read components by name and can reorder or repeat them:

```glsl
vec3 colour = vec3(0.1, 0.2, 0.3);
vec2 rg = colour.rg;        // (0.1, 0.2)
vec3 bgr = colour.bgr;      // (0.3, 0.2, 0.1)
vec4 rgba = colour.rgba;    // error: a is missing from a vec3
vec3 red = colour.rrr;      // (0.1, 0.1, 0.1)
vec4 extended = vec4(colour.rgb, 1.0);
```

Component sets:

- `x, y, z, w` — positions.
- `r, g, b, a` — colours.
- `s, t, p, q` — texture coordinates.

You may mix sets (`colour.rg` and `colour.xy` are the same), but not in one
swizzle (`colour.xg` is illegal). Assignment works too:

```glsl
vec4 rgba = vec4(0.0);
rgba.rgb = colour;
rgba.a = 1.0;
```

A swizzle is not a pointer. `colour.rg = vec2(1.0)` is allowed because the
left-hand side is an lvalue; passing `colour.rg` to a function passes a copy.

## Precision

Fragment shaders need a default precision for floats. The first lines of every
shader in this app are:

```glsl
#version 300 es
precision highp float;
```

`highp` gives 32-bit floats on desktop WebGL 2. `mediump` is cheaper on some
mobile GPUs but can show banding and precision artefacts in large coordinates.
Use `highp` unless you have a measured reason not to.

## Samplers are not colours

A `sampler2D` is a handle to a texture unit, not the texture data. You sample it
with `texture(sampler, uv)`, which returns a `vec4`:

```glsl
vec4 texel = texture(albedoTexture, vUV);
vec3 rgb = texel.rgb;
float alpha = texel.a;
```

You cannot do arithmetic on the sampler itself. You can pass it to a function
(without `in`/`out`), and you can index a `sampler2DArray` with an integer.

## Minimal example: swizzle a colour

```glsl run=sandbox title="Swizzles"
#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    vec3 base = vec3(vUv.x, vUv.y, 0.5);
    vec3 reordered = base.bgr;
    vec3 repeated = base.rrr;

    vec3 colour = mix(reordered, repeated, 0.5 + 0.5 * sin(uTime));
    fragColor = vec4(colour, 1.0);
}
```

## Exercises

1. Build a `vec4` named `tint` from `vUv` so that red follows `vUv.y` and green
   follows `vUv.x`.
2. Predict the output of `vec3(1.0, 2.0, 3.0).zyx` before running it.
3. Fix the declaration `float scale = 2;` without changing the `2` literal.
4. Why does `colour.xg` fail when `colour.rg` works?

::: solution Solution 1
`vec4 tint = vec4(vUv.yx, 0.0, 1.0);` (or `vec4(vUv.y, vUv.x, 0.0, 1.0)`).
:::

::: solution Solution 2
`(3.0, 2.0, 1.0)`; a swizzle selects components in the order you write them.
:::

::: solution Solution 3
`float scale = float(2);` or `float scale = 2.0;`.
:::

::: solution Solution 4
`x` and `r` belong to different naming sets. A single swizzle may use one set,
not a mixture of both.
:::

## Common mistakes

- Using `1 / 2` and expecting `0.5`.
- Forgetting the `.0` on float literals.
- Assuming `mat[0]` is a row.
- Using a swizzle as if it were a reference to the original vector.
- Declaring a `sampler2D` without a binding and expecting it to sample.

## Next

- [Built-in functions](/docs/built-in-functions)
- [GLSL ES 3.00](/docs/gles-3-0-webgl2)
- [Cheat sheet](/docs/cheat-sheet)
