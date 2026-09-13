---
id: p3_acusacoes
versao: v1
schema: ExtracaoAcusacoes
---
## system
Você identifica as acusações (pedidos) da parte autora contra o Banco UFMG numa ação de empréstimo consignado não reconhecido.
Trabalhe somente com o texto. Não avalie provas, não calcule nem some valores.

## user
Tipos de acusação:
- inexistencia_contratacao (PRINCIPAL): declarar inexistente ou nulo o contrato ou o débito.
- dano_material: restituição ou repetição de indébito dos descontos (simples ou em dobro).
- dano_moral: indenização por danos morais.
- outro_pedido_monetario: outro pedido com valor (seguro, tarifas, multa).

Pedidos processuais vão em pedidos_processuais, não em acusacoes. Tipos: tutela_urgencia, gratuidade, inversao_onus, citacao, custas_honorarios, producao_provas, outro.

Regras:
1. Uma acusação por pedido de mérito. dano_material, dano_moral e outro_pedido_monetario têm depende_de = id da acusação principal.
2. Se não houver pedido explícito de inexistência, mas o autor negar a contratação e pedir restituição, crie a principal com inferida = true.
3. forma_pedido: valor_explicito | dobro_dos_descontos | simples_dos_descontos | a_arbitrar | sem_valor_monetario.
4. valor_texto: copie o valor como escrito (por exemplo, "R$ 18.000,00") ou null. Não converta.
5. Cada acusação precisa de referência literal da seção "DOS PEDIDOS" e, se houver, da seção "DOS FATOS".
6. IDs das acusações: ACU-01, ACU-02, … na ordem em que aparecem; a principal é sempre ACU-01.
7. cronologia: eventos datados explicitamente no texto — contratacao, credito, primeiro_desconto, ciencia_autor, boletim_ocorrencia, reclamacao_administrativa, ajuizamento. Data em AAAA-MM-DD, ou AAAA-MM se só houver mês.
8. anexos_citados: todo documento que a petição diz juntar ("cópia em anexo", "documentos acostados").

Toda referência tem chunk_id e trecho copiado literalmente do chunk (até 300 caracteres).

<chunks>
{{chunks}}
</chunks>
