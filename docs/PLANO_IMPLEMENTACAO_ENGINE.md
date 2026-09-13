# Plano de implementação — Engine de IA (decisão final pela LLM)

## Contexto

A versão anterior do [`PLANO_ENGINE_IA_V2.md`](PLANO_ENGINE_IA_V2.md) fechava a decisão com uma regra fixa: `ACORDO se alvo ≤ min(custo_defesa_esperado − margem − custo_negociação, alçada)`. A equipe decidiu **remover essa regra**. A parte determinística calcula probabilidades, perdas, custo esperado da defesa, faixa de negociação (abertura/alvo/máximo) e cenários. Uma **LLM decisora** recebe tudo isso e escolhe ACORDO ou DEFESA, gerando o JSON de justificativa. O sistema só monta o envelope e verifica se a LLM inventou números.

As outras frentes já avançaram em branches remotas. Este plano:
1. registra o que está pronto em back e front;
2. alinha a engine ao contrato que o backend já consome;
3. ordena a implementação;
4. traz os prompts de cada chamada de LLM.

**Resultado esperado:** `decision_engine.run_pipeline(case)` funcionando nos dois casos exemplo, validando como `contracts.pipeline.PipelineOutput`, persistido pelo backend e com os blocos que a Tela 3 precisa.

> **Direção atual (hackathon):** prioridade é o fluxo da engine funcionando de ponta a ponta nos dois casos. Casos de borda, guardrails elaborados, modo map-reduce e a integração com backend e frontend (hoje placeholders) ficam para a fase de produção. PDFs e planilha são considerados corretos.

**Status:** Etapas 0, 1A, 1B, 2A, 2B e 3 implementadas em versão simplificada (`ENGINE_MODE=full`, CLI `python -m decision_engine <pasta>`). Etapa 4 em andamento: análise de conteúdo calibrada (P4 v3, P6 v3, P7 v2, definições e `max_itens` em `pesos_embasamento_v1.yaml`). Resultado real com `gpt-5`: Caso 01 → DEFESA (confiança 100%); Caso 02 → ACORDO (confiança 70%, faixa R$ 4.915 / 5.772 / 7.668), sem divergência entre subfluxos.

---

## 1. Estado atual das branches (lido via refs locais `origin/*`)

### Backend — `origin/codex/backend-contract-v1` (5e695a6, bate com o GitHub)

**Pronto:**
- FastAPI + SQLite com tabelas de casos, documentos, jobs, recomendações imutáveis, evidências, decisão, negociação, desfecho e chat.
- Upload de PDF validado.
- Máquina de estados com 409 em transição inválida.
- Job em `BackgroundTasks` com recuperação após restart.
- Dashboard de aderência/efetividade, histórico e chat (OpenAI Responses API com `json_schema` strict).
- Docker, seeds dos dois casos e testes pytest.

**Integração com a engine:** `src/api/app/services/analysis.py`:
- `build_engine_input()` → `CaseInput`;
- `invoke_pipeline()` → `PipelineOutput.model_validate(decision_engine.run_pipeline(case_input))`;
- `_persist_output()` projeta os campos mínimos e guarda o payload inteiro em `recommendations.payload_json`. Evidências viram linhas em `evidences`.

**Contrato atual (`src/contracts/contracts/pipeline.py`, com `extra="allow"`):**
- **Entrada:** `case_id, cnj, uf, assunto, subassunto, valor_causa, subsidy_flags{6}, documents[{id, type, path}]`. `type` vem em maiúsculas: `AUTOS`, `CONTRATO`, `EXTRATO`, `COMPROVANTE_CREDITO`, `DOSSIE`, `DEMONSTRATIVO_DIVIDA`, `LAUDO_REFERENCIADO`.
- **Saída mínima:**
  - `versions` (dict não vazio);
  - `recommendation{action, confidence_percent 0–100|null, summary, reason_codes[]}`;
  - `financial{suggested_offer|null, expected_defense_cost ≥0, expected_savings ≥0}`;
  - `evidences[{id, text, type, weight?, sources[{document_id, page?, excerpt}]}]`.
- **Assinatura:** `run_pipeline(case)` síncrona, sem callback de progresso. O job fica em `RUNNING_ENGINE` (10%) até terminar.

**Lacunas que afetam a engine (tarefas da Pessoa C):**
1. `build_workspace()`/`serialize_recommendation()` em `app/services/domain.py` **não expõem `payload_json`**. O front não recebe probabilidades, faixa, cenários nem justificativa.
2. **Seeds com dados divergentes dos PDFs** (`app/services/seeds.py`):
   - valor da causa 10.000/8.000, quando os PDFs dizem 20.000/25.000;
   - assunto/subassunto em texto livre, fora das categorias da base ("Não reconhece operação", Golpe/Genérico);
   - Caso 01 semeado como `ENCERRADO` com fixture, então não pode ser analisado.
3. O Dockerfile não instala o Tesseract (`tesseract-ocr tesseract-ocr-por`). As dependências Python da engine já foram adicionadas ao `pyproject.toml` na Etapa 0.

### Frontend — `origin/feat/web-entrada-acompanhamento` (211601a, bate com o GitHub; inclui `feat/workspace-view` até 4e9264f)

**Pronto:**
- Tela 1 (Meus processos): lista, KPIs e pendências, com mocks (`VITE_USE_MOCKS` default `true`).
- Tela 3 (Área de trabalho): `WorkspacePage` e componentes `RecommendationCard`, `SettlementCard`, `RiskCard`, `WhatChangesCard`, `EvidenceCard`, `SourcePanel`, com fixtures `caso01`/`caso02`.

