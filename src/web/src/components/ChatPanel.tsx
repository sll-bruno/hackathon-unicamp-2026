import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  createChatMessage,
  getChatMessages,
  type ChatApiMessage,
  type ChatEvidence,
} from '../api/chat';
import { documentTypeLabel } from '../pages/Workspace/format';
import type { CaseDocument, Source, Workspace } from '../types/workspace';
import type { Citation } from './EvidenceCard';
import './chat-panel.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  failed?: boolean;
}

interface Props {
  data: Workspace;
  isSample: boolean;
  onSelectCitation: (citation: Citation) => void;
  onClose: () => void;
}

/**
 * Painel do chatbot de explicações, aberto ao lado da área de trabalho (não é
 * mais uma tela separada). Toda resposta cita o documento e a página, como
 * pede o `architecture_engine.md` para a explicabilidade.
 */
function seedMessages(data: Workspace): ChatMessage[] {
  if (!data.recommendation) return [];
  const topFact = [...data.facts].sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1))[0];
  const contradiction = data.contradictions[0];
  const isAgreement = data.recommendation.action === 'ACORDO';

  const messages: ChatMessage[] = [
    {
      id: 'q1',
      role: 'user',
      text: `Por que a recomendação foi ${isAgreement ? 'acordo' : 'defesa'}?`,
    },
    {
      id: 'a1',
      role: 'assistant',
      text: data.recommendation.reason,
      sources: topFact?.sources,
    },
  ];

  if (contradiction) {
    messages.push(
      { id: 'q2', role: 'user', text: 'Existe alguma contradição nos documentos?' },
      { id: 'a2', role: 'assistant', text: contradiction.description, sources: contradiction.sources },
    );
  }

  return messages;
}

export function ChatPanel({ data, isSample, onSelectCitation, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    isSample ? seedMessages(data) : [],
  );
  const [draft, setDraft] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(!isSample);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const documents = useMemo(() => new Map(data.documents.map((d) => [d.document_id, d])), [data.documents]);
  const evidenceSources = useMemo(() => {
    const index = new Map<string, Source[]>();
    for (const item of [...data.facts, ...data.contradictions, ...data.gaps]) {
      index.set(item.id, item.sources);
    }
    return index;
  }, [data.contradictions, data.facts, data.gaps]);

  useEffect(() => {
    if (isSample) {
      setMessages(seedMessages(data));
      setLoadingHistory(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoadingHistory(true);
    setError(null);
    getChatMessages(data.case.case_id, controller.signal)
      .then(({ items }) => {
        if (!controller.signal.aborted) {
          setMessages(items.map((message) => fromApiMessage(message, evidenceSources)));
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(reason, 'Não foi possível carregar o histórico do chatbot.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingHistory(false);
      });

    return () => controller.abort();
  }, [data, evidenceSources, isSample]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || loadingHistory) return;

    if (isSample) {
      setMessages((current) => [
        ...current,
        { id: `sample-user-${Date.now()}`, role: 'user', text },
        {
          id: `sample-assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Este é um caso de exemplo local. Abra um processo carregado pela API para conversar com a análise real.',
        },
      ]);
      setDraft('');
      return;
    }

    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [...current, { id: pendingId, role: 'user', text }]);
    setDraft('');
    setSending(true);
    setError(null);

    try {
      const response = await createChatMessage(data.case.case_id, text);
      setMessages((current) => [
        ...current.filter((message) => message.id !== pendingId),
        fromApiMessage(response.user_message, evidenceSources),
        fromApiMessage(response.assistant_message, evidenceSources, response.sources),
      ]);
    } catch (reason) {
      setError(errorMessage(reason, 'Não foi possível obter uma resposta do chatbot.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="chat-panel side-panel" aria-label="Chatbot da análise">
      <header className="chat-panel__header">
        <div>
          <span className="eyebrow">Chatbot da análise</span>
          <h2 className="chat-panel__title">{data.case.plaintiff ?? data.case.cnj}</h2>
        </div>
        <button type="button" className="chat-panel__close" onClick={onClose} aria-label="Fechar chatbot">
          <CloseIcon />
        </button>
      </header>

      {isSample && (
        <div className="sample-banner sample-banner--compact" role="note">
          <span className="sample-banner__label">Dados de exemplo</span>
          <span className="sample-banner__text">Perguntas e respostas ilustrativas.</span>
        </div>
      )}

      <div className="chat-panel__thread">
        {loadingHistory && <p className="chat-panel__status">Carregando conversa…</p>}
        {!loadingHistory && messages.length === 0 && (
          <div className="chat-panel__empty">
            <strong>Converse com a análise</strong>
            <span>Pergunte sobre a recomendação, os valores ou as evidências do processo.</span>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            documents={documents}
            onSelectCitation={onSelectCitation}
          />
        ))}
        {sending && (
          <div className="chat-bubble chat-bubble--assistant chat-bubble--typing" aria-live="polite">
            Analisando o processo…
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <form className="chat-panel__composer" onSubmit={send}>
        {error && <p className="chat-panel__error" role="alert">{error}</p>}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Pergunte sobre a evidência, o valor ou a defesa…"
          aria-label="Pergunta para o chatbot"
          disabled={loadingHistory || sending}
        />
        <button type="submit" className="button button--secondary" disabled={loadingHistory || sending || !draft.trim()}>
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </aside>
  );
}

function ChatBubble({
  message,
  documents,
  onSelectCitation,
}: {
  message: ChatMessage;
  documents: Map<string, CaseDocument>;
  onSelectCitation: (citation: Citation) => void;
}) {
  return (
    <div className={`chat-bubble chat-bubble--${message.role}${message.failed ? ' chat-bubble--failed' : ''}`}>
      <p className="chat-bubble__text">{message.text}</p>
      {message.sources && message.sources.length > 0 && (
        <div className="chat-citations">
          {message.sources.map((s, i) => {
            const key = `${message.id}-${i}`;
            const doc = documents.get(s.document_id);
            return (
              <div key={key} className="chat-citation-wrap">
                <button
                  type="button"
                  className="chat-citation"
                  title="Abrir a fonte no visualizador"
                  onClick={() => onSelectCitation({ document_id: s.document_id, page: s.page, excerpts: [s.excerpt] })}
                >
                  {doc ? documentTypeLabel[doc.type] : s.document_id} · p. {s.page}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fromApiMessage(
  message: ChatApiMessage,
  evidenceSources: Map<string, Source[]>,
  evidences: ChatEvidence[] = [],
): ChatMessage {
  const responseSources = new Map(evidences.map((evidence) => [evidence.id, evidence.sources]));
  const sources = uniqueSources(
    message.evidence_ids.flatMap(
      (evidenceId) => responseSources.get(evidenceId) ?? evidenceSources.get(evidenceId) ?? [],
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

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
