# Arquitetura do backend MVP

Este documento descreve a implementação da Pessoa C. As regras internas do
motor permanecem em `architecture_engine.md`; o backend só orquestra o contrato
compartilhado definido em `contracts.pipeline`.

## Fluxo vertical

```text
cadastro/upload
    -> DOCUMENTOS_ENVIADOS
    -> job QUEUED/RUNNING
    -> snapshot de recomendação
    -> AGUARDANDO_DECISAO
    -> decisão ACORDO -> EM_NEGOCIACAO -> aceite ou defesa
    -> decisão DEFESA -----------------> encerramento judicial
    -> ENCERRADO -> dashboard observado
```

`lawyer_decisions`, `negotiation_results` e `case_outcomes` são registros
separados. Assim, aderir à ação `ACORDO` não significa que a parte autora aceitou
a proposta.

## Componentes

- `app/core`: settings, engine SQLite, lifecycle e envelope de erros.
- `app/models`: tabelas SQLModel e enums operacionais.
- `app/routers`: HTTP para casos, workflow, histórico, dashboard e chat.
- `app/services/analysis.py`: adapter e persistência da engine.
- `app/services/metrics.py`: agregações derivadas dos eventos persistidos.
- `app/services/chat.py`: adapter da OpenAI Responses API.
- `app/services/seeds.py`: dois casos idempotentes e fixture sinalizada.
- `contracts/pipeline.py`: única superfície compartilhada com a engine.

SQLite usa foreign keys, WAL e timeout de 30 segundos. O schema é criado no
startup. Arquivos enviados recebem nome UUID e ficam fora do banco; downloads
só podem resolver dentro de `DATA_DIR` ou `STORAGE_DIR`.

## Contrato da engine

Entrada mínima:

```text
case_id, cnj, uf, assunto, subassunto, valor_causa
subsidy_flags
documents[id, type, path]
```

Saída mínima:

```text
versions
recommendation[action, confidence_percent, summary, reason_codes]
financial[suggested_offer, expected_defense_cost, expected_savings]
evidences[id, text, type, weight?, sources]
```

Modelos Pydantic aceitam campos adicionais. Depois da validação, a saída inteira
é serializada em `recommendations.payload_json`, enquanto campos necessários à
consulta são projetados em colunas. Uma resposta inválida falha o job sem criar
snapshot parcial.

## Máquina de estados

| Estado | Operações principais |
|---|---|
| `RASCUNHO` | editar metadados, enviar PDF |
| `DOCUMENTOS_ENVIADOS` | editar, enviar e analisar |
| `EM_ANALISE` | polling do job |
| `AGUARDANDO_DECISAO` | reanalisar ou decidir |
| `EM_NEGOCIACAO` | registrar aceite/recusa |
| `AGUARDANDO_ENCERRAMENTO` | registrar desfecho judicial |
| `ENCERRADO` | somente leitura e métricas |

Transições inválidas retornam `409`. Reanálise é proibida depois da decisão do
advogado. Em falha, o job registra apenas uma mensagem segura e o caso retorna
a `DOCUMENTOS_ENVIADOS`.

## Definições das métricas

- aderência: decisões iguais à recomendação / decisões registradas;
- aceite: negociações aceitas / negociações registradas;
- desembolso de acordo: valor final + custos legais;
- desembolso de defesa: custo da defesa + condenação + custos legais;
- economia de acordo: custo esperado da defesa - desembolso observado;
- erro da defesa: desembolso observado - custo esperado da defesa.

O dashboard expõe média assinada e absoluta do erro de defesa, série diária e
contadores `DEMO_FIXTURE`. Divisões sem observações retornam `null`, não zero.

## Erros e concorrência

Erros controlados usam `{code, message, details}`. O único worker reduz corridas
na verificação de job ativo; SQLite mantém um registro por job e por evento.
Esta solução é adequada ao fluxo demonstrativo, mas exige fila durável e uma
restrição transacional específica ao migrar para múltiplos workers.
