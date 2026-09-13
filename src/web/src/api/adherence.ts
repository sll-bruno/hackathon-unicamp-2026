import { useQuery } from '@tanstack/react-query';
import { buildAdherenceOverview } from '../lib/adherence';
import type { AdherenceFilters, AdherenceOverview } from '../types/adherence';
import { USE_MOCKS, apiGet, simulateLatency } from './client';
import { mockAdherenceRecords } from './mocks/adherence';

function toQueryString(filters: AdherenceFilters): string {
  const params = new URLSearchParams({ period: filters.period });
  if (filters.officeId) params.set('office_id', filters.officeId);
  if (filters.thesis) params.set('thesis', filters.thesis);
  if (filters.confidenceBand) params.set('confidence_band', filters.confidenceBand);
  if (filters.policyVersion) params.set('policy_version', filters.policyVersion);
  return params.toString();
}

// GET /api/dashboard/adherence
export const useAdherenceOverview = (filters: AdherenceFilters) =>
  useQuery({
    queryKey: ['adherence', filters],
    queryFn: () =>
      USE_MOCKS
        ? simulateLatency(buildAdherenceOverview(mockAdherenceRecords, filters))
        : apiGet<AdherenceOverview>(`/dashboard/adherence?${toQueryString(filters)}`),
  });
