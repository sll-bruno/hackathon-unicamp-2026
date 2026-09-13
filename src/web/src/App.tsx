import { useState } from 'react';
import { EnterLogo } from './components/EnterLogo';
import { WorkspacePage } from './pages/Workspace/WorkspacePage';

// Enquanto não há roteador, o processo aberto vem de ?case= e o chatbot de ?view=chat.
function initialCaseId() {
  return new URLSearchParams(window.location.search).get('case') ?? 'caso-02';
}
function initialChatOpen() {
  return new URLSearchParams(window.location.search).get('view') === 'chat';
}

export default function App() {
  const [caseId, setCaseId] = useState(initialCaseId);
  const [chatOpen, setChatOpen] = useState(initialChatOpen);

  const updateUrl = (params: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState(null, '', url);
  };

  const selectCase = (id: string) => {
    updateUrl({ case: id });
    setCaseId(id);
  };

  const openChat = () => {
    updateUrl({ view: 'chat' });
    setChatOpen(true);
  };

  const closeChat = () => {
    updateUrl({ view: null });
    setChatOpen(false);
  };

  return (
    <>
      <header className="app-bar">
        <EnterLogo height={16} />
        <span className="app-bar__product">Política de acordos</span>
      </header>
      <WorkspacePage
        caseId={caseId}
        onSelectSampleCase={selectCase}
        chatOpen={chatOpen}
        onOpenChat={openChat}
        onCloseChat={closeChat}
      />
    </>
  );
}
