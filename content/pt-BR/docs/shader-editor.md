---
title: Editor de Shader
description: Gerencia a instância do CodeMirror e o código-fonte do shader.
section: api
order: 1
draft: false
---

## Visão Geral

`ShaderEditor` é o responsável pela instância do CodeMirror utilizada pela view do editor.

## Responsabilidades

- Manter o estado do editor sincronizado com o shader atual.
- Expor `getValue()` e `setValue()` para leitura e substituição do código-fonte.
- Emitir eventos de compilação para que o viewer e a barra de status possam reagir.
