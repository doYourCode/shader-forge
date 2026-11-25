---
title: "Texturas e dados"
description: Amostre texturas 2D, controle o wrapping, monte um referencial tangente para mapas de normais, leia cubemaps e forneça seus próprios uniforms pela aba Dados do usuário.
section: lessons
order: 4
difficulty: intermediate
prerequisites: vertex-stage-3d
editor: editor
example: normal-map
draft: false
---

# Texturas e dados

## Objetivo

Use `sampler2D` e `samplerCube` corretamente, raciocine sobre wrapping de UV e
níveis de mip, monte um referencial tangente para mapeamento de normais e
adicione seus próprios uniforms e texturas sem editar declarações à mão.

## Amostragem de uma textura 2D

Um sampler é um handle; `texture()` devolve um `vec4`:

```glsl
uniform sampler2D albedoTexture;

vec4 texel = texture(albedoTexture, vUv);
vec3 rgb = texel.rgb;
```

`texture` escolhe um nível de mip automaticamente a partir das derivadas em
espaço de tela da UV. Isso está correto para sombreamento de superfície. Use
`textureLod` quando precisar de um nível específico (cadeias de desfoque,
consultas de rugosidade) e `texelFetch` quando precisar de um texel inteiro sem
filtragem.

## Wrapping de UV

Wrapping é uma propriedade de estado do sampler, não uma propriedade de GLSL:

- **Repeat** — UVs fora de `[0, 1]` fazem tiling.
- **Clamp** — UVs fora de `[0, 1]` esticam a borda.
- **Mirror** — UVs fora de `[0, 1]` invertem.

Se uma textura parece estar se arrastando nas bordas, o sampler está com
clamp. Se ela se repete quando você esperava uma única imagem, o sampler está
repetindo. O seletor de texturas usa o padrão da prévia; não dá para mudar o
wrapping pelo shader.

## Mapeamento de normais

Um mapa de normais armazena uma direção no espaço tangente. Para usá-lo você
precisa de um referencial tangente por vértice:

```glsl
vec3 N = normalize(vWorldNormal);
vec3 T = normalize(vWorldTangent - N * dot(N, vWorldTangent));
vec3 B = cross(N, T);

vec3 tangentNormal = texture(normalTexture, vUv).rgb * 2.0 - 1.0;
vec3 worldNormal = normalize(T * tangentNormal.x + B * tangentNormal.y + N * tangentNormal.z);
```

Por que o passo de Gram–Schmidt? A tangente e a normal interpoladas não são
perfeitamente perpendiculares. Remover a componente normal da tangente mantém o
referencial ortonormal; caso contrário, o mapa de normais fica enviesado.

O exemplo `normal-map` evita uma textura e diferencia um campo de altura
procedural, mas a construção do referencial é idêntica.

## Cubemaps

Um `samplerCube` é amostrado com uma direção, não uma UV:

```glsl
uniform samplerCube environmentMap;

vec3 reflected = reflect(-viewDirection, normal);
vec3 environment = texture(environmentMap, reflected).rgb;
```

A prévia vincula `environmentMap`, `irradianceMap`, `prefilteredEnvironmentMap`
e `brdfLUT`. Os três últimos são os ingredientes da lição de IBL:
`irradianceMap` para difuso, `prefilteredEnvironmentMap` para especular e
`brdfLUT` para a aproximação split-sum.

## Dados do usuário

A aba Dados do usuário é o jeito de adicionar um uniform ou uma textura sem
editar as declarações dentro do shader:

1. Adicione uma linha e escolha um nome e um tipo.
2. Escolha os estágios que recebem a declaração gerada (`Frag`, `Vert`, `Todos`
   ou `Pós`).
3. Defina um valor. Edições de valor são aplicadas na hora; edições estruturais
   reconstroem o shader.

O bloco gerado é somente leitura no editor e é injetado acima do ponto de
injeção. Um shader que referencia `albedo` **não** deve declarar
`uniform vec3 albedo;` por conta própria — o bloco já faz isso, e a declaração
duplicada falha na compilação.

