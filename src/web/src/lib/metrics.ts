import type { CaseListItem, CaseOutcome, RecommendedAction } from '../types/case';

const DAY_MS = 86_400_000;
const NEW_CASE_WINDOW_DAYS = 30;

const closedCases = (cases: CaseListItem[]) => cases.filter((c) => c.status === 'ENCERRADO' && c.outcome !== null);
const isSuccessfulOutcome = (outcome: CaseOutcome | null) => outcome === 'IMPROCEDENCIA' || outcome === 'EXTINCAO';

// Casos encerrados, que acataram a recomendação e têm valor pago conhecido —
// o universo elegível para todas as métricas de economia real.
const savingsEligible = (cases: CaseListItem[]) =>
  cases.filter((c) => c.status === 'ENCERRADO' && c.followed_recommendation === true && c.final_value !== null);

// % de casos encerrados com improcedência ou extinção ("êxito"). null sem casos encerrados.
export function successRate(cases: CaseListItem[]): number | null {
  const closed = closedCases(cases);
  if (closed.length === 0) return null;
  return (closed.filter((c) => isSuccessfulOutcome(c.outcome)).length / closed.length) * 100;
}

// % de casos encerrados com procedência ("sem êxito"). null sem casos encerrados.
export function failureRate(cases: CaseListItem[]): number | null {
  const closed = closedCases(cases);
  if (closed.length === 0) return null;
  return (closed.filter((c) => c.outcome === 'PROCEDENCIA').length / closed.length) * 100;
}

// Contagem de casos encerrados por desfecho, na ordem êxito → parcial → sem êxito.
export function outcomeDistribution(cases: CaseListItem[]): { outcome: CaseOutcome; count: number }[] {
  const closed = closedCases(cases);
  const order: CaseOutcome[] = ['IMPROCEDENCIA', 'EXTINCAO', 'ACORDO', 'PARCIAL', 'PROCEDENCIA'];
  return order.map((outcome) => ({ outcome, count: closed.filter((c) => c.outcome === outcome).length }));
}

// Economia real = valor da causa − valor efetivamente pago, somada apenas nos
// casos em que o advogado acatou a recomendação (followed_recommendation) e o
// caso já foi encerrado com valor pago conhecido.
export function totalSavings(cases: CaseListItem[]): number {
  return savingsEligible(cases).reduce((sum, c) => sum + (c.claim_value - (c.final_value as number)), 0);
}

// Série mensal (YYYY-MM) de economia real, para os mesmos casos de totalSavings.
export function savingsByMonth(cases: CaseListItem[]): { month: string; savings: number }[] {
  const eligible = savingsEligible(cases);
  const byMonth = new Map<string, number>();
  for (const c of eligible) {
    const month = c.updated_at.slice(0, 7);
    const savings = c.claim_value - (c.final_value as number);
    byMonth.set(month, (byMonth.get(month) ?? 0) + savings);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, savings]) => ({ month, savings }));
}

// Contagem de decisões que seguiram vs. divergiram da recomendação.
export function adherenceBreakdown(cases: CaseListItem[]): { followed: number; diverged: number } {
  const decided = cases.filter((c) => c.followed_recommendation !== null);
  return {
    followed: decided.filter((c) => c.followed_recommendation === true).length,
    diverged: decided.filter((c) => c.followed_recommendation === false).length,
  };
}

// Casos encerrados agrupados por UF, ordenados do maior para o menor volume.
export function closedCasesByUF(cases: CaseListItem[]): { uf: string; count: number }[] {
  const closed = closedCases(cases);
  const byUf = new Map<string, number>();
  for (const c of closed) byUf.set(c.uf, (byUf.get(c.uf) ?? 0) + 1);
  return [...byUf.entries()].sort((a, b) => b[1] - a[1]).map(([uf, count]) => ({ uf, count }));
}

// Soma do valor da causa dos processos ainda não encerrados.
export function sumOpenValue(cases: CaseListItem[]): number {
  return cases.filter((c) => c.status !== 'ENCERRADO').reduce((sum, c) => sum + c.claim_value, 0);
}

