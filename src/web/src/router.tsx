import { Navigate, createBrowserRouter, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Placeholder } from './components/Placeholder/Placeholder';
import CasesList from './pages/CasesList/CasesList';
import { WorkspacePage } from './pages/Workspace/WorkspacePage';

// Área do processo (Tela 3). O painel de chat continua abrindo por ?view=chat,
// como na tela original, agora com o processo vindo da rota em vez de ?case=.
function WorkspaceRoute() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const setChatOpen = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('view', 'chat');
    else next.delete('view');
    setParams(next, { replace: true });
  };

  return (
    <WorkspacePage
      key={id}
      caseId={id}
      chatOpen={params.get('view') === 'chat'}
      onOpenChat={() => setChatOpen(true)}
      onCloseChat={() => setChatOpen(false)}
      onSelectSampleCase={(caseId) => navigate(`/processos/${caseId}`)}
    />
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/processos" replace /> },
      { path: 'processos', element: <CasesList /> },
      { path: 'processos/novo', element: <Placeholder title="Novo processo" description="Cadastro, envio de documentos e análise." /> },
      { path: 'processos/:id', element: <WorkspaceRoute /> },
      { path: 'historico', element: <Placeholder title="Histórico geral" description="Casos críticos e linha do tempo." /> },
      { path: 'dashboard', element: <Placeholder title="Dashboard" description="Aderência e efetividade da política." /> },
      { path: '*', element: <Navigate to="/processos" replace /> },
    ],
  },
]);
