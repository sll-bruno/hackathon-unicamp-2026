import { isDeadlineSoon } from '../../api/cases';
import { daysUntil, formatDate } from '../../lib/format';
import type { CaseListItem } from '../../types/case';
import styles from './Deadline.module.css';

export function Deadline({ item }: { item: CaseListItem }) {
  if (!item.deadline_at) return <span className={styles.muted}>—</span>;
  const days = daysUntil(item.deadline_at);
  const open = item.status !== 'ENCERRADO';
  const tone = open && days < 0 ? styles.overdue : isDeadlineSoon(item) ? styles.soon : '';
  const relative = days < 0 ? `vencido há ${-days} d` : days === 0 ? 'hoje' : `em ${days} d`;
  return (
    <span className={`${styles.deadline} ${tone}`}>
      {formatDate(item.deadline_at)}
      {open && <small>{relative}</small>}
    </span>
  );
}
