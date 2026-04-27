# Ideias para evoluir o Gerenciador de Compras

## Funcionalidades mais importantes

### 1. Histórico por produto

Guardar cada produto com:

- nome normalizado
- mercado
- mês
- quantidade
- preço unitário

Isso permite descobrir:

- se o arroz ficou mais caro neste mês que no anterior
- em qual mercado o leite costuma ser mais barato

### 2. Comparação entre mercados

Criar uma tela com:

- filtro por produto
- filtro por mês
- lista dos mercados do mais barato para o mais caro

Exemplo:

- Feijão 1kg
- Assaí: R$ 7,49
- Atacadão: R$ 7,99
- Carrefour: R$ 8,89

### 3. Comparação entre meses

Permitir comparar:

- janeiro vs fevereiro
- fevereiro vs março
- mês atual vs mês anterior

Mostrar:

- valor anterior
- valor atual
- diferença
- porcentagem de aumento ou queda

### 4. Resumo do mês

No fim do mês, mostrar:

- total gasto
- quantidade de itens
- mercado com menor total
- mercado com maior total
- produto que mais subiu
- produto que mais oscilou

## Modelagem de dados sugerida

### Tabela `markets`

- `id`
- `name`
- `address`
- `notes`

### Tabela `purchases`

- `id`
- `market_id`
- `reference_month`
- `purchase_date`
- `total_amount`

### Tabela `purchase_items`

- `id`
- `purchase_id`
- `product_name`
- `quantity`
- `unit_price`
- `final_price`

## Regras inteligentes

- preencher o mês atual automaticamente
- sugerir produtos comprados no mês anterior
- avisar quando um produto estiver acima do preço habitual
- destacar quando outro mercado teve preço menor para o mesmo item

## Métricas úteis

- preço médio por produto
- menor preço histórico por produto
- maior preço histórico por produto
- economia possível por mercado
- variação percentual por mês

## Ideias visuais para a tela de comparação

- cartão verde para o menor preço
- cartão vermelho para o maior preço
- seta para cima quando o preço aumentou
- seta para baixo quando o preço caiu
- filtro rápido por mercado e mês

## Próximo passo técnico recomendado

A próxima implementação mais importante é o banco local, porque sem persistência o app não vai conseguir comparar meses de verdade.
