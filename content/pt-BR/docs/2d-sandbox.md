---
title: "Sandbox GLSL 2D"
description: Um editor de shader de tela cheia só de fragmentos, com vUv, uResolution e uTime, e nenhuma cena para configurar.
section: editors
order: 30
draft: false
---

# Sandbox GLSL 2D

O Sandbox GLSL 2D é um playground de fragmentos em tela cheia. Ele desenha um
único triângulo que cobre toda a viewport e deixa você escrever o shader de
fragmentos que o preenche. Não há malha, câmera, luz nem ambiente para
configurar. Na página inicial, ele também aparece com esse nome.

## O que é

O sandbox é um renderizador WebGL 2 pequeno e feito sob medida. Seu estágio de
vértice é interno e fixo: ele gera um triângulo de tela cheia sem buffers de
vértices nem atributos. Você edita exatamente um documento, o shader de
fragmentos, e a engine fornece três entradas para ele.

Use-o quando quiser:

- aprender ou ensinar GLSL com o menor ciclo de feedback possível;
- escrever padrões, gradientes, ruído, SDFs ou cenas com raymarching;
- prototipar um efeito de tela cheia antes de movê-lo para um passe de
  pós-processamento;
- trabalhar sem pensar em malhas, câmeras ou iluminação.

Se você precisa de geometria ou de um ambiente, use o
[Editor GLSL 3D](/docs/3d-editor). Se precisa da profundidade ou das normais da
cena, use o Editor GLSL de Tela.

## O que "2D" significa aqui

"2D" significa **um único shader de fragmentos sobre a viewport**, não a API
Canvas 2D e não uma cena de sprites. Você calcula uma cor para cada pixel a
partir de coordenadas, tempo e quaisquer uniforms que declarar. A saída é uma
única imagem RGBA.

## A tela

| Região                        | Controle               | O que faz                                                      |
| ----------------------------- | ---------------------- | -------------------------------------------------------------- |
| Barra de ferramentas esquerda | Marca                  | Volta para a página inicial.                                   |
| Barra de ferramentas esquerda | **Etapas do shader**   | Contém apenas **Fragmentos**.                                  |
| Barra de ferramentas esquerda | **Pós-efeito**         | Abre o fragmento do efeito selecionado na pilha.               |
| Barra de ferramentas esquerda | **Dados do shader**    | Contém apenas **Dados do usuário**.                            |
| Barra de ferramentas direita  | **Compilar**           | Compila a família de documentos ativa.                         |
| Barra de ferramentas direita  | menu **Exemplos**      | Carrega um fragmento já incluído no sandbox (`uv`, `gradient`, `pattern`, `noise`, `sdf`). |
| Barra de ferramentas direita  | **Pausar** / **Retomar** | Congela ou retoma a renderização e `uTime`.                    |
| Barra de ferramentas direita  | Alternador de idioma   | Troca o idioma da interface.                                   |
| Prévia                        | Badge da ABI           | Mostra `vUv · uResolution · uTime · user data · post effects`.  |
| Barra de status               | Posição do cursor, status | Mostra linha/coluna e o último estado de compilação.        |

O sandbox **não** tem controle de copiar código-fonte, alternador de wireframe,
menu de modelo nem menu de ambiente. Seu grupo de etapas não tem documento de
vértices, porque o estágio de vértice não é editável. Ele tem, sim, cinco
exemplos incluídos e uma [Trilha de aprendizagem](/docs/learning-path).

## Seu primeiro fragmento

O documento padrão é uma ondulação animada. Substitua-o por este exemplo menor
para ver o contrato:

```glsl
#version 300 es
precision highp float;

in vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    // -1..1, corrigido para que círculos permaneçam circulares em qualquer formato de canvas.
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;

    float radius = length(p);
    float ring = 1.0 - smoothstep(0.50, 0.55, radius);

    vec3 color = mix(vec3(0.04, 0.07, 0.12), vec3(0.15, 0.85, 0.95), ring);
    color *= 0.85 + 0.15 * sin(uTime + radius * 12.0);

    fragColor = vec4(color, 1.0);
}
```

O que cada parte faz:

- `vUv` vai de `(0, 0)` no canto inferior esquerdo a `(1, 1)` no canto superior
  direito.
- `uResolution` é o tamanho do buffer de desenho em pixels, então a correção de
  proporção mantém o anel circular quando o painel não é quadrado.
- `uTime` avança em segundos enquanto a prévia está rodando e para quando você
  pausa.
- `fragColor` é a única saída. Mantenha o alpha em `1.0`; o canvas é opaco e o
  alpha não é composto contra a página.
- `#version 300 es` deve ser a primeira linha, e a precisão de float deve ser
  declarada antes de qualquer declaração de float.

Pressione **Compilar**. Se o fragmento compilar, a prévia atualiza na hora; se
falhar, a imagem anterior permanece e o painel de erros explica o motivo.

