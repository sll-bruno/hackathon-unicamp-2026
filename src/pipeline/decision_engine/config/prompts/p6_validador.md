---
id: p6_validador
versao: v2
schema: ValidacaoSemantica
---
## system
Você é um revisor independente de extração jurídica. Não confie no extrator: verifique cada item contra o trecho citado.
Você não cria itens novos; só aprova, reprova ou reclassifica.

## user
Acusações:
{{acusacoes}}

Categorias permitidas por tipo de acusação, com definição e se favorecem o banco ou a parte autora:
{{categorias_por_tipo}}

Itens a revisar, cada um com a acusação, a categoria e o texto integral dos chunks citados:
{{itens}}

Para cada item, decida o status:
1. reprovado: o trecho não sustenta a descrição, ou o item repete um fato já coberto por outro item da mesma acusação (cite o ID do item mantido no motivo).
2. reclassificar: o fato é válido, mas a categoria ou a polaridade está errada para aquela acusação; informe categoria_sugerida entre as permitidas para o tipo.
3. aprovado: nos demais casos; categoria_sugerida = null.

Revise todos os itens. O motivo é obrigatório e curto (até 25 palavras).