**Formato esperado pela Tela 3** (`src/web/src/types/workspace.ts`):
- `risk.probabilities{extincao, improcedencia, parcial, procedencia}` e `cohort_size`;
- `recommendation{action, confidence_percent, confidence_method_version, reason, reason_codes, expected_defense_cost, defense_cost_range, settlement_range{opening, target, ceiling}, expected_savings, what_changes[], assumptions[]}`;
- `facts[{id, fact_type, description, weight, weights_version, relation: supports|refutes|neutral, claim, sources}]`;
- `contradictions[]`, `gaps[]`.

**Ainda não integrado:**
- rota `processos/:id` é placeholder na branch consolidada;
- `CasesList` espera array em `/cases`, mas o backend devolve página `{items, ...}`;
- tipos de documento em minúsculas no front, maiúsculas no back;
- status `PROPOSTA_ACEITA`/`DIVERGIU` só existem no front;
- sem Tela 2 (cadastro/upload), Histórico ou Dashboard;
- sem modal de decisão, negociação e chat.

**Conferido na Etapa 0:** `feat/workspace-view` em **b9ea0b8** só adiciona a tela de chatbot (`pages/Chatbot`) e ajustes visuais na `WorkspacePage`; `types/workspace.ts` não mudou. `feat/web-entrada-acompanhamento` em e876287 só deixou de versionar `.claude/`.

---

## 2. Desenho da decisão (sem regra heurística)

### 2.1 O que o sistema calcula (determinístico, `finance/`)

```text
P(derrota)            = α·P_xgb + β·P_llm                       (α=0,6; β=0,4; ajustes do V2 §5.1)
perda_se_condenado    = α·cond_xgb + β·cond_llm
perda_esperada        = P(derrota) · perda_se_condenado
custo_defesa          = max(0,05 · perda_esperada, custo_defesa_minimo)
custo_defesa_esperado = perda_esperada + custo_defesa

abertura = 0,35 · perda_se_condenado      (k P25, calibrado nos 280 acordos)
alvo     = 0,41 · perda_se_condenado      (k P50)
maximo   = min(0,54 · perda_se_condenado, alçada = 0,6·VC)   (k P90)

custo_acordo_alvo            = alvo + custo_negociacao          (R$ 500, premissa)
vantagem_economica_acordo    = custo_defesa_esperado − custo_acordo_alvo   (pode ser negativa)
p_acordo_mais_barato         = fração de 1.000 simulações (α, pesos, T, probabilidades, k)
                               em que custo_acordo_alvo < custo_defesa_esperado
aceite_minimo_para_compensar = custo_negociacao / (custo_defesa_esperado − alvo)   (null se ≤ 0)
cenarios = defesa{melhor, medio, pior} e acordo{melhor, medio, pior}   (V2 §5.5)
```

- A margem de segurança sai (só servia à regra removida).
- A alçada continua como limite da faixa, não como gatilho.

### 2.2 O que a LLM decide (`decision/`)

- **Decisão:** a LLM decisora (prompt P7) recebe caso, subfluxo histórico, acusações e embasamentos validados, bloco financeiro com a faixa, cenários, contexto regional e reason codes, e escolhe `ACORDO` ou `DEFESA` com justificativa estruturada.
- **Faixa imutável:** a LLM não recalcula valores.

### 2.3 Guardrails (script, sem sobrescrever a decisão)

1. Schema strict válido.
2. Todo número citado no texto existe na entrada (tolerância de R$ 1 / 0,5 pp).
3. Todo `embasamento_id` existe.
4. Seções obrigatórias preenchidas; `contexto_regional` cita UF e efeito em pp.
5. Violação → uma nova tentativa com a lista de erros. **Se falhar de novo, a engine lança exceção**: o backend marca o job `FAILED` e o caso volta a `DOCUMENTOS_ENVIADOS`. Não há fallback heurístico.
6. Se a ação contraria o sinal de `vantagem_economica_acordo`, adicionar `DECISAO_CONTRARIA_ECONOMIA`. A decisão é mantida, e a justificativa precisa explicar o motivo (campo `decisao_contraria_a_economia`).

### 2.4 Confiança (`mc-economic-agreement-v1`)

```text
confidence_percent = 100·p_acordo_mais_barato        se ACORDO
                   = 100·(1 − p_acordo_mais_barato)  se DEFESA
```

- Tetos: `FORA_DA_DISTRIBUICAO` 60, `COORTE_PEQUENA` 70, `DIVERGENCIA_SUBFLUXOS` 70, validador com > 30% de reprovação 60, `VALOR_PEDIDO_ESTIMADO` 70.
- Continua calculada pelo sistema, nunca pela LLM. Uma decisão contra a economia sai naturalmente com confiança baixa.

---

## 3. Contrato engine → backend → front

Estender `src/contracts/contracts/pipeline.py` **só com campos opcionais**, para não quebrar `tests/test_contract.py` e `tests/test_workflow.py`. A engine emite:

