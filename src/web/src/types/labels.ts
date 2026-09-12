import type { CaseStatus, RecommendedAction, Thesis } from './case';

export const STATUS_LABEL: Record<CaseStatus, string> = {
  RASCUNHO: 'Rascunho',
  DOCUMENTOS_ENVIADOS: 'Documentos enviados',
  EM_ANALISE: 'Em análise',
  AGUARDANDO_DECISAO: 'Aguardando decisão',
  PROPOSTA_ACEITA: 'Proposta aceita',
  DIVERGIU: 'Divergiu',
  EM_NEGOCIACAO: 'Em negociação',
  AGUARDANDO_ENCERRAMENTO: 'Aguardando encerramento',
  ENCERRADO: 'Encerrado',
};

export const THESIS_LABEL: Record<Thesis, string> = {
  GOLPE: 'Golpe',
  GENERICO: 'Genérico',
};

export const ACTION_LABEL: Record<RecommendedAction, string> = {
  ACORDO: 'Acordo',
  DEFESA: 'Defesa',
};
