# Engine de decisão — pessoas A e B

- Pessoa A: ingestão, features, chunking, extração com LLM e validação.
- Pessoa B: modelo de risco, calibrações, scoring e motor financeiro (`training/` offline).
- Integração: `decision_engine/runner.py`, função `run_pipeline(case, on_progress=None)`.

Plano e prompts: [`docs/PLANO_IMPLEMENTACAO_ENGINE.md`](../../docs/PLANO_IMPLEMENTACAO_ENGINE.md). Fórmulas e parâmetros: [`docs/PLANO_ENGINE_IA_V2.md`](../../docs/PLANO_ENGINE_IA_V2.md). Contrato com o backend: `src/contracts/contracts/pipeline.py`.

## Modos

| `ENGINE_MODE` | Comportamento |
|---|---|
| `off` (padrão) | `run_pipeline` lança `NotImplementedError`; o job do backend termina `FAILED` |
| `stub` | Envelope válido marcado com `versions.pipeline="stub"` e reason code `STUB`, para integração |
| `full` | Pipeline completo: leitura dos PDFs (OCR com Tesseract), XGBoost, extração com LLM, motor financeiro e LLM decisora |

Outras variáveis (lidas do ambiente ou do `.env` da raiz): `OPENAI_API_KEY`, `OPENAI_MODEL`, `ENGINE_LLM_CACHE` (`live|record|replay`, padrão `record`), `ENGINE_LLM_CACHE_DIR`, `ENGINE_ARTIFACTS_DIR`.

## Rodar

```bash
brew install tesseract tesseract-lang                      # OCR (uma vez)
.venv/bin/python src/pipeline/training/train_risk.py       # re-treina o XGBoost (opcional; artefatos já versionados)
.venv/bin/python -m decision_engine data/Caso_02_0654321-09-2024-8-04-0001
```

O CLI grava o resultado completo em `resultados/<pasta>.json`. Com `ENGINE_LLM_CACHE=record`, respostas de LLM já obtidas ficam em `.engine_llm_cache/` e não são cobradas de novo.

## Fluxo (`ENGINE_MODE=full`)

1. `ingest/`: texto por página com `pdfplumber`; Tesseract nas páginas sem texto; UF pelo CNJ, valor da causa, flags e demonstrativo.
2. `extraction/content.py`: P2 (subassunto), P3 (acusações), P4 por acusação (embasamentos), P6 (validador).
3. `risk/model.py`: XGBoost calibrado → P(derrota), perda se condenado, efeitos em pp e perfil regional.
4. `scoring/probabilidade.py`: pesos × contagem → P(vitória) por acusação e perda se condenado do conteúdo.
5. `finance/motor.py`: combinação α/β, custo esperado da defesa, faixa de acordo (k), cenários e simulação.
6. `decision/decisor.py`: P7 decide ACORDO ou DEFESA e justifica; confiança calculada pelo sistema.
7. `output/envelope.py`: `PipelineOutput` do backend, com os blocos extras.

## Configuração versionada

- `decision_engine/config/engine_v1.yaml`: α/β, severidades, k do acordo, custos, alçada, scoring, simulação e tetos de confiança.
- `decision_engine/config/pesos_embasamento_v1.yaml`: categorias de embasamento por tipo de acusação, com peso e definição.
- `decision_engine/config/prompts/`: prompts P1–P7, carregados por `decision_engine.config_loader.load_prompt`.

## Testes

```bash
.venv/bin/python -m pytest tests/engine
```

As anotações de referência dos dois casos ficam em `tests/engine/fixtures/gold_caso0*.json`.
