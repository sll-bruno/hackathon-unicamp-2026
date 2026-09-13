import { useQuery } from '@tanstack/react-query';
import { simulateLatency } from './client';
import { mockCases } from './mocks/cases';

// O backend ainda não expõe os agregados necessários para os dashboards.
// Mantemos o fallback isolado e explícito para não afetar os fluxos operacionais.
export const DASHBOARD_DATA_ARE_SIMULATED = true;

export const useEffectivenessCases = () =>
  useQuery({
    queryKey: ['effectiveness-cases', 'simulated'],
    queryFn: () => simulateLatency(mockCases),
  });
