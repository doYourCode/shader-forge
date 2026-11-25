---
title: "Limites e solução de problemas"
description: Requisitos de navegador, o que não é salvo, limites dos editores, dicas de desempenho e correções para sintomas comuns.
section: reference
order: 50
draft: false
---

# Limites e solução de problemas

Esta página reúne os limites que são fáceis de atingir e as correções para os
sintomas mais comuns. Se outra página diz que um editor consegue fazer algo,
esta página diz o que ele não consegue fazer.

## Requisitos de navegador e hardware

- **WebGL 2 é obrigatório.** Os três editores criam um contexto WebGL 2. Não há
  fallback para WebGL 1 nem para canvas 2D.
- **Navegadores de desktop compatíveis:** Chrome e Edge atuais, Firefox atual e
  Safari 15 ou mais recente. O WebGL 2 é a base que essas versões trazem; um
  navegador sem ele não consegue rodar os editores.
- **A aceleração de hardware deve estar ativada.** Um renderizador por software
  consegue rodar os editores, mas a compilação e a animação ficam lentas.
- O Editor GLSL 3D e o Editor GLSL de Tela também usam Babylon.js;
  o Sandbox GLSL 2D usa um pequeno renderizador WebGL 2 dedicado. Os dois
  ainda exigem WebGL 2.
- Navegadores móveis não são um alvo compatível. Os editores têm layout para uma
  viewport de desktop, e a cena de espaço de tela é custosa.
- Se o navegador não conseguir criar um contexto WebGL 2, a prévia informa um
  erro em vez de renderizar. Tente um navegador desktop atual com a aceleração
  ativada.

## O que não é salvo

Nada é persistido. Não há conta, arquivo de projeto, salvamento automático nem
URL que codifique o seu shader. Recarregar a página zera:

- os dois estágios e a pilha de pós-efeitos;
- cada definição e cada valor de Dados do usuário;
- o modelo e o ambiente selecionados;
- a aba ativa e a câmera.

**Copiar código do shader** é a única exportação no editor 3D; o botão copia o
documento ativo com o bloco de dados do usuário gerado. O Sandbox GLSL 2D não
tem controle de cópia nem de exportação, então mantenha fragmentos importantes
fora da página.

## Idioma e conteúdo

A interface está disponível em inglês e em português do Brasil. A documentação
tem autoria em inglês por enquanto. Quando uma página ainda não tem tradução, o
app entrega o original em inglês e mostra um aviso de fallback; o conteúdo da
página fica em inglês mesmo que a interface esteja em português.

As árvores de conteúdo são gerenciadas no Pages CMS (`.pages.yml`). O contrato
de frontmatter das lições, os ids de seção e os modificadores de bloco de código
estão documentados em `docs/authoring-content.pt-BR.md`. Páginas
geradas, como a [Referência da ABI](/docs/abi-reference), são reconstruídas por
`npm run docs:abi`.

Alguns rótulos da prévia estão fixos em inglês no código: **Model**,
**Environment**, **Cfg** e **Toggle Wireframe**.

## Limites do Editor GLSL 3D

- O catálogo de modelos é fixo: Macaco, Esfera, Cubo, Coelho, Dragão. Não é
  possível enviar um GLB.
- O catálogo de ambientes é fixo: Estúdio de Madeira 17, Peppermint Powerplant,
  Pergola Walkway, Qwantani Sunrise, Mossy Forest. Não é possível enviar um HDR.
- Um material fica ativo. Carregar um exemplo substitui os dois estágios e todo
  o documento de Dados do usuário.
- A câmera orbita e dá zoom dentro de limites fixos de distância; não é possível
  mover o modelo nem adicionar luzes.
- A pilha de pós-efeitos recebe normais reais no espaço de visão, profundidade e
  matrizes de câmera, mas só para a malha única.
- Não há salvamento, exportação nem compartilhamento além de
  **Copiar código do shader**.

## Limites do Sandbox GLSL 2D