| Campo | Origem |
|---|---|
| `versions` | `pipeline`, `xgb`, `calibrador`, `k_acordo`, `pesos`, `engine_params`, `prompts` (hash por prompt), `llm_model` |
| `recommendation.action` / `summary` | LLM decisora (`acao`, `resumo`) |
| `recommendation.confidence_percent` | §2.4 |
| `recommendation.reason_codes` | Determinísticos + guardrails |
| `financial.suggested_offer` | `alvo` se ACORDO; `null` se DEFESA |
| `financial.expected_defense_cost` | `custo_defesa_esperado` |
| `financial.expected_savings` | `max(0, vantagem_economica_acordo)` se ACORDO; `0` se DEFESA |
| `evidences[]` | Embasamentos aprovados: `id=EMB-…`, `text=titulo — descricao`, `type=categoria`, `weight=peso`, `sources=[{document_id (id do backend), page, excerpt}]` |
| Extra `risk` | `probabilities{extincao, improcedencia, parcial, procedencia}`, `cohort_size`, `efeitos_pp` |
| Extra `settlement_range` | `{opening: abertura, target: alvo, ceiling: maximo}` |
| Extra `financeiro` | Bloco completo da §2.1 + cenários |
| Extra `acusacoes`, `pedidos_processuais`, `cronologia`, `validacao` | Subfluxo 2 |
| Extras `facts`, `contradictions`, `gaps` | Projeção dos embasamentos no formato de `types/workspace.ts` (tabela abaixo) |
| Extras `what_changes`, `assumptions`, `defense_cost_range`, `confidence_method_version` | `condicoes_para_reavaliar`, premissas, P10–P90 da simulação, versão do método |
| Extras `justificativa`, `estrategia_acordo`, `teses_defesa`, `contexto_regional`, `features`, `erros` | LLM decisora e etapas determinísticas |

**Projeção para a Tela 3:**

| Categoria de embasamento | Destino |
|---|---|
| `contradicoes_do_autor`, `inconsistencias_documentos_banco` | `contradictions` |
| `lacunas_argumentativas_autor`, `lacunas_probatorias_banco` | `gaps` (`impact` = justificativa) |
| Demais categorias | `facts`: `relation = refutes` se peso > 0, `supports` se peso < 0; `claim` = descrição da acusação |

**Pessoas C/E:**
- C: incluir `payload` (JSON de `payload_json`) em `serialize_recommendation`;
- E: consumir `payload.*` na `WorkspacePage` em vez das fixtures.

---

## 4. Etapas de implementação

Pessoa A = ingestão/LLM; Pessoa B = modelo/financeiro. Tudo em `src/pipeline/`; testes em `tests/engine/`.

### Etapa 0 — Base e alinhamento ✅

- [x] `git fetch`; `feature/engine-ai` avançada por fast-forward até `origin/codex/backend-contract-v1` (a engine usa o `CaseInput`/`PipelineOutput` reais). `feat/workspace-view` b9ea0b8 inspecionada.
- [x] Dependências no `pyproject.toml`:
  - runtime: `pdfplumber`, `pypdfium2`, `pytesseract`, `rapidfuzz`, `tiktoken`, `xgboost`, `scikit-learn`, `numpy`, `pyyaml`, `joblib`;
  - extra `training`: `pandas`, `openpyxl`;
  - `package-data` inclui `config/` e `artifacts/` (conferido no wheel usado pelo Docker).
- [ ] Pedir à Pessoa C: `tesseract-ocr tesseract-ocr-por` no `src/api/Dockerfile`. O binário também falta na máquina local.
- [x] `decision_engine/settings.py`: lê `ENGINE_MODE` (`off|stub|full`, padrão `off`), `OPENAI_API_KEY`, `OPENAI_MODEL`, `ENGINE_LLM_CACHE` (`live|record|replay`), `ENGINE_LLM_CACHE_DIR`, `ENGINE_ARTIFACTS_DIR`. A engine não importa `app.*`.
- [x] `config/engine_v1.yaml` e `config/pesos_embasamento_v1.yaml`, carregados por `decision_engine/config_loader.py`, junto com os prompts P1–P7 em `config/prompts/*.md` (versão + hash em `versions`).
- [x] **Stub:** com `ENGINE_MODE=stub`, `run_pipeline` devolve envelope válido com `versions.pipeline="stub"` e reason code `STUB`. O padrão `off` mantém o comportamento que o `tests/test_workflow.py` do backend espera (job `FAILED` sem engine). Para a demo, a Pessoa C precisa repassar `ENGINE_MODE` no `.env.example` e no `docker-compose.yml`.
- [x] Anotação gold dos 2 casos em `tests/engine/fixtures/gold_caso01.json` e `gold_caso02.json`: 42 trechos conferidos literalmente com `pdfplumber` nas páginas citadas.
- [x] `docs/PLANO_ENGINE_IA_V2.md` atualizado para a decisão pela LLM; este plano salvo em `docs/`; `docs/PLANO_ENGINE_IA.md` removido.
- [x] Testes: `tests/engine/` (configuração, prompts, stub, integração do stub com a API e anotações gold) + suíte do backend → 34 testes passando; `ruff` sem erros.

### Etapa 1A — Ingestão e features (A)

