// Estados do processo (docs/ARCHITECTURE.md §4).
export type CaseStatus =
  | 'RASCUNHO'
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

// Resultado final do caso, gravado em case_outcomes ao encerrar (docs/ARCHITECTURE.md §8).
export type CaseOutcome = 'FAVORAVEL' | 'PARCIAL' | 'DESFAVORAVEL';

export interface CaseListItem {
  id: string;
  cnj: string;
  plaintiff_name: string; // nome da parte autora — identificador amigável do caso
  uf: string;
  thesis: Thesis;
  claim_value: number;
  status: CaseStatus;
  office: string; // escritório responsável; não exibido nesta lista (um advogado só vê os próprios casos)
  created_at: string; // ISO datetime — data de cadastro do caso
  updated_at: string; // ISO datetime
  recommendation: RecommendationSummary | null;
  alert: CaseAlert | null;
  // Espelha lawyer_decisions.accepted (docs/ARCHITECTURE.md §7). null até o
  // advogado decidir; preenchido a partir de PROPOSTA_ACEITA/DIVERGIU e mantido
  // mesmo depois que o status avança (o status sozinho não distingue mais os dois
  // casos uma vez que o caso chega em AGUARDANDO_ENCERRAMENTO/ENCERRADO).
  followed_recommendation: boolean | null;
  outcome: CaseOutcome | null; // só preenchido quando status === 'ENCERRADO'
}

// Dados básicos do processo extraídos por OCR a partir do auto (docs/architecture_engine.md).
// O advogado revisa/corrige antes de salvar — nunca são gravados sem confirmação.
export interface ExtractedCaseData {
  cnj: string;
  uf: string;
  thesis: Thesis;
  claim_value: number;
  plaintiff_name: string;
  court: string;
  contract_number: string;
}

export interface CasesSummary {
  open: number;
  awaiting_decision: number; // precisa revisar a recomendação (aceitar/divergir)
  pending_outcome: number; // decisão tomada, falta registrar o desfecho
  document_errors: number; // documento com erro de leitura, precisa reenvio
  in_analysis: number;
  open_value_sum: number; // soma de claim_value dos casos não encerrados
  new_this_month: number; // casos com created_at nos últimos 30 dias
  adherence_percent: number | null; // % de decisões que seguiram a recomendação; null sem decisões
  effectiveness_percent: number | null; // % de desfechos favoráveis entre os que seguiram a recomendação; null sem casos encerrados elegíveis
}
