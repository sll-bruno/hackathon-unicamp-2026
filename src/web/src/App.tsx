import { useState } from 'react';
import { EnterLogo } from './components/EnterLogo';
import { ChatbotPage } from './pages/Chatbot/ChatbotPage';
import { WorkspacePage } from './pages/Workspace/WorkspacePage';

type Screen = 'workspace' | 'chatbot';

// Enquanto não há roteador, o processo aberto vem de ?case= e a tela de ?view=chat.
function initialCaseId() {
  return new URLSearchParams(window.location.search).get('case') ?? 'caso-02';
}
function initialScreen(): Screen {
  return new URLSearchParams(window.location.search).get('view') === 'chat' ? 'chatbot' : 'workspace';
}

export default function App() {
  const [caseId, setCaseId] = useState(initialCaseId);
  const [screen, setScreen] = useState<Screen>(initialScreen);

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
    setScreen('chatbot');
  };

  const closeChat = () => {
    updateUrl({ view: null });
    setScreen('workspace');
  };

  return (
    <>
      <header className="app-bar">
        <EnterLogo height={16} />
        <span className="app-bar__product">Política de acordos</span>
      </header>
      {screen === 'chatbot' ? (
        <ChatbotPage caseId={caseId} onBack={closeChat} />
      ) : (
        <WorkspacePage caseId={caseId} onSelectSampleCase={selectCase} onOpenChat={openChat} />
      )}
    </>
  );
}
