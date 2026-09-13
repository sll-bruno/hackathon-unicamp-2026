import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { USE_MOCKS } from '../../api/client';
import { HISTORICAL_CASES_ARE_SIMULATED } from '../../api/history';
import { EnterLogo } from '../EnterLogo';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/processos', label: 'Processos', end: false },
  { to: '/historico', label: 'Histórico', end: false },
  { to: '/dashboard', label: 'Dashboard', end: false },
];

export function AppLayout() {
  const location = useLocation();
  const usesSimulatedData = USE_MOCKS || (HISTORICAL_CASES_ARE_SIMULATED && location.pathname.startsWith('/historico'));

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <NavLink to="/processos" className={styles.brand} aria-label="EnterOS — início">
          <EnterLogo height={22} />
          <span className={styles.brandSuffix}>OS</span>
        </NavLink>
        <nav className={styles.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.right}>
          {usesSimulatedData && (
            <span className={styles.mockBadge} title="Front usando dados de exemplo; não são resultados reais">
              Dados simulados
            </span>
          )}
        </div>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
