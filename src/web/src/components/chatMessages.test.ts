import { describe, expect, it } from 'vitest';
import type { ChatApiMessage } from '../api/chat';
import type { Source } from '../types/workspace';
import { fromApiMessage } from './chatMessages';

describe('chat message citations', () => {
  it('rebuilds a persisted citation from workspace evidence after remount', () => {
    const source: Source = {
      document_id: 'contract-document',
      page: 1,
      excerpt: 'O valor líquido liberado será creditado em conta.',
    };
    const message: ChatApiMessage = {
      id: 'assistant-message',
      role: 'ASSISTANT',
      content: 'O contrato comprova o crédito.',
      evidence_ids: ['demo-evidence-1'],
      status: 'COMPLETED',
      created_at: '2026-09-13T05:52:14Z',
    };
    const workspaceSources = new Map<string, Source[]>([['demo-evidence-1', [source]]]);

    expect(fromApiMessage(message, workspaceSources).sources).toEqual([source]);
  });
});
