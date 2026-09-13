import type { CaseStatus, DocumentType, FactRelation } from '../../types/workspace';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const formatBRL = (value: number) => brl.format(value);

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const documentTypeLabel: Record<DocumentType, string> = {
  autos: 'Autos',
  contrato: 'Contrato',
  extrato: 'Extrato',
  comprovante_credito: 'Comprovante de crédito',
  dossie: 'Dossiê',
  demonstrativo_divida: 'Demonstrativo da dívida',
  laudo_referenciado: 'Laudo referenciado',
};

export const statusLabel: Record<CaseStatus, string> = {
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

export const factTypeLabel: Record<string, string> = {
  contracting_statement: 'Contratação',
  credit_transfer: 'Liberação do crédito',
  installment_payments: 'Parcelas e descontos',
  debt_balance: 'Saldo da dívida',
  material_damage_claim: 'Dano material',
  moral_damage_claim: 'Dano moral',
  contract_cancellation_claim: 'Cancelamento contratual',
};

export const relationLabel: Record<FactRelation, string> = {
  supports: 'Favorece a parte autora',
  refutes: 'Favorece o banco',
  neutral: 'Neutro',
};

export const reasonCodeLabel: Record<string, string> = {
  BAIXA_CONFIANCA: 'Baixa confiança',
  EVIDENCIA_CONTRADITORIA: 'Evidência contraditória',
  INTERVALOS_SOBREPOSTOS: 'Intervalos financeiros sobrepostos',
  INCONCLUSIVO_ECONOMICO: 'Diferença econômica pequena',
  DADOS_INSUFICIENTES: 'Dados insuficientes',
  FORA_DA_ALCADA: 'Fora da alçada',
  ARQUIVO_ILEGIVEL: 'Arquivo ilegível',
};
