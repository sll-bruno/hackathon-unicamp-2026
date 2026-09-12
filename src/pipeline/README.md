# Engine de decisão — pessoas A e B

- Pessoa A: `decision_engine/extraction/` — extração e classificação dos fatos com fontes.
- Pessoa B: `decision_engine/risk/`, `decision_engine/finance/` e `training/` — modelo, cálculo financeiro e treinamento offline.
- Integração: `decision_engine/runner.py`, função `run_pipeline(case)`.

A função ainda não está implementada. Não há dados simulados, modelos, pesos predefinidos nem chamadas à OpenAI. Contratos em `src/contracts/`; regras em `docs/architecture_engine.md`.
