import { useEffect, useState } from 'react';
import type { Workspace } from '../types/workspace';
import { USE_MOCKS, apiFetch, apiGet, apiUrl } from './client';
import { mockCases } from './mocks/cases';
import { buildMockWorkspace } from './mocks/workspace';

export type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Workspace; isSample: boolean };

const samples: Record<string, () => Promise<Workspace>> = {
  'caso-01': () => import('../pages/Workspace/fixtures/caso01').then((m) => m.caso01),
  'caso-02': () => import('../pages/Workspace/fixtures/caso02').then((m) => m.caso02),
};

export const sampleCaseIds = Object.keys(samples);

export function documentFileUrl(documentId: string, page?: number) {
  return `${apiUrl(`/api/documents/${encodeURIComponent(documentId)}/file`)}${page ? `#page=${page}` : ''}`;
}

async function fetchWorkspace(caseId: string, signal: AbortSignal): Promise<Workspace> {
  const workspace = await apiGet<Workspace>(`/cases/${encodeURIComponent(caseId)}/workspace`, signal);
  return {
    ...workspace,
    documents: workspace.documents.map((document) => ({
      ...document,
      type: document.type.toLowerCase() as (typeof document)['type'],
    })),
  };
}

export async function startAnalysis(caseId: string): Promise<NonNullable<Workspace['analysis_job']>> {
  const response = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/analyze`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`POST /api/cases/${caseId}/analyze → ${response.status}`);
  return response.json() as Promise<NonNullable<Workspace['analysis_job']>>;
}

export async function resetDemoCaseTwo(): Promise<void> {
  const response = await apiFetch('/api/demo/reset-case-two', { method: 'POST' });
  if (!response.ok) throw new Error(`POST /api/demo/reset-case-two → ${response.status}`);
}

async function postWorkflow<T>(caseId: string, path: string, body: Record<string, unknown>): Promise<T> {
  const response = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(detail?.message ?? `Não foi possível concluir a ação (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function submitDecision(
  caseId: string,
  action: 'ACORDO' | 'DEFESA',
  divergenceDetails?: string,
) {
  return postWorkflow(caseId, 'decision', {
    action,
    ...(divergenceDetails
      ? { divergence_reason: 'OUTRO', divergence_details: divergenceDetails }
      : {}),
  });
}

export function submitNegotiation(caseId: string, accepted: boolean, finalValue?: number) {
  return postWorkflow(caseId, 'negotiation-result', {
    accepted,
    ...(accepted ? { final_value: finalValue } : {}),
  });
}

export function submitClosure(
  caseId: string,
  body: {
    outcome: 'IMPROCEDENCIA' | 'EXTINCAO' | 'PARCIAL' | 'PROCEDENCIA';
    final_value?: number;
    defense_cost?: number;
    court_award?: number;
    legal_costs?: number;
  },
) {
  return postWorkflow(caseId, 'closure', body);
}

/**
 * Carrega a área de trabalho pela API. Em desenvolvimento, se a API ainda não
 * responder, usa os dados de exemplo identificados como tal (isSample).
 */
export function useWorkspace(caseId: string, refreshVersion = 0): WorkspaceState {
  const [state, setState] = useState<WorkspaceState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) =>
      current.status === 'ready' && current.data.case.case_id === caseId
        ? current
        : { status: 'loading' },
    );

    if (USE_MOCKS) {
      const loadSample = samples[caseId];
      const item = mockCases.find((c) => c.id === caseId);
      (loadSample ? loadSample() : Promise.resolve(item && buildMockWorkspace(item))).then((data) => {
        if (controller.signal.aborted) return;
        if (data) setState({ status: 'ready', data, isSample: true });
        else setState({ status: 'error', message: `Processo "${caseId}" não encontrado.` });
      });
      return () => controller.abort();
    }

    let timer: number | undefined;
    const load = () => fetchWorkspace(caseId, controller.signal)
      .then((data) => {
        setState({ status: 'ready', data, isSample: false });
        if (data.analysis_job?.status === 'QUEUED' || data.analysis_job?.status === 'RUNNING') {
          timer = window.setTimeout(load, 1000);
        }
      })
      .catch(async (err: unknown) => {
        if (controller.signal.aborted) return;
        const loadSample = samples[caseId];
        if (loadSample) {
          setState({ status: 'ready', data: await loadSample(), isSample: true });
          return;
        }
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });

    load();

    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [caseId, refreshVersion]);

  return state;
}
