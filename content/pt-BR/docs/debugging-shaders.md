---
title: "Depuração de shaders"
description: Leia o painel de erros, use cor como printf, isole um termo de cada vez e corrija os erros que o catálogo de diagnósticos já conhece.
section: debugging
order: 1
difficulty: intermediate
prerequisites: gles-3-0-webgl2
editor: sandbox
example: sdf
draft: false
---

# Depuração de shaders

## Objetivo

Transforme uma tela preta ou uma cor errada em uma pergunta específica, responda
a ela com uma saída de depuração e use o painel de erros em vez de adivinhar.
Esta página é a metade de depuração da trilha de lições; a
[Referência rápida de GLSL](/docs/cheat-sheet) tem a sintaxe, e a página
[Fundamentos de desempenho](/docs/how-the-gpu-executes-shaders) cobre o
custo das correções.

## Os dois modos de falha

Só há duas coisas que podem dar errado:

1. **O shader não compila.** A prévia mantém o último programa bom, então a
   imagem pode continuar animando enquanto o painel de erros mostra um erro
   novo. Leia o painel, não o canvas.
2. **O shader compila, mas o resultado está errado.** O programa é válido,
   então o problema é um valor, um espaço de coordenadas ou uma suposição.
   Depure os valores.

## Como ler o painel de erros

Cada entrada mostra quatro coisas:

- **Tipo** — `Sintaxe`, `Tipo`, `Lógica`, `Vinculação`, `Compilador`,
  `Tempo esgotado` ou `Interno`.
- **Estágio e linha** — por exemplo `Shader de fragmentos · linha 12, col 5`.
- **Título** — a descrição amigável que o catálogo de diagnósticos produziu.
- **Mensagem bruta e sugestão** — o texto do driver seguido da correção
  sugerida.

Clique em uma entrada para revelá-la no editor quando o estágio tiver um buffer
de texto. Em vez disso, erros de `user_data` revelam a linha na tabela Dados do
usuário. Um erro de `link` não tem uma linha única; a sugestão diz para comparar
a saída do shader de vértices e a entrada do shader de fragmentos.

O painel é um resumo de `src/core/utils/glslDiagnostics.ts`. As regras são
ordenadas, com as mais específicas primeiro, então uma variante de driver que
contém várias frases ainda recebe a sugestão pretendida.

## Cor como printf

Não existe `printf` em GLSL, mas uma cor são quatro números na tela.
Substitua a cor final pelo valor que você quer inspecionar:

```glsl
// Inspecione um escalar em [0, 1].
fragColor = vec4(vec3(value), 1.0);

// Inspecione um valor com sinal: remapeie para [0, 1].
fragColor = vec4(vec3(value * 0.5 + 0.5), 1.0);

// Inspecione um vetor 2D como vermelho/verde.
fragColor = vec4(uv, 0.0, 1.0);

// Inspecione uma normal.
fragColor = vec4(normal * 0.5 + 0.5, 1.0);

// Inspecione uma máscara booleana.
fragColor = vec4(vec3(step(0.5, value)), 1.0);
```

A última é a mais útil para perguntas do tipo "esse ramo é alguma vez
tomado?": um booleano vira preto ou branco, sem rampa para interpretar.

## Isolar termos

Quando um resultado de iluminação está errado, não fique olhando para a cor
final. Reduza o shader a um termo de cada vez:

```glsl
float NdotL = max(dot(N, L), 0.0);
fragColor = vec4(vec3(NdotL), 1.0);   // primeiro: o termo difuso está correto?

float NdotV = max(dot(N, V), 1e-3);
fragColor = vec4(vec3(NdotV), 1.0);   // depois: o termo de visão está correto?

fragColor = vec4(F, 1.0);             // depois: o Fresnel está na faixa?
```

Se `NdotL` está preto em uma superfície que deveria estar iluminada, o problema
é `N` ou `L`, não a matemática do especular. Se `NdotL` está correto mas a cor
final está errada, o bug está mais adiante.

## Cinco perguntas que localizam quase tudo

1. **O shader está rodando?** Imprima um vermelho constante. Se o canvas
   continuar preto, o estágio não está executando ou o programa falhou ao ser
   vinculado.
2. **A entrada é o que eu penso?** Imprima `vUv`, `vWorldNormal`, uma textura
   amostrada ou um uniform diretamente.
3. **O espaço de coordenadas é o que eu penso?** Imprima `normal * 0.5 + 0.5`;
   uma normal no espaço de mundo e uma normal no espaço de visão parecem
   diferentes quando a câmera se move.
4. **O ramo é tomado?** Imprima `step(condition, 0.5)` ou uma máscara
   booleana.
5. **O valor está na faixa?** Valores negativos e valores acima de `1.0` são
   limitados quando escritos em um render target LDR. Remapeie valores com sinal
   e use o Editor GLSL de Tela quando precisar ver HDR.

## O catálogo de erros

A tabela reproduz as regras em `glslDiagnostics.ts`. O texto do driver aparece
ao lado do título amigável, então isto é uma consulta, não uma substituição.

