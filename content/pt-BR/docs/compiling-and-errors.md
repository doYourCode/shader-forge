---
title: "Compilação e erros"
description: Quando a compilação roda, o que o botão Compilar compila, como a fila se comporta e como ler os diagnósticos de shader.
section: reference
order: 40
draft: false
---

# Compilação e erros

O ShaderForge compila GLSL no navegador com o driver do WebGL 2. Esta página
explica quando uma compilação acontece, o que ela compila, o que a barra
de status significa e como chegar de uma mensagem de erro até a linha
problemática.

## Quando a compilação acontece

| Gatilho                                                                                    | O que compila                                                                                |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Primeiro carregamento de um editor                                                         | O material inicial e a cadeia de pós-efeitos.                                                |
| **Compilar** em Vértices, Fragmentos, Atributos ou Uniformes                               | O material.                                                                                  |
| **Compilar** em Pós-efeito                                                                 | A cadeia de pós-efeitos.                                                                     |
| Adicionar, remover, mover, ativar ou desativar um efeito                                   | A cadeia de pós-efeitos.                                                                     |
| Adicionar, remover, renomear, trocar o tipo ou o alvo de uma definição de Dados do usuário | O material após um pequeno debounce e, em seguida, a cadeia, se o material tiver dado certo. |
| Carregar um exemplo                                                                        | O material, após substituir os estágios e os Dados do usuário.                               |
| Trocar de aba                                                                              | Nada; só muda qual documento está aberto.                                                    |
| Digitar no editor                                                                          | Nada.                                                                                        |
| Mudar um valor de Dados do usuário                                                         | Nada; o valor é vinculado ao vivo.                                                           |
| Mudar a transformação de saída                                                             | Nada; o passe de exibição a lê como um uniform.                                              |

A primeira compilação é automática, porque a prévia não consegue renderizar sem
um programa. Depois disso, a compilação é explícita: edite e então pressione
**Compilar**.

## O alvo do botão Compilar

O editor compila a família de documentos da aba ativa:

| Aba ativa        | Alvo da compilação    |
| ---------------- | --------------------- |
| Vértices         | Material              |
| Fragmentos       | Material              |
| Atributos        | Material              |
| Uniformes        | Material              |
| Pós-efeito       | Cadeia de pós-efeitos |
| Dados do usuário | O alvo anterior       |

A aba Dados do usuário é uma tabela, não um documento de shader, por isso ela
não muda o alvo. Se você estava em Fragmentos, Compilar ainda compila o
material; se estava em Pós-efeito, compila a cadeia.

## A fila de compilação

- Só uma compilação roda por vez. As compilações de material e de pós-efeitos
  compartilham um único gravador de log do WebGL, então sobrepô-las atribuiria
  mensagens do driver ao alvo errado.
- Uma solicitação mais nova da mesma família substitui uma mais antiga que ainda
  não começou. A solicitação mais recente vence.
- Quando uma edição estrutural em Dados do usuário pede as duas coisas, o
  material compila primeiro e a cadeia só é compilada se o material tiver dado
  certo. Assim, um material quebrado não se esconde atrás de uma compilação de
  pós-efeitos bem-sucedida.
- Pressionar **Compilar** na aba Pós-efeito compila a cadeia diretamente; não
  recompila o material.

## A regra da última versão boa

Uma compilação que falha nunca destrói a imagem que está funcionando. O programa
anterior continua renderizando enquanto os novos diagnósticos são mostrados.
Isso vale para o material e para a cadeia de pós-efeitos: uma cadeia só é
instalada quando todos os passes compilaram.

Uma consequência: um canvas em branco não é o resultado normal de um erro de
shader. Se o canvas estiver em branco, procure uma falha antes da primeira
compilação bem-sucedida, um contexto WebGL perdido ou um shader que retorna uma
cor de fundo.

## Estados do status

A barra de status mostra um de quatro estados:

| Estado      | Rótulo     | Significado                                                              |
| ----------- | ---------- | ------------------------------------------------------------------------ |
| `idle`      | Ocioso     | Nenhuma compilação rodou para o documento atual, ou uma aba foi trocada. |
| `ready`     | Pronto     | A última compilação deu certo.                                           |
| `compiling` | Compilando | Uma compilação está rodando.                                             |
| `error`     | Erro       | A última compilação falhou, ou a prévia está indisponível.               |

Mensagens comuns incluem **Editor pronto**, **Compilação concluída**,
**Compilando…**, **Compilando efeitos de pós-processamento…**,
**Exemplo carregado: …** e **O programa de shader falhou ao ser vinculado**. A
barra também mostra a linha e a coluna do cursor.

## Como ler o painel de erros

O painel aparece no topo da prévia depois de uma falha. Cada entrada mostra:

- um badge de **tipo**: Sintaxe, Tipo, Lógica, Vinculação, Compilador, Tempo
  esgotado ou Interno;
- um **estágio e localização**, como "Shader de fragmentos · linha 12, col 5"
  ou "Dados do usuário · linha 2";
