import type { CaseOutcome, CaseStatus, RecommendedAction, Thesis } from './case';
import type { DocumentType, SubsidyType } from './workspace';
import type { ConfidenceBand, DivergenceReason } from './adherence';

export const STATUS_LABEL: Record<CaseStatus, string> = {
  RASCUNHO: 'Rascunho',
  EM_ANALISE: 'Em análise',
  AGUARDANDO_DECISAO: 'Revisar recomendação',
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

export const OUTCOME_LABEL: Record<CaseOutcome, string> = {
  FAVORAVEL: 'Êxito',
  PARCIAL: 'Parcial',
  DESFAVORAVEL: 'Não êxito',
};

export const SUBSIDY_LABEL: Record<SubsidyType, string> = {
  contrato: 'Contrato',
  extrato: 'Extrato bancário',
  comprovante_credito: 'Comprovante de crédito',
  dossie: 'Dossiê',
  demonstrativo_divida: 'Demonstrativo de evolução da dívida',
  laudo_referenciado: 'Laudo referenciado',
};

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  autos: 'Auto do processo',
  ...SUBSIDY_LABEL,
};

// Unidades federativas do Brasil — usadas no seletor de UF do cadastro de processo.
export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const DIVERGENCE_REASON_LABEL: Record<DivergenceReason, string> = {
  DOCUMENTO_INVALIDO: 'Documento inválido',
  FATO_NOVO: 'Fato novo',
  ERRO_EXTRACAO: 'Erro de extração',
  VALOR_IRREAL: 'Valor irreal',
  OUTRO: 'Outro',
};

export const CONFIDENCE_BAND_LABEL: Record<ConfidenceBand, string> = {
  alta: 'Confiança alta',
  media: 'Confiança média',
  baixa: 'Confiança baixa',
};
