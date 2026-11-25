---
title: "Dados do usuário"
description: Declare uniforms e texturas em uma tabela. O ShaderForge gera o GLSL, injeta no momento da compilação e vincula os valores em tempo real.
section: reference
order: 20
draft: false
---

# Dados do usuário

**Dados do usuário** é a forma estruturada de adicionar seus próprios uniforms e
texturas sem editar declarações dentro do shader. Você preenche uma tabela; o
ShaderForge gera o GLSL, injeta no momento da compilação e vincula os valores
atuais a cada quadro.

## O que é

O painel tem uma linha por definição. Cada linha tem um nome, um tipo, um ou
mais estágios de destino e um controle de valor. As declarações geradas aparecem
no editor como um bloco somente leitura, e o mesmo bloco é inserido no
código-fonte que de fato é compilado.

O buffer do editor nunca é reescrito. O bloco gerado é um widget de prévia, não
texto do documento, então os números de linha e os diagnósticos continuam
correspondendo ao que você escreveu.

## Como o bloco gerado funciona

O app insere o bloco depois da sequência de cabeçalho inicial de um estágio:
depois de `#version`, `precision` e `#extension`, tolerando linhas em branco e
comentários no meio. Nada mais muda de lugar.

Para um `float` chamado `speed` com valor `1.5`, o bloco é:

```glsl
// >>> ShaderForge user data (managed block — edit it in the User data tab)
uniform float speed; // float
// current values: speed = 1.5
// <<< end ShaderForge user data >>>
```

O bloco nunca contém inicializadores; os valores ficam na tabela e são
vinculados por meio de uniforms. Não redigite o bloco, e não declare o mesmo
nome por conta própria: isso produziria uma declaração duplicada quando o bloco
é injetado.

No Editor GLSL 3D, **Copiar código do shader** copia o documento ativo com o
bloco incluído. O sandbox não tem controle de cópia.

## Tipos

| Tipo mostrado na tabela | GLSL gerado   | Controle           | Observações                                                              |
| ----------------------- | ------------- | ------------------ | ------------------------------------------------------------------------ |
| Float                   | `float`       | Número             |                                                                          |
| Vec2                    | `vec2`        | Dois números       |                                                                          |
| Vec3                    | `vec3`        | Três números       |                                                                          |
| Vec4                    | `vec4`        | Quatro números     |                                                                          |
| Cor                     | `vec3`        | Seletor de cor     | RGB, sem alpha                                                           |
| Cor (RGBA)              | `vec4`        | Seletor de cor     | RGBA                                                                     |
| Direção                 | `vec3`        | Três números       | Normalizado quando vinculado; um vetor zero é vinculado como `(0, 0, 0)` |
| Posição                 | `vec3`        | Três números       | Documentado como espaço de objeto; o app repassa o valor                 |
| Textura 2D              | `sampler2D`   | Seletor de textura | 3D e sandbox                                                             |
| Textura cúbica          | `samplerCube` | Seletor de textura | Somente 3D                                                               |

Não existem tipos matriz, array ou struct. Para uma matriz, monte-a no shader a
partir de vetores, ou use as matrizes da engine diretamente.

## Estágios

O estágio decide qual bloco gerado recebe a declaração. Os rótulos da tabela são
os que o painel mostra.

| Estágio mostrado | Editor GLSL 3D              | Sandbox GLSL 2D                                   |
| ---------------- | --------------------------- | ------------------------------------------------- |
| Frag             | Estágio de fragmento        | Fragmento base                                    |
| Vert             | Estágio de vértice          | Não oferecido                                     |
| Todos            | Vértice **e** fragmento     | Fragmento base **e** efeitos de pós-processamento |
| Pós              | Passes de pós-processamento | Passes de pós-processamento                       |

Dois detalhes importam:

- No Editor GLSL 3D, **Todos** significa "os dois estágios do material". Ele
  **não** inclui efeitos de pós-processamento. Para alcançar o estágio de
  vértice, o estágio de fragmento e os efeitos de pós-processamento, adicione
  duas definições com nomes diferentes: uma **Todos** e uma **Pós**.
- No sandbox, **Todos** inclui o fragmento base e todos os passes de
  pós-processamento, porque o sandbox não tem estágio de vértice.

Declarações destinadas a um estágio que o shader não usa são inofensivas, mas
invisíveis; se um uniform parece não fazer nada, verifique o estágio dele
primeiro.

## Edições de valor vs edições estruturais

| Edição                                       | Efeito                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| Mudar um valor (número, vetor, cor, textura) | Vincula em tempo real. Sem recompilação. Texturas carregam de forma assíncrona. |
| Adicionar ou remover uma definição           | Recompila após um pequeno debounce (cerca de 300 ms).                           |
| Renomear uma definição                       | Recompila.                                                                      |
| Mudar o tipo                                 | Recompila; o valor volta ao padrão do novo tipo.                                |
| Mudar o estágio                              | Recompila.                                                                      |

Como edições de valor não recompilam, você pode animar ou ajustar um parâmetro
enquanto a prévia continua rodando. Edições estruturais precisam reconstruir o
programa, porque as próprias declarações mudam.

