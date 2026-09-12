import { daysUntil } from './format';
import { toDisplayStatus } from './status';
import type { CaseListItem } from '../types/case';

export type PendencyKind = 'ALERTA' | 'DECISAO' | 'PRAZO' | 'DESFECHO';

export interface PendencyItem {
  key: string;
  kind: PendencyKind;
  item: CaseListItem;
  badge: string;
}

// Ordem em que os tipos de pendência competem por atenção quando um caso se
// encaixa em mais de um (ex.: prazo curto E decisão pendente) — mostramos só o mais urgente.
const KIND_PRIORITY: PendencyKind[] = ['ALERTA', 'PRAZO', 'DECISAO', 'DESFECHO'];

function classify(c: CaseListItem): { kind: PendencyKind; badge: string } | null {
  if (c.alert !== null) return { kind: 'ALERTA', badge: 'Falha na leitura' };
  if (c.deadline_at !== null && daysUntil(c.deadline_at) <= 5) {
    const d = daysUntil(c.deadline_at);
    return { kind: 'PRAZO', badge: d <= 0 ? 'vence hoje' : `vence em ${d}d` };
  }
  if (c.status === 'AGUARDANDO_DECISAO') {
    const conf = c.recommendation?.confidence_percent;
    return { kind: 'DECISAO', badge: conf === null || conf === undefined ? 'revisar' : `${Math.round(conf)}% de confiança` };
  }
  if (toDisplayStatus(c.status) === 'AGUARDANDO_ENCERRAMENTO') return { kind: 'DESFECHO', badge: 'registrar desfecho' };
  return null;
}

export function buildPendencyFeed(cases: CaseListItem[] | undefined, limit = 6): PendencyItem[] {
  if (!cases) return [];
  const open = cases.filter((c) => c.status !== 'ENCERRADO');
  const items: PendencyItem[] = [];
  for (const c of open) {
    const classified = classify(c);
    if (classified) items.push({ key: `${c.id}-${classified.kind}`, kind: classified.kind, item: c, badge: classified.badge });
  }
  return items
    .sort((a, b) => {
      const rank = KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind);
      if (rank !== 0) return rank;
      if (a.item.deadline_at === b.item.deadline_at) return 0;
      if (a.item.deadline_at === null) return 1;
      if (b.item.deadline_at === null) return -1;
      return a.item.deadline_at.localeCompare(b.item.deadline_at);
    })
    .slice(0, limit);
}
