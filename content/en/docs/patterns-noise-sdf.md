---
title: Patterns, Noise and SDFs
description: Tiling, hash-based value noise and signed distance fields - the three procedural building blocks behind most 2D shader art.
section: tutorials
order: 20
difficulty: beginner
prerequisites: first-shaders
editor: sandbox
example: noise
draft: false
---

# Patterns, Noise and SDFs

## Goal

Build repeating patterns with `fract` and `floor`, generate reproducible
pseudo-random noise with a hash, layer it into fBm, and draw antialiased shapes
with signed distance fields (SDFs).

## Tiling and cell coordinates

Two functions do most of the work:

- `floor(uv * scale)` gives the integer index of the cell.
- `fract(uv * scale)` gives the position inside that cell, in `[0, 1)`.

```glsl
vec2 uv = vUv * 8.0;
vec2 cell = floor(uv);
vec2 local = fract(uv);
```

The pattern can then depend on `cell` (a checker, a random per-cell value) and
on `local` (a shape inside the cell). This is the same idea as a texture atlas,
except the pattern is generated.

## Hash: cheap randomness

GLSL has no `random()`. A hash maps a number to a different-looking number
deterministically:

```glsl
float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
```

The constants are arbitrary but chosen to spread the sine output. The same
input always produces the same output, which is what makes noise reproducible
across frames. `sin` has precision limits, so this is not cryptographic and can
show patterns at very large coordinates; for learning it is the standard trick.

## Value noise and fBm

Value noise samples the hash at the four corners of a cell and blends them with
smoothstep weights:

```glsl
float valueNoise(vec2 p)
{
    vec2 cell = floor(p);
    vec2 local = fract(p);
    vec2 smoothWeights = local * local * (3.0 - 2.0 * local);

    float bottomLeft = hash(cell);
    float bottomRight = hash(cell + vec2(1.0, 0.0));
    float topLeft = hash(cell + vec2(0.0, 1.0));
    float topRight = hash(cell + vec2(1.0, 1.0));

    return mix(
        mix(bottomLeft, bottomRight, smoothWeights.x),
        mix(topLeft, topRight, smoothWeights.x),
        smoothWeights.y
    );
}
```

Layering octaves gives fBm (fractal Brownian motion):

```glsl
float fbm(vec2 p)
{
    float sum = 0.0;
    float amplitude = 0.5;

    for (int octave = 0; octave < 5; octave++)
    {
        sum += amplitude * valueNoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }

    return sum;
}
```

Each octave doubles the frequency and halves the contribution. More octaves add
fine detail at the cost of more texture-free maths. Five is a good default.

## Signed distance fields

An SDF returns the distance from a point to a shape:

- Negative inside.
- Zero on the boundary.
- Positive outside.

```glsl
float sdCircle(vec2 p, float radius)
{
    return length(p) - radius;
}

float sdBox(vec2 p, vec2 halfSize)
{
    vec2 d = abs(p) - halfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
```

Two properties make SDFs powerful:

- `min(a, b)` is the union of two shapes.
- `smoothstep(width, 0.0, abs(d))` draws an antialiased stroke of `width`.

The **sdf** example combines a circle and a rotated box with `min`, then draws a
stroke and a fill from the combined distance.

## Expected result

![Value noise: layered fBm in a warm palette](/images/content/lessons/noise.webp)

![SDF shapes: a circle and a rotated box with a stroke](/images/content/lessons/sdf.webp)

## Minimal example: a noise field

```glsl run=sandbox title="Value noise"
#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p)
{
    vec2 cell = floor(p);
    vec2 local = fract(p);
    vec2 smoothWeights = local * local * (3.0 - 2.0 * local);

    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));

    return mix(mix(a, b, smoothWeights.x), mix(c, d, smoothWeights.x), smoothWeights.y);
}

void main(void)
{
    vec2 uv = vUv;
    uv.x *= uResolution.x / uResolution.y;

    float n = valueNoise(uv * 6.0 + vec2(uTime * 0.2, 0.0));
    vec3 color = mix(vec3(0.03, 0.05, 0.12), vec3(0.95, 0.7, 0.35), n);

    fragColor = vec4(color, 1.0);
}
```

## Exercises

1. Animate the noise by adding `uTime` to the noise input instead of to `uv.x`.
   Which direction does it move?
2. Change the fBm amplitude multiplier from `0.5` to `0.8`. How does the texture
   change, and why does it stop resembling fBm?
3. Draw a ring instead of a filled circle: use `abs(sdCircle(p, 0.3))` and
   `smoothstep`.
4. Intersect two SDFs with `max(a, b)` instead of uniting them with `min`.
5. Add `0.5` to the cell index before hashing and explain why the pattern is
   still deterministic.

::: solution Solution 1
Adding time to `uv` translates the field, so the noise moves in the direction of
the added vector. Adding to `uv.x` moves it horizontally.
:::

::: solution Solution 2
Higher amplitudes make later octaves louder, so the fine detail dominates and the
result looks harsher. Standard fBm halves each octave so the low frequencies set
the overall shape.
:::

::: solution Solution 3
```glsl
float ring = smoothstep(0.02, 0.0, abs(sdCircle(p, 0.3)));
fragColor = vec4(vec3(ring), 1.0);
```
:::

::: solution Solution 4
`max(a, b)` keeps only the region inside both shapes; the result is the
intersection. The boundary is still the larger of the two distances.
:::

::: solution Solution 5
The hash is a pure function of its input. Adding a constant changes which random
values you get but not the reproducibility: the same cell always maps to the same
value.
:::

## Common mistakes

- Forgetting to scale the UV before `fract`, so nothing repeats.
- Using `fract` where you need `floor` (or the reverse).
- Calling `smoothstep` with the edges reversed for a shape; the result is
  undefined.
- Hashing screen-space pixels instead of cell coordinates, which makes the noise
  flicker when the window resizes.
- Looping a non-constant number of octaves; a literal bound is what the compiler
  can unroll.

## Next

- [The 3D vertex stage](/docs/vertex-stage-3d)
- [Textures and data](/docs/textures-and-data)
- [Debugging shaders](/docs/debugging-shaders)
