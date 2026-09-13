import type { Source } from '../types/workspace';
import { apiFetch, apiGet } from './client';

export interface ChatStructuredPoint {
  title: string;
  text: string;
  evidence_ids: string[];
}

export interface ChatStructuredAnswer {
  summary: string;
  points: ChatStructuredPoint[];
  caveat: string | null;
}

export interface ChatApiMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  evidence_ids: string[];
  structured_answer?: ChatStructuredAnswer | null;
  status: 'COMPLETED' | 'FAILED';
  created_at: string;
}

export interface ChatEvidence {
  id: string;
  text: string;
  type: string;
  weight: number | null;
  sources: Source[];
}

export interface ChatRuntime {
  provider: string;
  model: string;
  reasoning_effort: string;
}

export interface ChatMessagesResponse {
  items: ChatApiMessage[];
  total: number;
  runtime: ChatRuntime;
}

export interface ChatCreateResponse {
  user_message: ChatApiMessage;
  assistant_message: ChatApiMessage;
  sources: ChatEvidence[];
  runtime: ChatRuntime;
}

interface ApiErrorPayload {
  message?: string;
}

async function responseError(response: Response): Promise<Error> {
  const fallback = `A API do chatbot respondeu com status ${response.status}.`;
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return new Error(payload.message?.trim() || fallback);
  } catch {
    return new Error(fallback);
  }
}

export function getChatMessages(caseId: string, signal?: AbortSignal) {
  return apiGet<ChatMessagesResponse>(
    `/cases/${encodeURIComponent(caseId)}/chat/messages`,
    signal,
  );
}

export async function createChatMessage(
  caseId: string,
  message: string,
): Promise<ChatCreateResponse> {
  const response = await apiFetch(
    `/api/cases/${encodeURIComponent(caseId)}/chat/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    },
  );
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<ChatCreateResponse>;
}
