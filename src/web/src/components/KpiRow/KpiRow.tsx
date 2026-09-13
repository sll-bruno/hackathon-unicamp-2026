import { formatBRL, formatPercent } from '../../lib/format';
import styles from './KpiRow.module.css';

export interface KpiRowProps {
  openValueSum: number | undefined;
  newThisMonth: number | undefined;
  adherencePercent: number | null | undefined;
  effectivenessPercent: number | null | undefined;
}

export function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.box}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

export function KpiRow({ openValueSum, newThisMonth, adherencePercent, effectivenessPercent }: KpiRowProps) {
  return (
    <div className={styles.row} role="group" aria-label="Métricas do escritório">
      <KpiBox label="Valor em aberto" value={openValueSum === undefined ? '–' : formatBRL(openValueSum)} />
      <KpiBox label="Casos novos no mês" value={newThisMonth === undefined ? '–' : String(newThisMonth)} />
      <KpiBox label="Aderência à recomendação" value={formatPercent(adherencePercent ?? null)} />
      <KpiBox label="Eficácia ao seguir a recomendação" value={formatPercent(effectivenessPercent ?? null)} />
    </div>
  );
}
