# Documentação Funcional

Este documento explica, em linguagem simples, como cada parte do sistema **Gerenciador de Compras** funciona no dia a dia.

O foco do app é ajudar o usuário a:
- registrar compras mensais
- organizar mercados
- comparar preços
- acompanhar gastos
- entender o que subiu ou caiu de valor

## Cadastro de mercados

**Para que serve**  
Permite guardar os mercados usados nas compras para o usuário não precisar digitar tudo toda vez.

**Como o usuário usa**  
Na tela de cadastro de compra, o usuário pode escolher um mercado já existente na lista ou digitar o nome de um novo mercado e salvar.

**Qual regra de negócio está envolvida**  
- O mercado pode ser reaproveitado em várias compras.
- Se o mercado já existir, o sistema evita duplicidade desnecessária.

**Exemplo prático**  
O usuário digita `Assaí` e salva. Depois, nas próximas compras, esse mercado já aparece na lista para seleção.

## Registro de compra mensal

**Para que serve**  
Permite salvar uma compra ligada a um mercado e a um mês de referência.

**Como o usuário usa**  
O usuário escolhe o mês, seleciona o mercado, adiciona os itens da compra e salva.

**Qual regra de negócio está envolvida**  
- Cada compra fica vinculada a um `mês de referência`.
- O sistema usa esse mês para comparações e histórico.
- O mês atual vem preenchido automaticamente, mas pode ser alterado.

**Exemplo prático**  
Uma compra feita em abril de 2026 pode ser salva com o mês `2026-04`, mesmo que o usuário esteja registrando depois.

## Adição de itens

**Para que serve**  
Permite montar a compra produto por produto.

**Como o usuário usa**  
O usuário toca em `Novo item`, informa o nome do produto, a quantidade e o preço unitário.

**Qual regra de negócio está envolvida**  
- Cada item pertence a uma compra.
- O item precisa ter nome para fazer sentido nas comparações.
- Quantidade e preço unitário são usados no cálculo automático.

**Exemplo prático**  
Produto: `Arroz 5kg`  
Quantidade: `2`  
Preço unitário: `28,90`

## Cálculo automático dos itens

**Para que serve**  
Mostra o valor final de cada item sem o usuário precisar calcular.

**Como o usuário usa**  
Ao preencher quantidade e preço unitário, o total do item aparece automaticamente na tela.

**Qual regra de negócio está envolvida**  
- Regra principal: `preço final do item = quantidade x preço unitário`

**Exemplo prático**  
Se o usuário informa `2` unidades de um produto que custa `R$ 10,00`, o sistema mostra `R$ 20,00` como total do item.

## Cálculo do total da compra

**Para que serve**  
Mostra quanto foi gasto no conjunto da compra.

**Como o usuário usa**  
Conforme adiciona itens, o usuário acompanha o total geral da compra no card de totais.

**Qual regra de negócio está envolvida**  
- O total da compra é a soma dos totais finais de todos os itens.

**Exemplo prático**  
Se uma compra tem:
- arroz: `R$ 28,90`
- leite: `R$ 15,00`
- café: `R$ 18,50`

O total da compra será `R$ 62,40`.

## Histórico de compras

**Para que serve**  
Permite consultar compras já salvas no sistema.

**Como o usuário usa**  
Na área de histórico, o usuário vê as compras registradas com mercado, mês, quantidade de itens e total.

**Qual regra de negócio está envolvida**  
- As compras ficam salvas localmente em banco SQLite.
- O histórico é persistente e continua disponível depois.

**Exemplo prático**  
O usuário pode abrir o histórico e localizar uma compra salva no `Assaí`, no mês `2026-04`, com total de `R$ 312,00`.

## Filtros do histórico

**Para que serve**  
Ajuda a encontrar compras específicas mais rápido.

**Como o usuário usa**  
O usuário pode filtrar por:
- mês
- mercado
- produto

Depois toca em `Filtrar` para ver só o que interessa.

**Qual regra de negócio está envolvida**  
- O filtro por produto usa o nome normalizado do produto.
- Isso ajuda a encontrar itens mesmo com variações de escrita.

**Exemplo prático**  
Se o usuário filtra por produto `arroz`, o sistema consegue encontrar registros como:
- `Arroz`
- `arroz`
- `ARROZ`

## Edição de compras

**Para que serve**  
Permite corrigir uma compra já salva.

**Como o usuário usa**  
No histórico, o usuário toca em `Editar`. A compra volta para o formulário principal, onde pode ser ajustada e salva novamente.

**Qual regra de negócio está envolvida**  
- A compra existente é atualizada.
- Os itens antigos são substituídos pelos novos dados informados na edição.

**Exemplo prático**  
O usuário percebe que digitou `R$ 12,00` em vez de `R$ 21,00` no leite. Ele edita a compra, corrige o valor e salva de novo.

## Exclusão de compras

**Para que serve**  
Permite remover compras que não deveriam mais existir no sistema.

**Como o usuário usa**  
No histórico, o usuário toca em `Excluir` e confirma a ação.

**Qual regra de negócio está envolvida**  
- A exclusão remove a compra e também os itens ligados a ela.
- Existe confirmação antes de concluir, para evitar exclusão acidental.

