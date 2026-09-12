import { daysUntil } from './format';
import { toDisplayStatus } from './status';
import type { CaseListItem } from '../types/case';

export type PendencyKind = 'ALERTA' | 'PRAZO' | 'DECISAO' | 'DESFECHO';

export interface Pendency {
  kind: PendencyKind;
  label: string;
}

// Ordem em que os tipos de pendência competem por atenção quando um caso se
// encaixa em mais de um (ex.: prazo curto E decisão pendente) — mostramos só a mais urgente.
const KIND_PRIORITY: PendencyKind[] = ['ALERTA', 'PRAZO', 'DECISAO', 'DESFECHO'];

export function classifyPendency(c: CaseListItem): Pendency | null {
  if (c.status === 'ENCERRADO') return null;
  if (c.alert !== null) return { kind: 'ALERTA', label: 'Erro de leitura' };
  if (c.deadline_at !== null && daysUntil(c.deadline_at) <= 5) {
    const d = daysUntil(c.deadline_at);
    return { kind: 'PRAZO', label: d <= 0 ? 'Vence hoje' : `Vence em ${d}d` };
  }
  if (c.status === 'AGUARDANDO_DECISAO') return { kind: 'DECISAO', label: 'Revisar recomendação' };
  if (toDisplayStatus(c.status) === 'AGUARDANDO_ENCERRAMENTO') return { kind: 'DESFECHO', label: 'Registrar desfecho' };
  return null;
}

// Casos sem pendência (rank mais alto) ficam no fim da fila ordenada por urgência.
export function pendencyRank(c: CaseListItem): number {
  const p = classifyPendency(c);
  return p ? KIND_PRIORITY.indexOf(p.kind) : KIND_PRIORITY.length;
}