| Arquivo | Função |
|---|---|
| `ingest/pdf_text.py` | `pdfplumber` por página + mapa de offsets + limpeza de cabeçalho/rodapé |
| `ingest/ocr.py` | Detecção por página (< 50 caracteres, imagem > 80%, `(cid:)`) → `pypdfium2` 300 dpi → Tesseract `por` |
| `ingest/classify.py` | Regras de cabeçalho → P1 como fallback; reconcilia com o `documents[].type` declarado |
| `ingest/segment.py` | Peças dos autos por página |
| `features/cnj.py` | Segmento TR → UF (tabela dos 27 TJs; bate 100% com a base) |
| `features/triagem.py` | Regex "Dá-se à causa" + P2 (escopo, subassunto, valor da causa como fallback) |
| `features/flags.py` | Flags a partir dos documentos de origem banco; `DIVERGENCIA_INVENTARIO` se diferir de `subsidy_flags`; `VALOR_CAUSA_DIVERGENTE` se a petição diferir do cadastro (os seeds atuais divergem) |
| `scoring/valores.py` | Parser do demonstrativo (parcelas pagas, saldo) e dos pedidos |
| `chunking/chunker.py` | Chunks estruturais de ~1.000 tokens (V2 §4.1); `retrieval.py` para map-reduce |

**Pronto quando:** MA/20.000/`111111` e AM/25.000/`001011`; parcelas 21/8; saldos R$ 4.326,00/R$ 8.241,28; PDFs rasterizados passam no OCR.

### Etapa 1B — Modelo e calibrações (B)

- `training/train_xgb.py` e `calibrate.py`: `multi:softprob`, sem pesos de classe, split 70/15/15, baselines prior/regressão logística, relatório.
- `training/calibrate_settlement.py`: k = valor do acordo / perda se condenado nos 280 acordos.
- `training/build_regional_profile.py`.
- `risk/model.py`: P_xgb, cond_xgb, coorte, fora da distribuição. `risk/explain.py`: Δ em pp por marginalização.
- Artefatos em `decision_engine/artifacts/` (XGBoost em `.json`, porque `*.bin` está no `.gitignore`).

**Pronto quando:** log loss ≤ regressão logística, calibração verificada e k reproduzido.

### Etapa 2A — Extração e validação (A)

| Arquivo | Função |
|---|---|
| `llm/client.py` | Mesmo padrão do `OpenAIChatGateway` (`src/api/app/services/chat.py`: `responses.create` + `text.format json_schema strict`), com retry e cache por hash (modelo + versão do prompt + entrada) |
| `llm/schemas.py` | Modelos Pydantic de P1–P7 → JSON Schema strict |
| `extraction/acusacoes.py` | P3 |
| `extraction/embasamentos.py` | P4, uma chamada por acusação, em paralelo |
| `extraction/fichamento.py` | P5, só no modo map-reduce (> 40 mil tokens) |
| `extraction/references.py` | Localização literal/fuzzy ≥ 90, `pagina`, `char_inicio/fim`, `regex`; checagem de `ausencia_documental` |
| `validation/deterministic.py` | Schema, enums, categorias por tipo, `depende_de`, valores presentes no trecho |
| `validation/semantic.py` | P6 |
| `validation/apply.py` | Aplica aprovado/reprovado/reclassificar/mesclar; no máximo 1 reextração por omissão |

**Pronto quando:** todos os itens obrigatórios do gold aparecem, 100% das referências são localizadas e o validador pega ≥ 90% das mutações.

### Etapa 2B — Scoring e financeiro (B), usando o gold como entrada

- `scoring/probabilidade.py`: `S_i`, P_v(A0), condicionais, P_llm, cond_llm com valor pedido × 0,90.
- `finance/combinacao.py`, `finance/acordo.py` (faixa), `finance/cenarios.py`, `finance/robustez.py` (simulação → `p_acordo_mais_barato`, `defense_cost_range`, confiança).
- **Sem `finance/decisao.py`.**

**Pronto quando:** as fórmulas estão testadas e o exemplo do V2 §8 é reproduzido (cond 15.818; custo esperado 14.083; faixa 5.516/6.509/8.568).

### Etapa 3 — Decisão, envelope e runner (A + B)

- `decision/decisor.py` (P7) e `decision/guardrails.py` (§2.3).
- `output/envelope.py`: monta o `PipelineOutput` e as extras da §3, e valida com `PipelineOutput.model_validate`.
- `runner.py`: `run_pipeline(case, on_progress=None)` com estágios ingestão → features → extração → validação → risco → financeiro → decisão.
  - Degradação: subfluxo 2 indisponível → α = 1 e segue para a decisão.
  - Falha da decisora → exceção.
- Estender o contrato com campos opcionais (§3) e adicionar teste no estilo de `tests/test_contract.py`.

**Pronto quando:** backend local analisa o Caso 02 de ponta a ponta e o workspace retorna a recomendação.

### Etapa 4 — Calibração e documentação

- [x] Análise de conteúdo calibrada contra as anotações de referência: Caso 02 com P(derrota) de conteúdo 83% (XGBoost 97%) e Caso 01 com 2%, piso do clip (XGBoost 1,7%); cobertura dos embasamentos de referência 12/14 e 13/16. Detalhes em `HISTORICO_ENGINE_IA.md`.
- Sensibilidade nos 2 casos (pesos, T, α, k, custo de negociação).
- Números para os slides.
- Atualizar `architecture_engine.md` e `docs/BACKEND.md` §"Contrato da engine" (com a Pessoa C).

---

## 5. Prompts

A fonte de verdade são os arquivos em `src/pipeline/decision_engine/config/prompts/` (placeholders `{{nome}}`, validados por `tests/engine/test_config.py`); o texto abaixo é o espelho legível.

