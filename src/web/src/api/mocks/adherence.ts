// DADOS SIMULADOS do dashboard de aderência do banco — cobre vários escritórios,
// diferente de api/mocks/cases.ts (que é só o escritório do advogado logado).
import type { AdherenceRecord } from '../../lib/adherence';
import type { Office } from '../../types/office';

export const mockOffices: Office[] = [
  { id: 'office-1', name: 'Silva & Associados' },
  { id: 'office-2', name: 'Ferreira Advocacia' },
  { id: 'office-3', name: 'Costa & Martins' },
  { id: 'office-4', name: 'Almeida Barros' },
];

export const POLICY_VERSIONS = ['v1.0', 'v0.9'];

const DAY_MS = 86_400_000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS).toISOString();
const officeName = (id: string) => mockOffices.find((o) => o.id === id)!.name;

type Row = [
  action: 'ACORDO' | 'DEFESA',
  accepted: boolean,
  divergenceReason: AdherenceRecord['divergence_reason'],
  confidence: number | null,
  officeId: string,
  thesis: 'GOLPE' | 'GENERICO',
  policyVersion: string,
  decidedDaysAgo: number,
];

const rows: Row[] = [
  ['ACORDO', true, null, 88, 'office-1', 'GOLPE', 'v1.0', 3],
  ['ACORDO', false, 'VALOR_IRREAL', 91, 'office-1', 'GOLPE', 'v1.0', 6],
  ['DEFESA', true, null, 74, 'office-1', 'GENERICO', 'v1.0', 12],
  ['ACORDO', true, null, 65, 'office-2', 'GOLPE', 'v1.0', 4],
  ['DEFESA', false, 'FATO_NOVO', 55, 'office-2', 'GOLPE', 'v1.0', 20],
  ['DEFESA', false, 'DOCUMENTO_INVALIDO', 82, 'office-2', 'GENERICO', 'v0.9', 45],
  ['ACORDO', true, null, 70, 'office-3', 'GOLPE', 'v1.0', 8],
  ['ACORDO', true, null, null, 'office-3', 'GENERICO', 'v1.0', 15],
  ['DEFESA', false, 'ERRO_EXTRACAO', 45, 'office-3', 'GOLPE', 'v0.9', 33],
  ['ACORDO', true, null, 92, 'office-4', 'GOLPE', 'v1.0', 2],
  ['ACORDO', false, 'OUTRO', 60, 'office-4', 'GOLPE', 'v1.0', 18],
  ['DEFESA', true, null, 77, 'office-4', 'GENERICO', 'v1.0', 25],
];

export const mockAdherenceRecords: AdherenceRecord[] = rows.map(
  ([action, accepted, divergence_reason, confidence_percent, office_id, thesis, policy_version, decidedDaysAgo]) => ({
    action,
    accepted,
    divergence_reason,
    confidence_percent,
    office_id,
    office_name: officeName(office_id),
    thesis,
    policy_version,
    decided_at: daysAgo(decidedDaysAgo),
  }),
);