Carregar um exemplo substitui o documento inteiro, então quaisquer definições
que você tenha adicionado são descartadas.

## Nomes

Um nome deve ser um identificador GLSL válido: letras, dígitos e sublinhados,
não começando com um dígito. Ele também deve ser único e não pode colidir com um
nome que a engine possui:

- Palavras reservadas do GLSL.
- Atributos, uniforms e samplers do material (`position`, `world`,
  `normalMatrix`, `environmentMap`, ...).
- Nomes de pós-processamento (`textureSampler`, `gbufferTexture`,
  `depthTexture`, `resolution`, `texelSize`, `cameraNear`, `cameraFar`,
  `cameraPosition`, `projection`, `inverseProjection`, `view`, `inverseView`,
  `time`, `vUV`, `fragColor`, ...).
- Nomes do sandbox (`uResolution`, `uTime`, `vUv`).
- Qualquer outra definição na mesma tabela.

O painel rejeita um nome inválido antes que ele chegue ao compilador, com uma
mensagem para identificador inválido, nome reservado ou duplicata.

## Texturas

Os tipos de textura usam um seletor de textura com três fontes:

- **Textura do repositório**: as texturas de xadrez incluídas,
  **UV Checker 01** e **UV Checker 02**.
- **URL personalizada…**: qualquer URL de imagem que o navegador consiga
  carregar.
- **Enviar imagem**: um arquivo local, mantido em memória durante a sessão.

Um `sampler2D` lê uma imagem 2D. Um `samplerCube` lê um cubemap e só é oferecido
no Editor GLSL 3D. Escolha uma fonte que corresponda à declaração: um sampler de
cubo não consegue ler um xadrez 2D, e um sampler 2D não consegue ler um cubemap.

Texturas carregam de forma assíncrona e a prévia é redesenhada quando uma fica
pronta. Uma definição sem fonte não tem o que vincular, e uma textura que ainda
não terminou de carregar ainda não está vinculada; não julgue o shader antes que
a textura apareça.

## Receitas

### Um controle de cor

1. Adicione uma definição chamada `tint`, tipo **Cor**, estágio **Frag**.
2. No estágio de fragmento, use-a:

```glsl
vec3 shaded = baseColor * tint;
fragColor = vec4(shaded, 1.0);
```

`tint` é declarado pelo bloco gerado, então o fragmento não deve declará-lo.
`baseColor` representa qualquer cor de superfície que seu shader já calcule.

### Um parâmetro animado

1. Adicione `speed`, tipo **Float**, estágio **Frag**, valor `2.0`.
2. Use-o com o relógio da engine:

```glsl
float pulse = 0.5 + 0.5 * sin(uTime * speed);
```

`uTime` é uma entrada do sandbox, então o fragmento deve declarar
`uniform float uTime;` (o fragmento padrão do sandbox já faz isso). Para o
Editor GLSL 3D, use `time` em vez disso e declare `uniform float time;` no
fragmento (o fragmento padrão do 3D já faz isso):

```glsl
float pulse = 0.5 + 0.5 * sin(time * speed);
```

### Uma amostragem de textura

1. Adicione `albedoMap`, tipo **Textura 2D**, estágio **Frag**.
2. Amostre-a com a entrada UV do estágio. O estágio de fragmento 3D recebe os
   varyings que seu estágio de vértice declara; o par padrão chama o UV primário
   de `vUv`. O sandbox tem `vUv` embutido. Declare o varying no estágio que o
   lê:

```glsl
in vec2 vUv;
vec3 albedo = texture(albedoMap, vUv).rgb;
```

## Solução de problemas

| Sintoma                                                    | Causa provável                                                         | Correção                                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| "Redefinition" ou declaração duplicada                     | O nome é declarado no shader e também em Dados do usuário              | Remova a declaração manual; mantenha a linha da tabela                              |
| O uniform não tem efeito                                   | Estágio errado, ou o shader nunca o lê                                 | Verifique a coluna do estágio; no 3D, use **Pós** para efeitos de pós-processamento |
| O efeito de pós-processamento não vê um uniform            | A definição é **Todos**, que exclui efeitos de pós-processamento no 3D | Adicione uma definição **Pós** (com um nome diferente)                              |
| A amostragem da textura sai preta                          | Sem fonte, ainda carregando, ou o tipo de sampler errado               | Escolha uma fonte; use **Textura 2D** para uma imagem 2D                            |
| O nome é rejeitado                                         | Identificador inválido, palavra reservada ou duplicata                 | Renomeie; evite nomes que a engine possui                                           |
| As mudanças de valor sumiram depois de carregar um exemplo | Exemplos substituem todo o documento de Dados do usuário               | Adicione a definição de novo, ou copie o valor antes de carregar                    |

## Relacionados

- [Editor GLSL 3D](/docs/3d-editor)
- [Sandbox GLSL 2D](/docs/2d-sandbox)
- [Efeitos de pós-processamento](/docs/post-effects)
- [Compilação e erros](/docs/compiling-and-errors)