Regras comuns a todas as chamadas:
- temperatura 0 (ou o mínimo que o modelo aceitar), `OPENAI_MODEL`, saída `json_schema` strict gerada de `llm/schemas.py`;
- versões em `config/prompts/*.md`, com o hash registrado em `versions.prompts`;
- chunks enviados como `<chunk id="D02:p2:c1" doc="Contrato" secao="4 Canal de contratação" pagina="2">texto</chunk>`;
- valores monetários da entrada já formatados em pt-BR (`R$ 6.509`) para facilitar a verificação dos números.

### P1 — Classificação de página (fallback de `ingest/classify.py`)

**System**
```
Você classifica páginas de processos judiciais sobre empréstimo consignado não reconhecido contra o Banco UFMG.
Use somente o texto fornecido. Não deduza pelo nome do arquivo quando o texto contradisser.
Responda apenas com o JSON do schema.
```
**User**
```
Tipos permitidos:
- origem "banco": contrato, extrato, comprovante_credito, dossie, demonstrativo_divida, laudo_referenciado
- origem "autos": peticao_inicial, procuracao, documento_pessoal, comprovante_residencia, boletim_ocorrencia, extrato_autor, decisao, outro

Regras:
- "banco" = documento produzido pelo Banco UFMG ou por terceiro contratado por ele (ex.: perícia).
- "autos" = peça ou anexo juntado pela parte autora ou pelo juízo, mesmo que seja um extrato bancário.
- Se o texto não permitir decidir, marque incerto = true e escolha o tipo mais provável.

Arquivo: {nome_arquivo} · página {n} de {total}
<pagina>{texto_pagina_ate_3000_caracteres}</pagina>
```
**Schema:** `{tipo, origem, trecho_indicativo (literal, ≤ 150 caracteres), incerto: bool}`

### P2 — Triagem da petição (escopo, subassunto, valor da causa)

**System**
```
Você é analista jurídico do Banco UFMG (réu). Lê a petição inicial e extrai metadados usados por um modelo estatístico.
Não avalie o mérito nem as provas. Copie trechos literalmente, sem corrigir ou resumir.
```
**User**
```
Tarefas:
1. no_escopo: true somente se a ação alega que o autor não reconhece ou não contratou empréstimo/operação de crédito com o banco.
2. subassunto:
   - GOLPE: a petição narra fraude praticada por terceiro (uso indevido de identidade ou documentos, crédito em conta de terceiro, falso atendente ou correspondente, boletim de ocorrência por fraude).
   - GENERICO: a petição apenas nega a contratação, sem narrar fraude de terceiro.
   - Se houver elementos dos dois ou nenhum claro, ambiguo = true e escolha o mais provável.
3. valor_causa_texto: copie o trecho com o valor dado à causa (ex.: "Dá-se à causa o valor de R$ 20.000,00"); null se não existir.
4. uf_comarca: sigla da UF do endereçamento ("COMARCA DE …/UF"); null se não existir.

<chunks>{chunks_da_peticao}</chunks>
```
**Schema:** `{no_escopo: bool, motivo_escopo, subassunto: GOLPE|GENERICO, ambiguo: bool, referencias_subassunto: [{chunk_id, trecho}], valor_causa_texto|null, referencia_valor_causa: {chunk_id, trecho}|null, uf_comarca|null}`

**Pós-processamento:** o número é convertido por código; `uf_comarca` é comparada com o CNJ.

### P3 — Extração de acusações

**System**
```
Você identifica as acusações (pedidos) da parte autora contra o Banco UFMG numa ação de empréstimo consignado não reconhecido.
Trabalhe somente com o texto. Não avalie provas, não calcule nem some valores.
```
**User**
```
Tipos de acusação:
- inexistencia_contratacao (PRINCIPAL): declarar inexistente ou nulo o contrato ou o débito.
- dano_material: restituição ou repetição de indébito dos descontos (simples ou em dobro).
- dano_moral: indenização por danos morais.
- outro_pedido_monetario: outro pedido com valor (seguro, tarifas, multa).
Pedidos processuais (tutela de urgência, gratuidade, inversão do ônus, citação, custas e honorários, produção de provas) vão em pedidos_processuais, não em acusacoes.

Regras:
1. Uma acusação por pedido de mérito. dano_material, dano_moral e outro_pedido_monetario têm depende_de = id da acusação principal.
2. Se não houver pedido explícito de inexistência, mas o autor negar a contratação e pedir restituição, crie a principal com inferida = true.
3. forma_pedido: valor_explicito | dobro_dos_descontos | simples_dos_descontos | a_arbitrar | sem_valor_monetario.
4. valor_texto: copie o valor como escrito (ex.: "R$ 18.000,00") ou null. Não converta.
5. Cada acusação precisa de referência literal de "DOS PEDIDOS" e, se houver, de "DOS FATOS".
6. cronologia: eventos datados explicitamente no texto — contratacao, credito, primeiro_desconto, ciencia_autor, boletim_ocorrencia, reclamacao_administrativa, ajuizamento. Data em AAAA-MM-DD, ou AAAA-MM se só houver mês.
7. anexos_citados: todo documento que a petição diz juntar ("cópia em anexo", "documentos acostados").

<chunks>{chunks_da_peticao_e_anexos}</chunks>
```
**Schema:** `{acusacoes: [{id "ACU-01"…, tipo, descricao, depende_de|null, inferida: bool, forma_pedido, valor_texto|null, referencias: [{chunk_id, trecho}]}], pedidos_processuais: [{tipo, descricao, referencias}], cronologia: [{evento, data, referencias}], anexos_citados: [{descricao, chunk_id, trecho}]}`

