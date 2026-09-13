import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  createChatMessage,
  getChatMessages,
  type ChatRuntime,
} from '../api/chat';
import { documentTypeLabel } from '../pages/Workspace/format';
import type { CaseDocument, Source, Workspace } from '../types/workspace';
import type { Citation } from './EvidenceCard';
import { fromApiMessage, type ChatMessage } from './chatMessages';
import './chat-panel.css';

interface Props {
  data: Workspace;
  isSample: boolean;
  onSelectCitation: (citation: Citation) => void;
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Quais são os 3 fatos que mais favorecem o banco?',
  'Quais pontos favorecem a parte autora?',
  'Por que essa recomendação foi escolhida?',
  'Quais lacunas podem mudar a decisão?',
];

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
  const [runtime, setRuntime] = useState<ChatRuntime | null>(null);
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
      .then(({ items, runtime: apiRuntime }) => {
        if (!controller.signal.aborted) {
          setMessages(items.map((message) => fromApiMessage(message, evidenceSources)));
          setRuntime(apiRuntime);
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

  const sendText = async (rawText: string) => {
    const text = rawText.trim();
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
      setRuntime(response.runtime);
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

  const send = (e: FormEvent) => {
    e.preventDefault();
    void sendText(draft);
  };

  return (
    <aside className="chat-panel side-panel" aria-label="Chatbot da análise">
      <header className="chat-panel__header">
        <div>
          <div className="chat-panel__meta">
            <span className="eyebrow">Chatbot da análise</span>
            {!isSample && runtime && (
              <span className="chat-panel__model" title={`${runtime.provider} · ${runtime.model}`}>
                {formatRuntime(runtime)}
              </span>
            )}
          </div>
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
        {!loadingHistory && (
          <div className="chat-panel__suggestions" aria-label="Perguntas sugeridas">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className="chat-panel__suggestion"
                disabled={sending}
                onClick={() => void sendText(question)}
              >
                {question}
              </button>
            ))}
          </div>
        )}
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

function formatRuntime(runtime: ChatRuntime): string {
  const model = runtime.model
    .replace(/^gpt-/i, 'GPT-')
    .replace(/-luna$/i, ' Luna')
    .replace(/-terra$/i, ' Terra')
    .replace(/-sol$/i, ' Sol');
  const effort = runtime.reasoning_effort.toLowerCase() === 'medium'
    ? 'Medium'
    : runtime.reasoning_effort;
  return `${model} · ${effort}`;
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
  if (message.structured) {
    return (
      <div className="chat-bubble chat-bubble--assistant chat-bubble--structured">
        <p className="chat-answer__summary">{message.structured.summary}</p>
        <div className="chat-answer__points">
          {message.structured.points.map((point, index) => (
            <section className="chat-answer__point" key={`${message.id}-${index}`}>
              <strong>{point.title}</strong>
              <p>{point.text}</p>
              <CitationButtons
                messageId={`${message.id}-${index}`}
                sources={point.sources}
                documents={documents}
                onSelectCitation={onSelectCitation}
              />
            </section>
          ))}
        </div>
        {message.structured.caveat && (
          <p className="chat-answer__caveat">
            <strong>Atenção:</strong> {message.structured.caveat}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`chat-bubble chat-bubble--${message.role}${message.failed ? ' chat-bubble--failed' : ''}`}>
      <p className="chat-bubble__text">{message.text}</p>
      <CitationButtons
        messageId={message.id}
        sources={message.sources ?? []}
        documents={documents}
        onSelectCitation={onSelectCitation}
      />
    </div>
  );
}

function CitationButtons({
  messageId,
  sources,
  documents,
  onSelectCitation,
}: {
  messageId: string;
  sources: Source[];
  documents: Map<string, CaseDocument>;
  onSelectCitation: (citation: Citation) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="chat-citations">
      {sources.map((source, index) => {
        const doc = documents.get(source.document_id);
        return (
          <div key={`${messageId}-${index}`} className="chat-citation-wrap">
            <button
              type="button"
              className="chat-citation"
              title="Abrir a fonte no visualizador"
              onClick={() => onSelectCitation({
                document_id: source.document_id,
                page: source.page,
                excerpts: [source.excerpt],
              })}
            >
              {doc ? documentTypeLabel[doc.type] : source.document_id} · p. {source.page}
            </button>
          </div>
        );
      })}
    </div>
  );
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
