---
title: "Editor GLSL 3D"
description: Escreva um par de shaders de vértices e fragmentos para uma malha, compile-o e veja a prévia em um modelo sob um ambiente HDR.
section: editors
order: 20
draft: false
---

# Editor GLSL 3D

O Editor GLSL 3D é a bancada de trabalho de materiais de superfície. Você
escreve um par de shaders de vértices e fragmentos, o app fornece a malha, a
câmera, a luz e as entradas de ambiente, e o Babylon.js renderiza o resultado em
tempo real. Na página inicial, ele também aparece com esse nome.

## O que é

Você está sombreando uma superfície, não montando uma cena. O modelo, a câmera,
a luz direcional e o ambiente HDR são escolhidos de um catálogo fixo; seu shader
decide como a superfície responde a eles. Os dois estágios são compilados
juntos, então o estágio de fragmento só consegue ler varyings que o estágio de
vértice realmente escreve.

Use-o quando quiser:

- montar um material do zero e vê-lo em uma malha real;
- experimentar modelos de iluminação, normais, tangentes e coordenadas de
  textura;
- ler um ambiente HDR para iluminação baseada em imagem difusa e especular;
- expor alguns parâmetros como controles ao vivo em **Dados do usuário**;
- empilhar efeitos de pós-processamento sobre a cena sombreada.

Para um shader de tela cheia sem geometria, use o
[Sandbox GLSL 2D](/docs/2d-sandbox). Para pós-processar uma cena inteira com um
G-buffer, use o [Editor GLSL de Tela](/docs/screen-space-editor). A aba
Pós-efeito aqui só enxerga esta única malha e a ABI de pós-efeito de superfície.

## A tela

A tela se divide em uma área de documentos à esquerda e uma prévia ao vivo à
direita, com uma barra de status na parte inferior.

| Região                        | Controle                       | O que faz                                                                        |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| Barra de ferramentas esquerda | Marca                          | Volta para a página inicial.                                                     |
| Barra de ferramentas esquerda | **Etapas do shader**           | Abre os documentos **Vértices** e **Fragmentos**.                                |
| Barra de ferramentas esquerda | **Pós-efeito**                 | Abre o fragmento do efeito selecionado na pilha de efeitos de pós-processamento. |
| Barra de ferramentas esquerda | **Dados do shader**            | Abre **Dados do usuário**, **Atributos** e **Uniformes**.                        |
| Barra de ferramentas esquerda | **Exemplos**                   | Abre o seletor de exemplos incluídos.                                            |
| Painel esquerdo               | Copiar código do shader        | Copia o documento ativo com o bloco de dados do usuário gerado.                  |
| Barra de ferramentas direita  | **Compilar**                   | Compila a família de documentos da aba ativa.                                    |
| Barra de ferramentas direita  | **Cfg** → **Toggle Wireframe** | Desenha a malha como wireframe.                                                  |
| Barra de ferramentas direita  | **Pausar** / **Retomar**       | Para ou reinicia a renderização.                                                 |
| Barra de ferramentas direita  | Alternador de idioma           | Troca o idioma da interface.                                                     |
| Prévia                        | **Model**                      | Troca a malha.                                                                   |
| Prévia                        | **Environment**                | Troca o ambiente HDR.                                                            |
| Barra de status               | Posição do cursor e status     | Mostra linha/coluna e o último estado de compilação.                             |

A prévia também mostra uma sobreposição de carregamento enquanto um modelo ou
ambiente carrega, e um painel de erros quando uma compilação falha. `Cfg`,
`Model`, `Environment` e `Toggle Wireframe` são, por enquanto, rótulos apenas em
inglês.

## Documentos

| Documento        | Editável | Contém                                                                       |
| ---------------- | -------- | ---------------------------------------------------------------------------- |
| Vértices         | Sim      | Estágio de vértice: atributos na entrada, varyings e `gl_Position` na saída. |
| Fragmentos       | Sim      | Estágio de fragmento: varyings e uniforms na entrada, `fragColor` na saída.  |
| Pós-efeito       | Sim      | Fragmento do efeito selecionado na pilha.                                    |
| Dados do usuário | Tabela   | Uniforms e texturas; o app gera e injeta o GLSL deles.                       |
| Atributos        | Não      | Referência integrada gerada a partir da ABI do material.                     |
| Uniformes        | Não      | Referência integrada gerada a partir da ABI do material.                     |

Os documentos **Atributos** e **Uniformes** são somente leitura. Eles descrevem
os nomes que a engine vincula; não são código extra que você possa editar.

## Fluxo de trabalho

1. Escolha um **Model** e um **Environment** se os padrões não servirem ao
   material. O ambiente alimenta os samplers de iluminação baseada em imagem.