- Um documento de fragmento. O estágio de vértice é interno e não pode ser
  editado, então não há atributos nem varyings personalizados.
- Sem geometria, câmera, luz nem ambiente.
- O painel Dados do usuário não oferece `samplerCube`; só texturas `sampler2D`
  são aceitas.
- Sem exemplos incluídos, sem cópia do código, sem wireframe, sem menus de
  modelo ou de ambiente.
- Os efeitos de pós-processamento recebem normais neutras, profundidade neutra e
  matrizes de câmera identidade. Efeitos com base em profundidade e em normais
  não funcionam aqui.

## Limites dos efeitos de pós-processamento

- Efeitos são somente de fragmento; o estágio de vértice de tela cheia é
  interno.
- A pilha é linear. O passe de exibição aplica a transformação de saída e a
  codificação sRGB uma vez, no final.
- Uma cadeia só é instalada se todos os passes compilarem. Uma falha mantém a
  cadeia anterior.
- Efeitos desativados não são compilados e seus uniforms não são vinculados.
- Com a geometria neutra do sandbox, efeitos que dependem da geometria não
  produzem nada; eles ainda compilam.

## Limites do Editor GLSL de Tela

- Há uma cena disponível (Bistro) e o catálogo de HDRIs é fixo. Não há caminho
  de upload para nenhum dos dois.
- Efeitos são somente de fragmento; o estágio de vértice de tela cheia é
  interno.
- Os attachments do G-buffer só são solicitados quando os efeitos compilados ou
  a visualização de depuração ativa os leem. Adicionar um sampler a um efeito
  desativado não adiciona um passe.
- A ABI de espaço de tela é separada da ABI de pós-efeito de superfície. Um
  shader escrito para `gbufferTexture`/`depthTexture` não verá os mesmos dados
  lá.
- `materialTexture` armazena F0 e glossiness, não metallic/roughness.
  Decodifique-o com os helpers documentados antes de usá-lo.
- O render target de sobreposição transparente está desativado por padrão; a
  visualização de depuração dele fica oculta enquanto isso for verdade.
- A prévia reduz a resolução interna quando não alcança o orçamento de 60 fps
  (até 50%). A sobreposição de estatísticas mostra a escala atual.
- Não há salvamento, exportação nem compartilhamento além de
  **Copiar código do shader**, e nada persiste entre recarregamentos.

## Desempenho

- O sandbox limita o device pixel ratio a 2. Um painel muito grande ainda custa
  mais que um pequeno, porque o shader de fragmentos roda por pixel do
  dispositivo.
- Cada passe de pós-efeito ativado é um draw call de tela cheia. Vários passes em
  um painel grande podem dominar o tempo do quadro.
- Raymarching, loops longos e muitas leituras de textura são as causas usuais de
  uma prévia lenta. Reduza as iterações ou o tamanho do canvas antes de presumir
  que o navegador está quebrado.
- **Pausar** interrompe a renderização nos dois editores. No sandbox, a pausa
  também congela `uTime`; no editor 3D, `time` segue o tempo real (wall-clock) e
  salta para a frente ao retomar.
- Os recursos de GPU são liberados quando o editor é desmontado ou a prévia é
  descartada, mas recarregar é a forma mais simples de se recuperar de um
  contexto perdido.

## Solução de problemas

