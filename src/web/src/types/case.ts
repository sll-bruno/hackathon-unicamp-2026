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

export interface CaseListItem {
  id: string;
  cnj: string;
  uf: string;
  thesis: Thesis;
  claim_value: number;
  status: CaseStatus;
  office: string;
  deadline_at: string | null; // ISO date
  updated_at: string; // ISO datetime
  recommendation: RecommendationSummary | null;
}

export interface CasesSummary {
  open: number;
  awaiting_decision: number;
  in_analysis: number;
  deadline_soon: number; // prazo ≤ 5 dias
}
