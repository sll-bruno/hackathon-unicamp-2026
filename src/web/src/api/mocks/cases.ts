// DADOS SIMULADOS para desenvolvimento do front enquanto a API não existe.
// Valores e confianças são ilustrativos — não são resultados da engine.
import type { CaseListItem, CaseStatus, RecommendationSummary } from '../../types/case';

const DAY_MS = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString();

const acordo = (confidence: number | null, range: [number, number], ceiling: number, defense: number): RecommendationSummary => ({
  action: 'ACORDO',
  confidence_percent: confidence,
  suggested_range: range,
  economic_ceiling: ceiling,
  defense_cost_central: defense,
  policy_version: 'v1',
});

const defesa = (confidence: number | null, defense: number): RecommendationSummary => ({
  action: 'DEFESA',
  confidence_percent: confidence,
  suggested_range: null,
  economic_ceiling: null,
  defense_cost_central: defense,
  policy_version: 'v1',
});

type Row = [cnj: string, uf: string, thesis: 'GOLPE' | 'GENERICO', claim: number, status: CaseStatus, office: string, deadline: number | null, updated: number, rec: RecommendationSummary | null];

const rows: Row[] = [
  // CNJs dos dois casos de exemplo em data/
  ['0801234-56.2024.8.10.0001', 'MA', 'GOLPE', 15000, 'AGUARDANDO_DECISAO', 'Silva & Associados', 3, -0.1, acordo(75, [4300, 5200], 5600, 6100)],
  ['0654321-09.2024.8.04.0001', 'AM', 'GOLPE', 22000, 'EM_ANALISE', 'Moura Advocacia', 9, -0.02, null],
  ['0712345-11.2024.8.26.0100', 'SP', 'GENERICO', 8000, 'RASCUNHO', 'Silva & Associados', 14, -1, null],
  ['0723456-22.2024.8.13.0024', 'MG', 'GOLPE', 31000, 'EM_NEGOCIACAO', 'Pereira Lima', 6, -2, acordo(68, [7800, 9400], 10200, 12900)],
  ['0734567-33.2024.8.05.0001', 'BA', 'GENERICO', 12500, 'PROPOSTA_ACEITA', 'Moura Advocacia', 2, -0.5, defesa(82, 3100)],
  ['0745678-44.2024.8.17.0001', 'PE', 'GOLPE', 18000, 'DIVERGIU', 'Pereira Lima', 11, -3, acordo(null, [5100, 6300], 7000, 7400)],
  ['0756789-55.2024.8.19.0001', 'RJ', 'GOLPE', 9500, 'DOCUMENTOS_ENVIADOS', 'Silva & Associados', 20, -0.3, null],
  ['0767890-66.2024.8.10.0001', 'MA', 'GENERICO', 6700, 'AGUARDANDO_ENCERRAMENTO', 'Moura Advocacia', 1, -6, defesa(71, 2400)],
  ['0778901-77.2024.8.04.0001', 'AM', 'GOLPE', 27000, 'AGUARDANDO_DECISAO', 'Pereira Lima', 5, -1.5, defesa(58, 8900)],
  ['0789012-88.2024.8.26.0100', 'SP', 'GOLPE', 14200, 'ENCERRADO', 'Silva & Associados', null, -12, acordo(79, [3900, 4700], 5100, 5800)],
  ['0790123-99.2024.8.13.0024', 'MG', 'GENERICO', 11000, 'AGUARDANDO_DECISAO', 'Moura Advocacia', 8, -0.8, acordo(64, [2900, 3600], 4000, 4500)],
  ['0701234-10.2024.8.05.0001', 'BA', 'GOLPE', 19800, 'ENCERRADO', 'Pereira Lima', null, -20, defesa(88, 6200)],
];

export const mockCases: CaseListItem[] = rows.map(([cnj, uf, thesis, claim, status, office, deadline, updated, rec], i) => ({
  id: `mock-${i + 1}`,
  cnj,
  uf,
  thesis,
  claim_value: claim,
  status,
  office,
  deadline_at: deadline === null ? null : inDays(deadline),
  updated_at: inDays(updated),
  recommendation: rec,
}));
