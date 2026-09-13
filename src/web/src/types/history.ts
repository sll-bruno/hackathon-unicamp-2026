import type { RecommendedAction } from './case';

export type HistoricalMacroResult = 'EXITO' | 'NAO_EXITO';

export type HistoricalOutcome =
  | 'IMPROCEDENCIA'
  | 'EXTINCAO'
  | 'PARCIAL'
  | 'PROCEDENCIA'
  | 'ACORDO';

export interface HistoricalRecommendation {
  action: RecommendedAction;
  confidence_percent: number | null;
}

/**
 * Registro encerrado da base histórica. Este contrato é propositalmente
 * diferente de HistoryEvent (`GET /api/history`), que representa auditoria.
 */
export interface HistoricalCase {
  id: string;
  operational_case_id: string | null;
  cnj: string;
  plaintiff_name: string | null;
  uf: string;
  subject: string;
  subtopic: string;
  macro_result: HistoricalMacroResult;
  outcome: HistoricalOutcome;
  claim_value: number;
  award_value: number;
  recommendation: HistoricalRecommendation | null;
  closed_at: string | null;
}

export interface HistoricalCasesPayload {
  items: HistoricalCase[];
  total: number;
  simulated: true;
}
