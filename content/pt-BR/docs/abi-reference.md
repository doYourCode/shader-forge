---
title: "Referência da ABI"
description: Todos os atributos, uniforms e samplers que os três editores vinculam, gerados a partir de materialAbi.ts, postEffectAbi.ts e screenSpaceAbi.ts.
section: api
order: 0
generated: true
draft: false
---

<!-- GENERATED FILE: run `npm run docs:abi` after changing an ABI declaration. Do not edit by hand. -->

# Referência da ABI

Esta página é o contrato entre o seu GLSL e o renderizador. Todo nome abaixo é
declarado pela engine antes de o seu código ser compilado, então declará-lo de
novo no editor gera uma declaração duplicada. As tabelas são geradas a partir
das mesmas declarações TypeScript que os binders usam: se um nome não está aqui,
o editor não o fornece.

| Editor | Rota | Origem da ABI |
| --- | --- | --- |
| Editor GLSL 3D | `/editor` | `src/core/constants/materialAbi.ts` |
| Sandbox GLSL 2D | `/sandbox` | `src/core/constants/sandboxAbi.ts` |
| Efeitos de pós-processamento (3D e sandbox) | Aba Pós-efeito | `src/core/constants/postEffectAbi.ts` |
| Editor GLSL de Tela | `/screen-space` | `src/core/constants/screenSpaceAbi.ts` |

## Editor GLSL 3D: shader de superfície

### Atributos de vértice

Atributos são entradas de vértice, declaradas com `in`. Eles vêm da malha, não
de um bloco de uniforms.

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `position` | `vec3` | Posição do vértice no espaço de objeto/local; |
| `normal` | `vec3` | Direção da normal da superfície; |
| `tangent` | `vec3` | Direção da tangente para mapeamento de normais; |
| `uv` | `vec2` | Coordenadas de textura primárias; |
| `uv2` | `vec2` | Coordenadas de textura secundárias; |
| `color` | `vec4` | Cor do vértice (RGBA). |

### Uniforms

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `world` | `mat4` | Matriz de mundo da malha; |
| `view` | `mat4` | Matriz de visão da câmera; |
| `projection` | `mat4` | Matriz de projeção da câmera; |
| `time` | `float` | Segundos desde o início da animação; |
| `cameraPos` | `vec3` | Posição da câmera no espaço de mundo; |
| `lightDir` | `vec3` | Vetor de direção da luz direcional, no espaço de mundo. |
| `normalMatrix` | `mat3` | Matriz de mundo inversa-transposta, aplicada às normais. |

### Samplers

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `environmentMap` | `samplerCube` | HDRI ativo da cena; |
| `irradianceMap` | `samplerCube` | Irradiância difusa (cubemap de ambiente convoluído pelo cosseno); |
| `prefilteredEnvironmentMap` | `samplerCube` | Cubemap especular pré-filtrado com GGX (níveis de mip mais altos = mais rugoso); |
| `brdfLUT` | `sampler2D` | LUT de split-sum (R = bias, G = albedo); amostre em (NdotV, rugosidade) e depois faça mix(R, G, F0). |

## Efeitos de pós-processamento (Editor GLSL 3D e Sandbox GLSL 2D)

Cada efeito é um passe de fragmentos de tela cheia. `textureSampler` é a saída
do passe anterior; `textureSampler`, `gbufferTexture` e `depthTexture` são as
variantes da cena de superfície. O editor de tela tem o seu próprio G-buffer,
mais rico, listado abaixo.

### Uniforms

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `time` | `float` | Segundos desde o início da prévia. |
| `resolution` | `vec2` | Tamanho do render target em pixels. |
| `texelSize` | `vec2` | 1.0 / resolution, para deslocamentos de um texel no espaço de tela. |
| `cameraNear` | `float` | Plano próximo de clipping da câmera, em unidades de mundo. |
| `cameraFar` | `float` | Plano distante de clipping da câmera, em unidades de mundo. |
| `cameraPosition` | `vec3` | Posição da câmera no espaço de mundo. |
| `projection` | `mat4` | Matriz de projeção da câmera (do espaço de visão para o clip space). |
| `inverseProjection` | `mat4` | Projeção inversa, para reconstruir a posição no espaço de visão a partir da profundidade. |
| `view` | `mat4` | Matriz de visão da câmera (do espaço de mundo para o espaço de visão). |
| `inverseView` | `mat4` | Matriz de visão inversa (do espaço de visão para o espaço de mundo). |

### Samplers

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `textureSampler` | `sampler2D` | Saída do passe anterior; cor da cena em espaço linear para o primeiro efeito. |
| `gbufferTexture` | `sampler2D` | Normal no espaço de visão em rgb, codificada como n * 0.5 + 0.5; a = máscara de geometria. |
| `depthTexture` | `sampler2D` | Profundidade de visão linear normalizada em r: 0 = plano próximo, 1 = plano distante e o fundo limpo. Unidades de mundo: cameraNear + r * (cameraFar - cameraNear). |

O passe interno de exibição também possui `toneMappingMode` e reserva `vUV`,
`fragColor` e `gl_FragColor`. Não os redeclare.

## Editor GLSL de Tela

Efeitos de espaço de tela rodam sobre a cena HDR inteira. Eles podem ler o passe
anterior, a cor da cena intocada e cada attachment do G-buffer.

