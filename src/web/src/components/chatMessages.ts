import type { ChatApiMessage, ChatEvidence } from '../api/chat';
import type { Source } from '../types/workspace';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  failed?: boolean;
}

export function fromApiMessage(
  message: ChatApiMessage,
  workspaceSources: Map<string, Source[]>,
  evidences: ChatEvidence[] = [],
): ChatMessage {
  const responseSources = new Map(evidences.map((evidence) => [evidence.id, evidence.sources]));
  const sources = uniqueSources(
    message.evidence_ids.flatMap(
      (evidenceId) => responseSources.get(evidenceId) ?? workspaceSources.get(evidenceId) ?? [],
    ),
  );
  return {
    id: message.id,
    role: message.role.toLowerCase() as ChatMessage['role'],
    text: message.content,
    sources,
    failed: message.status === 'FAILED',
  };
}

function uniqueSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.document_id}:${source.page}:${source.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