### P4 — Embasamentos de uma acusação (uma chamada por acusação)

**System**
```
Você é analista jurídico do Banco UFMG (réu) numa ação de empréstimo consignado não reconhecido.
Para UMA acusação, mapeie os pontos que favorecem o banco e os que favorecem a parte autora, sempre com trecho literal dos documentos.
Seja completo e imparcial: omitir um ponto desfavorável ao banco é tão grave quanto inventar um favorável.
Classifique pela prova, não pela versão de cada parte. Quando a parte autora atribui a contratação a terceiro, os registros do próprio banco sobre a operação contestada (canal, dispositivo, conta de destino, aceite) mostram que a operação existiu, não que a parte autora a fez: não são contradições da parte autora.
Não atribua pesos, notas, probabilidades nem valores calculados.
```
**User**
```
Acusação analisada:
{{acusacao}}

Acusação principal (contexto):
{{acusacao_principal}}

Documentos presentes no pacote:
{{documentos_presentes}}

Tipos de subsídio do banco AUSENTES do pacote:
{{tipos_ausentes}}

Anexos que a petição diz ter juntado:
{{anexos_citados}}

Categorias permitidas para esta acusação. Preencha todas; use [] quando não houver itens:
{{categorias}}

Checklist — verifique cada ponto nos documentos presentes:
- contrato: assinatura e forma (manual ou eletrônica), canal, data, valor, conta de crédito.
- dossiê: resultado da grafotécnica, liveness ou biometria, validação de documentos.
- laudo: canal, autenticação, gravação, IP, dispositivo e geolocalização (compatível com o domicílio?), provas declaradas e não localizadas, documentos citados e não disponibilizados.
- comprovante de crédito: instituição e conta de destino, data; a titularidade é comprovada por documento independente ou só declarada pelo banco? A conta é a mesma em que a parte autora recebe o benefício? A parte autora nega ter essa conta?
- extrato: crédito, movimentações posteriores (saques, TED, PIX), titularidade.
- demonstrativo: parcelas pagas, status do contrato, divergência entre resumo e tabela.
- autos: alegações de fato, perfil do autor, boletim de ocorrência e reclamações, anexos citados × juntados, cronologia.

Regras:
1. Um fato por item, e cada fato numa única categoria desta acusação. Metadados da mesma fonte que provam a mesma coisa formam um item só.
2. Se a acusação analisada depende da principal, avalie-a supondo que a principal foi perdida (contrato declarado inexistente). Registre só fatos que mudam o cabimento ou o valor desta acusação; não repita provas nem lacunas sobre a existência da contratação.
3. titulo com até 12 palavras; descricao com o fato, de forma objetiva; justificativa explicando por que o item ajuda ou prejudica o banco NESTA acusação.
4. Referência do tipo "trecho": chunk_id + trecho copiado literalmente (até 300 caracteres, sem reticências nem correções); documentos_esperados = [].
5. Referência do tipo "ausencia_documental": só para lacunas; chunk_id e trecho = null; documentos_esperados com os tipos que faltam. Quando houver, acrescente outra referência do tipo "trecho" com a alegação não comprovada.
6. Alegação da parte autora sem prova vai em lacunas_argumentativas_autor. Só vai em fatos_comprovados_autor se um documento a comprovar.
7. Documento que a petição diz ter juntado, mas que não está entre os documentos presentes, é lacuna da parte autora.
8. Informação desfavorável ao banco que esteja nos próprios subsídios do banco (prova que o banco declara não localizada, documento citado e não disponibilizado, divergência interna) deve ser registrada. Prova que o banco descreve como existente e preservada conta a favor do banco na categoria própria; não é lacuna só por não ter sido anexada em arquivo separado.
9. Crédito em conta que a parte autora nega ter, sem documento independente que comprove a titularidade, é indício de fraude, não crédito em conta da parte autora nem contradição dela.
10. IDs no formato EMB-<número da acusação>-<sequencial com 3 dígitos>, por exemplo EMB-01-003.

<chunks>
{{chunks}}
</chunks>
```
**Schema:** `{acusacao_id, embasamentos: {<categoria>: [{id, titulo, descricao, justificativa, referencias: [{tipo: trecho|ausencia_documental, chunk_id|null, trecho|null, documentos_esperados: [], documentos_verificados: []}]}] }}`. Todas as categorias do tipo são obrigatórias.

### P5 — Fichamento de lote (map; só casos > 40 mil tokens)

**System**
```
Você faz o fichamento de um lote de trechos de um processo de empréstimo consignado não reconhecido contra o Banco UFMG.
Registre candidatos a embasamento para as acusações listadas. Não consolide, não deduplique e não conclua: outra etapa fará isso.
```
**User**
```
Acusações: {acusacoes_json}
Categorias por tipo de acusação: {catalogo_categorias_com_polaridade}

Para cada fato relevante do lote, crie um item com a acusação e a categoria mais adequadas, copiando o trecho literalmente (até 300 caracteres).
Ignore cabeçalhos, rodapés e texto repetido. Não crie itens de ausência documental nesta etapa.

<chunks>{lote_de_chunks}</chunks>
```
**Schema:** `{itens: [{acusacao_id, categoria, titulo, descricao, chunk_id, trecho}]}`. O *reduce* reutiliza P4, recebendo esses itens como `candidatos` junto dos chunks recuperados.

