// Estados do processo (docs/ARCHITECTURE.md §4).
export type CaseStatus =
  | 'RASCUNHO'
  | 'DOCUMENTOS_ENVIADOS'
  | 'EM_ANALISE'
  | 'AGUARDANDO_DECISAO'
  | 'PROPOSTA_ACEITA'
  | 'DIVERGIU'
  | 'EM_NEGOCIACAO'
  | 'AGUARDANDO_ENCERRAMENTO'
  | 'ENCERRADO';

export type Thesis = 'GOLPE' | 'GENERICO';

// Ação recomendada pela engine (contracts/pipeline.py).
export type RecommendedAction = 'ACORDO' | 'DEFESA';

// Resumo da recomendação exibido fora da área do processo.
// Campos seguem docs/architecture_engine.md §5.
export interface RecommendationSummary {
  action: RecommendedAction;
  confidence_percent: number | null; // 0–100; null quando não calculável
  suggested_range: [number, number] | null; // só em ACORDO
  economic_ceiling: number | null;
  defense_cost_central: number;
  policy_version: string;
}

// Pendência que trava a análise e exige reenvio do advogado (docs/ARCHITECTURE.md §4/§7,
// erros de analysis_jobs como ARQUIVO_ILEGIVEL).
export interface CaseAlert {
  code: 'DOCUMENTO_ILEGIVEL' | 'FALHA_EXTRACAO';
  message: string;
}

export interface CaseListItem {
  id: string;
  cnj: string;
  plaintiff_name: string; // nome da parte autora — identificador amigável do caso
  uf: string;
  thesis: Thesis;
  claim_value: number;
  status: CaseStatus;
  office: string; // escritório responsável; não exibido nesta lista (um advogado só vê os próprios casos)
  updated_at: string; // ISO datetime
  recommendation: RecommendationSummary | null;
  alert: CaseAlert | null;
}

export interface CasesSummary {
  open: number;
  awaiting_decision: number; // precisa revisar a recomendação (aceitar/divergir)
  pending_outcome: number; // decisão tomada, falta registrar o desfecho
  document_errors: number; // documento com erro de leitura, precisa reenvio
  in_analysis: number;
}