## O contrato do shader

### Entradas

| Nome          | Tipo   | Significado                                                             |
| ------------- | ------ | ----------------------------------------------------------------------- |
| `vUv`         | `vec2` | Coordenada de tela normalizada. `(0, 0)` no canto inferior esquerdo, `(1, 1)` no canto superior direito. |
| `uResolution` | `vec2` | Tamanho do buffer de desenho em pixels.                                 |
| `uTime`       | `float` | Segundos; congelado enquanto a prévia está pausada.                    |

Declare cada entrada que usar; a engine vincula os valores por nome, mas não
declara os uniforms para você. O exemplo acima declara `vUv`, `uResolution` e
`uTime`.

### Saída

```glsl
out vec4 fragColor;
```

Uma única saída RGBA. O canvas é opaco, então o alpha não é composto contra a
página.

### O que você não pode declarar

- Não há documento de vértices, então você não pode adicionar atributos nem
  escrever varyings personalizados. `vUv` é o único varying.
- `uResolution` e `uTime` são nomes reservados; os dados do usuário não podem
  reutilizá-los.
- `samplerCube` não está disponível no painel Dados do usuário do sandbox,
  porque o sandbox não tem fonte de textura cúbica. Use `sampler2D`.
- Não há entradas por malha: nada de normais, tangentes, conjuntos de UV ou
  cores de vértice.

Os dados do usuário são a forma suportada de adicionar seus próprios uniforms e
samplers. Veja [Dados do usuário](/docs/user-data).

## Coordenadas e proporção

`vUv` é normalizado, então independe do tamanho do canvas. Converta-o para uma
faixa de coordenadas centrada antes de fazer qualquer coisa radial:

```glsl
vec2 p = vUv * 2.0 - 1.0;          // -1..1 nos dois eixos
p.x *= uResolution.x / uResolution.y; // corrige para painéis não quadrados
```

`uResolution` é medido em **pixels do dispositivo**, não em pixels CSS. O
sandbox limita o device pixel ratio a 2 para manter painéis grandes com custo
aceitável, então em uma tela de alta densidade `uResolution` é no máximo o dobro
do tamanho CSS.

## Tempo e pausa

`uTime` começa em zero na sessão e só acumula enquanto a prévia está rodando.
**Pausar** interrompe a animação por completo; **Retomar** continua a partir do
mesmo valor. Isso é diferente do Editor GLSL 3D, onde o relógio do shader segue
o tempo real e salta para a frente depois de uma pausa.

Uma compilação feita com a prévia pausada ainda desenha um quadro, então você
pode iterar sobre uma imagem congelada.

## Dados do usuário no sandbox

O painel Dados do usuário é a mesma tabela do Editor GLSL 3D, com duas
diferenças:

- Os tipos excluem `samplerCube`.
- As etapas são apenas **Frag**, **Pós** e **Todos**. **Frag** atinge o
  fragmento base; **Pós** atinge cada passe de efeito; **Todos** atinge os dois.

As declarações geradas para o fragmento base são injetadas depois do cabeçalho
de `#version`/precisão. As declarações para efeitos de pós-processamento,
em vez disso, são injetadas em cada passe de efeito.

## Efeitos de pós-processamento no sandbox

O sandbox tem a mesma pilha de efeitos de pós-processamento do Editor GLSL 3D, e
a mesma ABI. Porém, não há geometria de cena por trás dela, então as entradas de
geometria são neutras:

- `gbufferTexture` é uma textura 1×1 contendo uma normal neutra.
- `depthTexture` é uma textura 1×1; `cameraNear` é `0` e `cameraFar` é `1`.
- Todas as matrizes de câmera são identidade.

Efeitos que usam apenas `textureSampler`, `resolution`, `texelSize`, `time` e
seus próprios uniforms funcionam normalmente. Efeitos que leem normais,
profundidade ou matrizes de câmera não têm nada significativo para ler e vão
parecer no-ops. Veja [Efeitos de pós-processamento](/docs/post-effects).

## Limites

- Um documento de fragmentos e uma pilha de efeitos de pós-processamento. Sem
  estágio de vértice, sem cena, sem assets integrados.
- Sem copiar código-fonte, sem exportação, sem salvar. Recarregar a página
  redefine o documento.
- WebGL 2 é obrigatório.
- Abaixo de 860 px de largura de viewport, os painéis se empilham na vertical, e
  a prévia mantém a própria linha.

Veja [Limites e solução de problemas](/docs/limits-and-troubleshooting).

## Relacionados

- [Editor GLSL 3D](/docs/3d-editor)
- [Dados do usuário](/docs/user-data)
- [Efeitos de pós-processamento](/docs/post-effects)
- [Compilação e erros](/docs/compiling-and-errors)