### P6 — Validador semântico

**System**
```
Você é um revisor independente de extração jurídica. Não confie no extrator: verifique cada item contra o trecho citado.
Você não cria itens novos; só aprova, reprova ou reclassifica.
```
**User**
```
Acusações:
{{acusacoes}}

Categorias permitidas por tipo de acusação, com definição e se favorecem o banco ou a parte autora:
{{categorias_por_tipo}}

Itens a revisar, cada um com a acusação, a categoria e o texto integral dos chunks citados:
{{itens}}

Para cada item, decida o status:
1. reprovado: o trecho não sustenta a descrição; o item repete um fato já coberto por outro item da mesma acusação (cite o ID do item mantido no motivo); ou o item está numa acusação dependente (dano_material, dano_moral, outro_pedido_monetario) e trata só da existência da contratação (provas, lacunas ou indícios sobre quem contratou), que já conta na acusação principal.
2. reclassificar: o fato é válido, mas a categoria ou a polaridade está errada para aquela acusação; informe categoria_sugerida entre as permitidas para o tipo. Confira em especial:
   - contradicoes_do_autor apoiada só em registro interno do banco sobre a operação contestada (canal, conta de destino, aceite) não é contradição;
   - credito_em_conta_do_autor ou compensacao_valor_creditado em conta que a parte autora nega ter, sem documento independente de titularidade, não favorece o banco: na principal, reclassifique para indicios_de_fraude; nas dependentes, reprove;
   - autenticação declarada cuja evidência o próprio banco diz não ter localizado não é autenticacao_forte;
   - instrumento contratual presente no pacote e prova descrita pelo banco como preservada (gravação com duração, retorno do INSS com data) favorecem o banco: não reprove por a assinatura ou o arquivo não aparecerem no texto extraído.
3. aprovado: nos demais casos; categoria_sugerida = null.

Revise todos os itens. O motivo é obrigatório e curto (até 25 palavras).
```
**Schema:** `{itens: [{id, status: aprovado|reprovado|reclassificar|mesclar, categoria_sugerida|null, mesclar_com|null, motivo}], acusacoes_omitidas: [{descricao, chunk_id, trecho}], omissoes: [{acusacao_id, categoria, descricao, chunk_id|null, trecho|null}], observacoes_gerais: []}`

### P7 — Decisora e justificativa final

**System**
```
Você é responsável pela recomendação final do Banco UFMG (réu) num processo de empréstimo consignado não reconhecido.
Decida entre ACORDO e DEFESA e justifique para o advogado que vai executar a decisão.

Você recebe análises já calculadas pelo sistema: probabilidades do modelo histórico, embasamentos extraídos e validados, perdas estimadas, custo esperado da defesa, faixa de negociação (abertura, alvo, máximo) e cenários.
Esses números são fixos: não recalcule, não crie novos valores e não altere a faixa.

Não confunda valor a pagar com custo total:
- faixa_acordo_valor_a_pagar (abertura, alvo, máximo) é o valor oferecido à parte autora. Só esses números podem ser chamados de abertura, alvo ou máximo.
- custo_total_acordo_no_alvo = alvo + custo_negociacao. Chame-o de "custo total do acordo no alvo", nunca de "alvo".
- cenarios_custo_total já incluem o custo de negociação (acordo) ou o custo de defesa (defesa).

Critérios, em ordem de importância:
1. Comparação econômica: custo esperado da defesa × custo total do acordo no alvo, considerando a robustez informada (em quantas simulações o acordo sai mais barato).
2. Risco de cauda: pior cenário da defesa frente à alçada do banco.
3. Qualidade da prova: embasamentos que favorecem e prejudicam o banco, com atenção aos de maior peso e às lacunas de cada lado.
4. Contexto regional: efeito da UF e do subassunto no histórico.
5. Confiabilidade da análise: divergência entre modelo histórico e análise de conteúdo, coorte pequena, falhas de extração.

Você pode decidir contra a comparação econômica apenas se prova, risco ou confiabilidade justificarem. Nesse caso, marque decisao_contraria_a_economia = true e explique em comparacao_economica.
Escreva em português claro para advogado. Cite embasamentos pelos IDs. Todo número mencionado deve existir literalmente na entrada.
Se a ação for ACORDO, preencha estrategia_acordo e deixe teses_defesa = null. Se for DEFESA, preencha teses_defesa e deixe estrategia_acordo = null.
```
**User** (JSON montado pelo `runner`)
```
{
  "caso": {"cnj", "uf", "subassunto", "valor_causa", "flags", "reason_codes_deterministicos"},
  "historico": {"probabilidades", "p_derrota", "perda_se_condenado", "coorte", "certeza_modelo",
                "efeitos_pp": {"uf", "subassunto", "contrato", "extrato", "..."},
                "perfil_regional": {"taxa_derrota_uf", "taxa_derrota_nacional", "ranking_uf"}},
  "conteudo": {"acusacoes": [{"id", "tipo", "descricao", "valor_pedido", "p_vitoria", "p_vitoria_condicional",
                "embasamentos": [{"id", "categoria", "polaridade", "peso", "titulo", "descricao", "justificativa",
                                  "referencias": [{"documento", "pagina", "trecho"}]}]}],
               "p_derrota", "perda_se_condenado", "validacao": {"taxa_reprovacao", "omissoes"}},
  "financeiro": {"alfa", "beta", "p_derrota", "perda_se_condenado", "perda_esperada", "custo_defesa",
                 "custo_defesa_esperado", "faixa_acordo_valor_a_pagar": {"abertura", "alvo", "maximo"}, "alcada", "custo_negociacao",
                 "custo_total_acordo_no_alvo", "vantagem_economica_acordo", "p_acordo_mais_barato",
                 "aceite_minimo_para_compensar",
                 "cenarios_custo_total": {"defesa": {"melhor", "medio", "pior"}, "acordo": {"melhor", "medio", "pior"}},
                 "divergencia_subfluxos": {"p", "perda_se_condenado"}},
  "premissas": ["aceite do acordo no alvo é assumido", "k calibrado em 280 acordos históricos", "..."]
}
```
**Schema:**
```
{
  acao: ACORDO|DEFESA,
  resumo: string (até 3 frases),
  decisao_contraria_a_economia: bool,
  justificativa: {
    risco_historico, contexto_regional, comparacao_economica, qualidade_da_prova,
    convergencia_das_analises, premissas_e_limitacoes,
    analise_por_acusacao: [{acusacao_id, analise, embasamento_ids: []}]
  },
  estrategia_acordo: {roteiro: [], concessoes_por_acusacao: [{acusacao_id, posicao, embasamento_ids}],
                      argumentos_para_negociacao: [], riscos_se_recusado: []} | null,
  teses_defesa: {teses: [{acusacao_id, tese, embasamento_ids}],
                 riscos_da_defesa: [{descricao, embasamento_ids}]} | null,
  condicoes_para_reavaliar: [],
  pontos_de_atencao: []
}
```
**Pós-processamento:** guardrails da §2.3; montagem do envelope da §3 (`summary = resumo`, `what_changes = condicoes_para_reavaliar`).

