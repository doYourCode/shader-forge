---
title: "Referência rápida de GLSL"
description: Uma referência imprimível de uma página sobre GLSL ES 3.00 — tipos, swizzles, qualificadores, funções integradas, termos de iluminação e os erros mais comuns.
section: reference
order: 5
difficulty: beginner
printable: true
draft: false
---

# Referência rápida de GLSL

Use **Print / Save as PDF** no cabeçalho. A página muda para um layout
econômico em tinta e remove a interface do aplicativo.

## Esqueleto do shader

```glsl
#version 300 es
precision highp float;

in vec2 vUv;                    // entrada de fragmento (ou atributo de vértice)
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

## Qualificadores

| Qualificador | Uso |
| --- | --- |
| `in` | atributo de vértice (vértice) / entrada interpolada (fragmento) |
| `out` | saída interpolada (vértice) / saída de cor (fragmento) |
| `uniform` | constante para o draw call; controlada pela engine |
| `const` | constante de tempo de compilação |
| `inout` | parâmetro de função lido e escrito |
| `flat` | sem interpolação |
| `smooth` | correção de perspectiva (padrão) |

## Tipos

| Tipo | Componentes | Observações |
| --- | --- | --- |
| `float` | 1 | sempre escreva `1.0`, não `1` |
| `int`, `uint`, `bool` | 1 | `1 / 2 == 0` |
| `vec2`, `vec3`, `vec4` | 2, 3, 4 floats | cor, posição, UV |
| `ivec*`, `uvec*`, `bvec*` | vetores inteiros/booleanos | |
| `mat2`, `mat3`, `mat4` | 2×2, 3×3, 4×4 | column-major |
| `sampler2D`, `samplerCube` | opaco | amostre com `texture()` |

## Swizzling

| Swizzle | Resultado para `v = vec3(1, 2, 3)` |
| --- | --- |
| `v.x`, `v.r`, `v.s` | `1.0` |
| `v.y`, `v.g`, `v.t` | `2.0` |
| `v.z`, `v.b`, `v.p` | `3.0` |
| `v.rg` | `(1.0, 2.0)` |
| `v.bgr` | `(3.0, 2.0, 1.0)` |
| `v.rrr` | `(1.0, 1.0, 1.0)` |
| `v.xg` | ilegal: conjuntos misturados |

`v.w`/`v.a`/`v.q` é o quarto componente. `v.rgba` em um `vec3` é um erro.

## Matemática escalar

| Função | Resultado |
| --- | --- |
| `sin(x)`, `cos(x)`, `tan(x)` | radianos |
| `asin`, `acos`, `atan(y, x)` | `atan` de dois argumentos preserva o quadrante |
| `pow(x, y)` | `x` elevado a `y`; base negativa é indefinida |
| `exp(x)`, `log(x)` | exponencial/logaritmo natural |
| `sqrt(x)`, `inversesqrt(x)` | raiz quadrada / recíproco |
| `abs(x)`, `sign(x)` | absoluto / sinal |
| `floor(x)`, `ceil(x)`, `round(x)` | arredondamento |
| `fract(x)` | `x - floor(x)` |
| `mod(x, y)` | `x - y * floor(x / y)` |
| `min`, `max`, `clamp` | limites |
| `mix(a, b, t)` | `a * (1 - t) + b * t` |
| `step(edge, x)` | `x >= edge ? 1 : 0` |
| `smoothstep(e0, e1, x)` | rampa suave; `e0 < e1` |

## Matemática vetorial

| Função | Resultado |
| --- | --- |
| `dot(a, b)` | escalar; cosseno para vetores unitários |
| `cross(a, b)` | vetor perpendicular (3D) |
| `normalize(v)` | vetor unitário |
| `length(v)`, `distance(a, b)` | comprimento euclidiano |
| `reflect(i, n)` | reflexão do incidente `i` |
| `refract(i, n, eta)` | refração; zero na reflexão interna total |
| `faceforward(n, i, nref)` | inverte `n` se necessário |
| `transpose(m)`, `inverse(m)` | operações de matriz |

## Amostragem de textura

| Função | Uso |
| --- | --- |
| `texture(sampler2D, vec2)` | amostra 2D filtrada, mip automático |
| `texture(samplerCube, vec3)` | consulta a cubemap por direção |
| `textureLod(sampler, coord, lod)` | nível de mip explícito |
| `textureGrad` | derivadas explícitas |
| `texelFetch` | texel inteiro, sem filtragem |

## Termos de iluminação

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

// Especular de Cook-Torrance
vec3 F = F0 + (vec3(1.0) - F0) * pow(1.0 - VdotH, 5.0);
vec3 specular = (D * G * F) / (4.0 * NdotL * NdotV + 1e-3);
```

## Espaços de coordenadas

```glsl
vec4 world = worldMatrix * vec4(position, 1.0);
vec4 view = viewMatrix * world;
gl_Position = projectionMatrix * view;

vec3 worldNormal = normalize(normalMatrix * normal);
vec3 reflected = reflect(-V, N);        // V aponta da superfície para a câmera
```

## Erros comuns

| Erro | Correção |
| --- | --- |
| `#version` não é a primeira linha | mova para a linha 1 |
| `gl_FragColor` | declare `out vec4 fragColor` |
| `attribute` / `varying` | use `in` / `out` |
| `texture2D` | use `texture` |
| uniform duplicado | não redeclare nomes da ABI nem de Dados do usuário |
| nenhuma função correspondente | verifique tipos/quantidade de argumentos |
| precisão ausente | `precision highp float;` |
| incompatibilidade de vinculação | mesmo nome e tipo de varying nos dois estágios |
| amostra preta | verifique se o sampler está vinculado e se o UV está no intervalo |

## Relacionados

- [GLSL ES 3.00](/docs/gles-3-0-webgl2)
- [Funções integradas](/docs/built-in-functions)
- [Depuração de shaders](/docs/debugging-shaders)
- [Referência da ABI](/docs/abi-reference)
