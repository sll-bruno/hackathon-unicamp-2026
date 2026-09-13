import styles from './HotTopics.module.css';

export interface HotTopicItem {
  key: string;
  label: string;
  value: number | undefined;
  tone: 'negative' | 'accent' | 'muted';
  icon: string;
  active: boolean;
  onClick: () => void;
}

export function HotTopics({ items }: { items: HotTopicItem[] }) {
  return (
    <ul className={styles.list} aria-label="Pendências">
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className={`${styles.row} ${item.active ? styles.active : ''}`}
            onClick={item.onClick}
            aria-pressed={item.active}
          >
            <span className={`${styles.icon} ${styles[item.tone]}`} aria-hidden>
              {item.icon}
            </span>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>{item.value ?? '–'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
