import { toDisplayStatus, type DisplayStatus } from '../../lib/status';
import type { CaseStatus, RecommendationSummary } from '../../types/case';
import type { HistoricalMacroResult, HistoricalOutcome } from '../../types/history';
import { ACTION_LABEL, STATUS_LABEL } from '../../types/labels';
import styles from './Badges.module.css';

type Tone = 'accent' | 'neutral' | 'muted' | 'negative' | 'positive';

const STATUS_TONE: Record<DisplayStatus, Tone> = {
  RASCUNHO: 'muted',
  DOCUMENTOS_ENVIADOS: 'neutral',
  EM_ANALISE: 'neutral',
  AGUARDANDO_DECISAO: 'accent',
  AGUARDANDO_ENCERRAMENTO: 'neutral',
  ENCERRADO: 'muted',
};

const OUTCOME_LABEL: Record<HistoricalOutcome, string> = {
  IMPROCEDENCIA: 'Improcedência',
  EXTINCAO: 'Extinção',
  PARCIAL: 'Parcial',
  PROCEDENCIA: 'Procedência',
  ACORDO: 'Acordo',
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

export function RecommendationTag({
  recommendation,
}: {
  recommendation: Pick<RecommendationSummary, 'action' | 'confidence_percent'> | null;
}) {
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

export function MacroResultBadge({ result }: { result: HistoricalMacroResult }) {
  return (
    <span className={`${styles.badge} ${result === 'EXITO' ? styles.positive : styles.negative}`}>
      {result === 'EXITO' ? 'Êxito' : 'Não êxito'}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: HistoricalOutcome }) {
  return <span className={`${styles.badge} ${styles.muted}`}>{OUTCOME_LABEL[outcome]}</span>;
}
