import styles from './StatCard.module.css';

export function StatCard({
  label,
  value,
  hint,
  active = false,
  onClick,
}: {
  label: string;
  value: number | string | undefined;
  hint?: string; // exemplo concreto do caso mais urgente da categoria
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`${styles.card} ${active ? styles.active : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value ?? '–'}</span>
      <span className={styles.hint}>{hint ?? ' '}</span>
    </Tag>
  );
}
