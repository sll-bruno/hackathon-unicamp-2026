import { useQuery } from '@tanstack/react-query';
import { adherencePercent, countNewThisMonth, effectivenessPercent, sumOpenValue } from '../lib/metrics';
import { toDisplayStatus } from '../lib/status';
import type { CaseListItem, CasesSummary } from '../types/case';
import { USE_MOCKS, apiGet, simulateLatency } from './client';
import { type DraftRecord, listDrafts } from './mocks/draftStore';
import { MY_OFFICE, mockCases } from './mocks/cases';

const draftToCaseListItem = (d: DraftRecord): CaseListItem => ({
  id: d.id,
  cnj: d.data.cnj,
  plaintiff_name: d.data.plaintiff_name,
  uf: d.data.uf,
  thesis: d.data.thesis,
  claim_value: d.data.claim_value,
  status: 'RASCUNHO',
  office: MY_OFFICE,
  created_at: d.created_at,
  updated_at: d.updated_at,
  recommendation: null,
  followed_recommendation: null,
  outcome: null,
  final_value: null,
  alert: null,
});

interface ApiCase {
  id: string;
  cnj: string;
  uf: string;
  assunto: string;
  subassunto: string;
  valor_causa: number;
  plaintiff_name: string | null;
  court: string | null;
  contract_number: string | null;
  status: CaseListItem['status'];
  created_at: string;
  updated_at: string;
  recommendation: null | {
    action: 'ACORDO' | 'DEFESA';
    confidence_percent: number | null;
    financial: {
      suggested_offer: number | null;
      expected_defense_cost: number;
    };
    versions: Record<string, string>;
  };
}

interface ApiPage<T> {
  items: T[];
  total: number;
}

interface ApiDashboard {
  adherence: { rate: number | null };
}

function apiCaseToListItem(item: ApiCase): CaseListItem {
  const suggested = item.recommendation?.financial.suggested_offer ?? null;
  return {
    id: item.id,
    cnj: item.cnj,
    plaintiff_name: item.plaintiff_name || 'Parte autora não informada',
    uf: item.uf,
    thesis: /golpe/i.test(item.subassunto) ? 'GOLPE' : 'GENERICO',
    claim_value: item.valor_causa,
    status: item.status,
    office: '',
    created_at: item.created_at,
    updated_at: item.updated_at,
    recommendation: item.recommendation
      ? {
          action: item.recommendation.action,
          confidence_percent: item.recommendation.confidence_percent,
          suggested_range: suggested === null ? null : [suggested, suggested],
          economic_ceiling: null,
          defense_cost_central: item.recommendation.financial.expected_defense_cost,
          policy_version:
            item.recommendation.versions.policy ??
            item.recommendation.versions.pipeline ??
            'não informada',
        }
      : null,
    followed_recommendation: null,
    outcome: null,
    final_value: null,
    alert: null,
  };
}

async function fetchRealCases(): Promise<CaseListItem[]> {
  const page = await apiGet<ApiPage<ApiCase>>('/cases?page_size=100');
  return page.items.map(apiCaseToListItem);
}

// Casos estáticos de exemplo + rascunhos criados em CaseNew (persistidos em localStorage).
function allCases(): CaseListItem[] {
  const drafts = listDrafts().map(draftToCaseListItem);
  return [...drafts, ...mockCases.filter((c) => !drafts.some((d) => d.id === c.id))];
}

const isOpen = (c: CaseListItem) => c.status !== 'ENCERRADO';

function summarize(cases: CaseListItem[]): CasesSummary {
  const open = cases.filter(isOpen);
  return {
    open: open.length,
    awaiting_decision: open.filter((c) => c.status === 'AGUARDANDO_DECISAO').length,
    pending_outcome: open.filter((c) => toDisplayStatus(c.status) === 'AGUARDANDO_ENCERRAMENTO').length,
    document_errors: open.filter((c) => c.alert !== null).length,
    in_analysis: open.filter((c) => c.status === 'EM_ANALISE').length,
    open_value_sum: sumOpenValue(cases),
    new_this_month: countNewThisMonth(cases),
    adherence_percent: adherencePercent(cases),
    effectiveness_percent: effectivenessPercent(cases),
  };
}

// GET /api/cases
export const useCases = () =>
  useQuery({
    queryKey: ['cases'],
    queryFn: () => (USE_MOCKS ? simulateLatency(allCases()) : fetchRealCases()),
  });

// GET /api/cases/summary
export const useCasesSummary = () =>
  useQuery({
    queryKey: ['cases', 'summary'],
    queryFn: async () => {
      if (USE_MOCKS) return simulateLatency(summarize(allCases()));
      const [cases, dashboard] = await Promise.all([
        fetchRealCases(),
        apiGet<ApiDashboard>('/dashboard'),
      ]);
      const summary = summarize(cases);
      summary.adherence_percent =
        dashboard.adherence.rate === null ? null : dashboard.adherence.rate * 100;
      return summary;
    },
  });

// GET /api/cases/{id}
export const useCase = (id: string) =>
  useQuery({
    queryKey: ['cases', id],
    queryFn: () =>
      USE_MOCKS
        ? simulateLatency(allCases().find((c) => c.id === id) ?? null)
        : apiGet<ApiCase>(`/cases/${id}`).then(apiCaseToListItem),
  });
