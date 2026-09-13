import type { CaseListItem } from '../types/case';

const DAY_MS = 86_400_000;
const NEW_CASE_WINDOW_DAYS = 30;

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
