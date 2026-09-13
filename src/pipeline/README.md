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
| `full` | Pipeline completo (em implementação) |

Outras variáveis: `OPENAI_API_KEY`, `OPENAI_MODEL`, `ENGINE_LLM_CACHE` (`live|record|replay`), `ENGINE_LLM_CACHE_DIR`, `ENGINE_ARTIFACTS_DIR`.

## Configuração versionada

- `decision_engine/config/engine_v1.yaml`: α/β, severidades, k do acordo, custos, alçada, scoring, simulação e tetos de confiança.
- `decision_engine/config/pesos_embasamento_v1.yaml`: categorias de embasamento por tipo de acusação, com peso e definição.
- `decision_engine/config/prompts/`: prompts P1–P7, carregados por `decision_engine.config_loader.load_prompt`.

## Testes

```bash
.venv/bin/python -m pytest tests/engine
```

As anotações de referência dos dois casos ficam em `tests/engine/fixtures/gold_caso0*.json`.
