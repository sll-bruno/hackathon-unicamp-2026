// DADOS SIMULADOS para desenvolvimento do front enquanto a API não existe.
// Valores e confianças são ilustrativos — não são resultados da engine.
// A tela "Meus processos" só mostra os casos do escritório logado (MY_OFFICE);
// o Dashboard do banco enxerga todos os escritórios — por isso os casos
// encerrados abaixo têm `office` variado (comparativo entre escritórios).
import type { CaseAlert, CaseListItem, CaseOutcome, CaseStatus, RecommendationSummary } from '../../types/case';

const DAY_MS = 86_400_000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS).toISOString();

export const MY_OFFICE = 'Silva & Associados';

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
  createdDaysAgo: number,
  updatedDaysAgo: number,
  rec: RecommendationSummary | null,
  followedRecommendation: boolean | null,
  outcome?: CaseOutcome,
  // Valor efetivamente pago quando o caso foi encerrado (case_outcomes.final_value).
  finalValue?: number,
  office?: string,
  alert?: CaseAlert,
];

const rows: Row[] = [
  // CNJs dos dois casos de exemplo em data/
  ['0801234-56.2024.8.10.0001', 'Maria de Fátima Souza', 'MA', 'GOLPE', 15000, 'AGUARDANDO_DECISAO', 12, 0, acordo(75, [4300, 5200], 5600, 6100), null],
  ['0654321-09.2024.8.04.0001', 'João Carlos Pereira', 'AM', 'GOLPE', 22000, 'EM_ANALISE', 40, 0, null, null],
  ['0712345-11.2024.8.26.0100', 'Ana Beatriz Lima', 'SP', 'GENERICO', 8000, 'RASCUNHO', 4, 1, null, null],
  ['0723456-22.2024.8.13.0024', 'Carlos Eduardo Santos', 'MG', 'GOLPE', 31000, 'EM_NEGOCIACAO', 45, 2, acordo(68, [7800, 9400], 10200, 12900), true],
  ['0734567-33.2024.8.05.0001', 'Francisca das Chagas Oliveira', 'BA', 'GENERICO', 12500, 'PROPOSTA_ACEITA', 35, 0.5, defesa(82, 3100), true],
  ['0745678-44.2024.8.17.0001', 'Pedro Henrique Costa', 'PE', 'GOLPE', 18000, 'DIVERGIU', 60, 3, acordo(null, [5100, 6300], 7000, 7400), false],
  [
    '0756789-55.2024.8.19.0001',
    'Raimunda Ferreira Alves',
    'RJ',
    'GOLPE',
    9500,
    'RASCUNHO',
    9,
    0.3,
    null,
    null,
    undefined,
    undefined,
    undefined,
    { code: 'DOCUMENTO_ILEGIVEL', message: 'Extrato bancário com páginas ilegíveis — reenviar' },
  ],
  ['0767890-66.2024.8.10.0001', 'Antônio Marcos Ribeiro', 'MA', 'GENERICO', 6700, 'AGUARDANDO_ENCERRAMENTO', 70, 6, defesa(71, 2400), true],
  ['0778901-77.2024.8.04.0001', 'Luzia Aparecida Rocha', 'AM', 'GOLPE', 27000, 'AGUARDANDO_DECISAO', 22, 1.5, defesa(58, 8900), null],
  ['0789012-88.2024.8.26.0100', 'José Roberto Almeida', 'SP', 'GOLPE', 14200, 'ENCERRADO', 120, 12, acordo(79, [3900, 4700], 5100, 5800), true, 'IMPROCEDENCIA', 4650, MY_OFFICE],
  ['0790123-99.2024.8.13.0024', 'Sebastiana Gomes Dias', 'MG', 'GENERICO', 11000, 'AGUARDANDO_DECISAO', 28, 0.8, acordo(64, [2900, 3600], 4000, 4500), null],
  ['0701234-10.2024.8.05.0001', 'Francisco das Neves Barbosa', 'BA', 'GOLPE', 19800, 'ENCERRADO', 150, 20, defesa(88, 6200), true, 'PARCIAL', 12400, MY_OFFICE],

  // Casos encerrados adicionais — volume e variedade (meses, UFs, desfechos e
  // escritórios distintos) para alimentar o Dashboard do banco.
  ['0812345-21.2024.8.26.0100', 'Marcos Vinícius Teixeira', 'SP', 'GOLPE', 24000, 'ENCERRADO', 200, 175, acordo(81, [6200, 7500], 8100, 9200), true, 'IMPROCEDENCIA', 6900, 'Barros & Nunes Advogados'],
  ['0823456-32.2024.8.13.0024', 'Patrícia Helena Nogueira', 'MG', 'GOLPE', 17500, 'ENCERRADO', 190, 160, acordo(73, [4800, 5700], 6200, 7100), true, 'EXTINCAO', 5300, 'Barros & Nunes Advogados'],
  ['0834567-43.2024.8.10.0001', 'Eduardo Luiz Machado', 'MA', 'GENERICO', 9800, 'ENCERRADO', 180, 150, defesa(69, 3400), true, 'PROCEDENCIA', 9800, 'Campos Torres Advocacia'],
  ['0845678-54.2024.8.04.0001', 'Vanessa Cristina Farias', 'AM', 'GOLPE', 28500, 'ENCERRADO', 170, 130, acordo(85, [7900, 9300], 10100, 11800), true, 'IMPROCEDENCIA', 8600, 'Barros & Nunes Advogados'],
  ['0856789-65.2024.8.19.0001', 'Rodrigo Alves Bittencourt', 'RJ', 'GENERICO', 13200, 'ENCERRADO', 160, 110, defesa(77, 4600), true, 'PARCIAL', 8100, 'Ferreira Mendes & Cia'],
  ['0867890-76.2024.8.17.0001', 'Camila dos Santos Vieira', 'PE', 'GOLPE', 21000, 'ENCERRADO', 150, 95, acordo(66, [5600, 6800], 7400, 8600), false, 'PROCEDENCIA', 21000, 'Campos Torres Advocacia'],
  ['0878901-87.2024.8.26.0100', 'Fábio Henrique Cardoso', 'SP', 'GOLPE', 16800, 'ENCERRADO', 140, 80, acordo(88, [4500, 5400], 5900, 6700), true, 'EXTINCAO', 5050, MY_OFFICE],
  ['0889012-98.2024.8.05.0001', 'Juliana Aparecida Moreira', 'BA', 'GENERICO', 10500, 'ENCERRADO', 130, 60, defesa(72, 3800), true, 'PROCEDENCIA', 10500, 'Campos Torres Advocacia'],
  ['0890123-09.2024.8.13.0024', 'Bruno César Andrade', 'MG', 'GOLPE', 32000, 'ENCERRADO', 120, 45, acordo(79, [8600, 10200], 11000, 12800), true, 'IMPROCEDENCIA', 9700, 'Ferreira Mendes & Cia'],
  ['0901234-10.2024.8.10.0001', 'Larissa Fernandes Cunha', 'MA', 'GOLPE', 19200, 'ENCERRADO', 110, 30, acordo(70, [5300, 6400], 6900, 8000), true, 'PARCIAL', 12100, MY_OFFICE],
  ['0912345-21.2024.8.04.0001', 'Thiago Ribeiro Cavalcante', 'AM', 'GENERICO', 8700, 'ENCERRADO', 100, 20, defesa(84, 2900), true, 'EXTINCAO', 2650, 'Ferreira Mendes & Cia'],
  ['0923456-32.2024.8.19.0001', 'Renata Souza Pimentel', 'RJ', 'GOLPE', 26500, 'ENCERRADO', 95, 15, acordo(60, [7100, 8500], 9300, 10600), false, 'PROCEDENCIA', 26500, 'Campos Torres Advocacia'],
];

export const mockCases: CaseListItem[] = rows.map(
  ([cnj, plaintiff, uf, thesis, claim, status, createdDaysAgo, updatedDaysAgo, rec, followedRecommendation, outcome, finalValue, office, alert], i) => ({
    id: `mock-${i + 1}`,
    cnj,
    plaintiff_name: plaintiff,
    uf,
    thesis,
    claim_value: claim,
    status,
    office: office ?? MY_OFFICE,
    created_at: daysAgo(createdDaysAgo),
    updated_at: daysAgo(updatedDaysAgo),
    recommendation: rec,
    followed_recommendation: followedRecommendation,
    outcome: outcome ?? null,
    final_value: finalValue ?? null,
    alert: alert ?? null,
  }),
);
