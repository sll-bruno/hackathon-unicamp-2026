import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/AppLayout/AppLayout';
import AdherenceDashboard from './pages/AdherenceDashboard/AdherenceDashboard';
import CaseDetail from './pages/CaseDetail/CaseDetail';
import CaseNew from './pages/CaseNew/CaseNew';
import CasesList from './pages/CasesList/CasesList';
import DashboardShell from './pages/Dashboard/DashboardShell';
import EffectivenessDashboard from './pages/EffectivenessDashboard/EffectivenessDashboard';
import HistoryPage from './pages/History/HistoryPage';
import PolicyPage from './pages/Policy/PolicyPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/processos" replace /> },
      { path: 'processos', element: <CasesList /> },
      { path: 'processos/novo', element: <CaseNew /> },
      { path: 'processos/:id', element: <CaseDetail /> },
      { path: 'historico', element: <HistoryPage /> },
      { path: 'politica', element: <PolicyPage /> },
      {
        path: 'dashboard',
        element: <DashboardShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard/efetividade" replace /> },
          { path: 'efetividade', element: <EffectivenessDashboard /> },
          { path: 'aderencia', element: <AdherenceDashboard /> },
        ],
      },
      { path: '*', element: <Navigate to="/processos" replace /> },
    ],
  },
]);
