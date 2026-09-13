import { Navigate, createBrowserRouter, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Placeholder } from './components/Placeholder/Placeholder';
import CasesList from './pages/CasesList/CasesList';
import CaseNew from './pages/CaseNew/CaseNew';

// Área do processo (Tela 3) é da Pessoa E; este placeholder só mantém a navegação.
function WorkspacePlaceholder() {
  const { id } = useParams();
  return <Placeholder title="Área do processo" description={`Processo ${id} — responsabilidade da Pessoa E.`} />;
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/processos" replace /> },
      { path: 'processos', element: <CasesList /> },
      { path: 'processos/novo', element: <CaseNew /> },
      { path: 'processos/:id', element: <WorkspacePlaceholder /> },
      { path: 'historico', element: <Placeholder title="Histórico geral" description="Casos críticos e linha do tempo." /> },
      { path: 'dashboard', element: <Placeholder title="Dashboard" description="Aderência e efetividade da política." /> },
      { path: '*', element: <Navigate to="/processos" replace /> },
    ],
  },
]);