2. Comece pelo par padrão ou carregue um exemplo em **Exemplos**. Carregar um
   exemplo é destrutivo: ele substitui os dois estágios e todo o documento de
   Dados do usuário.
3. Edite os documentos **Vértices** e **Fragmentos**. Mantenha os varyings deles
   em sincronia.
4. Pressione **Compilar**. A primeira compilação acontece automaticamente quando
   a prévia fica pronta; depois disso, o botão é o gatilho.
5. Se a compilação falhar, leia o painel de erros. Clique em um erro para ir até
   a linha dele; a imagem anterior continua na tela.
6. Adicione entradas em **Dados do usuário** para os valores que você quer
   ajustar sem editar código. Mudanças de valor são aplicadas imediatamente;
   mudanças estruturais reconstroem o shader.
7. Adicione **Efeitos de pós-processamento** se a superfície precisar de
   grading, desfoque ou outro passe em espaço de tela.
8. Use **Copiar código do shader** para levar o documento ativo consigo, com o
   bloco gerado incluído.

## O contrato do shader

### Pareamento de estágios

Os estágios de vértice e de fragmento são compilados como um único programa. Um
varying precisa ter o mesmo nome e o mesmo tipo nos dois estágios, e os atributos
só são visíveis no estágio de vértice. Se você substituir um estágio, verifique
as declarações do outro.

### Atributos

Entradas de vértice fornecidas pela malha:

| Nome       | Tipo   | Significado                                   |
| ---------- | ------ | --------------------------------------------- |
| `position` | `vec3` | Posição do vértice no espaço de objeto/local. |
| `normal`   | `vec3` | Normal do vértice.                            |
| `tangent`  | `vec3` | Direção da tangente, para mapa de normais.    |
| `uv`       | `vec2` | Coordenadas de textura primárias.             |
| `uv2`      | `vec2` | Coordenadas de textura secundárias.           |
| `color`    | `vec4` | Cor do vértice (RGBA).                        |

### Uniformes

Valores que a engine escreve a cada quadro:

| Nome           | Tipo    | Significado                                                        |
| -------------- | ------- | ------------------------------------------------------------------ |
| `world`        | `mat4`  | Matriz de mundo da malha.                                          |
| `view`         | `mat4`  | Matriz de visão da câmera.                                         |
| `projection`   | `mat4`  | Matriz de projeção da câmera.                                      |
| `normalMatrix` | `mat3`  | Matriz de mundo inversa-transposta, usada para normais.            |
| `time`         | `float` | Segundos no relógio da prévia.                                     |
| `cameraPos`    | `vec3`  | Posição da câmera no espaço de mundo.                              |
| `lightDir`     | `vec3`  | Direção da luz direcional no espaço de mundo (veja a nota abaixo). |

O Babylon.js define `lightDir` como a direção em que a luz viaja. Os exemplos
incluídos usam esse valor diretamente como `L` em `dot(N, L)`, o que o trata como
a direção que aponta para a luz; inverta o sinal se quiser a convenção
fisicamente correta.

### Samplers

Texturas vinculadas pela prévia:

| Nome                        | Tipo          | Significado                                                                                                         |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `environmentMap`            | `samplerCube` | O cubemap do ambiente HDR ativo.                                                                                    |
| `irradianceMap`             | `samplerCube` | Ambiente convoluído por cosseno, usado como irradiância difusa.                                                     |
| `prefilteredEnvironmentMap` | `samplerCube` | Cubemap especular pré-filtrado por GGX; níveis de mip mais altos são mais rugosos.                                  |
| `brdfLUT`                   | `sampler2D`   | Textura de consulta split-sum: `R` é bias, `G` é albedo. Amostre em `(NdotV, roughness)` e depois combine com `F0`. |

A engine vincula esses nomes, mas cada estágio ainda precisa declarar as entradas
que lê: um fragmento que usa a luz precisa de `uniform vec3 lightDir;`, e um
estágio de vértice que usa posições precisa de `in vec3 position;`.

### Saída

O estágio de fragmento escreve uma cor:

```glsl
layout(location = 0) out vec4 fragColor;
```

Comece todo estágio com `#version 300 es` e declare uma precisão de float, por
exemplo `precision highp float;`.

### Coordenadas

O Babylon.js usa um sistema de coordenadas **de mão esquerda**. O estágio de
vértice padrão monta o clip space como
`projection * view * world * vec4(position, 1.0)`. As normais são transformadas
com `normalMatrix`, não com `world`.

### Um par mínimo

Estes dois documentos formam um par completo e compilável. Use-os juntos: o
varying `vWorldNormal` é escrito pelo estágio de vértice e lido pelo estágio de
fragmento.

