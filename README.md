# Gerenciador de Compras

Base inicial de um app híbrido para Android Studio usando:

- Android nativo para empacotar o app
- `WebView` para a interface em `HTML`, `CSS` e `JavaScript`
- `Python` com `Chaquopy` para cálculos e resumos

## Objetivo do app

Registrar compras mensais por mercado, com:

- mercado
- mês de referência
- produto
- quantidade
- preço unitário
- preço final do item (`quantidade * preço`)
- preço total da compra

Também preparar o terreno para responder perguntas como:

- qual mercado ficou mais barato no mês
- qual produto aumentou de preço
- em qual mercado um produto costuma custar menos

## Estrutura

- `app/src/main/assets/`
  - interface web do app
- `app/src/main/python/`
  - regras de cálculo e resumo
- `app/src/main/java/com/gerenciadordecompras/app/`
  - Activity Android, ponte entre WebView e Python e banco SQLite local

## Como a arquitetura funciona

1. O app Android abre uma tela local HTML dentro de uma `WebView`.
2. O usuário cadastra mercados e registra os itens da compra.
3. O JavaScript organiza os dados da tela.
4. O Android envia esses dados para o Python.
5. O Python calcula totais, resumo do mês e comparação de preços.
6. O Android salva a compra no banco local `SQLite`.
7. O resultado volta para a interface com histórico mensal persistido.

## Banco local

O banco local foi implementado em:

- `app/src/main/java/com/gerenciadordecompras/app/ShoppingDatabaseHelper.kt`

Tabelas criadas:

- `markets`
- `purchases`
- `purchase_items`

Dados salvos:

- mercados cadastrados
- compras por mês
- itens de cada compra
- total da compra

O histórico mensal aparece na própria interface do app.

## Comparações já implementadas

O app agora também mostra:

- mercado mais barato no mês selecionado
- ranking de mercados pelo total do mês
- comparação de produtos por mercado no mês selecionado
- comparação entre mês atual e mês anterior
- produtos que subiram, caíram ou apareceram no mês
- edição e exclusão de compras salvas pelo histórico
- filtros no histórico por mês, mercado e produto
- visual reorganizado com destaque para cadastro, histórico e comparações
- gráficos simples de barras para mercados do mês e evolução entre meses
- dashboard geral com métricas executivas:
  - total do mês atual
  - total do mês anterior
  - variação percentual
  - mercado mais barato no mês
  - produto com maior aumento
  - produto com maior queda
  - evolução de gastos por mês
  - barras por mercado

Arquivos principais dessa parte:

- `app/src/main/java/com/gerenciadordecompras/app/ShoppingDatabaseHelper.kt`
- `app/src/main/java/com/gerenciadordecompras/app/WebAppBridge.kt`
- `app/src/main/assets/index.html`
- `app/src/main/assets/app.js`

## Próximas evoluções recomendadas

- salvar dados com SQLite ou Room
- separar compras por mês automaticamente
- gerar histórico por produto
- mostrar gráfico por mercado
- destacar:
  - produto mais caro do mês
  - mercado mais barato do mês
  - diferença de preço entre mercados