Linhas de textura usam `sampler2D` ou `samplerCube`. O Sandbox GLSL 2D oferece
apenas `sampler2D`; o Editor GLSL de Tela oferece apenas definições de estágio
de pós-processamento.

```glsl
// Gerado por Dados do usuário:
// uniform vec3 albedo;
// uniform float roughness;
// uniform sampler2D detailMap;

vec4 detail = texture(detailMap, vUv * 4.0);
vec3 color = albedo * detail.rgb;
```

## Resultado esperado

![Mapeamento de normais: detalhes finos de superfície a partir de uma normal procedural em espaço tangente](/images/content/lessons/normal-map.png)

![Reflexo de ambiente: o HDRI amostrado com a direção de visão refletida](/images/content/lessons/reflections.png)

## Exemplo mínimo: um mapa de normais procedural

```glsl run=editor example=normal-map title="Exemplo de mapa de normais"
#version 300 es
precision highp float;

in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec3 vWorldTangent;
in vec2 vUv;

uniform vec3 cameraPos;
uniform vec3 lightDir;

out vec4 fragColor;

void main(void)
{
    vec3 N = normalize(vWorldNormal);
    vec3 T = normalize(vWorldTangent - N * dot(N, vWorldTangent));
    vec3 B = cross(N, T);

    float frequency = 36.0;
    float dx = cos(vUv.x * frequency) * sin(vUv.y * frequency);
    float dy = sin(vUv.x * frequency) * cos(vUv.y * frequency);

    vec3 perturbed = normalize(N - normalStrength * (dx * T + dy * B));

    float NdotL = max(dot(perturbed, normalize(lightDir)), 0.0);
    fragColor = vec4(albedo * (0.12 + 0.88 * NdotL), 1.0);
}
```

## Exercícios

1. Mude a frequência do mapa de normais de `36.0` para `8.0`. O que acontece
   com a rugosidade aparente da superfície?
2. Defina `normalStrength` como `0.0`. A superfície fica plana ou só perde a
   perturbação?
3. Multiplique a UV por `4.0` ao amostrar a textura. O que muda, e qual estado
   de sampler faria ela repetir?
4. No exemplo de reflexos, mude `reflect(-viewDirection, normal)` para
   `reflect(viewDirection, normal)`. O que acontece com o reflexo?
5. Adicione uma linha `sampler2D` em Dados do usuário e amostre-a. Qual estágio
   ela precisa ter como alvo para ficar visível no shader de fragmentos?

::: solution Solução 1
Uma frequência menor significa saliências maiores e mais suaves. A perturbação
da normal varia mais devagar ao longo da superfície, então os brilhos
especulares ficam mais amplos.
:::

::: solution Solução 2
A normal perturbada passa a ser a normal geométrica; a superfície é iluminada
como se não tivesse mapa de normais, mas a geometria subjacente não muda.
:::

::: solution Solução 3
A textura se repete quatro vezes ao longo do intervalo de UV. Isso só funciona
se o sampler fizer wrapping com **repeat**; com clamp, os pixels da borda
esticam em vez disso.
:::

::: solution Solução 4
A direção refletida aponta para dentro da superfície, então a consulta ao
cubemap retorna o ambiente atrás do objeto. O reflexo aparece invertido.
:::

::: solution Solução 5
`Frag` (ou `Todos`). Uma declaração só em `Vert` não é visível no shader de
fragmentos, e uma declaração `Pós` só chega aos passes de efeito.
:::

## Erros comuns

- Declarar um uniform que Dados do usuário já gera.
- Esquecer de decodificar um mapa de normais (`rgb * 2.0 - 1.0`).
- Usar a `normal` do vértice como base do mapa de normais sem uma tangente.
- Amostrar um cubemap com uma UV em vez de uma direção.
- Esperar que `texture()` faça wrapping quando o sampler está com clamp.

## Próximos passos

- [Iluminação: Lambert](/docs/lighting-lambert)
- [Iluminação: IBL](/docs/lighting-ibl)
- [Dados do usuário](/docs/user-data)
