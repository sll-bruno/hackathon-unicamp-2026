import { useEffect, useState } from 'react';
import type { Workspace } from '../types/workspace';
import { apiFetch, apiGet, apiUrl } from './client';

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

export async function startAnalysis(caseId: string): Promise<void> {
  const response = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/analyze`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`POST /api/cases/${caseId}/analyze → ${response.status}`);
}

/**
 * Carrega a área de trabalho pela API. Em desenvolvimento, se a API ainda não
 * responder, usa os dados de exemplo identificados como tal (isSample).
 */
export function useWorkspace(caseId: string): WorkspaceState {
  const [state, setState] = useState<WorkspaceState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    let timer: number | undefined;
    const load = () => fetchWorkspace(caseId, controller.signal)
      .then((data) => {
        setState({ status: 'ready', data, isSample: false });
        if (data.analysis_job?.status === 'QUEUED' || data.analysis_job?.status === 'RUNNING') {
          timer = window.setTimeout(load, 1500);
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
  }, [caseId]);

  return state;
}
