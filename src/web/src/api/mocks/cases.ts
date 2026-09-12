// DADOS SIMULADOS para desenvolvimento do front enquanto a API não existe.
// Valores e confianças são ilustrativos — não são resultados da engine.
// Todos os casos pertencem ao mesmo escritório/advogado logado (visão do advogado
// não mostra outros escritórios — isso é assunto do Dashboard do banco).
import type { CaseAlert, CaseListItem, CaseStatus, RecommendationSummary } from '../../types/case';

const DAY_MS = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString();

const MY_OFFICE = 'Silva & Associados';

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

type Row = [
  cnj: string,
  plaintiff: string,
  uf: string,
  thesis: 'GOLPE' | 'GENERICO',
  claim: number,
  status: CaseStatus,
  deadline: number | null,
  updated: number,
  rec: RecommendationSummary | null,
  alert?: CaseAlert,
];

const rows: Row[] = [
  // CNJs dos dois casos de exemplo em data/
  ['0801234-56.2024.8.10.0001', 'Maria de Fátima Souza', 'MA', 'GOLPE', 15000, 'AGUARDANDO_DECISAO', 3, -0.1, acordo(75, [4300, 5200], 5600, 6100)],
  ['0654321-09.2024.8.04.0001', 'João Carlos Pereira', 'AM', 'GOLPE', 22000, 'EM_ANALISE', 9, -0.02, null],
  ['0712345-11.2024.8.26.0100', 'Ana Beatriz Lima', 'SP', 'GENERICO', 8000, 'RASCUNHO', 14, -1, null],
  ['0723456-22.2024.8.13.0024', 'Carlos Eduardo Santos', 'MG', 'GOLPE', 31000, 'EM_NEGOCIACAO', 6, -2, acordo(68, [7800, 9400], 10200, 12900)],
  ['0734567-33.2024.8.05.0001', 'Francisca das Chagas Oliveira', 'BA', 'GENERICO', 12500, 'PROPOSTA_ACEITA', 2, -0.5, defesa(82, 3100)],
  ['0745678-44.2024.8.17.0001', 'Pedro Henrique Costa', 'PE', 'GOLPE', 18000, 'DIVERGIU', 11, -3, acordo(null, [5100, 6300], 7000, 7400)],
  [
    '0756789-55.2024.8.19.0001',
    'Raimunda Ferreira Alves',
    'RJ',
    'GOLPE',
    9500,
    'DOCUMENTOS_ENVIADOS',
    20,
    -0.3,
    null,
    { code: 'DOCUMENTO_ILEGIVEL', message: 'Extrato bancário com páginas ilegíveis — reenviar' },
  ],
  ['0767890-66.2024.8.10.0001', 'Antônio Marcos Ribeiro', 'MA', 'GENERICO', 6700, 'AGUARDANDO_ENCERRAMENTO', 1, -6, defesa(71, 2400)],
  ['0778901-77.2024.8.04.0001', 'Luzia Aparecida Rocha', 'AM', 'GOLPE', 27000, 'AGUARDANDO_DECISAO', 5, -1.5, defesa(58, 8900)],
  ['0789012-88.2024.8.26.0100', 'José Roberto Almeida', 'SP', 'GOLPE', 14200, 'ENCERRADO', null, -12, acordo(79, [3900, 4700], 5100, 5800)],
  ['0790123-99.2024.8.13.0024', 'Sebastiana Gomes Dias', 'MG', 'GENERICO', 11000, 'AGUARDANDO_DECISAO', 8, -0.8, acordo(64, [2900, 3600], 4000, 4500)],
  ['0701234-10.2024.8.05.0001', 'Francisco das Neves Barbosa', 'BA', 'GOLPE', 19800, 'ENCERRADO', null, -20, defesa(88, 6200)],
];

export const mockCases: CaseListItem[] = rows.map(([cnj, plaintiff, uf, thesis, claim, status, deadline, updated, rec, alert], i) => ({
  id: `mock-${i + 1}`,
  cnj,
  plaintiff_name: plaintiff,
  uf,
  thesis,
  claim_value: claim,
  status,
  office: MY_OFFICE,
  deadline_at: deadline === null ? null : inDays(deadline),
  updated_at: inDays(updated),
  recommendation: rec,
  alert: alert ?? null,
}));
