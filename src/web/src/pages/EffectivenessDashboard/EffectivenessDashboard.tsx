import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffectivenessCases } from '../../api/dashboard';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { formatBRL, formatPercent } from '../../lib/format';
import {
  closedCasesByUF,
  confidenceCalibration,
  cumulativeSavingsByMonth,
  failureRate,
  officeRanking,
  outcomeDistribution,
  pipelineValue,
  predictedVsRealized,
  savingsByAction,
  savingsByMonth,
  savingsByThesis,
  successRate,
  topCasesBySavings,
  totalSavings,
} from '../../lib/metrics';
import { ACTION_LABEL, OUTCOME_LABEL, THESIS_LABEL } from '../../types/labels';
import styles from './EffectivenessDashboard.module.css';

const OUTCOME_COLOR: Record<string, string> = {
  IMPROCEDENCIA: 'var(--status-positive)',
  EXTINCAO: 'var(--status-positive)',
  ACORDO: 'var(--accent)',
  PARCIAL: 'var(--status-warning)',
  PROCEDENCIA: 'var(--status-negative)',
};

const monthLabel = (ym: string) => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
};

const rateColor = (rate: number | null) => {
  if (rate === null) return 'var(--text-muted)';
  if (rate >= 70) return 'var(--status-positive)';
  if (rate >= 40) return 'var(--status-warning)';
  return 'var(--status-negative)';
};

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'accent';
  hint?: string;
}) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`${styles.chartCard} ${wide ? styles.chartCardWide : ''}`}>
      <header className={styles.chartHeader}>
        <h2 className={styles.chartTitle}>{title}</h2>
        {subtitle && <p className={styles.chartSubtitle}>{subtitle}</p>}
      </header>
      <div className={styles.chartBody}>{children}</div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionSubtitle}>{subtitle}</p>
    </div>
  );
}

