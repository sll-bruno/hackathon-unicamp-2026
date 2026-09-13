import { useMemo, useState, type FormEvent } from 'react';
import { useWorkspace } from '../../api/workspace';
import type { CaseDocument, Source, Workspace } from '../../types/workspace';
import { documentTypeLabel } from '../Workspace/format';
import './chatbot.css';

interface Props {
  caseId: string;
  onBack: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
}

/**
 * Tela do chatbot de explicações. Segundo o `architecture_engine.md`, toda
 * resposta recebe o snapshot da recomendação e os trechos dos documentos, e
 * precisa citar documento e página — é isso que os chips abaixo de cada
 * resposta representam.
 */
export function ChatbotPage({ caseId, onBack }: Props) {
  const state = useWorkspace(caseId);

  if (state.status === 'loading') {
    return (
      <main className="chat chat--state" aria-busy="true">
        <p>Carregando o chatbot…</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="chat chat--state">
        <h1>Não foi possível abrir o chatbot</h1>
        <p>{state.message}</p>
        <button type="button" className="button button--secondary" onClick={onBack}>
          Voltar à área de trabalho
        </button>
      </main>
    );
  }

  return <ChatbotView key={caseId} data={state.data} isSample={state.isSample} onBack={onBack} />;
}

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

function ChatbotView({ data, isSample, onBack }: { data: Workspace; isSample: boolean; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => seedMessages(data));
  const [draft, setDraft] = useState('');
  const [openCitation, setOpenCitation] = useState<string | null>(null);

  const documents = useMemo(() => new Map(data.documents.map((d) => [d.document_id, d])), [data.documents]);

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
    <main className="chat">
      <header className="chat__header">
        <button type="button" className="link-button" onClick={onBack}>
          ← Voltar à área de trabalho
        </button>
        <div>
          <span className="eyebrow">Chatbot da análise</span>
          <h1 className="chat__title">{data.case.plaintiff}</h1>
        </div>
      </header>

      {isSample && (
        <div className="sample-banner" role="note">
          <span className="sample-banner__label">Dados de exemplo</span>
          <span className="sample-banner__text">As perguntas e respostas abaixo são ilustrativas.</span>
        </div>
      )}

      <p className="chat__note">Toda resposta cita o documento e a página de onde veio a informação.</p>

      <div className="chat__thread">
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            documents={documents}
            openCitation={openCitation}
            onToggleCitation={setOpenCitation}
          />
        ))}
      </div>

      <form className="chat__composer" onSubmit={send}>
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
    </main>
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
