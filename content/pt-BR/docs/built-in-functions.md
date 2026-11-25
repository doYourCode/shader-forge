---
title: "Funções integradas"
description: As funções do GLSL ES 3.00 que você mais vai usar, com intervalos de argumentos, usos comuns e as diferenças em relação ao GLSL ES 1.00.
section: glsl
order: 2
difficulty: beginner
prerequisites: data-types
draft: false
---

# Funções integradas

## Objetivo

Saiba qual função integrada usar, o que seus argumentos significam e quais são
fáceis de usar errado. Esta página é um tour; a [Referência rápida de
GLSL](/docs/cheat-sheet) é a lista imprimível.

## Trigonometria e interpolação

| Função | Resultado | Observações |
| --- | --- | --- |
| `sin(x)`, `cos(x)` | seno/cosseno em radianos | `sin` é periódica; anime com `time` |
| `atan(y, x)` | ângulo em radianos | a forma de dois argumentos preserva o quadrante |
| `radians(deg)` | graus para radianos | use para legibilidade |
| `mix(a, b, t)` | `a * (1 - t) + b * t` | `t` não é limitado |
| `step(edge, x)` | `0` se `x < edge`, senão `1` | borda dura |
| `smoothstep(e0, e1, x)` | rampa suave de `0..1` | indefinido se `e0 >= e1` |
| `clamp(x, lo, hi)` | valor limitado | muito comum depois da iluminação |
| `saturate(x)` | **não** é GLSL | use `clamp(x, 0.0, 1.0)` |

`mix` com um terceiro argumento `bool` seleciona um de dois valores
(GLSL ES 3.00):

```glsl
vec3 color = mix(colorA, colorB, useB);
```

## Potências, exponenciais e raízes

| Função | Resultado |
| --- | --- |
| `pow(x, y)` | `x` elevado à potência `y`; indefinido para `x` negativo |
| `exp(x)` / `log(x)` | exponencial / logaritmo naturais |
| `sqrt(x)` / `inversesqrt(x)` | raiz quadrada / `1 / sqrt(x)` |
| `abs(x)` / `sign(x)` | valor absoluto / sinal |
| `floor(x)` / `ceil(x)` | arredonda para baixo / para cima |
| `fract(x)` | `x - floor(x)`, a parte fracionária |
| `mod(x, y)` | resto, `x - y * floor(x / y)` |

`fract` e `floor` são a base do tiling:

```glsl
vec2 cell = floor(uv * 8.0);
vec2 local = fract(uv * 8.0);
```

## Geometria

| Função | Significado |
| --- | --- |
| `dot(a, b)` | projeção escalar; cosseno para vetores unitários |
| `cross(a, b)` | vetor perpendicular (apenas 3D) |
| `normalize(v)` | vetor unitário |
| `length(v)` | comprimento euclidiano |
| `distance(a, b)` | `length(a - b)` |
| `reflect(i, n)` | reflexão do incidente `i` em torno da normal `n` |
| `refract(i, n, eta)` | refração; retorna zero na reflexão interna total |
| `faceforward(n, i, nref)` | inverte `n` quando ele aponta para longe |
| `transpose(m)` / `inverse(m)` | operações de matriz |

Para uma direção de visão `V` e uma normal de superfície `N`, a direção
refletida é:

```glsl
vec3 R = reflect(-V, N);
```

A direção incidente precisa apontar *para* a superfície, daí o `-V`.

## Auxiliares de vetores e componentes

| Função | Exemplo |
| --- | --- |
| `min(a, b)` / `max(a, b)` | componente a componente |
| `clamp(v, lo, hi)` | vetor ou escalar |
| `mix` | componente a componente com `t` escalar ou vetor |
| `step` / `smoothstep` | componente a componente |
| `any(bvec)` / `all(bvec)` | reduções booleanas |
| `equal(a, b)` / `lessThan(a, b)` | booleanos componente a componente |
| `vec2`, `vec3`, `vec4` | construtores |

## Amostragem de textura

| Função | Uso |
| --- | --- |
| `texture(sampler2D, vec2)` | textura 2D, com derivadas implícitas |
| `texture(samplerCube, vec3)` | cubemap, a direção é a consulta |
| `textureLod(sampler, coord, lod)` | nível de mip explícito |
| `textureGrad` | derivadas explícitas |
| `texelFetch` | coordenadas inteiras, sem filtragem |

`texture` é o nome do GLSL ES 3.00. Os nomes `texture2D`/`textureCube` do ES
1.00 foram removidos; o painel de diagnósticos relata esse erro com uma dica
dedicada.

## Vindo do GLSL ES 1.00

Se você já escreveu shaders de WebGL 1, estas são as mudanças que você vai
encontrar primeiro:

| GLSL ES 1.00 | GLSL ES 3.00 |
| --- | --- |
| `attribute` | `in` no shader de vértices |
| `varying` | `out` no shader de vértices, `in` no shader de fragmentos |
| `gl_FragColor` | `layout(location = 0) out vec4 fragColor;` |
| `texture2D(s, uv)` | `texture(s, uv)` |
| `textureCube(s, dir)` | `texture(s, dir)` |
| `#version 100` | `#version 300 es` |

O editor aceita trechos de GLSL ES 1.00 no caminho de código de diagnósticos,
mas a prévia compila GLSL ES 3.00. Se um trecho usa os nomes antigos, leia a
orientação do painel de erros em vez de adivinhar.

## Exemplo mínimo: modelar uma onda

```glsl run=sandbox title="Modelagem de onda"
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

    // smoothstep transforma a onda em um anel suave.
    float ring = smoothstep(0.85, 1.0, wave);
    vec3 color = mix(vec3(0.03, 0.05, 0.1), vec3(0.95, 0.75, 0.35), ring);

    fragColor = vec4(color, 1.0);
}
```

## Exercícios

1. Substitua `smoothstep(0.85, 1.0, wave)` por `step(0.0, wave)` e descreva a
   qualidade da borda.
2. Use `fract(radius * 8.0)` para desenhar anéis concêntricos. O que a
   multiplicação por `8.0` controla?
3. Monte uma cor com `mix` em espaço linear, depois aplique
   `pow(colour, vec3(1.0 / 2.2))`. O sandbox parece correto ou lavado?
4. Por que `reflect(V, N)` parece errado quando `V` aponta da superfície para
   a câmera?

::: solution Solução 1
`step` produz uma borda dura e com aliasing. `smoothstep` interpola ao longo de
um intervalo, então o anel tem uma largura suave que você controla.
:::

::: solution Solução 2
O multiplicador define o número de anéis ao longo da faixa de raio: valores
maiores produzem mais anéis, mais finos.
:::

::: solution Solução 3
O sandbox já grava a imagem final; adicionar uma codificação sRGB é uma segunda
codificação, então a imagem fica lavada. Use a transformação de saída do Editor
GLSL de Tela para comparar corretamente.
:::

::: solution Solução 4
`reflect` espera a direção incidente apontando *para* a superfície, então você
passa `-V` quando `V` aponta da superfície para a câmera.
:::

## Erros comuns

- Chamar `pow` com base negativa.
- Usar `smoothstep` com `edge0 >= edge1`; o resultado é indefinido.
- Esquecer que `mix` não limita o fator.
- Usar `texture2D` em um shader `#version 300 es`.
- Amostrar um cubemap com um `vec2`.

## Próximos passos

- [Referência rápida de GLSL](/docs/cheat-sheet)
- [Primeiros shaders no sandbox](/docs/first-shaders)
- [Texturas e dados](/docs/textures-and-data)
