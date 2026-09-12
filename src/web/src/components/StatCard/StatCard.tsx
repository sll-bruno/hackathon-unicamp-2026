import styles from './StatCard.module.css';

export function StatCard({ label, value, accent = false }: { label: string; value: number | string | undefined; accent?: boolean }) {
  return (
    <div className={`${styles.card} ${accent ? styles.accent : ''}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value ?? '–'}</span>
    </div>
  );
}
