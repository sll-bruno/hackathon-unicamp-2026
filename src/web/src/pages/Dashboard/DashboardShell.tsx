import { NavLink, Outlet } from 'react-router-dom';
import styles from './DashboardShell.module.css';

const TABS = [
  { to: '/dashboard/efetividade', label: 'Efetividade' },
  { to: '/dashboard/aderencia', label: 'Aderência' },
];

// Dashboard do banco tem duas visões independentes — cada uma com dono próprio.
// Esta tela cobre só Efetividade; Aderência é responsabilidade de outra pessoa do time.
export default function DashboardShell() {
  return (
    <div className={styles.shell}>
      <nav className={styles.tabs} aria-label="Visões do dashboard">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => [styles.tab, isActive && styles.active].filter(Boolean).join(' ')}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