---

## 6. Reuso

| O quê | Onde |
|---|---|
| Padrão OpenAI Responses + `json_schema` strict | `src/api/app/services/chat.py` (`OpenAIChatGateway.answer`) — replicar em `decision_engine/llm/client.py` |
| Modelos de contrato e validação de saída | `src/contracts/contracts/pipeline.py` (`CaseInput`, `PipelineOutput.model_validate`, `complete_payload`) |
| Chamada e persistência pelo backend | `src/api/app/services/analysis.py` (`build_engine_input`, `invoke_pipeline`, `_persist_output`) |
| Padrão de teste com engine mockada e fixture de saída | `tests/test_workflow.py` (`pipeline_result`, `monkeypatch` em `app.services.analysis.decision_engine.run_pipeline`) e `tests/test_contract.py` |
| Formato esperado pela Tela 3 | `src/web/src/types/workspace.ts` e `src/web/src/pages/Workspace/fixtures/caso02.ts` |
| Fórmulas, pesos, taxonomia e parâmetros | `docs/PLANO_ENGINE_IA_V2.md` §3–§5 |

---

## 7. Verificação

1. **Unitários offline** (`pytest tests/engine`):
   - CNJ → UF, valor da causa e flags nos 2 casos;
   - parser (21/R$ 4.326,00; 8/R$ 8.241,28) e pedidos (15.000/18.000; dobro 5.040/2.880);
   - fórmulas de scoring e financeiro; reprodução do V2 §8;
   - monotonicidade (item negativo nunca aumenta P_v);
   - cenários ordenados.
2. **LLM em replay** (`ENGINE_LLM_CACHE=replay`, respostas gravadas uma vez com a chave real):
   - extractor cobre o gold;
   - 100% das referências localizadas;
   - validador pega ≥ 90% das mutações (trecho inventado, polaridade trocada, duplicado, valor alterado, pedido omitido).
3. **Guardrails adversariais:** saída da P7 com número inventado, `embasamento_id` inexistente ou ação sem bloco de estratégia → nova tentativa → exceção. Decisão contra a economia → `DECISAO_CONTRARIA_ECONOMIA`, com a decisão mantida.
4. **Contrato:** `PipelineOutput.model_validate(run_pipeline(case))` passa para os 2 casos; `tests/test_contract.py` e `tests/test_workflow.py` do backend continuam passando.
5. **Ponta a ponta com o backend:**
   ```
   DATABASE_URL=sqlite:///./db/app.db STORAGE_DIR=./storage DATA_DIR=./data uvicorn app.main:app
   ```
   `POST /api/cases/{caso02}/analyze` → polling em `GET /api/cases/{id}/analysis` até `COMPLETED` → `GET /api/cases/{id}/workspace` com ação, confiança, faixa e evidências com `document_id` válido. `GET /api/documents/{id}/file` abre a página citada.
6. **Execução real (live)** nos 2 casos: revisar manualmente a justificativa e as referências, gravando o cache para o replay.

---

## 8. Premissas assumidas neste plano

- A LLM decisora recebe todo o contexto (não só a faixa); a faixa, os valores e a confiança são do sistema.
- Sem fallback heurístico: se a decisora falhar após a nova tentativa, o job falha e pode ser reexecutado.
- Confiança = concordância da ação escolhida com a robustez econômica simulada.
- A margem de segurança sai; custo de negociação (R$ 500) e alçada (0,6·VC) continuam como parâmetros.
- A engine emite as extras no formato da Tela 3; o backend só precisa expor `payload`.
- Continua pendente confirmar com a organização que, nas linhas de Acordo, a coluna de valor é o valor pago; a calibração de k depende disso.
