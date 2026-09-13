import { toDisplayStatus, type DisplayStatus } from '../../lib/status';
import type { CaseStatus, RecommendationSummary } from '../../types/case';
import { ACTION_LABEL, STATUS_LABEL } from '../../types/labels';
import styles from './Badges.module.css';

type Tone = 'accent' | 'neutral' | 'muted' | 'negative' | 'positive';

const STATUS_TONE: Record<DisplayStatus, Tone> = {
  RASCUNHO: 'muted',
  EM_ANALISE: 'neutral',
  AGUARDANDO_DECISAO: 'accent',
  AGUARDANDO_ENCERRAMENTO: 'neutral',
  ENCERRADO: 'muted',
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const display = toDisplayStatus(status);
  return (
    <span className={`${styles.badge} ${styles[STATUS_TONE[display]]}`}>
      {display === 'EM_ANALISE' && <span className={styles.pulse} aria-hidden />}
      {STATUS_LABEL[display]}
    </span>
  );
}

export function RecommendationTag({ recommendation }: { recommendation: RecommendationSummary | null }) {
  if (!recommendation) return <span className={styles.empty}>—</span>;
  const { action, confidence_percent } = recommendation;
  return (
    <span className={styles.recommendation}>
      <span className={action === 'ACORDO' ? styles.actionAcordo : styles.actionDefesa}>{ACTION_LABEL[action]}</span>
      <span className={styles.confidence} title="Confiança da recomendação">
        {confidence_percent === null ? 'confiança indisponível' : `${Math.round(confidence_percent)}%`}
      </span>
    </span>
  );
}
