import { useState } from 'react';
import { EnterLogo } from './components/EnterLogo';
import { WorkspacePage } from './pages/Workspace/WorkspacePage';

// Enquanto não há roteador, o processo aberto vem de ?case= (padrão: caso de exemplo 02).
function initialCaseId() {
  return new URLSearchParams(window.location.search).get('case') ?? 'caso-02';
}

export default function App() {
  const [caseId, setCaseId] = useState(initialCaseId);

  const selectCase = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('case', id);
    window.history.replaceState(null, '', url);
    setCaseId(id);
  };

  return (
    <>
      <header className="app-bar">
        <EnterLogo height={16} />
        <span className="app-bar__product">Política de acordos</span>
      </header>
      <WorkspacePage caseId={caseId} onSelectSampleCase={selectCase} />
    </>
  );
}
