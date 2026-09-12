import type { CaseListItem } from '../types/case';
import { daysUntil } from './format';

export type UrgencyKey = 'HOJE' | 'SEMANA' | 'SEM_URGENCIA' | 'ENCERRADOS';

const LABEL: Record<UrgencyKey, string> = {
  HOJE: 'Precisa de ação hoje',
  SEMANA: 'Esta semana',
  SEM_URGENCIA: 'Sem urgência',
  ENCERRADOS: 'Encerrados',
};

// Grupos recolhidos por padrão — reduz o volume visto de uma vez, sem esconder dados.
export const DEFAULT_EXPANDED: Record<UrgencyKey, boolean> = {
  HOJE: true,
  SEMANA: true,
  SEM_URGENCIA: false,
  ENCERRADOS: false,
};

export interface UrgencyGroup {
  key: UrgencyKey;
  label: string;
  items: CaseListItem[];
}

function bucket(c: CaseListItem): UrgencyKey {
  if (c.status === 'ENCERRADO') return 'ENCERRADOS';
  if (c.deadline_at === null) return 'SEM_URGENCIA';
  const days = daysUntil(c.deadline_at);
  if (days <= 1) return 'HOJE'; // vencido, hoje ou amanhã
  if (days <= 7) return 'SEMANA';
  return 'SEM_URGENCIA';
}

const ORDER: UrgencyKey[] = ['HOJE', 'SEMANA', 'SEM_URGENCIA', 'ENCERRADOS'];

// Espera receber `cases` já ordenado (ex.: por prazo) — a ordem dentro de cada grupo é preservada.
export function groupByUrgency(cases: CaseListItem[]): UrgencyGroup[] {
  const buckets: Record<UrgencyKey, CaseListItem[]> = { HOJE: [], SEMANA: [], SEM_URGENCIA: [], ENCERRADOS: [] };
  for (const c of cases) buckets[bucket(c)].push(c);
  return ORDER.filter((key) => buckets[key].length > 0).map((key) => ({ key, label: LABEL[key], items: buckets[key] }));
}
