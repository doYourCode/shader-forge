---
title: "Glossário"
description: Definições curtas dos termos de gráficos e GLSL usados nas lições, com links de referência para a página que cobre cada um.
section: reference
order: 1
difficulty: beginner
draft: false
---

# Glossário

Os termos são definidos onde são usados, mas esta página é a consulta
rápida. Na prosa das lições, um termo envolvido como
`[[albedo|a cor base de uma superfície]]` é renderizado como uma definição
exibida ao passar o mouse:

> O [[albedo|a cor difusa de base de uma superfície, antes da iluminação]] é
> multiplicado pelo termo do cosseno.

A definição é escrita no próprio texto, então continua editável no Pages CMS.

## A–F

| Termo | Definição | Onde |
| --- | --- | --- |
| **Albedo** | A cor difusa de base de uma superfície, antes da iluminação. Linear no shader. | [Texturas e dados](/docs/textures-and-data) |
| **Atributo** | Entrada por vértice fornecida pela malha, declarada com `in` no estágio de vértice. | [Referência da ABI](/docs/abi-reference) |
| **BRDF** | Função de distribuição de reflectância bidirecional: como uma superfície reflete luz entre duas direções. | [Cook-Torrance](/docs/lighting-cook-torrance) |
| **Clip space** | Coordenadas homogêneas produzidas por `projection * view * world`; a GPU divide por `w`. | [Matemática para shaders](/docs/math-for-shaders) |
| **Cook-Torrance** | Uma BRDF de microfaceta montada a partir de uma distribuição, um termo de geometria e Fresnel. | [Cook-Torrance](/docs/lighting-cook-torrance) |
| **Espaço de mundo** | O sistema de coordenadas compartilhado da cena em que a direção da luz é definida. | [Matemática para shaders](/docs/math-for-shaders) |
| **Espaço de visão** | Coordenadas relativas à câmera; profundidade e normais no G-buffer de espaço de tela estão em espaço de visão. | [Editor GLSL de Tela](/docs/screen-space-editor) |
| **Espaço linear** | Valores proporcionais à luz física; o espaço em que a matemática de iluminação está correta. | [Cor e espaço linear](/docs/color-and-linear) |
| **Espaço tangente** | Um referencial de coordenadas na superfície, usado para armazenar mapas de normais. | [Texturas e dados](/docs/textures-and-data) |
| **Especular** | A parte espelhada de uma reflexão, concentrada em torno da direção de reflexão. | [Phong](/docs/lighting-phong) |
| **F0** | Reflectância de Fresnel em incidência normal. `0.04` para a maioria dos dielétricos; a cor base para metais. | [Cook-Torrance](/docs/lighting-cook-torrance) |
| **fBm** | Movimento browniano fractal: várias oitavas de ruído somadas com amplitude decrescente. | [Padrões, ruído e SDFs](/docs/patterns-noise-sdf) |
| **Fragmento** | Um pixel candidato produzido pela rasterização; o shader de fragmentos executa uma vez por fragmento coberto. | [O pipeline de renderização](/docs/the-rendering-pipeline) |
| **Fresnel** | A tendência de uma superfície de refletir mais luz em ângulos rasantes. | [Cook-Torrance](/docs/lighting-cook-torrance) |

## G–N

| Termo | Definição | Onde |
| --- | --- | --- |
| **G-buffer** | Um conjunto de render targets que guardam dados da cena (profundidade, normal, albedo, material, velocidade) para passes posteriores. | [Pós-processamento e o G-buffer](/docs/post-processing) |
| **GGX** | Uma distribuição de normais de microfaceta com uma cauda longa e realista de brilho especular. | [Cook-Torrance](/docs/lighting-cook-torrance) |
| **HDR** | Faixa dinâmica alta: valores lineares que podem ultrapassar `1.0` até a transformação de exibição. | [Cor e espaço linear](/docs/color-and-linear) |
| **HDRI** | Uma imagem de alta faixa dinâmica, normalmente um ambiente equirretangular usado como cubemap. | [IBL](/docs/lighting-ibl) |
| **IBL** | Iluminação baseada em imagem: usar um mapa de ambiente como fonte de luz. | [IBL](/docs/lighting-ibl) |
| **Lambert** | O modelo difuso da lei do cosseno, `albedo * max(dot(N, L), 0)`. | [Lambert](/docs/lighting-lambert) |
| **Matriz de normais** | A inversa-transposta da matriz de mundo, usada para transformar normais. | [Matemática para shaders](/docs/math-for-shaders) |
| **Metálico** | Uma máscara em que `1` significa que a superfície é um metal (sem difuso, F0 tingido). | [IBL](/docs/lighting-ibl) |
| **NDC** | Coordenadas de dispositivo normalizadas: `x`/`y` em `[-1, 1]` após a divisão perspectiva. | [Matemática para shaders](/docs/math-for-shaders) |

## O–S

| Termo | Definição | Onde |
| --- | --- | --- |
| **Oren-Nayar** | Um modelo de difusão rugosa com um termo de retrorreflexão dependente da visão. | [Oren-Nayar](/docs/lighting-oren-nayar) |
| **Overdraw** | Sombrear o mesmo pixel mais de uma vez, normalmente por causa de camadas em tela cheia ou transparentes. | [Fundamentos de desempenho](/docs/how-the-gpu-executes-shaders) |
| **Phong** | Um modelo especular que compara a direção da luz refletida com a direção de visão. | [Phong](/docs/lighting-phong) |
| **Rugosidade** | Um parâmetro perceptivo de 0 a 1; o GGX eleva esse valor ao quadrado para obter o `alpha` da distribuição. | [Cook-Torrance](/docs/lighting-cook-torrance) |
| **SDF** | Campo de distância com sinal: uma função que retorna a distância com sinal até uma forma. | [Padrões, ruído e SDFs](/docs/patterns-noise-sdf) |
| **Split-sum** | A aproximação que torna a IBL em tempo real: radiância pré-filtrada vezes uma LUT de BRDF. | [IBL](/docs/lighting-ibl) |
| **sRGB** | A codificação perceptiva usada por imagens e pelo canvas. Decodifique para linear antes da matemática. | [Cor e espaço linear](/docs/color-and-linear) |

## T–Z

| Termo | Definição | Onde |
| --- | --- | --- |
| **Texel** | Um elemento de textura; o equivalente a um pixel em uma textura. | [Texturas e dados](/docs/textures-and-data) |
| **Tone mapping** | Uma curva que mapeia cor HDR ilimitada para a faixa exibível. | [Cor e espaço linear](/docs/color-and-linear) |
| **UV** | Coordenadas de textura normalizadas, normalmente em `[0, 1]`. | [Primeiros shaders no sandbox](/docs/first-shaders) |
| **Varying** | O nome antigo do GLSL ES 1.00 para um valor interpolado entre estágios; agora `out`/`in`. | [GLSL ES 3.00](/docs/gles-3-0-webgl2) |

## Relacionados

- [Trilha de aprendizagem](/docs/learning-path)
- [GLSL ES 3.00](/docs/gles-3-0-webgl2)
- [Referência rápida de GLSL](/docs/cheat-sheet)
