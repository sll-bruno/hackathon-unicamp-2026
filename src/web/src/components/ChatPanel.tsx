import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { CaseDocument, Source, Workspace } from '../types/workspace';
import { documentTypeLabel } from '../pages/Workspace/format';
import './chat-panel.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
}

interface Props {
  data: Workspace;
  isSample: boolean;
  onClose: () => void;
}

/**
 * Painel do chatbot de explicações, aberto ao lado da área de trabalho (não é
 * mais uma tela separada). Toda resposta cita o documento e a página, como
 * pede o `architecture_engine.md` para a explicabilidade.
 */
function seedMessages(data: Workspace): ChatMessage[] {
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

export function ChatPanel({ data, isSample, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => seedMessages(data));
  const [draft, setDraft] = useState('');
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const documents = useMemo(() => new Map(data.documents.map((d) => [d.document_id, d])), [data.documents]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const reply: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: 'Ainda não estou conectado ao pipeline de IA. Quando estiver, toda resposta vai citar o documento e a página, como nos exemplos acima.',
    };
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text }, reply]);
    setDraft('');
  };

  return (
    <aside className="chat-panel" aria-label="Chatbot da análise">
      <header className="chat-panel__header">
        <div>
          <span className="eyebrow">Chatbot da análise</span>
          <h2 className="chat-panel__title">{data.case.plaintiff}</h2>
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
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            documents={documents}
            openCitation={openCitation}
            onToggleCitation={setOpenCitation}
          />
        ))}
        <div ref={threadEndRef} />
      </div>

      <form className="chat-panel__composer" onSubmit={send}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Pergunte sobre a evidência, o valor ou a defesa…"
          aria-label="Pergunta para o chatbot"
        />
        <button type="submit" className="button button--secondary">
          Enviar
        </button>
      </form>
    </aside>
  );
}

function ChatBubble({
  message,
  documents,
  openCitation,
  onToggleCitation,
}: {
  message: ChatMessage;
  documents: Map<string, CaseDocument>;
  openCitation: string | null;
  onToggleCitation: (key: string | null) => void;
}) {
  return (
    <div className={`chat-bubble chat-bubble--${message.role}`}>
      <p className="chat-bubble__text">{message.text}</p>
      {message.sources && message.sources.length > 0 && (
        <div className="chat-citations">
          {message.sources.map((s, i) => {
            const key = `${message.id}-${i}`;
            const doc = documents.get(s.document_id);
            const open = openCitation === key;
            return (
              <div key={key} className="chat-citation-wrap">
                <button
                  type="button"
                  className="chat-citation"
                  aria-pressed={open}
                  onClick={() => onToggleCitation(open ? null : key)}
                >
                  {doc ? documentTypeLabel[doc.type] : s.document_id} · p. {s.page}
                </button>
                {open && <blockquote className="chat-citation__quote">{s.excerpt}</blockquote>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
