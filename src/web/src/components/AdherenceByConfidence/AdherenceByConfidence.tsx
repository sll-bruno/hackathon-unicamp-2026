import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { CONFIDENCE_BAND_LABEL } from '../../types/labels';
import type { AdherenceOverview } from '../../types/adherence';
import styles from './AdherenceByConfidence.module.css';

export function AdherenceByConfidence({ data }: { data: AdherenceOverview['by_confidence'] }) {
  const rows = data.map((d) => ({ name: CONFIDENCE_BAND_LABEL[d.band], Aceito: d.accepted, Divergiu: d.diverged }));
  const hasData = data.some((d) => d.accepted + d.diverged > 0);

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Aderência por confiança</h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--stroke-secondary)" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-primary)', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
            <Bar dataKey="Aceito" stackId="decisao" fill="var(--status-positive)" radius={[4, 0, 0, 4]} />
            <Bar dataKey="Divergiu" stackId="decisao" fill="var(--status-negative)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className={styles.empty}>Sem decisões no período.</p>
      )}
    </div>
  );
}
