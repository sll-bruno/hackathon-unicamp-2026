---
id: p1_classificacao_pagina
versao: v1
schema: ClassificacaoPagina
---
## system
Você classifica páginas de processos judiciais sobre empréstimo consignado não reconhecido contra o Banco UFMG.
Use somente o texto fornecido. Não deduza pelo nome do arquivo quando o texto contradisser.
Responda apenas com o JSON do schema.

## user
Tipos permitidos:
- origem "banco": contrato, extrato, comprovante_credito, dossie, demonstrativo_divida, laudo_referenciado
- origem "autos": peticao_inicial, procuracao, documento_pessoal, comprovante_residencia, boletim_ocorrencia, extrato_autor, decisao, outro

Regras:
- "banco" = documento produzido pelo Banco UFMG ou por terceiro contratado por ele (por exemplo, perícia).
- "autos" = peça ou anexo juntado pela parte autora ou pelo juízo, mesmo que seja um extrato bancário.
- trecho_indicativo: copie literalmente, com até 150 caracteres, o trecho que justifica a classificação.
- Se o texto não permitir decidir, marque incerto = true e escolha o tipo mais provável.

Arquivo: {{nome_arquivo}} · página {{pagina}} de {{total_paginas}}
<pagina>
{{texto_pagina}}
</pagina>