```glsl
// Vértice
#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix;

out vec3 vWorldNormal;

void main(void)
{
    vec4 worldPosition = world * vec4(position, 1.0);
    vWorldNormal = normalize(normalMatrix * normal);
    gl_Position = projection * view * worldPosition;
}
```

```glsl
// Fragmento
#version 300 es
precision highp float;

in vec3 vWorldNormal;

uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(lightDir);
    float ndl = max(dot(N, L), 0.0);
    fragColor = vec4(vec3(ndl), 1.0);
}
```

Este par ignora o ambiente e a posição da câmera; é um ponto de partida, não um
substituto do material padrão. Como os exemplos incluídos, ele trata `lightDir`
como a direção que aponta para a luz.

O par padrão no primeiro carregamento é mais rico: ele lê os mapas de ambiente
pré-filtrado e de irradiância, adiciona um termo de Fresnel e aplica uma curva
ACES. Abra os dois estágios e leia-os antes de alterar um deles isoladamente.

## Cena e assets

A prévia oferece cinco modelos: **Macaco** (o padrão), **Esfera**, **Cubo**,
**Coelho** e **Dragão**. Oferece cinco ambientes pré-assados:
**Estúdio de Madeira 17** (o padrão), **Peppermint Powerplant**,
**Pergola Walkway**, **Qwantani Sunrise** e **Mossy Forest**.

- Arraste na prévia para orbitar a câmera; use a roda para dar zoom. A distância
  da câmera é limitada.
- O modelo gira continuamente enquanto renderiza. **Pausar** interrompe o loop
  de renderização, então a rotação também para.
- Trocar de modelo ou de ambiente carrega de forma assíncrona. Um carregamento
  que falha restaura a seleção anterior.
- O ambiente alimenta `environmentMap`, `irradianceMap` e
  `prefilteredEnvironmentMap`. `brdfLUT` é gerado uma vez e é independente do
  ambiente selecionado.

## Exemplos

**Exemplos** abre doze materiais incluídos em três pastas:

- **Lighting**: Lambert, Phong, Blinn-Phong, Oren-Nayar, Cook-Torrance.
- **Surface**: Toon, Rim light, Normal map, Displacement, Environment
  reflection.
- **Image-based lighting**: IBL Metalness / Roughness, IBL Specular /
  Glossiness.

Cada pasta também é uma trilha de lições na
[Trilha de aprendizagem](/docs/learning-path). Os callouts **Open in editor**
dessas lições apontam por deep link para os mesmos ids, por exemplo
[`/editor?example=phong`](/editor?example=phong).

Carregar um exemplo **substitui** os dois estágios editáveis e todo o documento
de Dados do usuário. Ele não se funde com o seu trabalho atual. Os parâmetros do
exemplo são inseridos em Dados do usuário, que gera as declarações que o código
do exemplo espera; o código do exemplo não deve declará-las por conta própria.

## Compilação, erros e estado

- A primeira compilação roda automaticamente quando a prévia fica pronta.
- **Compilar** compila a família de documentos ativa: material para
  Vértices/Fragmentos/Atributos/Uniformes, cadeia de pós-efeitos para
  Pós-efeito.
- Digitar não compila. Mudanças de valor em Dados do usuário são aplicadas sem
  compilar; mudanças estruturais recompilam após um pequeno debounce.
- Uma compilação que falha deixa a última imagem bem-sucedida na tela e relata o
  erro no painel da prévia e na barra de status.
- `time` segue o tempo real. Pausar interrompe a renderização, mas a
  animação salta para a frente quando você retoma.

Veja [Compilação e erros](/docs/compiling-and-errors) para o comportamento
completo.

## Limites

- Os catálogos de modelos e ambientes são fixos; você não pode enviar um arquivo
  GLB nem um HDR.
- Não é possível salvar, exportar nem compartilhar. **Copiar código do shader**
  é a única forma de tirar código do editor 3D.
- Um material fica ativo por vez. Os exemplos o substituem.
- WebGL 2 é obrigatório.

Veja [Limites e solução de problemas](/docs/limits-and-troubleshooting) para a
lista completa.

## Relacionados

- [Trilha de aprendizagem](/docs/learning-path)
- [Sandbox GLSL 2D](/docs/2d-sandbox)
- [Editor GLSL de Tela](/docs/screen-space-editor)
- [Dados do usuário](/docs/user-data)
- [Efeitos de pós-processamento](/docs/post-effects)
- [Referência da ABI](/docs/abi-reference)
- [Compilação e erros](/docs/compiling-and-errors)
- [O pipeline de renderização](/docs/the-rendering-pipeline)