// Quantos processos foram cadastrados nos últimos 30 dias, de qualquer status.
export function countNewThisMonth(cases: CaseListItem[], now = new Date()): number {
  const cutoff = now.getTime() - NEW_CASE_WINDOW_DAYS * DAY_MS;
  return cases.filter((c) => new Date(c.created_at).getTime() >= cutoff).length;
}

// docs/ARCHITECTURE.md §7: aderência = aceitos / (aceitos + divergiu), via
// followed_recommendation (espelha lawyer_decisions.accepted). null sem decisões.
export function adherencePercent(cases: CaseListItem[]): number | null {
  const decided = cases.filter((c) => c.followed_recommendation !== null);
  if (decided.length === 0) return null;
  const followed = decided.filter((c) => c.followed_recommendation === true).length;
  return (followed / decided.length) * 100;
}

// Inspirado em docs/ARCHITECTURE.md §8 (usa case_outcomes), mas é uma métrica
// própria para esta home: % de desfechos favoráveis entre os casos encerrados
// que seguiram a recomendação. null sem casos elegíveis.
export function effectivenessPercent(cases: CaseListItem[]): number | null {
  const followedAndClosed = cases.filter((c) => c.status === 'ENCERRADO' && c.followed_recommendation === true);
  if (followedAndClosed.length === 0) return null;
  const favorable = followedAndClosed.filter((c) =>
    c.outcome === 'IMPROCEDENCIA' || c.outcome === 'EXTINCAO',
  ).length;
  return (favorable / followedAndClosed.length) * 100;
}

// ── Métricas do Dashboard de Efetividade (visão do banco) ──

export interface PredictedVsRealized {
  caseId: string;
  plaintiff: string;
  predicted: number;
  realized: number;
}

// Custo previsto pela IA (defense_cost_central — o que se esperava desembolsar
// caso o processo fosse a julgamento) vs. valor efetivamente pago. Mede se a
// política está calibrada: pontos abaixo da diagonal pagaram menos que o previsto.
export function predictedVsRealized(cases: CaseListItem[]): PredictedVsRealized[] {
  return savingsEligible(cases)
    .filter((c) => c.recommendation !== null)
    .map((c) => ({
      caseId: c.id,
      plaintiff: c.plaintiff_name,
      predicted: (c.recommendation as NonNullable<CaseListItem['recommendation']>).defense_cost_central,
      realized: c.final_value as number,
    }));
}

export interface ConfidenceBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  successRate: number | null;
}

const CONFIDENCE_BUCKETS: [string, number, number][] = [
  ['< 50%', 0, 50],
  ['50–70%', 50, 70],
  ['70–85%', 70, 85],
  ['85–100%', 85, 101],
];

// Casos encerrados agrupados por faixa de confiança da recomendação, com a taxa
// de êxito real de cada faixa — mostra se "mais confiança" realmente significa
// "mais acerto" (calibração do modelo).
export function confidenceCalibration(cases: CaseListItem[]): ConfidenceBucket[] {
  const closed = closedCases(cases).filter((c) => c.recommendation?.confidence_percent != null);
  return CONFIDENCE_BUCKETS.map(([label, min, max]) => {
    const inBucket = closed.filter((c) => {
      const conf = c.recommendation?.confidence_percent as number;
      return conf >= min && conf < max;
    });
    return {
      label,
      min,
      max,
      count: inBucket.length,
      successRate: inBucket.length > 0 ? (inBucket.filter((c) => isSuccessfulOutcome(c.outcome)).length / inBucket.length) * 100 : null,
    };
  });
}

export interface OfficeStats {
  office: string;
  closedCount: number;
  successRate: number | null;
  totalSavings: number;
}

// Ranking de escritórios parceiros do banco por economia gerada e taxa de êxito.
export function officeRanking(cases: CaseListItem[]): OfficeStats[] {
  const offices = [...new Set(closedCases(cases).map((c) => c.office))];
  return offices
    .map((office) => {
      const closed = closedCases(cases).filter((c) => c.office === office);
      const savings = savingsEligible(cases)
        .filter((c) => c.office === office)
        .reduce((sum, c) => sum + (c.claim_value - (c.final_value as number)), 0);
      return {
        office,
        closedCount: closed.length,
        successRate: closed.length > 0 ? (closed.filter((c) => isSuccessfulOutcome(c.outcome)).length / closed.length) * 100 : null,
        totalSavings: savings,
      };
    })
    .sort((a, b) => b.totalSavings - a.totalSavings);
}

