import styles from './StatCard.module.css';

export function StatCard({
  label,
  value,
  accent = false,
  active = false,
  onClick,
}: {
  label: string;
  value: number | string | undefined;
  accent?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`${styles.card} ${accent ? styles.accent : ''} ${active ? styles.active : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value ?? '–'}</span>
    </Tag>
  );
}
