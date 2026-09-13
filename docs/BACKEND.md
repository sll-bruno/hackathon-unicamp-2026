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
- `app/routers`: HTTP para casos, intakes upload-first, workflow, histórico,
  dashboard e chat.
- `app/services/analysis.py`: adapter e persistência da engine.
- `app/services/autos.py`: extração nativa/OCR seletivo e estruturação dos
  Autos para o intake (`CaseIntake`).
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

## Intake upload-first a partir dos Autos

O cadastro principal de processos começa com o upload de um único PDF AUTOS,
sem exigir preenchimento prévio de CNJ, UF, assunto, subassunto ou valor da
causa. O fluxo é:

```text
POST /api/intakes (PDF)
    -> UPLOADED (arquivo persistido em STORAGE_DIR/intakes)
    -> EXTRACTING (BackgroundTasks, mesmo worker único do backend)
    -> NEEDS_REVIEW (campos + página/trecho para conferência humana)
    -> POST /api/intakes/{id}/confirm (correções opcionais)
    -> CONFIRMED + Case DOCUMENTOS_ENVIADOS + Document AUTOS
    -> análise existente (POST /api/cases/{id}/analyze)
```

Em falha, o intake vai para `FAILED` com apenas uma mensagem segura em
`safe_error`; o PDF é preservado e `POST /api/intakes/{id}/retry` reexecuta a
extração. Intakes interrompidos por reinício da API são marcados `FAILED` no
startup (`FAILED_ON_RESTART`), também sem apagar o arquivo.

Extração (`app/services/autos.py`, versão `autos-v1`, sem dependências novas):

- texto nativo de cada página tem preferência; OCR é seletivo, somente nas
  páginas com menos de 50 caracteres não-brancos;
- OCR usa backends opcionais (`pdf2image` + `pytesseract`, nunca obrigatórios
  nem chamados pelos testes); sem backend, a página fraca falha com
  `OCR_REQUIRED` e permite retry;
- cada campo carrega `page` (1-based) e `excerpt`; `ocr_pages` lista as páginas
  que usaram OCR;
- CNJ é normalizado para `NNNNNNN-DD.AAAA.J.TR.OOOO`;
- UF é extraída da comarca (`COMARCA DE .../UF`) com fallback para a sigla mais
  frequente entre as UFs válidas;
- valor da causa é lido da âncora `Dá-se à causa o valor de R$ X` (pt-BR);
- assunto/subassunto usam heurística inicial (`EMPRÉSTIMO CONSIGNADO` →
  `Empréstimo consignado não reconhecido`; `INEXISTÊNCIA` → `Inexistência de
  relação jurídica`); campos ausentes voltam `null` e o usuário completa na
  confirmação;
- os seis flags de subsídios (`contrato`, `extrato`, `comprovante_credito`,
  `dossie`, `demonstrativo_divida`, `laudo_referenciado`) sempre nascem `false`
  e nunca são inferidos dos Autos.

Contrato para o frontend:

- `POST /api/intakes` (multipart `file`, só PDF até `max_upload_bytes`) → `201`
  com o intake; a extração roda em background, então o frontend deve fazer
  polling em `GET /api/intakes/{id}` até `NEEDS_REVIEW` ou `FAILED`;
- `GET /api/intakes` lista; `GET /api/intakes/{id}/file` baixa o PDF original;
- `POST /api/intakes/{id}/retry` → `202` (de `FAILED` ou `NEEDS_REVIEW`;
  `409 INTAKE_ALREADY_RUNNING` se já estiver extraindo);
- `POST /api/intakes/{id}/confirm` com corpo opcional
  `{cnj?, uf?, assunto?, subassunto?, valor_causa?}` → `201 {intake, case}`;
  valores enviados prevalecem sobre os extraídos (inclusive divergência de
  valor); CNJ duplicado retorna `409 CNJ_ALREADY_EXISTS` com
  `details.existing_case_id` sem alterar o caso existente; segunda confirmação
  retorna `409 INTAKE_ALREADY_CONFIRMED` sem duplicar o caso;
- respostas de intake nunca expõem `stored_path` nem segredos; erros de
  validação usam `422 INVALID_CNJ | INVALID_UF | INVALID_ASSUNTO |
  INVALID_VALOR_CAUSA`.

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