**Exemplo prático**  
Se o usuário salvou uma compra de teste por engano, pode excluí-la e manter o histórico limpo.

## Comparação do mês selecionado

**Para que serve**  
Mostra como os mercados se comportaram em um mês específico.

**Como o usuário usa**  
O usuário escolhe um mês na área de comparação e toca em `Ver comparação`.

**Qual regra de negócio está envolvida**  
- O sistema soma os valores das compras de cada mercado no mês selecionado.
- O mercado com menor total aparece como o mais barato do mês.

**Exemplo prático**  
No mês `2026-04`, o sistema pode mostrar:
- Assaí: `R$ 280,00`
- Atacadão: `R$ 295,00`
- Carrefour: `R$ 330,00`

Nesse caso, o `Assaí` aparece como o mais barato.

## Comparação entre mês atual e anterior

**Para que serve**  
Ajuda o usuário a entender se os gastos subiram ou caíram de um mês para o outro.

**Como o usuário usa**  
Ao comparar um mês, o sistema também mostra automaticamente a diferença para o mês anterior.

**Qual regra de negócio está envolvida**  
- O sistema calcula:
  - total do mês atual
  - total do mês anterior
  - diferença em valor
  - diferença percentual

**Exemplo prático**  
Se em março o total foi `R$ 400,00` e em abril foi `R$ 460,00`, o sistema mostra aumento de `R$ 60,00`.

## Comparação por produto

**Para que serve**  
Permite descobrir qual mercado teve melhor preço para cada produto.

**Como o usuário usa**  
Na comparação do mês, o usuário consulta a lista de produtos comparados.

**Qual regra de negócio está envolvida**  
- Produtos iguais são agrupados usando nome normalizado.
- O sistema calcula média de preço por produto e por mercado.

**Exemplo prático**  
Para o produto `leite`, o sistema pode mostrar:
- Assaí: média `R$ 5,89`
- Atacadão: média `R$ 6,10`
- Carrefour: média `R$ 6,40`

## Gráficos

**Para que serve**  
Facilitam a leitura visual dos dados, sem exigir que o usuário analise só números.

**Como o usuário usa**  
O usuário acompanha:
- gráfico de evolução de gastos por mês
- barras por mercado
- barras em comparações de mercado

**Qual regra de negócio está envolvida**  
- Os gráficos usam os mesmos dados do histórico e das comparações.
- Eles são apenas uma forma visual de apresentar o que já foi calculado.

**Exemplo prático**  
Se o usuário teve aumento contínuo de gastos por três meses, o gráfico de linha deixa isso claro rapidamente.

## Alertas ou informações importantes para o usuário

**Para que serve**  
Chama atenção para produtos que tiveram mudança forte de preço.

**Como o usuário usa**  
No dashboard, o usuário vê:
- quantos produtos aumentaram mais de 20%
- quantos diminuíram mais de 20%
- lista de atenção com os casos mais relevantes

**Qual regra de negócio está envolvida**  
- Aumento forte: mais de `20%`
- Queda forte: menos de `-20%`
- A comparação só faz sentido quando existe preço no mês atual e no mês anterior

**Exemplo prático**  
Se o café custava `R$ 12,00` e passou para `R$ 15,00`, o sistema sinaliza que esse produto teve aumento importante.

## Ranking histórico de mercados

**Para que serve**  
Ajuda o usuário a enxergar, no histórico geral, quais mercados costumam compensar mais.

**Como o usuário usa**  
No dashboard, o usuário vê um ranking com posição, média de gasto, vezes em que o mercado foi o mais barato e score.

**Qual regra de negócio está envolvida**  
- O sistema calcula a média de gasto por mercado.
- Também conta quantas vezes o mercado foi o mais barato.
- Depois gera um score para ordenar o ranking.

**Exemplo prático**  
Se um mercado apareceu várias vezes como o mais barato e manteve média de gasto menor, ele tende a subir no ranking.

## Exportação de relatório em CSV

**Para que serve**  
Permite baixar os dados em arquivo para consulta externa.

**Como o usuário usa**  
Na área de exportação, o usuário pode:
- exportar um mês específico
- exportar todo o histórico

**Qual regra de negócio está envolvida**  
- O arquivo inclui:
  - mês
  - mercado
  - compra
  - produto
  - nome normalizado
  - quantidade
  - preço unitário
  - preço final do item
  - total da compra

**Exemplo prático**  
O usuário exporta o mês `2026-04` e recebe um CSV com todas as compras e itens daquele período.

## Observações importantes para o usuário

**Para que serve**  
Evita dúvidas no uso diário.

**Como o usuário usa**  
O usuário deve lembrar que:
- o app funciona com dados salvos localmente no aparelho
- as comparações dependem das compras registradas
- quanto mais histórico existir, melhores ficam os gráficos, rankings e alertas

**Qual regra de negócio está envolvida**  
- Sem dados suficientes, algumas comparações e gráficos podem aparecer vazios.
- Isso não significa erro. Significa apenas que ainda faltam registros para análise.

**Exemplo prático**  
Se o usuário acabou de instalar o app e só lançou uma compra, ainda não haverá comparação entre meses.
