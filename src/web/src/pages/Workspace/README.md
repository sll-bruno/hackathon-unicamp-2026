# Tela 3 · Área de trabalho

Visão de um processo: cartão de recomendação, explicabilidade (fatos, contradições e lacunas com citação de documento e página) e painel de fontes.

## Dados

- Contrato consumido: `GET /api/cases/{id}/workspace` → `Workspace` em [`src/types/workspace.ts`](../../types/workspace.ts). Segue a engine: `confidence_percent` 0–100 ou `null`, fatos com `weight`/`weights_version` e fontes `{document_id, page, excerpt}`.
- Enquanto a API não responde, em `npm run dev` a tela usa `fixtures/caso01.ts` (DEFESA) e `fixtures/caso02.ts` (ACORDO) e mostra o selo **Dados de exemplo**. Os trechos citados vêm dos PDFs em `data/`; confiança, probabilidades, valores e pesos são ilustrativos.
- Trocar de caso: `?case=caso-01` ou `?case=caso-02`.
- Clicar no texto ou em uma fonte da evidência abre automaticamente o PDF em nova aba na página citada, via `GET /api/documents/{id}/file#page=N`; o trecho permanece selecionado no painel lateral e há um link para reabrir o documento.

## Componentes

| Arquivo | Papel |
|---|---|
| `components/RecommendationCard.tsx` | Decisão: ação (acordo/defesa) e confiança |
| `components/SettlementCard.tsx` | Faixa abertura/alvo/teto, custo da defesa, economia e premissas |
| `components/RiskCard.tsx` | Risco de condenação do banco por desfecho |
| `components/WhatChangesCard.tsx` | Condições que mudariam a decisão |
| `components/EvidenceCard.tsx` | Fato, contradição ou lacuna com documentos citados (agrupados por página) |
| `components/SourcePanel.tsx` | Trecho selecionado e inventário dos seis subsídios |

A perspectiva é sempre a do banco réu. O app tem só tema escuro.

## Pendente

Confirmar/corrigir evidência.
