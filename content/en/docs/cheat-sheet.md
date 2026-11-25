---
title: GLSL Cheat Sheet
description: A printable one-page reference for GLSL ES 3.00 types, swizzles, qualifiers, built-in functions, lighting terms and the most common errors.
section: reference
order: 5
difficulty: beginner
printable: true
draft: false
---

# GLSL Cheat Sheet

Use **Print / Save as PDF** in the header. The page switches to an ink-friendly
layout and drops the application chrome.

## Shader skeleton

```glsl
#version 300 es
precision highp float;

in vec2 vUv;                    // fragment input (or vertex attribute)
uniform sampler2D textureSampler;
uniform vec2 resolution;
uniform float time;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 color = texture(textureSampler, vUv).rgb;
    fragColor = vec4(color, 1.0);
}
```

## Qualifiers

| Qualifier | Use |
| --- | --- |
| `in` | vertex attribute (vertex) / interpolated input (fragment) |
| `out` | interpolated output (vertex) / colour output (fragment) |
| `uniform` | constant for the draw; engine-owned |
| `const` | compile-time constant |
| `inout` | function parameter read and written |
| `flat` | no interpolation |
| `smooth` | perspective-correct (default) |

## Types

| Type | Components | Notes |
| --- | --- | --- |
| `float` | 1 | always write `1.0`, not `1` |
| `int`, `uint`, `bool` | 1 | `1 / 2 == 0` |
| `vec2`, `vec3`, `vec4` | 2, 3, 4 floats | colour, position, UV |
| `ivec*`, `uvec*`, `bvec*` | integer/boolean vectors | |
| `mat2`, `mat3`, `mat4` | 2×2, 3×3, 4×4 | column-major |
| `sampler2D`, `samplerCube` | opaque | sample with `texture()` |

## Swizzling

| Swizzle | Result for `v = vec3(1, 2, 3)` |
| --- | --- |
| `v.x`, `v.r`, `v.s` | `1.0` |
| `v.y`, `v.g`, `v.t` | `2.0` |
| `v.z`, `v.b`, `v.p` | `3.0` |
| `v.rg` | `(1.0, 2.0)` |
| `v.bgr` | `(3.0, 2.0, 1.0)` |
| `v.rrr` | `(1.0, 1.0, 1.0)` |
| `v.xg` | illegal: mixed sets |

`v.w`/`v.a`/`v.q` is the fourth component. `v.rgba` on a `vec3` is an error.

## Scalar maths

| Function | Result |
| --- | --- |
| `sin(x)`, `cos(x)`, `tan(x)` | radians |
| `asin`, `acos`, `atan(y, x)` | two-argument `atan` keeps the quadrant |
| `pow(x, y)` | `x` to `y`; negative base is undefined |
| `exp(x)`, `log(x)` | natural exponential/log |
| `sqrt(x)`, `inversesqrt(x)` | square root / reciprocal |
| `abs(x)`, `sign(x)` | absolute / sign |
| `floor(x)`, `ceil(x)`, `round(x)` | rounding |
| `fract(x)` | `x - floor(x)` |
| `mod(x, y)` | `x - y * floor(x / y)` |
| `min`, `max`, `clamp` | bounds |
| `mix(a, b, t)` | `a * (1 - t) + b * t` |
| `step(edge, x)` | `x >= edge ? 1 : 0` |
| `smoothstep(e0, e1, x)` | smooth ramp; `e0 < e1` |

## Vector maths

| Function | Result |
| --- | --- |
| `dot(a, b)` | scalar; cosine for unit vectors |
| `cross(a, b)` | perpendicular vector (3D) |
| `normalize(v)` | unit vector |
| `length(v)`, `distance(a, b)` | Euclidean length |
| `reflect(i, n)` | reflection of incident `i` |
| `refract(i, n, eta)` | refraction; zero on total internal reflection |
| `faceforward(n, i, nref)` | flip `n` if needed |
| `transpose(m)`, `inverse(m)` | matrix operations |

## Texture sampling

| Function | Use |
| --- | --- |
| `texture(sampler2D, vec2)` | filtered 2D sample, automatic mip |
| `texture(samplerCube, vec3)` | cubemap lookup by direction |
| `textureLod(sampler, coord, lod)` | explicit mip level |
| `textureGrad` | explicit derivatives |
| `texelFetch` | integer texel, no filtering |

## Lighting terms

```glsl
vec3 N = normalize(vWorldNormal);
vec3 L = normalize(lightDir);
vec3 V = normalize(cameraPos - vWorldPosition);
vec3 H = normalize(L + V);

float NdotL = max(dot(N, L), 0.0);
float NdotV = max(dot(N, V), 1e-3);
float NdotH = max(dot(N, H), 0.0);
float VdotH = max(dot(V, H), 0.0);

vec3 R = reflect(-V, N);
float fresnel = pow(1.0 - NdotV, 5.0);

// Lambert
vec3 diffuse = albedo * NdotL;

// Phong / Blinn-Phong
float phong = pow(max(dot(reflect(-L, N), V), 0.0), shininess);
float blinn = pow(max(dot(N, H), 0.0), shininess);

// Cook-Torrance specular
vec3 F = F0 + (vec3(1.0) - F0) * pow(1.0 - VdotH, 5.0);
vec3 specular = (D * G * F) / (4.0 * NdotL * NdotV + 1e-3);
```

## Coordinate spaces

```glsl
vec4 world = worldMatrix * vec4(position, 1.0);
vec4 view = viewMatrix * world;
gl_Position = projectionMatrix * view;

vec3 worldNormal = normalize(normalMatrix * normal);
vec3 reflected = reflect(-V, N);        // V points surface -> camera
```

## Common errors

| Error | Fix |
| --- | --- |
| `#version` not first | move it to line 1 |
| `gl_FragColor` | declare `out vec4 fragColor` |
| `attribute` / `varying` | use `in` / `out` |
| `texture2D` | use `texture` |
| duplicate uniform | do not redeclare ABI or User data names |
| no matching function | check argument types/count |
| missing precision | `precision highp float;` |
| link mismatch | same varying name and type in both stages |
| black sample | check the sampler is bound and the UV is in range |

## Related

- [GLSL ES 3.00](/knowledge/gles-3-0-webgl2)
- [Built-in functions](/knowledge/built-in-functions)
- [Debugging shaders](/knowledge/debugging-shaders)
- [ABI Reference](/docs/abi-reference)
