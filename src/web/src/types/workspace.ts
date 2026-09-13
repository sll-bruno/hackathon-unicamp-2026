/*
 * Contrato proposto para GET /api/cases/{id}/workspace (Tela 3 · Área de trabalho).
 * Segue o contrato atualizado da engine (docs/architecture_engine.md):
 * confiança percentual 0–100 (ou null), fatos com peso por categoria e fontes
 * com documento, página e trecho. Alinhar mudanças com Backend e Pipeline.
 */

export type Action = 'ACORDO' | 'DEFESA';

export type CaseStatus =
  | 'RASCUNHO'
  | 'EM_ANALISE'
  | 'AGUARDANDO_DECISAO'
  | 'PROPOSTA_ACEITA'
  | 'DIVERGIU'
  | 'EM_NEGOCIACAO'
  | 'AGUARDANDO_ENCERRAMENTO'
  | 'ENCERRADO';

export type SubsidyType =
  | 'contrato'
  | 'extrato'
  | 'comprovante_credito'
  | 'dossie'
  | 'demonstrativo_divida'
  | 'laudo_referenciado';

export type DocumentType = SubsidyType | 'autos';

export interface CaseDocument {
  document_id: string;
  filename: string;
  type: DocumentType;
  pages: number;
}

/** Trecho citado: documento, página (1-based) e trecho literal. */
export interface Source {
  document_id: string;
  page: number;
  excerpt: string;
}

/** Relação do fato com a alegação da parte autora. */
export type FactRelation = 'supports' | 'refutes' | 'neutral';

export interface Fact {
  id: string;
  fact_type: string;
  description: string;
  /** Peso da categoria, obtido da tabela versionada. null = não mapeado. */
  weight: number | null;
  weights_version: string;
  relation: FactRelation;
  claim?: string;
  sources: Source[];
}

/** Divergência de conteúdo entre trechos. Não altera flags nem valida documentos. */
export interface Contradiction {
  id: string;
  description: string;
  sources: Source[];
  note?: string;
}

/** Informação necessária ausente ou indisponível no inventário. */
export interface Gap {
  id: string;
  description: string;
  impact: string;
  sources: Source[];
}

export interface SettlementRange {
  opening: number;
  target: number;
  ceiling: number;
}

export interface Recommendation {
  action: Action;
  /** 0–100; null quando ainda não calculável (ver confidence_null_reason). */
  confidence_percent: number | null;
  confidence_method_version: string | null;
  confidence_null_reason?: string;
  reason: string;
  reason_codes: string[];
  expected_defense_cost: number;
  defense_cost_range: [number, number];
  settlement_range: SettlementRange;
  expected_savings: number;
  what_changes: string[];
  assumptions: string[];
}

export interface OutcomeProbabilities {
  extincao: number;
  improcedencia: number;
  parcial: number;
  procedencia: number;
}

export interface Workspace {
  case: {
    case_id: string;
    cnj: string;
    court: string;
    uf: string;
    thesis: string;
    claim_value: number;
    status: CaseStatus;
    plaintiff: string;
    contract_number: string;
  };
  documents: CaseDocument[];
  subsidy_flags: Record<SubsidyType, boolean>;
  risk: { probabilities: OutcomeProbabilities; cohort_size: number | null };
  recommendation: Recommendation;
  facts: Fact[];
  contradictions: Contradiction[];
  gaps: Gap[];
  versions: Record<string, string>;
  analyzed_at: string;
}
