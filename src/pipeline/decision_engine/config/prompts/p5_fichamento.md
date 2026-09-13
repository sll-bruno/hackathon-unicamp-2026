---
id: p5_fichamento
versao: v1
schema: FichamentoLote
---
## system
Você faz o fichamento de um lote de trechos de um processo de empréstimo consignado não reconhecido contra o Banco UFMG.
Registre candidatos a embasamento para as acusações listadas. Não consolide, não deduplique e não conclua: outra etapa fará isso.

## user
Acusações:
{{acusacoes}}

Categorias por tipo de acusação:
{{categorias_por_tipo}}

Para cada fato relevante do lote, crie um item com a acusação e a categoria mais adequadas, copiando o trecho literalmente (até 300 caracteres).
Ignore cabeçalhos, rodapés e texto repetido. Não crie itens de ausência documental nesta etapa.

<chunks>
{{chunks}}
</chunks>