### Uniforms

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `time` | `float` | Segundos desde o início da prévia. |
| `resolution` | `vec2` | Tamanho do render target em pixels. |
| `texelSize` | `vec2` | 1.0 / resolution, para deslocamentos de um texel no espaço de tela. |
| `cameraNear` | `float` | Plano próximo de clipping da câmera, em unidades de mundo. |
| `cameraFar` | `float` | Plano distante de clipping da câmera, em unidades de mundo. |
| `cameraPosition` | `vec3` | Posição da câmera no espaço de mundo. |
| `projection` | `mat4` | Matriz de projeção da câmera (do espaço de visão para o clip space). |
| `inverseProjection` | `mat4` | Projeção inversa, para reconstruir a posição no espaço de visão a partir da profundidade. |
| `view` | `mat4` | Matriz de visão da câmera (do espaço de mundo para o espaço de visão). |
| `inverseView` | `mat4` | Matriz de visão inversa (do espaço de visão para o espaço de mundo). |
| `viewProjection` | `mat4` | Matriz combinada de visão * projeção (do espaço de mundo para o clip space). |
| `inverseViewProjection` | `mat4` | Inversa de viewProjection, para reconstruir a posição no espaço de mundo a partir da profundidade. |
| `previousViewProjection` | `mat4` | viewProjection do quadro anterior, usada para reprojetar os vetores de movimento. |
| `frameIndex` | `float` | Contador monotônico de quadros, útil para ruído temporal e jitter. |
| `deltaTime` | `float` | Segundos decorridos desde o quadro anterior. |

### Samplers do G-buffer

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `textureSampler` | `sampler2D` | Saída do passe anterior; o primeiro passe recebe a cor da cena HDR. |
| `sceneColorTexture` | `sampler2D` | A cor da cena HDR original e sem modificação (não o passe anterior). |
| `depthTexture` | `sampler2D` | Profundidade linear no espaço de visão em unidades de mundo (distância positiva); o fundo é o plano distante. |
| `normalTexture` | `sampler2D` | Normal no espaço de visão codificada como n * 0.5 + 0.5 em rgb; a = máscara de geometria (1 na geometria, 0 no fundo). |
| `albedoTexture` | `sampler2D` | Cor base linear codificada com sqrt em rgb (eleve ao quadrado para decodificar); a = máscara de geometria. |
| `materialTexture` | `sampler2D` | Refletividade PBR: rgb = F0 especular, a = glossiness (1 - rugosidade). Reconstrua o metálico a partir de F0 comparado ao albedo. |
| `velocityTexture` | `sampler2D` | Vetores de movimento lineares no espaço UV em rg; os valores podem ser negativos. |

### Nomes exclusivos do passe de exibição

O passe interno de exibição adiciona estes nomes além da ABI pública. Eles são
visíveis no shader de exibição compilado, nunca no código do seu efeito, e ficam
reservados para que os dados do usuário não colidam com eles.

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `toneMappingMode` | `float` | Transformação de saída selecionada na pilha de efeitos: 0 = linear para sRGB, 1 = Reinhard, 2 = ACES. |
| `debugMode` | `float` | Seletor de visualização de depuração do G-buffer. 0 = imagem final; os valores são declarados em screenSpaceDebug.ts. |

| Nome | Tipo GLSL | Descrição |
| --- | --- | --- |
| `transparentTexture` | `sampler2D` | Cor da sobreposição transparente/transmissiva. Presente apenas quando TRANSPARENT_OVERLAY_ENABLED é true; caso contrário, essas superfícies são renderizadas no passe principal. |

O passe de exibição também reserva `vUV`, `fragColor` e `gl_FragColor`.

## Sandbox GLSL 2D

O sandbox não tem estágio de vértice editável. Um triângulo de tela cheia
interno fornece `vUv`, e a engine fornece os uniforms de resolução e tempo.

| Nome | Declaração | Descrição |
| --- | --- | --- |
| `vUv` | `in vec2` | Coordenada de tela normalizada vinda do triângulo de tela cheia interno; xy em [0, 1]. |
| `uResolution` | `uniform vec2` | Tamanho do buffer de desenho em pixels (já multiplicado pelo device pixel ratio limitado). |
| `uTime` | `uniform float` | Segundos desde o início da prévia; congelado enquanto pausado. |

O sandbox também reserva todos os nomes de pós-efeito, porque a mesma tabela de
Dados do usuário pode se aplicar tanto ao fragmento base quanto à cadeia de
pós-efeito.

## Nomes de funções auxiliares derivadas

O efeito de tela padrão declara funções auxiliares além dos samplers acima.
Elas não são uniforms da engine, mas documentam a codificação que o G-buffer
usa:

| Auxiliar | Retorna |
| --- | --- |
| `gbufferAlbedo(uv)` | Albedo linear (o attachment é codificado com sqrt). |
| `gbufferRoughness(uv)` | `1.0 - materialTexture.a`. |
| `gbufferMetallic(uv)` | Metálico reconstruído a partir de F0 e do albedo. |
| `gbufferViewPosition(uv)` | Posição no espaço de visão reconstruída a partir da profundidade e da projeção inversa. |

## Relacionados

- [Editor GLSL de Tela](/docs/screen-space-editor)
- [Efeitos de pós-processamento](/docs/post-effects)
- [Dados do usuário](/docs/user-data)
- [GLSL ES 3.00](/docs/gles-3-0-webgl2)
- [Depuração de shaders](/docs/debugging-shaders)
- [Referência rápida de GLSL](/docs/cheat-sheet)

## Regenerar esta página

```bash
npm run docs:abi
```

`predev`, `prebuild` e `pretest` executam o mesmo comando, então a página é
reconstruída antes do app, do bundle de produção e da suíte de testes. O
teste de drift `src/core/content/abiReference.test.ts` compara o arquivo
versionado com este builder e falha se os dois divergirem.