- um **título** curto, a **mensagem** do driver e uma linha de **sugestão**
  quando o app consegue sugerir uma correção;
- um alvo de clique que abre o documento certo e move o caret.

Falhas de shader também aparecem como um destaque de linha vermelha, um marcador
na gutter e um sublinhado ondulado no editor. Passar o mouse sobre o sublinhado
mostra a mensagem. Uma falha de Dados do usuário é mostrada destacando a linha
culpada em vez disso.

### Onde um clique leva você

| Estágio do erro             | Comportamento do clique                                           |
| --------------------------- | ----------------------------------------------------------------- |
| Shader de vértices          | Abre **Vértices**, exibe a linha e a coluna.                      |
| Shader de fragmentos        | Abre **Fragmentos**, exibe a linha e a coluna.                    |
| Efeito de pós-processamento | Seleciona o efeito com falha, abre **Pós-efeito**, exibe a linha. |
| Dados do usuário            | Abre **Dados do usuário** e destaca a linha culpada.              |
| Programa de shader          | Nenhuma linha é informada; a entrada não é clicável.              |

Um erro sem linha não pode ser revelado no editor. Isso geralmente significa que
a falha é no momento da vinculação, ou que o driver não informou uma posição.

## Tipos de erro

| Tipo       | Exibido como   | Causa típica                                                                            |
| ---------- | -------------- | --------------------------------------------------------------------------------------- |
| `syntax`   | Sintaxe        | Ponto e vírgula ou chave faltando, caractere solto, instrução inacabada.                |
| `type`     | Tipo           | Atribuir um `vec4` a um `vec3`, tipo de argumento errado, tipo de retorno errado.       |
| `logic`    | Lógica         | O driver rejeita uma construção que passa no parser, mas não é válida aqui.             |
| `link`     | Vinculação     | As interfaces de vértices e de fragmentos não batem, ou um nome é declarado duas vezes. |
| `program`  | Compilador     | Falha no nível do programa, sem uma única linha atribuível.                             |
| `timeout`  | Tempo esgotado | O driver não terminou de compilar dentro da janela do watchdog (15 s).                  |
| `internal` | Interno        | Uma falha do lado do app: alocação, perda de contexto ou um throw inesperado.           |

## Falhas comuns e correções

| Mensagem ou sintoma                       | Causa provável                                             | Correção                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `'foo' : undeclared identifier`           | A declaração está faltando neste estágio                   | Adicione uma entrada em Dados do usuário apontando para este estágio, ou declare a entrada da engine por conta própria. |
| `'foo' : redefinition`                    | Você declarou um nome que Dados do usuário também gera     | Remova a declaração manual; mantenha apenas a linha da tabela.                                                         |
| `syntax error` perto de uma linha         | `;`, `)` ou `}` faltando, ou um caractere extra            | Verifique a linha informada e a linha acima dela.                                                                      |
| Não é possível converter `vec4` em `vec3` | Largura de vetor incompatível                              | Use `.rgb`/`.xyz`, ou monte o componente que falta explicitamente.                                                     |
| O programa falha ao vincular, sem linha   | Os varyings diferem entre vértices e fragmentos            | Deixe nomes e tipos idênticos nos dois estágios.                                                                       |
| O fragmento não consegue ler um varying   | O estágio de vértice não o escreve                         | Adicione o `out` correspondente no estágio de vértice.                                                                 |
| Um uniform não tem efeito                 | Estágio errado, ou o shader não o lê                       | Verifique a coluna de estágio; no 3D, use **Pós** para efeitos de pós-processamento.                                   |
| A textura parece preta                    | Sem origem, ainda carregando ou o tipo de sampler errado   | Escolha uma origem válida; use **Textura 2D** para uma imagem 2D.                                                      |
| Tempo esgotado                            | Um shader muito grande ou patológico, ou um driver travado | Reduza o shader, recarregue a página e tente de novo.                                                                  |
| Erro interno                              | Perda de contexto ou falha de alocação                     | Recarregue a página. Se persistir, anote a mensagem e os detalhes do navegador/GPU.                                    |

## O que a compilação não faz

- Ela não salva o seu trabalho. Recarregar zera todos os documentos.
- Ela não compila a cada tecla digitada.
- Ela não compila WGSL. Os editores compilam GLSL ES 3.00.
- Ela não reinicia a câmera, o modelo selecionado nem o ambiente.
- Ela não substitui um shader com falha por uma imagem de fallback; a última
  imagem boa permanece.

## Relacionados

- [Depuração de shaders](/docs/debugging-shaders) — cor como printf e o
  catálogo completo de erros.
- [Editor GLSL 3D](/docs/3d-editor)
- [Sandbox GLSL 2D](/docs/2d-sandbox)
- [Editor GLSL de Tela](/docs/screen-space-editor)
- [Dados do usuário](/docs/user-data)
- [Efeitos de pós-processamento](/docs/post-effects)
- [Limites e solução de problemas](/docs/limits-and-troubleshooting)
