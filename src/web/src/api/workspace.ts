import { useEffect, useState } from 'react';
import type { Workspace } from '../types/workspace';

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
  return `/api/documents/${encodeURIComponent(documentId)}/file${page ? `#page=${page}` : ''}`;
}

async function fetchWorkspace(caseId: string, signal: AbortSignal): Promise<Workspace> {
  const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/workspace`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

    fetchWorkspace(caseId, controller.signal)
      .then((data) => setState({ status: 'ready', data, isSample: false }))
      .catch(async (err: unknown) => {
        if (controller.signal.aborted) return;
        const loadSample = samples[caseId];
        if (loadSample) {
          setState({ status: 'ready', data: await loadSample(), isSample: true });
          return;
        }
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });

    return () => controller.abort();
  }, [caseId]);

  return state;
}