export default function EffectivenessDashboard() {
  const { data: cases } = useEffectivenessCases();
  const all = cases ?? [];

  const outcomes = useMemo(() => outcomeDistribution(all), [all]);
  const closedTotal = outcomes.reduce((sum, o) => sum + o.count, 0);
  const success = successRate(all);
  const failure = failureRate(all);
  const savings = totalSavings(all);
  const savingsCaseCount = all.filter((c) => c.status === 'ENCERRADO' && c.followed_recommendation === true && c.final_value !== null).length;
  const monthlySavings = useMemo(() => savingsByMonth(all).map((m) => ({ ...m, label: monthLabel(m.month) })), [all]);
  const cumulative = useMemo(() => cumulativeSavingsByMonth(all).map((m) => ({ ...m, label: monthLabel(m.month) })), [all]);
  const byUF = useMemo(() => closedCasesByUF(all), [all]);
  const scatter = useMemo(() => predictedVsRealized(all), [all]);
  const calibration = useMemo(() => confidenceCalibration(all), [all]);
  const offices = useMemo(() => officeRanking(all), [all]);
  const byAction = useMemo(() => savingsByAction(all), [all]);
  const byThesis = useMemo(() => savingsByThesis(all), [all]);
  const pipeline = useMemo(() => pipelineValue(all), [all]);
  const topCases = useMemo(() => topCasesBySavings(all, 5), [all]);

  const successCount = outcomes
    .filter((o) => o.outcome === 'IMPROCEDENCIA' || o.outcome === 'EXTINCAO')
    .reduce((sum, o) => sum + o.count, 0);
  const outcomesWithCases = outcomes.filter((o) => o.count > 0);
  const scatterMax = Math.max(1, ...scatter.flatMap((p) => [p.predicted, p.realized])) * 1.1;
  const maxOfficeSavings = Math.max(1, ...offices.map((o) => o.totalSavings));

  return (
    <div className={styles.page}>
      <PageHeader title="Efetividade" description="Economia gerada e taxa de êxito dos casos, para o banco acompanhar o retorno da política de decisão." />

      {/* ── Destaque: êxito + economia ── */}
      <div className={styles.hero}>
        <div className={`${styles.heroCard} ${styles.heroGauge}`}>
          <div className={styles.gaugeWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outcomesWithCases}
                  dataKey="count"
                  nameKey="outcome"
                  innerRadius="72%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={outcomesWithCases.length > 1 ? 3 : 0}
                  stroke="none"
                >
                  {outcomesWithCases.map((o) => (
                    <Cell key={o.outcome} fill={OUTCOME_COLOR[o.outcome]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.gaugeCenter}>
              <span className={styles.gaugeValue}>{formatPercent(success)}</span>
              <span className={styles.gaugeCaption}>êxito</span>
            </div>
          </div>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>Taxa de casos com êxito</span>
            <p className={styles.heroHint}>
              {successCount} de {closedTotal} casos encerrados tiveram desfecho favorável ao banco
            </p>
            <ul className={styles.gaugeLegend}>
              {outcomesWithCases.map((o) => (
                <li key={o.outcome}>
                  <i style={{ background: OUTCOME_COLOR[o.outcome] }} />
                  {OUTCOME_LABEL[o.outcome]}
                  <strong>{formatPercent(closedTotal > 0 ? (o.count / closedTotal) * 100 : null)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`${styles.heroCard} ${styles.heroSavings}`}>
          <span className={styles.heroLabel}>Economia gerada</span>
          <span className={styles.heroSavingsValue}>{formatBRL(savings)}</span>
          <p className={styles.heroHint}>
            Valor da causa menos valor efetivamente pago, somado nos {savingsCaseCount} casos que acataram a nossa proposta
          </p>
        </div>
      </div>

      <div className={styles.stats}>
        <StatCard
          label="Taxa de casos sem êxito"
          value={formatPercent(failure)}
          tone="negative"
          hint={`${outcomes.find((o) => o.outcome === 'PROCEDENCIA')?.count ?? 0} de ${closedTotal} casos encerrados`}
        />
        <StatCard label="Casos encerrados" value={String(closedTotal)} hint="Total com desfecho registrado" />
        <StatCard
          label="Economia média por caso"
          value={savingsCaseCount > 0 ? formatBRL(savings / savingsCaseCount) : '–'}
          hint="Entre os casos que acataram a proposta"
        />
        <StatCard
          label="Economia em pipeline"
          value={formatBRL(pipeline.value)}
          tone="accent"
          hint={`Projeção para ${pipeline.count} casos ainda abertos`}
        />
      </div>

      <div className={styles.grid}>
        <ChartCard title="Economia mensal" subtitle="Soma de (valor da causa − valor pago) por mês de encerramento">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlySavings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-secondary)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--stroke-secondary)' }} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => formatBRL(v)}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                formatter={(value) => formatBRL(Number(value))}
                labelFormatter={(label) => `Mês: ${label}`}
                contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--stroke-secondary)', borderRadius: 8 }}
              />
              <Bar dataKey="savings" name="Economia" fill="var(--status-positive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Economia acumulada" subtitle="Evolução do total entregue ao banco desde o início">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={cumulative}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-secondary)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--stroke-secondary)' }} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => formatBRL(v)}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                formatter={(value) => formatBRL(Number(value))}
                labelFormatter={(label) => `Mês: ${label}`}
                contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--stroke-secondary)', borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="cumulative" name="Economia acumulada" stroke="var(--status-positive)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Casos encerrados por UF" subtitle="Volume de processos concluídos por estado">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byUF}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-secondary)" vertical={false} />
              <XAxis dataKey="uf" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--stroke-secondary)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--stroke-secondary)', borderRadius: 8 }} />
              <Bar dataKey="count" name="Casos" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Confiabilidade do modelo ── */}
      <SectionHeader
        title="Confiabilidade da política"
        subtitle="A IA está prevendo bem? Aqui dá para ver se a confiança declarada e o custo estimado batem com a realidade."
      />
      <div className={styles.grid}>
        <ChartCard title="Previsto vs. realizado" subtitle="Custo esperado de defesa (previsto) contra o valor efetivamente pago. Abaixo da linha = pagamos menos que o previsto.">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-secondary)" />
              <XAxis
                type="number"
                dataKey="predicted"
                name="Previsto"
                domain={[0, scatterMax]}
                tickFormatter={(v: number) => formatBRL(v)}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--stroke-secondary)' }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="realized"
                name="Realizado"
                domain={[0, scatterMax]}
                tickFormatter={(v: number) => formatBRL(v)}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: scatterMax, y: scatterMax }]} stroke="var(--stroke-primary)" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ stroke: 'var(--stroke-primary)' }}
                formatter={(value, name) => [formatBRL(Number(value)), name]}
                labelFormatter={() => ''}
                contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--stroke-secondary)', borderRadius: 8 }}
              />
              <Scatter data={scatter} name="Casos">
                {scatter.map((p) => (
                  <Cell key={p.caseId} fill={p.realized <= p.predicted ? 'var(--status-positive)' : 'var(--status-negative)'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Confiança vs. taxa de acerto" subtitle="Quanto maior a confiança da recomendação, maior deveria ser a taxa de êxito real">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={calibration}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-secondary)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--stroke-secondary)' }} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(value, _name, entry) => [
                  value === null ? 'sem casos' : `${Math.round(Number(value))}%`,
                  `Taxa de êxito (${entry.payload.count} casos)`,
                ]}
                contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--stroke-secondary)', borderRadius: 8 }}
              />
              <Bar dataKey="successRate" name="Taxa de êxito" radius={[6, 6, 0, 0]}>
                {calibration.map((b) => (
                  <Cell key={b.label} fill={rateColor(b.successRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Comparativos ── */}
      <SectionHeader title="Comparativos" subtitle="Onde a política gera mais valor: por estratégia, por tese e por escritório parceiro." />
      <div className={styles.grid}>
        <ChartCard title="Acordo vs. Defesa" subtitle="Taxa de êxito e economia média por estratégia recomendada">
          <div className={styles.compareRow}>
            {byAction.map((a) => (
              <div key={a.action} className={styles.compareCol}>
                <span className={styles.compareLabel}>{ACTION_LABEL[a.action]}</span>
                <span className={styles.compareValue} style={{ color: rateColor(a.successRate) }}>
                  {formatPercent(a.successRate)}
                </span>
                <span className={styles.compareCaption}>taxa de êxito</span>
                <span className={styles.compareSecondary}>{a.averageSavings === null ? '–' : formatBRL(a.averageSavings)}</span>
                <span className={styles.compareCaption}>economia média · {a.closedCount} casos</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Economia por tese" subtitle="Golpe vs. Genérico — total e média de economia real">
          <div className={styles.compareRow}>
            {byThesis.map((t) => (
              <div key={t.thesis} className={styles.compareCol}>
                <span className={styles.compareLabel}>{THESIS_LABEL[t.thesis]}</span>
                <span className={styles.compareValue}>{formatBRL(t.totalSavings)}</span>
                <span className={styles.compareCaption}>economia total</span>
                <span className={styles.compareSecondary}>{t.averageSavings === null ? '–' : formatBRL(t.averageSavings)}</span>
                <span className={styles.compareCaption}>economia média · {t.closedCount} casos</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Ranking de escritórios" subtitle="Economia gerada e taxa de êxito por escritório parceiro" wide>
          <ul className={styles.rankingList}>
            {offices.map((o, i) => (
              <li key={o.office} className={styles.rankingRow}>
                <span className={styles.rankingPosition}>{i + 1}</span>
                <div className={styles.rankingMain}>
                  <div className={styles.rankingHead}>
                    <span className={styles.rankingName}>{o.office}</span>
                    <span className={styles.rankingSuccess} style={{ color: rateColor(o.successRate) }}>
                      {formatPercent(o.successRate)} êxito
                    </span>
                  </div>
                  <div className={styles.rankingBarTrack}>
                    <div
                      className={styles.rankingBarFill}
                      style={{ width: `${(o.totalSavings / maxOfficeSavings) * 100}%` }}
                    />
                  </div>
                  <div className={styles.rankingFoot}>
                    <span>{formatBRL(o.totalSavings)} economizados</span>
                    <span>{o.closedCount} casos encerrados</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {/* ── Top casos ── */}
      <ChartCard title="Maiores economias" subtitle="Os 5 casos encerrados com maior diferença entre valor da causa e valor pago">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Parte autora</th>
                <th>UF</th>
                <th>Escritório</th>
                <th className={styles.num}>Valor da causa</th>
                <th className={styles.num}>Valor pago</th>
                <th className={styles.num}>Economia</th>
              </tr>
            </thead>
            <tbody>
              {topCases.map((c) => (
                <tr key={c.id}>
                  <td>{c.plaintiff}</td>
                  <td>{c.uf}</td>
                  <td>{c.office}</td>
                  <td className={styles.num}>{formatBRL(c.claimValue)}</td>
                  <td className={styles.num}>{formatBRL(c.finalValue)}</td>
                  <td className={`${styles.num} ${styles.savingsCell}`}>{formatBRL(c.savings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
