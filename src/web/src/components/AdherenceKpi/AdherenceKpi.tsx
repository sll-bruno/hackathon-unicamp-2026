import { KpiBox } from '../KpiRow/KpiRow';
import { formatPercent } from '../../lib/format';
import styles from './AdherenceKpi.module.css';

export interface AdherenceKpiProps {
  overallPercent: number | null | undefined;
  totalDecisions: number | undefined;
}

export function AdherenceKpi({ overallPercent, totalDecisions }: AdherenceKpiProps) {
  return (
    <div className={styles.row} role="group" aria-label="Aderência geral">
      <KpiBox label="Aderência geral" value={formatPercent(overallPercent ?? null)} />
      <KpiBox label="Decisões no período" value={totalDecisions === undefined ? '–' : String(totalDecisions)} />
    </div>
  );
}
