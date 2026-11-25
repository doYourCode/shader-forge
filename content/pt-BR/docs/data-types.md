---
title: "Tipos e swizzling"
description: Escalares, vetores, matrizes e samplers em GLSL ES 3.00, com as regras de swizzle, os construtores e algumas armadilhas de tipos.
section: glsl
order: 1
difficulty: beginner
prerequisites: gles-3-0-webgl2
draft: false
---

# Tipos e swizzling

## Objetivo

Leia e escreva declarações GLSL com confiança: saiba qual tipo uma expressão
tem, como montar um `vec4` a partir de peças menores e como ler ou reordenar
componentes com swizzles.

## Tipos escalares

| Tipo | Significado | Exemplos de literal |
| --- | --- | --- |
| `float` | ponto flutuante de 32 bits (highp) | `1.0`, `0.5`, `3.14159` |
| `int` | inteiro com sinal de 32 bits | `0`, `42`, `-3` |
| `uint` | inteiro sem sinal de 32 bits | `0u`, `7u` |
| `bool` | booleano | `true`, `false` |

Literais inteiros não são floats. `1 / 2` é divisão inteira e resulta em `0`;
escreva `1.0 / 2.0` quando quiser dizer `0.5`.

## Vetores e matrizes

| Tipo | Componentes | Uso típico |
| --- | --- | --- |
| `vec2` | 2 floats | UVs, deslocamentos em espaço de tela |
| `vec3` | 3 floats | posições, normais, RGB |
| `vec4` | 4 floats | posições homogêneas, RGBA |
| `ivec2` / `uvec3` | vetores de inteiros | tamanhos de textura, truques com bits |
| `bvec2` | booleanos | resultados de comparação |
| `mat2` / `mat3` / `mat4` | 2×2, 3×3, 4×4 floats | rotações, transformações |
| `sampler2D` / `samplerCube` | handles opacos | texturas |

Uma `mat3` tem três colunas, cada uma um `vec3`. `m[0]` é a primeira coluna,
não a primeira linha. Esse layout column-major importa quando você monta uma
matriz na mão.

## Construtores

Construtores têm o nome do tipo. Você pode montar um vetor maior a partir de
vetores menores e pode repetir um escalar:

```glsl
vec3 rgb = vec3(0.2, 0.4, 0.8);
vec4 rgba = vec4(rgb, 1.0);          // acrescenta alpha
vec3 grey = vec3(0.5);               // (0.5, 0.5, 0.5)
vec2 uv = vec2(0.5, 0.25);
vec2 doubled = uv * 2.0;             // multiplicação componente a componente
mat3 identity = mat3(1.0);           // diagonal 1, fora da diagonal 0
mat3 rot = mat3(cos(a), -sin(a), 0.0,
                sin(a),  cos(a), 0.0,
                0.0,     0.0,    1.0);
```

Não existe conversão implícita de `int` para `float`. `float x = 1;` falha;
escreva `float x = 1.0;`. Use `float(i)` para converter explicitamente.

## Swizzling

Swizzles leem componentes pelo nome e podem reordená-los ou repeti-los:

```glsl
vec3 colour = vec3(0.1, 0.2, 0.3);
vec2 rg = colour.rg;        // (0.1, 0.2)
vec3 bgr = colour.bgr;      // (0.3, 0.2, 0.1)
vec4 rgba = colour.rgba;    // erro: a não existe em um vec3
vec3 red = colour.rrr;      // (0.1, 0.1, 0.1)
vec4 extended = vec4(colour.rgb, 1.0);
```

Conjuntos de componentes:

- `x, y, z, w` — posições.
- `r, g, b, a` — cores.
- `s, t, p, q` — coordenadas de textura.

Você pode misturar conjuntos (`colour.rg` e `colour.xy` são iguais), mas não em
um mesmo swizzle (`colour.xg` é ilegal). Atribuição também funciona:

```glsl
vec4 rgba = vec4(0.0);
rgba.rgb = colour;
rgba.a = 1.0;
```

Um swizzle não é um ponteiro. `colour.rg = vec2(1.0)` é permitido porque o lado
esquerdo é um lvalue; passar `colour.rg` para uma função passa uma cópia.

## Precisão

Shaders de fragmentos precisam de uma precisão padrão para floats. As primeiras
linhas de todo shader neste app são:

```glsl
#version 300 es
precision highp float;
```

`highp` dá floats de 32 bits no WebGL 2 de desktop. `mediump` é mais barato em
algumas GPUs móveis, mas pode mostrar banding e artefatos de precisão em
coordenadas grandes. Use `highp` a menos que você tenha um motivo medido para
não usar.

## Samplers não são cores

Um `sampler2D` é um handle para uma unidade de textura, não os dados da textura.
Você o amostra com `texture(sampler, uv)`, que retorna um `vec4`:

```glsl
vec4 texel = texture(albedoTexture, vUV);
vec3 rgb = texel.rgb;
float alpha = texel.a;
```

Você não pode fazer aritmética com o próprio sampler. Você pode passá-lo para
uma função (sem `in`/`out`) e pode indexar um `sampler2DArray` com um inteiro.

## Exemplo mínimo: swizzle de uma cor

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

## Exercícios

1. Monte um `vec4` chamado `tint` a partir de `vUv` de forma que o vermelho
   siga `vUv.y` e o verde siga `vUv.x`.
2. Preveja a saída de `vec3(1.0, 2.0, 3.0).zyx` antes de executar.
3. Corrija a declaração `float scale = 2;` sem alterar o literal `2`.
4. Por que `colour.xg` falha quando `colour.rg` funciona?

::: solution Solução 1
`vec4 tint = vec4(vUv.yx, 0.0, 1.0);` (ou `vec4(vUv.y, vUv.x, 0.0, 1.0)`).
:::

::: solution Solução 2
`(3.0, 2.0, 1.0)`; um swizzle seleciona os componentes na ordem em que você os
escreve.
:::

::: solution Solução 3
`float scale = float(2);` ou `float scale = 2.0;`.
:::

::: solution Solução 4
`x` e `r` pertencem a conjuntos de nomes diferentes. Um único swizzle pode usar
um conjunto, não uma mistura dos dois.
:::

## Erros comuns

- Usar `1 / 2` e esperar `0.5`.
- Esquecer o `.0` nos literais float.
- Presumir que `mat[0]` é uma linha.
- Usar um swizzle como se fosse uma referência ao vetor original.
- Declarar um `sampler2D` sem binding e esperar que ele amostre.

## Próximos passos

- [Funções integradas](/docs/built-in-functions)
- [GLSL ES 3.00](/docs/gles-3-0-webgl2)
- [Referência rápida de GLSL](/docs/cheat-sheet)
