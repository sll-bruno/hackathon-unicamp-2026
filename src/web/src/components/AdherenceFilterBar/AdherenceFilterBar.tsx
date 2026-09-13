import type { AdherenceFilters } from '../../types/adherence';
import type { Office } from '../../types/office';
import { CONFIDENCE_BAND_LABEL, THESIS_LABEL } from '../../types/labels';
import styles from './AdherenceFilterBar.module.css';

const PERIOD_LABEL: Record<AdherenceFilters['period'], string> = {
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  '12m': 'Últimos 12 meses',
  all: 'Todo o período',
};

export interface AdherenceFilterBarProps {
  filters: AdherenceFilters;
  onChange: (filters: AdherenceFilters) => void;
  offices: Office[];
  policyVersions: string[];
}

export function AdherenceFilterBar({ filters, onChange, offices, policyVersions }: AdherenceFilterBarProps) {
  return (
    <section className={styles.filters} aria-label="Filtros do monitor de aderência">
      <select
        className={styles.select}
        aria-label="Período"
        value={filters.period}
        onChange={(e) => onChange({ ...filters, period: e.target.value as AdherenceFilters['period'] })}
      >
        {(Object.keys(PERIOD_LABEL) as AdherenceFilters['period'][]).map((p) => (
          <option key={p} value={p}>
            {PERIOD_LABEL[p]}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        aria-label="Escritório"
        value={filters.officeId ?? ''}
        onChange={(e) => onChange({ ...filters, officeId: e.target.value || undefined })}
      >
        <option value="">Todos os escritórios</option>
        {offices.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        aria-label="Tese"
        value={filters.thesis ?? ''}
        onChange={(e) => onChange({ ...filters, thesis: (e.target.value || undefined) as AdherenceFilters['thesis'] })}
      >
        <option value="">Todas as teses</option>
        <option value="GOLPE">{THESIS_LABEL.GOLPE}</option>
        <option value="GENERICO">{THESIS_LABEL.GENERICO}</option>
      </select>

      <select
        className={styles.select}
        aria-label="Confiança"
        value={filters.confidenceBand ?? ''}
        onChange={(e) =>
          onChange({ ...filters, confidenceBand: (e.target.value || undefined) as AdherenceFilters['confidenceBand'] })
        }
      >
        <option value="">Todas as confianças</option>
        <option value="alta">{CONFIDENCE_BAND_LABEL.alta}</option>
        <option value="media">{CONFIDENCE_BAND_LABEL.media}</option>
        <option value="baixa">{CONFIDENCE_BAND_LABEL.baixa}</option>
      </select>

      <select
        className={styles.select}
        aria-label="Versão da política"
        value={filters.policyVersion ?? ''}
        onChange={(e) => onChange({ ...filters, policyVersion: e.target.value || undefined })}
      >
        <option value="">Todas as versões</option>
        {policyVersions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </section>
  );
}
