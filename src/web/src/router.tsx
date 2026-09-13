import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Placeholder } from './components/Placeholder/Placeholder';
import CasesList from './pages/CasesList/CasesList';
import CaseNew from './pages/CaseNew/CaseNew';
import CaseDetail from './pages/CaseDetail/CaseDetail';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/processos" replace /> },
      { path: 'processos', element: <CasesList /> },
      { path: 'processos/novo', element: <CaseNew /> },
      { path: 'processos/:id', element: <CaseDetail /> },
      { path: 'historico', element: <Placeholder title="Histórico geral" description="Casos críticos e linha do tempo." /> },
      {
        // Lazy: BankDashboard traz recharts (e por tabela @reduxjs/toolkit, react-redux, d3-*),
        // e não deve entrar no bundle inicial das outras rotas.
        path: 'dashboard',
        lazy: () => import('./pages/BankDashboard/BankDashboard').then((m) => ({ Component: m.default })),
      },
      { path: '*', element: <Navigate to="/processos" replace /> },
    ],
  },
]);
