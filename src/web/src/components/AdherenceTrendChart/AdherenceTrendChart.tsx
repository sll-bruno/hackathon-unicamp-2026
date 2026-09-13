import { Area, AreaChart, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { AdherenceOverview } from '../../types/adherence';
import { formatPercent } from '../../lib/format';
import styles from './AdherenceTrendChart.module.css';

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

interface TrendRow {
  label: string;
  adherence_percent: number | null;
  total: number;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendRow }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <strong>{point.label}</strong>
      <span>
        {formatPercent(point.adherence_percent)} · {point.total} decisõe{point.total === 1 ? '' : 's'}
      </span>
    </div>
  );
}

export function AdherenceTrendChart({ data }: { data: AdherenceOverview['trend'] }) {
  const hasData = data.some((d) => d.total > 0);
  const rows: TrendRow[] = data.map((d) => ({
    label: shortDate.format(new Date(d.week_start)),
    adherence_percent: d.adherence_percent,
    total: d.total,
  }));

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Tendência de aderência</h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--stroke-secondary)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              allowDecimals={false}
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              width={36}
            />
            <Tooltip content={<TrendTooltip />} />
            <Area
              type="monotone"
              dataKey="adherence_percent"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.2}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className={styles.empty}>Sem decisões no período.</p>
      )}
    </div>
  );
}
