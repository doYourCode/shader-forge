---
title: "Padrões, ruído e SDFs"
description: Tiling, ruído de valor baseado em hash e campos de distância com sinal — os três blocos de construção procedurais por trás da maior parte da arte 2D com shaders.
section: lessons
order: 2
difficulty: beginner
prerequisites: first-shaders
editor: sandbox
example: noise
draft: false
---

# Padrões, ruído e SDFs

## Objetivo

Crie padrões repetidos com `fract` e `floor`, gere ruído pseudoaleatório
reproduzível com um hash, empilhe-o em fBm e desenhe formas com antialiasing
usando campos de distância com sinal (SDFs).

## Tiling e coordenadas de célula

Duas funções fazem a maior parte do trabalho:

- `floor(uv * scale)` dá o índice inteiro da célula.
- `fract(uv * scale)` dá a posição dentro dessa célula, em `[0, 1)`.

```glsl
vec2 uv = vUv * 8.0;
vec2 cell = floor(uv);
vec2 local = fract(uv);
```

O padrão pode então depender de `cell` (um xadrez, um valor aleatório por
célula) e de `local` (uma forma dentro da célula). É a mesma ideia de um atlas
de textura, só que o padrão é gerado.

## Hash: aleatoriedade barata

GLSL não tem `random()`. Um hash mapeia um número para outro número de aparência
diferente, de forma determinística:

```glsl
float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
```

As constantes são arbitrárias, mas escolhidas para espalhar a saída do seno. A
mesma entrada sempre produz a mesma saída, e é isso que torna o ruído
reproduzível entre quadros. `sin` tem limites de precisão, então isso não é
criptográfico e pode mostrar padrões em coordenadas muito grandes; para
aprender, é o truque padrão.

## Ruído de valor e fBm

O ruído de valor amostra o hash nos quatro cantos de uma célula e os mistura com
pesos de smoothstep:

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

Empilhar oitavas dá fBm (fractal Brownian motion):

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

Cada oitava dobra a frequência e reduz a contribuição pela metade. Mais oitavas
acrescentam detalhe fino ao custo de mais matemática sem textura. Cinco é um bom
valor padrão.

## Campos de distância com sinal

Um SDF retorna a distância de um ponto a uma forma:

- Negativa dentro.
- Zero na fronteira.
- Positiva fora.

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

Duas propriedades tornam os SDFs poderosos:

- `min(a, b)` é a união de duas formas.
- `smoothstep(width, 0.0, abs(d))` desenha um traço com antialiasing de largura
  `width`.

O exemplo **sdf** combina um círculo e uma caixa rotacionada com `min` e depois
desenha um traço e um preenchimento a partir da distância combinada.

## Resultado esperado

![Ruído de valor: fBm em camadas em uma paleta quente](/images/content/lessons/noise.webp)

![Formas SDF: um círculo e uma caixa rotacionada com um traço](/images/content/lessons/sdf.webp)

## Exemplo mínimo: um campo de ruído

```glsl run=sandbox title="Ruído de valor"
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

## Exercícios

1. Anime o ruído somando `uTime` à entrada do ruído em vez de somá-lo a `uv.x`.
   Em que direção ele se move?
2. Mude o multiplicador de amplitude do fBm de `0.5` para `0.8`. Como a textura
   muda, e por que ela deixa de se parecer com fBm?
3. Desenhe um anel em vez de um círculo preenchido: use `abs(sdCircle(p, 0.3))`
   e `smoothstep`.
4. Faça a interseção de dois SDFs com `max(a, b)` em vez de uni-los com `min`.
5. Some `0.5` ao índice da célula antes de calcular o hash e explique por que o
   padrão continua determinístico.

::: solution Solução 1
Somar tempo a `uv` translada o campo, então o ruído se move na direção do vetor
somado. Somar a `uv.x` o desloca na horizontal.
:::

::: solution Solução 2
Amplitudes maiores deixam as oitavas seguintes mais intensas, então o detalhe
fino domina e o resultado fica mais duro. O fBm padrão divide cada oitava pela
metade, para que as baixas frequências definam a forma geral.
:::

::: solution Solução 3
```glsl
float ring = smoothstep(0.02, 0.0, abs(sdCircle(p, 0.3)));
fragColor = vec4(vec3(ring), 1.0);
```
:::

::: solution Solução 4
`max(a, b)` mantém apenas a região dentro das duas formas; o resultado é a
interseção. A fronteira ainda é a maior das duas distâncias.
:::

::: solution Solução 5
O hash é uma função pura de sua entrada. Somar uma constante muda quais valores
aleatórios você obtém, mas não a reprodutibilidade: a mesma célula sempre mapeia
para o mesmo valor.
:::

## Erros comuns

- Esquecer de escalar a UV antes de `fract`, e aí nada se repete.
- Usar `fract` onde você precisa de `floor` (ou o contrário).
- Chamar `smoothstep` com as bordas invertidas para uma forma; o resultado é
  indefinido.
- Aplicar o hash em pixels do espaço de tela em vez de coordenadas de célula, o
  que faz o ruído piscar quando a janela é redimensionada.
- Fazer um loop com um número não constante de oitavas; um limite literal é o
  que o compilador consegue desenrolar.

## Próximos passos

- [O estágio de vértice 3D](/docs/vertex-stage-3d)
- [Texturas e dados](/docs/textures-and-data)
- [Depuração de shaders](/docs/debugging-shaders)
