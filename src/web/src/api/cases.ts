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
    queryFn: () => (USE_MOCKS ? simulateLatency(allCases()) : apiGet<CaseListItem[]>('/cases')),
  });

// GET /api/cases/summary
export const useCasesSummary = () =>
  useQuery({
    queryKey: ['cases', 'summary'],
    queryFn: () => (USE_MOCKS ? simulateLatency(summarize(allCases())) : apiGet<CasesSummary>('/cases/summary')),
  });

// GET /api/cases/{id}
export const useCase = (id: string) =>
  useQuery({
    queryKey: ['cases', id],
    queryFn: () =>
      USE_MOCKS ? simulateLatency(allCases().find((c) => c.id === id) ?? null) : apiGet<CaseListItem>(`/cases/${id}`),
  });

