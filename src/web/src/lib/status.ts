import type { CaseStatus } from '../types/case';

// O advogado vê status simplificados. Proposta aceita, Divergiu e Em negociação viram
// "Aguardando encerramento": todos significam que a decisão já foi tomada e falta só o
// desfecho. O dado bruto persistido continua granular — isto é só uma simplificação de exibição.
export type DisplayStatus = Exclude<CaseStatus, 'PROPOSTA_ACEITA' | 'DIVERGIU' | 'EM_NEGOCIACAO'>;

const MERGED_INTO_ENCERRAMENTO: ReadonlySet<CaseStatus> = new Set(['PROPOSTA_ACEITA', 'DIVERGIU', 'EM_NEGOCIACAO']);

export function toDisplayStatus(status: CaseStatus): DisplayStatus {
  if (MERGED_INTO_ENCERRAMENTO.has(status)) return 'AGUARDANDO_ENCERRAMENTO';
  return status as DisplayStatus;
}

export const DISPLAY_STATUS_ORDER: DisplayStatus[] = [
  'RASCUNHO',
  'EM_ANALISE',
  'AGUARDANDO_DECISAO',
  'AGUARDANDO_ENCERRAMENTO',
  'ENCERRADO',
];
