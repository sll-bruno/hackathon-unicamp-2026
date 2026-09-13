import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import styles from './AdherenceBarCard.module.css';

export interface AdherenceBarCardRow {
  name: string;
  value: number; // percentual (0–100) ou contagem, conforme valueFormat
  total: number; // total de decisões na categoria — só usado para decidir o estado vazio
}

export interface AdherenceBarCardProps {
  title: string;
  rows: AdherenceBarCardRow[];
  valueFormat: 'percent' | 'count';
  color?: string;
  emptyMessage?: string;
}

const formatValue = (value: number, format: 'percent' | 'count') =>
  format === 'percent' ? `${Math.round(value)}%` : String(value);

export function AdherenceBarCard({
  title,
  rows,
  valueFormat,
  color = 'var(--status-positive)',
  emptyMessage = 'Sem decisões no período.',
}: AdherenceBarCardProps) {
  const hasData = rows.some((r) => r.total > 0);

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--stroke-secondary)" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text-primary)', fontSize: 12 }} />
            <Bar dataKey="value" fill={color} radius={4}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => formatValue(v as number, valueFormat)}
                fill="var(--text-primary)"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className={styles.empty}>{emptyMessage}</p>
      )}
    </div>
  );
}
