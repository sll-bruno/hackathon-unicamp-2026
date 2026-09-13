import type { CaseStatus } from '../types/case';

// O advogado vê 5 status, não os 9 da máquina de estados (docs/ARCHITECTURE.md §4).
// Proposta aceita, Divergiu e Em negociação viram "Aguardando encerramento": todos
// significam que a decisão já foi tomada e falta só o desfecho. Documentos enviados
// vira "Rascunho": para o advogado, ambos significam "ainda não foi para análise".
// O dado bruto persistido continua granular — isto é só uma simplificação de exibição.
export type DisplayStatus = Exclude<
  CaseStatus,
  'DOCUMENTOS_ENVIADOS' | 'PROPOSTA_ACEITA' | 'DIVERGIU' | 'EM_NEGOCIACAO'
>;

const MERGED_INTO_ENCERRAMENTO: ReadonlySet<CaseStatus> = new Set(['PROPOSTA_ACEITA', 'DIVERGIU', 'EM_NEGOCIACAO']);
const MERGED_INTO_RASCUNHO: ReadonlySet<CaseStatus> = new Set(['DOCUMENTOS_ENVIADOS']);

export function toDisplayStatus(status: CaseStatus): DisplayStatus {
  if (MERGED_INTO_ENCERRAMENTO.has(status)) return 'AGUARDANDO_ENCERRAMENTO';
  if (MERGED_INTO_RASCUNHO.has(status)) return 'RASCUNHO';
  return status as DisplayStatus;
}

export const DISPLAY_STATUS_ORDER: DisplayStatus[] = [
  'RASCUNHO',
  'EM_ANALISE',
  'AGUARDANDO_DECISAO',
  'AGUARDANDO_ENCERRAMENTO',
  'ENCERRADO',
];
