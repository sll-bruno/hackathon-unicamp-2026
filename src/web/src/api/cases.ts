import { useQuery } from '@tanstack/react-query';
import type { CaseListItem, CasesSummary } from '../types/case';
import { daysUntil } from '../lib/format';
import { USE_MOCKS, apiGet, simulateLatency } from './client';
import { mockCases } from './mocks/cases';

const DEADLINE_SOON_DAYS = 5;

export const isDeadlineSoon = (c: CaseListItem) =>
  c.status !== 'ENCERRADO' && c.deadline_at !== null && daysUntil(c.deadline_at) <= DEADLINE_SOON_DAYS;

function summarize(cases: CaseListItem[]): CasesSummary {
  const open = cases.filter((c) => c.status !== 'ENCERRADO');
  return {
    open: open.length,
    awaiting_decision: open.filter((c) => c.status === 'AGUARDANDO_DECISAO').length,
    in_analysis: open.filter((c) => c.status === 'EM_ANALISE').length,
    deadline_soon: open.filter(isDeadlineSoon).length,
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
