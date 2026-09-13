import type { RecommendedAction, Thesis } from '../types/case';
import type {
  AdherenceByAction,
  AdherenceByConfidence,
  AdherenceByOffice,
  AdherenceFilters,
  AdherenceOverview,
  AdherenceTrendPoint,
  ConfidenceBand,
  DivergenceReason,
} from '../types/adherence';

// Uma linha de lawyer_decisions já resolvida com os dados de recommendation/case
// necessários pro dashboard (docs/ARCHITECTURE.md §6, tabelas lawyer_decisions + recommendations).
export interface AdherenceRecord {
  action: RecommendedAction;
  accepted: boolean;
  divergence_reason: DivergenceReason | null; // preenchido quando accepted === false
  confidence_percent: number | null;
  office_id: string;
  office_name: string;
  thesis: Thesis;
  policy_version: string;
  decided_at: string; // ISO datetime
}

export const CONFIDENCE_BANDS: ConfidenceBand[] = ['alta', 'media', 'baixa'];
export const DIVERGENCE_REASONS: DivergenceReason[] = [
  'DOCUMENTO_INVALIDO',
  'FATO_NOVO',
  'ERRO_EXTRACAO',
  'VALOR_IRREAL',
  'OUTRO',
];

const PERIOD_DAYS: Record<Exclude<AdherenceFilters['period'], 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
};
const DAY_MS = 86_400_000;

// docs/ARCHITECTURE.md não define os limiares — provisório até o time de engine validar
// a distribuição real de confidence_percent.
export function bucketFromPercent(percent: number | null): ConfidenceBand | null {
  if (percent === null) return null;
  if (percent >= 80) return 'alta';
  if (percent >= 50) return 'media';
  return 'baixa';
}

function matchesFilters(record: AdherenceRecord, filters: AdherenceFilters, now: Date): boolean {
  if (filters.period !== 'all') {
    const cutoff = now.getTime() - PERIOD_DAYS[filters.period] * DAY_MS;
    if (new Date(record.decided_at).getTime() < cutoff) return false;
  }
  if (filters.officeId && record.office_id !== filters.officeId) return false;
  if (filters.thesis && record.thesis !== filters.thesis) return false;
  if (filters.confidenceBand && bucketFromPercent(record.confidence_percent) !== filters.confidenceBand) return false;
  if (filters.policyVersion && record.policy_version !== filters.policyVersion) return false;
  return true;
}

function adherencePercentOf(records: AdherenceRecord[]): number | null {
  if (records.length === 0) return null;
  const accepted = records.filter((r) => r.accepted).length;
  return (accepted / records.length) * 100;
}

function buildByAction(records: AdherenceRecord[]): AdherenceByAction[] {
  return (['ACORDO', 'DEFESA'] as const).map((action) => {
    const subset = records.filter((r) => r.action === action);
    return { action, adherence_percent: adherencePercentOf(subset), total: subset.length };
  });
}

function buildByOffice(records: AdherenceRecord[]): AdherenceByOffice[] {
  const byId = new Map<string, AdherenceRecord[]>();
  for (const r of records) {
    byId.set(r.office_id, [...(byId.get(r.office_id) ?? []), r]);
  }
  return [...byId.entries()].map(([office_id, subset]) => ({
    office_id,
    office_name: subset[0].office_name,
    adherence_percent: adherencePercentOf(subset),
    total: subset.length,
  }));
}

function buildByConfidence(records: AdherenceRecord[]): AdherenceByConfidence[] {
  return CONFIDENCE_BANDS.map((band) => {
    const subset = records.filter((r) => bucketFromPercent(r.confidence_percent) === band);
    return {
      band,
      accepted: subset.filter((r) => r.accepted).length,
      diverged: subset.filter((r) => !r.accepted).length,
    };
  });
}

function buildDivergenceReasons(records: AdherenceRecord[]) {
  const diverged = records.filter((r) => !r.accepted);
  return DIVERGENCE_REASONS.map((reason) => ({
    reason,
    count: diverged.filter((r) => r.divergence_reason === reason).length,
  }));
}

const WEEK_MS = 7 * DAY_MS;
const toISODate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Bucketiza os registros já filtrados em intervalos de 7 dias, ancorados no início
// da janela do período (ou na decisão mais antiga do filtro, quando period === 'all',
// já que não há um início de janela fixo nesse caso).
function buildTrend(records: AdherenceRecord[], filters: AdherenceFilters, now: Date): AdherenceTrendPoint[] {
  if (records.length === 0) return [];

  const windowEnd = now.getTime();
  const windowStart =
    filters.period === 'all'
      ? Math.min(...records.map((r) => new Date(r.decided_at).getTime()))
      : windowEnd - PERIOD_DAYS[filters.period] * DAY_MS;

  const bucketCount = Math.max(1, Math.floor((windowEnd - windowStart) / WEEK_MS) + 1);
  const buckets: AdherenceRecord[][] = Array.from({ length: bucketCount }, () => []);

  for (const record of records) {
    const offset = new Date(record.decided_at).getTime() - windowStart;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(offset / WEEK_MS)));
    buckets[idx].push(record);
  }

  return buckets.map((subset, i) => ({
    week_start: toISODate(windowStart + i * WEEK_MS),
    adherence_percent: adherencePercentOf(subset),
    total: subset.length,
  }));
}

export function buildAdherenceOverview(
  records: AdherenceRecord[],
  filters: AdherenceFilters,
  now: Date = new Date(),
): AdherenceOverview {
  const filtered = records.filter((r) => matchesFilters(r, filters, now));
  return {
    overall_percent: adherencePercentOf(filtered),
    total_decisions: filtered.length,
    by_action: buildByAction(filtered),
    by_office: buildByOffice(filtered),
    by_confidence: buildByConfidence(filtered),
    divergence_reasons: buildDivergenceReasons(filtered),
    trend: buildTrend(filtered, filters, now),
  };
}