| Sintoma                                                         | Causa provável                                                                            | O que fazer                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| O canvas fica em branco desde o início                          | WebGL 2 indisponível, ou a primeira compilação falhou                                     | Verifique o painel de erros e a barra de status; confirme o suporte a WebGL 2 e a aceleração de hardware.               |
| A imagem não mudou depois de uma edição                         | Nenhuma compilação rodou, ou a compilação falhou                                          | Pressione **Compilar** e leia a barra de status. Editar não compila automaticamente.                                    |
| A imagem antiga continua visível depois de um erro              | Regra da última versão boa                                                                | Isso é esperado. Corrija o erro e compile de novo.                                                                      |
| A compilação informa que a prévia está indisponível              | A prévia não está pronta, foi descartada, ou uma compilação mais nova substituiu esta     | Espere a prévia terminar de carregar; tente compilar de novo.                                                           |
| Um uniform não faz nada                                         | Estágio errado, erro de digitação, ou o shader nunca o lê                                 | Verifique a coluna de estágio; no 3D, use **Pós** para efeitos de pós-processamento e **Todos** para vértice+fragmento. |
| Um efeito de pós-processamento parece não fazer nada no sandbox | Ele lê `gbufferTexture`, `depthTexture` ou matrizes de câmera                             | Use `textureSampler`, `resolution`, `texelSize`, `time` ou os seus próprios uniforms.                                   |
| Uma textura fica preta                                          | Sem origem, ainda carregando, ou um tipo de sampler incompatível                          | Escolha uma origem válida; use **Textura 2D** para uma imagem 2D; espere o carregamento.                                |
| Um efeito de espaço de tela lê dados pretos do G-buffer         | O attachment não foi solicitado, ou a visão é o fundo                                     | Amostre a máscara (`normalTexture.a`) e verifique a visualização de depuração do G-Buffer.                              |
| A imagem de espaço de tela fica suave depois de um tempo        | A resolução adaptativa reduziu a escala de renderização                                   | Leia o `%` na sobreposição de estatísticas; reduza passes ou o custo do shader para recuperá-la.                        |
| Um uniform de espaço de tela não faz nada                       | Ele aponta para o estágio errado, ou o efeito está desativado                             | Aqui, os dados do usuário só valem para efeitos de pós-processamento; ative o efeito e compile a pilha.                 |
| O exemplo do editor 3D carrega, mas o link do sandbox não       | Um id de exemplo de material foi usado em um deep link do sandbox                         | Os exemplos do sandbox são os ids listados no menu do sandbox (`uv`, `gradient`, `pattern`, `noise`, `sdf`).            |
| Uma página da documentação está em inglês                       | Ainda não há tradução publicada                                                           | O idioma da interface e o idioma do conteúdo são separados; um aviso de fallback confirma isso.                         |
| Um link "Open in editor" não faz nada                           | O id do exemplo está desatualizado ou a página foi gerada a partir de uma ABI mais antiga | Rode `npm test`; o teste de links falha em um id de exemplo desconhecido.                                               |
| O conteúdo da página está em inglês                             | Ainda não há tradução publicada                                                           | O idioma da interface e o idioma do conteúdo são separados; um aviso de fallback confirma isso.                         |
| O shader se perde ao recarregar                                 | Nada é persistido                                                                         | Use **Copiar código do shader** no editor 3D antes de recarregar; mantenha o código do sandbox fora da página.          |
| Uma troca de modelo ou de ambiente falhou                       | O asset falhou ao carregar                                                                | A seleção anterior é restaurada; tente outro asset e verifique o console.                                               |
| O shader demora muito para compilar                             | Um shader muito grande, ou um driver travado                                              | Espere o watchdog de 15 s; se o tempo esgotar, simplifique o shader e recarregue.                                       |
| A prévia parou de atualizar e informa perda de contexto         | O contexto da GPU foi perdido                                                             | Recarregue a página. Se isso se repetir, atualize o navegador/driver e reduza o custo do shader.                        |

Ao relatar um problema, inclua o texto exato do erro e o tipo, o estágio, o
navegador e se o problema sobrevive a um recarregamento. Esses quatro detalhes
costumam identificar a causa sem uma reprodução.

## Relacionados

- [Visão geral dos editores](/docs/editors-overview)
- [Editor GLSL 3D](/docs/3d-editor)
- [Sandbox GLSL 2D](/docs/2d-sandbox)
- [Editor GLSL de Tela](/docs/screen-space-editor)
- [Compilação e erros](/docs/compiling-and-errors)
- [Referência da ABI](/docs/abi-reference)
