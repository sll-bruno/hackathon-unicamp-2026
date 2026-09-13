// DADOS SIMULADOS. A planilha histórica não é carregada no bundle e ainda não
// existe um endpoint de processos históricos. Os dois registros com
// operational_case_id correspondem a casos encerrados do mock operacional.
import type { HistoricalCase, HistoricalMacroResult, HistoricalOutcome } from '../../types/history';

type Row = [
  cnj: string,
  plaintiff: string | null,
  uf: string,
  subject: string,
  subtopic: string,
  macro: HistoricalMacroResult,
  outcome: HistoricalOutcome,
  claimValue: number,
  awardValue: number,
  closedAt: string | null,
  operationalCaseId?: string,
  recommendation?: HistoricalCase['recommendation'],
];

const rows: Row[] = [
  ['0789012-88.2024.8.26.0100', 'José Roberto Almeida', 'SP', 'Não reconhece operação', 'Golpe', 'EXITO', 'IMPROCEDENCIA', 14200, 0, '2026-09-01', 'mock-10', { action: 'ACORDO', confidence_percent: 79 }],
  ['0701234-10.2024.8.05.0001', 'Francisco das Neves Barbosa', 'BA', 'Não reconhece operação', 'Golpe', 'NAO_EXITO', 'PARCIAL', 19800, 7810.45, '2026-08-24', 'mock-12', { action: 'DEFESA', confidence_percent: 88 }],
  ['1764352-89.2025.8.06.1818', null, 'CE', 'Não reconhece operação', 'Genérico', 'NAO_EXITO', 'PARCIAL', 13534, 7714.38, '2026-08-18'],
  ['5488325-36.2025.8.17.4124', 'Maria Aparecida Nunes', 'PE', 'Não reconhece operação', 'Golpe', 'NAO_EXITO', 'PARCIAL', 7883.63, 3784.14, '2026-08-11'],
  ['1637471-89.2025.8.18.1658', null, 'PI', 'Empréstimo consignado', 'Golpe', 'NAO_EXITO', 'PARCIAL', 8561.97, 6507.1, '2026-08-04'],
  ['9547931-23.2025.8.04.4188', 'Edna Ferreira Lima', 'AM', 'Não reconhece operação', 'Golpe', 'EXITO', 'IMPROCEDENCIA', 5693.13, 0, '2026-07-28'],
  ['9999646-69.2025.8.04.4264', null, 'AM', 'Empréstimo consignado', 'Golpe', 'EXITO', 'IMPROCEDENCIA', 8515.67, 0, '2026-07-21'],
  ['2412149-28.2025.8.24.1145', 'Paulo Sérgio Costa', 'SC', 'Não reconhece operação', 'Genérico', 'NAO_EXITO', 'PARCIAL', 16961.06, 12720.8, '2026-07-15'],
  ['8874499-95.2025.8.07.3223', null, 'DF', 'Cartão consignado', 'Golpe', 'NAO_EXITO', 'PROCEDENCIA', 11180, 11180, '2026-07-07'],
  ['1917140-43.2025.8.07.3368', 'Joana Célia Martins', 'DF', 'Não reconhece operação', 'Golpe', 'EXITO', 'EXTINCAO', 20080.4, 0, '2026-06-29'],
  ['6604556-08.2025.8.05.2439', null, 'BA', 'Empréstimo consignado', 'Golpe', 'NAO_EXITO', 'PARCIAL', 16021.5, 9773.12, '2026-06-20'],
  ['1921027-43.2025.8.15.3964', 'Rita de Cássia Freitas', 'PB', 'Não reconhece operação', 'Golpe', 'EXITO', 'EXTINCAO', 16520.52, 0, '2026-06-12'],
  ['6144081-15.2025.8.25.2962', null, 'SE', 'Não reconhece operação', 'Golpe', 'EXITO', 'IMPROCEDENCIA', 22470.81, 0, '2026-06-03'],
  ['4246001-27.2025.8.10.6476', 'Antônia Pereira Alves', 'MA', 'Cartão consignado', 'Golpe', 'EXITO', 'IMPROCEDENCIA', 8658.46, 0, '2026-05-26'],
  ['4008328-43.2025.8.03.5952', null, 'AP', 'Não reconhece operação', 'Genérico', 'NAO_EXITO', 'PROCEDENCIA', 18986.78, 17089.9, '2026-05-18'],
  ['3958810-64.2025.8.11.6659', 'Célio Rodrigues Souza', 'MT', 'Empréstimo consignado', 'Genérico', 'EXITO', 'IMPROCEDENCIA', 25650.47, 0, '2026-05-09'],
  ['2831047-72.2025.8.21.0033', null, 'RS', 'Não reconhece operação', 'Golpe', 'NAO_EXITO', 'ACORDO', 12800, 6400, '2026-04-30'],
  ['1098345-19.2025.8.19.0001', 'Lúcia Helena Barros', 'RJ', 'Cartão consignado', 'Genérico', 'EXITO', 'EXTINCAO', 9300, 0, null],
];

export const mockHistoricalCases: HistoricalCase[] = rows.map(
  ([cnj, plaintiff_name, uf, subject, subtopic, macro_result, outcome, claim_value, award_value, closed_at, operational_case_id, recommendation], index) => ({
    id: `historical-${index + 1}`,
    operational_case_id: operational_case_id ?? null,
    cnj,
    plaintiff_name,
    uf,
    subject,
    subtopic,
    macro_result,
    outcome,
    claim_value,
    award_value,
    recommendation: recommendation ?? null,
    closed_at,
  }),
);
