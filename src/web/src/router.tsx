import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Placeholder } from './components/Placeholder/Placeholder';
import CaseDetail from './pages/CaseDetail/CaseDetail';
import CaseNew from './pages/CaseNew/CaseNew';
import CasesList from './pages/CasesList/CasesList';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/processos" replace /> },
      { path: 'processos', element: <CasesList /> },
      { path: 'processos/novo', element: <CaseNew /> },
      { path: 'processos/:id', element: <CaseDetail /> },
      { path: 'historico', element: <Placeholder title="Histórico geral" description="Casos críticos e linha do tempo." /> },
      { path: 'dashboard', element: <Placeholder title="Dashboard" description="Aderência e efetividade da política." /> },
      { path: '*', element: <Navigate to="/processos" replace /> },
    ],
  },
]);
