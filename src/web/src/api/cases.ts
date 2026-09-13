import { useQuery } from '@tanstack/react-query';
import { toDisplayStatus } from '../lib/status';
import type { CaseListItem, CasesSummary } from '../types/case';
import { USE_MOCKS, apiGet, simulateLatency } from './client';
import { mockCases } from './mocks/cases';

const isOpen = (c: CaseListItem) => c.status !== 'ENCERRADO';

function summarize(cases: CaseListItem[]): CasesSummary {
  const open = cases.filter(isOpen);
  return {
    open: open.length,
    awaiting_decision: open.filter((c) => c.status === 'AGUARDANDO_DECISAO').length,
    pending_outcome: open.filter((c) => toDisplayStatus(c.status) === 'AGUARDANDO_ENCERRAMENTO').length,
    document_errors: open.filter((c) => c.alert !== null).length,
    in_analysis: open.filter((c) => c.status === 'EM_ANALISE').length,
  };
}

// GET /api/cases
export const useCases = () =>
  useQuery({
    queryKey: ['cases'],
    queryFn: () => (USE_MOCKS ? simulateLatency(mockCases) : apiGet<CaseListItem[]>('/cases')),
  });

// GET /api/cases/summary
export const useCasesSummary = () =>
  useQuery({
    queryKey: ['cases', 'summary'],
    queryFn: () => (USE_MOCKS ? simulateLatency(summarize(mockCases)) : apiGet<CasesSummary>('/cases/summary')),
  });

