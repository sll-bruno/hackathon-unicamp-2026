import { useNavigate } from 'react-router-dom';
import { Deadline } from '../Deadline/Deadline';
import { formatBRL } from '../../lib/format';
import type { CaseListItem } from '../../types/case';
import { THESIS_LABEL } from '../../types/labels';
import { RecommendationTag, StatusBadge } from '../Badges/Badges';
import styles from './CaseCard.module.css';

export function CaseCard({ item }: { item: CaseListItem }) {
  const navigate = useNavigate();
  return (
    <article
      className={styles.card}
      tabIndex={0}
      onClick={() => navigate(`/processos/${item.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/processos/${item.id}`)}
    >
      <header className={styles.header}>
        <p className={styles.plaintiff}>{item.plaintiff_name}</p>
        <p className={styles.cnj}>{item.cnj}</p>
      </header>

      <div className={styles.statusRow}>
        <StatusBadge status={item.status} />
        <span className={styles.value}>{formatBRL(item.claim_value)}</span>
      </div>

      <footer className={styles.footer}>
        <span className={styles.meta}>
          {item.uf} · {THESIS_LABEL[item.thesis]}
        </span>
        <Deadline item={item} />
      </footer>

      <div className={styles.recommendation}>
        <RecommendationTag recommendation={item.recommendation} />
      </div>
    </article>
  );
}