// Economia mensal acumulada (soma corrida de savingsByMonth) — evolução do
// valor total entregue ao banco desde o início.
export function cumulativeSavingsByMonth(cases: CaseListItem[]): { month: string; cumulative: number }[] {
  let running = 0;
  return savingsByMonth(cases).map(({ month, savings }) => {
    running += savings;
    return { month, cumulative: running };
  });
}

export interface ActionStats {
  action: RecommendedAction;
  closedCount: number;
  successRate: number | null;
  averageSavings: number | null;
}

// Compara as duas estratégias de recomendação (Acordo vs. Defesa) por taxa de
// êxito e economia média, entre os casos encerrados que acataram a proposta.
export function savingsByAction(cases: CaseListItem[]): ActionStats[] {
  const actions: RecommendedAction[] = ['ACORDO', 'DEFESA'];
  return actions.map((action) => {
    const closed = closedCases(cases).filter((c) => c.followed_recommendation === true && c.recommendation?.action === action);
    const eligible = savingsEligible(cases).filter((c) => c.recommendation?.action === action);
    const savings = eligible.reduce((sum, c) => sum + (c.claim_value - (c.final_value as number)), 0);
    return {
      action,
      closedCount: closed.length,
      successRate: closed.length > 0 ? (closed.filter((c) => isSuccessfulOutcome(c.outcome)).length / closed.length) * 100 : null,
      averageSavings: eligible.length > 0 ? savings / eligible.length : null,
    };
  });
}

// Economia potencial ainda não realizada: soma de (valor da causa − custo
// esperado de defesa) dos casos ainda abertos que seguem a recomendação
// (não divergiram). É o valor "em pipeline" que a política deve entregar.
export function pipelineValue(cases: CaseListItem[]): { count: number; value: number } {
  const open = cases.filter((c) => c.status !== 'ENCERRADO' && c.recommendation !== null && c.followed_recommendation !== false);
  const value = open.reduce((sum, c) => sum + Math.max(c.claim_value - (c.recommendation as NonNullable<CaseListItem['recommendation']>).defense_cost_central, 0), 0);
  return { count: open.length, value };
}

export interface TopCase {
  id: string;
  plaintiff: string;
  uf: string;
  office: string;
  claimValue: number;
  finalValue: number;
  savings: number;
}

// Os N casos encerrados com maior economia real (valor da causa − valor pago),
// entre os que acataram a proposta.
export function topCasesBySavings(cases: CaseListItem[], limit = 5): TopCase[] {
  return savingsEligible(cases)
    .map((c) => ({
      id: c.id,
      plaintiff: c.plaintiff_name,
      uf: c.uf,
      office: c.office,
      claimValue: c.claim_value,
      finalValue: c.final_value as number,
      savings: c.claim_value - (c.final_value as number),
    }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, limit);
}

export interface ThesisStats {
  thesis: 'GOLPE' | 'GENERICO';
  closedCount: number;
  totalSavings: number;
  averageSavings: number | null;
}

// Economia total e média por tese (Golpe vs. Genérico) — ajuda a priorizar
// quais tipos de causa valem mais o investimento em análise e negociação.
export function savingsByThesis(cases: CaseListItem[]): ThesisStats[] {
  const theses: ('GOLPE' | 'GENERICO')[] = ['GOLPE', 'GENERICO'];
  return theses.map((thesis) => {
    const eligible = savingsEligible(cases).filter((c) => c.thesis === thesis);
    const savings = eligible.reduce((sum, c) => sum + (c.claim_value - (c.final_value as number)), 0);
    return {
      thesis,
      closedCount: eligible.length,
      totalSavings: savings,
      averageSavings: eligible.length > 0 ? savings / eligible.length : null,
    };
  });
}
