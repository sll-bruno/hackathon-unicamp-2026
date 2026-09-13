import type { RecommendedAction, Thesis } from './case';

// Motivo estruturado quando o advogado diverge da recomendação (docs/ARCHITECTURE.md §6/§7).
export type DivergenceReason = 'DOCUMENTO_INVALIDO' | 'FATO_NOVO' | 'ERRO_EXTRACAO' | 'VALOR_IRREAL' | 'OUTRO';

// Bucket de recommendation.confidence_percent: alta ≥80, média 50–79, baixa <50.
// Threshold provisório — ajustar quando o time de engine validar a distribuição real.
export type ConfidenceBand = 'alta' | 'media' | 'baixa';

export interface AdherenceFilters {
  period: '30d' | '90d' | '12m' | 'all';
  officeId?: string;
  thesis?: Thesis;
  confidenceBand?: ConfidenceBand;
  policyVersion?: string;
}

export interface AdherenceByAction {
  action: RecommendedAction;
  adherence_percent: number | null;
  total: number;
}

export interface AdherenceByOffice {
  office_id: string;
  office_name: string;
  adherence_percent: number | null;
  total: number;
}

export interface AdherenceByConfidence {
  band: ConfidenceBand;
  accepted: number;
  diverged: number;
}

export interface DivergenceReasonCount {
  reason: DivergenceReason;
  count: number;
}

export interface AdherenceOverview {
  overall_percent: number | null; // null sem decisões no filtro
  total_decisions: number;
  by_action: AdherenceByAction[];
  by_office: AdherenceByOffice[];
  by_confidence: AdherenceByConfidence[];
  divergence_reasons: DivergenceReasonCount[];
}
