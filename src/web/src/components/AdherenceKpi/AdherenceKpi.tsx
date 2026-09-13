import { KpiBox } from '../KpiRow/KpiRow';
import { formatPercent } from '../../lib/format';
import styles from './AdherenceKpi.module.css';

export interface AdherenceKpiProps {
  overallPercent: number | null | undefined;
  totalDecisions: number | undefined;
}

type StatusTone = 'positive' | 'warning' | 'negative' | null;

function toneFromPercent(percent: number | null): StatusTone {
  if (percent === null) return null;
  if (percent >= 70) return 'positive';
  if (percent >= 50) return 'warning';
  return 'negative';
}

export function AdherenceKpi({ overallPercent, totalDecisions }: AdherenceKpiProps) {
  const percent = overallPercent ?? null;
  const tone = toneFromPercent(percent);

  return (
    <div className={styles.row} role="group" aria-label="Aderência geral">
      <div className={`${styles.hero} ${tone ? styles[tone] : ''}`}>
        <span className={styles.heroLabel}>Aderência geral</span>
        <span className={styles.heroValue}>{formatPercent(percent)}</span>
      </div>
      <div className={styles.support}>
        <KpiBox label="Decisões no período" value={totalDecisions === undefined ? '–' : String(totalDecisions)} />
      </div>
    </div>
  );
}
