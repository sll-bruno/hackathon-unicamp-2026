import styles from './GroupHeader.module.css';

export function GroupHeader({ label, count, expanded, onToggle }: { label: string; count: number; expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={styles.header} onClick={onToggle} aria-expanded={expanded}>
      <span className={`${styles.chevron} ${expanded ? styles.expanded : ''}`} aria-hidden>
        ▸
      </span>
      {label}
      <span className={styles.count}>{count}</span>
    </button>
  );
}
