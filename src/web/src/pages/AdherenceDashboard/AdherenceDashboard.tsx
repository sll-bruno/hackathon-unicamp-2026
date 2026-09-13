import { useState } from 'react';
import { useAdherenceOverview } from '../../api/adherence';
import { useOffices, usePolicyVersions } from '../../api/offices';
import { AdherenceBarCard } from '../../components/AdherenceBarCard/AdherenceBarCard';
import { AdherenceByConfidence } from '../../components/AdherenceByConfidence/AdherenceByConfidence';
import { AdherenceFilterBar } from '../../components/AdherenceFilterBar/AdherenceFilterBar';
import { AdherenceKpi } from '../../components/AdherenceKpi/AdherenceKpi';
import { AdherenceTrendChart } from '../../components/AdherenceTrendChart/AdherenceTrendChart';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { AdherenceFilters } from '../../types/adherence';
import { ACTION_LABEL, DIVERGENCE_REASON_LABEL } from '../../types/labels';
import styles from './AdherenceDashboard.module.css';

const INITIAL_FILTERS: AdherenceFilters = { period: '90d' };

export default function AdherenceDashboard() {
  const [filters, setFilters] = useState<AdherenceFilters>(INITIAL_FILTERS);
  const offices = useOffices();
  const policyVersions = usePolicyVersions();
  const overview = useAdherenceOverview(filters);

  return (
    <div className={styles.page}>
      <PageHeader title="Aderência à política" description="Como os advogados seguem a recomendação da engine." />

      <AdherenceFilterBar
        filters={filters}
        onChange={setFilters}
        offices={offices.data ?? []}
        policyVersions={policyVersions.data ?? []}
      />

      {overview.isPending && <p className={styles.message}>Carregando indicadores…</p>}
      {overview.isError && (
        <p className={styles.message}>Não foi possível carregar os indicadores. {overview.error.message}</p>
      )}

      {overview.isSuccess && (
        <>
          <AdherenceKpi overallPercent={overview.data.overall_percent} totalDecisions={overview.data.total_decisions} />

          <AdherenceTrendChart data={overview.data.trend} />

          <div className={styles.grid}>
            <AdherenceBarCard
              title="Aderência por tipo"
              valueFormat="percent"
              rows={overview.data.by_action.map((a) => ({
                name: ACTION_LABEL[a.action],
                value: a.adherence_percent,
                total: a.total,
              }))}
            />
            <AdherenceBarCard
              title="Motivos de divergência"
              valueFormat="count"
              color="var(--status-negative)"
              emptyMessage="Nenhuma divergência no período."
              rows={overview.data.divergence_reasons.map((r) => ({
                name: DIVERGENCE_REASON_LABEL[r.reason],
                value: r.count,
                total: r.count,
              }))}
            />
            <AdherenceBarCard
              title="Aderência por escritório"
              valueFormat="percent"
              rows={overview.data.by_office.map((o) => ({
                name: o.office_name,
                value: o.adherence_percent,
                total: o.total,
              }))}
            />
            <AdherenceByConfidence data={overview.data.by_confidence} totalDecisions={overview.data.total_decisions} />
          </div>
        </>
      )}
    </div>
  );
}
