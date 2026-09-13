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

  it('maps citations into each structured answer point', () => {
    const source: Source = {
      document_id: 'contract-document',
      page: 2,
      excerpt: 'Contrato assinado pela autora.',
    };
    const message: ChatApiMessage = {
      id: 'structured-assistant',
      role: 'ASSISTANT',
      content: 'A contratação está documentada.',
      evidence_ids: ['evidence-1'],
      structured_answer: {
        summary: 'A contratação está documentada.',
        points: [
          {
            title: 'Assinatura',
            text: 'O contrato possui assinatura manual.',
            evidence_ids: ['evidence-1'],
          },
        ],
        caveat: 'A autenticidade ainda pode ser questionada.',
      },
      status: 'COMPLETED',
      created_at: '2026-09-13T05:52:14Z',
    };

    const converted = fromApiMessage(message, new Map([['evidence-1', [source]]]));
    expect(converted.structured?.points[0].sources).toEqual([source]);
    expect(converted.structured?.caveat).toBe('A autenticidade ainda pode ser questionada.');
  });
});
