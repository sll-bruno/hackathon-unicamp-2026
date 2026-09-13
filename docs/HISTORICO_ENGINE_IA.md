# Histórico da engine de IA

Registro das decisões e do estado da engine de decisão (branch `feature/engine-ai`). Detalhes técnicos em [`PLANO_ENGINE_IA_V2.md`](PLANO_ENGINE_IA_V2.md) (o quê e por quê) e [`PLANO_IMPLEMENTACAO_ENGINE.md`](PLANO_IMPLEMENTACAO_ENGINE.md) (como e em que ordem).

## Contexto

- Hackathon Enter: política de acordos do Banco UFMG para ações de empréstimo consignado não reconhecido. Para cada processo, recomendar ACORDO ou DEFESA, com valor de acordo e justificativa.
- Tiago é responsável pela engine de IA. Backend (Pessoa C) e frontend (Pessoas D e E) estão em outras branches e, por ora, são placeholders: a engine não depende deles.
- Dados: `data/Hackaton_Enter_Base_Candidatos.xlsx` (60 mil processos; fora do git) e dois casos completos em PDF (`data/Caso_01…`, `data/Caso_02…`). PDFs e planilha são considerados corretos.
- Prioridade atual: fluxo funcionando de ponta a ponta. Casos de borda, guardrails elaborados, map-reduce e integração com back/front ficam para produção.

## Decisões, em ordem

1. **Arquitetura da equipe:** dois subfluxos independentes — histórico (XGBoost sobre UF, subassunto, valor da causa e 6 flags) e conteúdo (LLM extrai acusações e embasamentos com trechos citados, validador LLM, pesos × contagem → probabilidade por acusação).
2. **Regra `custo/VC > 0,6` descartada:** comparava a exposição com uma fração fixa e ignorava o preço do acordo. 0,6 × VC virou apenas a **alçada** (limite da faixa).
3. **Três informações para a decisão:** perda se condenado, acordo provável e fatos probatórios, com cenários melhor/médio/pior.
4. **Valor do acordo = k × perda se condenado** (não perda esperada). k calibrado nos 280 acordos históricos: P25 0,35 (abertura), P50 0,41 (alvo), P90 0,54 (máximo). Prevê os acordos com o mesmo erro do histórico puro, partindo do caso atual.
5. **Regra heurística final removida:** o sistema calcula números, faixa, cenários e robustez; a **LLM decisora (P7)** escolhe ACORDO ou DEFESA e justifica. A confiança continua calculada pelo sistema (`mc-economic-agreement-v1`: concordância da ação com a comparação econômica simulada, com tetos por alerta).
6. **OCR com Tesseract** (Apache-2.0) via `pytesseract`, só nas páginas sem texto. OCR por LLM e OCRmyPDF foram descartados.
7. **Documentos mantidos:** `architecture_engine.md` fica como está (é referência das outras frentes); `PLANO_ENGINE_IA.md` foi removido.

## Estado atual (commits)

| Commit | Etapa | Conteúdo |
|---|---|---|
| `184af3b` | 0 | Configuração versionada (`engine_v1.yaml`, `pesos_embasamento_v1.yaml`), prompts P1–P7, stub, anotações de referência dos dois casos |
| `2171b22` | 1B | XGBoost calibrado (`training/train_risk.py`; log loss 0,936 × 1,244 do prior; ECE 0,004), severidade, k, perfil regional |
| `8151b7f` | 1A | Leitura dos PDFs com OCR, UF pelo CNJ, valor da causa, flags, parser do demonstrativo, chunks por página |
| `43cb8f4` | 2 e 3 | Cliente OpenAI com cache, extração (P2, P3, P4, P6), pontuação, motor financeiro, decisora (P7), `PipelineOutput`, CLI e teste de ponta a ponta offline |

Testes: 54 passando (`.venv/bin/python -m pytest -q`).

## Resultado real (`gpt-5`)

| Caso | Decisão | Confiança | P(derrota) | Custo esperado da defesa | Faixa de acordo |
|---|---|---|---|---|---|
| 01 (MA, 6 subsídios) | DEFESA | 100% | 1,8% | R$ 239 | R$ 4.372 / 5.134 / 6.821 |
| 02 (AM, Golpe, 3 subsídios) | ACORDO | 70% | 62% | R$ 9.823 | R$ 5.304 / 6.228 / 8.275 |

## Pendências

- **Calibração (Etapa 4):** no Caso 02 a análise de conteúdo deu P(derrota) 26% contra 97% do XGBoost (`DIVERGENCIA_SUBFLUXOS`). A LLM contou registros digitais e "contradições do autor" a favor do banco e nenhum indício de fraude. Ajustar prompt P4, pesos e definições das categorias.
- A decisora chamou de "alvo" o custo do acordo no alvo (alvo + custo de negociação); deixar os rótulos mais explícitos no P7.
- Prompts P1 (classificação de página) e P5 (fichamento map-reduce) existem, mas não estão ligados ao fluxo.
- Integração com o backend (expor `payload`, `ENGINE_MODE=full`, Tesseract no Dockerfile) e com a Tela 3 do frontend.
- Confirmar com a organização que, nas linhas de Acordo da planilha, a coluna de valor é o valor pago (base da calibração de k).
- Atualizar `architecture_engine.md` quando a engine estabilizar.

## Como rodar

```bash
brew install tesseract tesseract-lang
.venv/bin/python -m pip install -e '.[dev,training]'
.venv/bin/python -m decision_engine data/Caso_02_0654321-09-2024-8-04-0001   # grava resultados/<pasta>.json
.venv/bin/python -m pytest -q tests/engine
```

A chave `OPENAI_API_KEY` e o `OPENAI_MODEL` vêm do `.env` da raiz. Respostas de LLM ficam em `.engine_llm_cache/` (modo `record`); os testes usam as gravadas em `tests/engine/fixtures/llm_cache/` (modo `replay`).
