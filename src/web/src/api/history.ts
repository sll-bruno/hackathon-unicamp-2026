import { useQuery } from '@tanstack/react-query';
import type { HistoricalCasesPayload } from '../types/history';
import { simulateLatency } from './client';
import { mockHistoricalCases } from './mocks/history';

// TODO(API): substituir quando existir um endpoint próprio de processos
// históricos. GET /api/history permanece reservado a eventos de auditoria.
export const HISTORICAL_CASES_ARE_SIMULATED = true;

export const useHistoricalCases = () =>
  useQuery({
    queryKey: ['historical-cases', 'simulated'],
    queryFn: (): Promise<HistoricalCasesPayload> =>
      simulateLatency({
        items: mockHistoricalCases,
        total: mockHistoricalCases.length,
        simulated: true,
      }),
  });