| Título | Texto típico do driver | Correção |
| --- | --- | --- |
| `#version` must be on the first line | `#version` before/after another token | Mova `#version 300 es` para a linha 1. |
| `gl_FragColor` is not available | `gl_FragColor` / `gl_FragData` | Declare `layout(location = 0) out vec4 fragColor;` e atribua a ele. |
| `attribute`/`varying` is not available | `attribute`, `varying` | Use `in`/`out`; saída no shader de vértices, entrada no shader de fragmentos. |
| Missing fragment output | no output declared | Adicione a saída explícita `fragColor` e escreva nela em `main`. |
| Unexpected token | `unexpected token '…'` | Verifique a linha anterior em busca de um ponto e vírgula faltando ou de um colchete não fechado. |
| Missing token | `expected ';'` / `expected ')'` | Termine a instrução ou feche o colchete. |
| Syntax error | `syntax error` | Corrija o token destacado; verifique a linha acima. |
| Unfinished block | `unterminated`, `premature end of file` | Feche o `*/`, o `}` ou o `)`. |
| Unknown identifier | `undeclared identifier` | Corrija a ortografia ou declare o nome antes de usá-lo. |
| Duplicate declaration | `redefinition`, `already defined` | Renomeie uma das declarações, ou não redeclare um nome da ABI. |
| No matching function | `no matching overload` | Verifique a quantidade e os tipos dos argumentos; `texture(sampler, vec2)` em ES 3.00. |
| Type mismatch | `cannot convert`, `incompatible type` | Use um construtor explícito: `vec3(...)`, `float(...)`. |
| Missing precision qualifier | `precision` | Adicione `precision highp float;` depois de `#version`. |
| Missing entry point | `main` not found | Defina `void main(void)`. |
| Shaders do not match | link/varying mismatch | Dê ao varying o mesmo nome e o mesmo tipo nos dois estágios. |
| Unsupported feature | `unsupported`, `version`, `extension` | Reescreva com recursos do GLSL ES 3.00 ou habilite a extensão. |
| Reserved word | `reserved`, `keyword` | Escolha um identificador diferente. |
| Shader is too complex | `too many`, `out of memory`, `too complex` | Reduza a quantidade de iterações de laço, de uniforms ou de chamadas de função. |

## Resultado esperado

![Formas SDF: um exemplo amigável para depuração, com silhueta nítida e um traço](/images/content/lessons/sdf.webp)

Este exemplo é um bom alvo de depuração: o traço e o preenchimento são termos
separados de `step`/`smoothstep`, então você pode imprimir cada um de forma
independente.

## Exemplo mínimo: uma visualização de depuração da máscara

```glsl run=sandbox title="Visualização de depuração da máscara"
#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float distanceToCentre = length(p);
    float inside = step(distanceToCentre, 0.3);

    // Imprima a máscara diretamente: branco dentro, preto fora.
    fragColor = vec4(vec3(inside), 1.0);
}
```

## Exercícios

1. Pegue o exemplo SDF e imprima apenas `stroke`. Quais partes ficam brancas?
2. Imprima `normal * 0.5 + 0.5` no exemplo de deslocamento. O que você aprende
   sobre a normal ao longo da onda?
3. Quebre o shader de propósito: remova um ponto e vírgula. Qual título
   aparece, e qual linha fica destacada?
4. Declare `uniform float time;` em um shader que também usa o `time` da ABI.
   Que erro você recebe, e por quê?
5. No Editor GLSL de Tela, imprima `texture(depthTexture, vUV).r` diretamente.
   Por que o resultado fica quase branco no plano distante?

::: solution Solução 1
O traço é uma faixa estreita em torno da borda da forma, então só o contorno
fica branco; o interior e o fundo são pretos.
:::

::: solution Solução 2
A normal é, em grande parte, a normal da superfície sem deslocamento, com a onda
visível como uma variação suave. A normal do vértice não é recalculada a partir
da superfície deslocada, e é por isso que a iluminação é aproximada.
:::

::: solution Solução 3
`Missing ';'` ou `Syntax error` na linha seguinte ao ponto e vírgula que falta.
O compilador relata onde percebeu o problema, nem sempre a linha onde ele
ocorreu.
:::

::: solution Solução 4
Uma declaração duplicada. A ABI já declara `time`; declará-lo de novo é
rejeitado. Remova sua declaração e use o valor da engine.
:::

::: solution Solução 5
O buffer de profundidade armazena distâncias grandes no espaço de mundo;
escrito diretamente em uma cor LDR, tudo acima de `1.0` é limitado a branco.
Remapeie-o (`depth / cameraFar`) antes de exibir.
:::

## Erros comuns

- Depurar o canvas enquanto o painel de erros mostra uma falha de compilação.
- Imprimir um valor com sinal sem remapeá-lo e depois concluir que ele é zero.
- Esquecer que o último programa bom continua na tela.
- Presumir que um número de linha aponta a causa, em vez do primeiro token que o
  compilador não conseguiu analisar.
- Imprimir um uniform que a engine nunca vinculou; ele é lido como zero.

## Próximos passos

- [Fundamentos de desempenho](/docs/how-the-gpu-executes-shaders)
- [O catálogo de erros na referência do compilador](/docs/compiling-and-errors)
- [Referência rápida de GLSL](/docs/cheat-sheet)
