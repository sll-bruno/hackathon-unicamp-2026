import { useQuery } from '@tanstack/react-query';
import type { Office } from '../types/office';
import { USE_MOCKS, apiGet, simulateLatency } from './client';
import { POLICY_VERSIONS, mockOffices } from './mocks/adherence';

// GET /api/offices — usado pelo filtro de escritório do monitor de aderência.
export const useOffices = () =>
  useQuery({
    queryKey: ['offices'],
    queryFn: () => (USE_MOCKS ? simulateLatency(mockOffices) : apiGet<Office[]>('/offices')),
  });

// GET /api/policy-versions — usado pelo filtro de versão de política do monitor de aderência.
export const usePolicyVersions = () =>
  useQuery({
    queryKey: ['policy-versions'],
    queryFn: () => (USE_MOCKS ? simulateLatency(POLICY_VERSIONS) : apiGet<string[]>('/policy-versions')),
  });
