import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { USE_MOCKS } from '../../api/client';
import { DASHBOARD_DATA_ARE_SIMULATED } from '../../api/dashboard';
import { HISTORICAL_CASES_ARE_SIMULATED } from '../../api/history';
import { resetDemoCaseTwo } from '../../api/workspace';
import { EnterLogo } from '../EnterLogo';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/processos', label: 'Processos', end: false },
  { to: '/historico', label: 'Histórico', end: false },
  { to: '/politica', label: 'Política', end: false },
  { to: '/dashboard', label: 'Dashboard', end: false },
];

export function AppLayout() {
  const location = useLocation();
  const [demoReady, setDemoReady] = useState(USE_MOCKS);

  useEffect(() => {
    if (USE_MOCKS) return;
    let active = true;
    resetDemoCaseTwo()
      .catch(() => undefined)
      .finally(() => {
        if (active) setDemoReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const usesSimulatedData =
    USE_MOCKS ||
    (HISTORICAL_CASES_ARE_SIMULATED && location.pathname.startsWith('/historico')) ||
    (DASHBOARD_DATA_ARE_SIMULATED && location.pathname.startsWith('/dashboard'));

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
        {demoReady ? <Outlet /> : null}
      </main>
    </div>
  );
}
