import type { CSSProperties } from 'react';
import type { OutcomeProbabilities } from '../types/workspace';
import { formatPercent } from '../pages/Workspace/format';

interface Outcome {
  key: keyof OutcomeProbabilities;
  label: string;
  slot: number;
}

const favorable: Outcome[] = [
  { key: 'extincao', label: 'Extinção', slot: 1 },
  { key: 'improcedencia', label: 'Improcedência', slot: 2 },
];

const condemnation: Outcome[] = [
  { key: 'parcial', label: 'Procedência parcial', slot: 3 },
  { key: 'procedencia', label: 'Procedência', slot: 4 },
];

/** Probabilidades de desfecho judicial, do ponto de vista do banco réu. */
export function RiskCard({ probabilities, cohortSize }: { probabilities: OutcomeProbabilities; cohortSize: number | null }) {
  const risk = probabilities.parcial + probabilities.procedencia;
  const all = [...favorable, ...condemnation];

  return (
    <section className="card risk" aria-labelledby="risk-title">
      <header className="card__header">
        <h2 id="risk-title" className="card__title">
          Risco de condenação do banco
        </h2>
      </header>
      <p className="card__subtitle">Chance de o banco ter que pagar algo, caso o processo vá a julgamento.</p>

      <p className="big-number">
        {Math.round(risk * 100)}
        <span>%</span>
      </p>

      <div className="outcomes__bar" role="img" aria-label={all.map((o) => `${o.label} ${formatPercent(probabilities[o.key])}`).join(', ')}>
        {all.map((o) => (
          <div
            key={o.key}
            className="outcomes__segment"
            style={{ flexGrow: probabilities[o.key], '--seg': `var(--viz-outcome-${o.slot})` } as CSSProperties}
            tabIndex={0}
            aria-label={`${o.label}: ${formatPercent(probabilities[o.key])}`}
          >
            <span className="tooltip" role="tooltip">
              {o.label} <strong>{formatPercent(probabilities[o.key])}</strong>
            </span>
          </div>
        ))}
      </div>

      <div className="risk__legend">
        <LegendGroup title="Favorável ao banco" items={favorable} probabilities={probabilities} />
        <LegendGroup title="Condenação" items={condemnation} probabilities={probabilities} />
      </div>

      {cohortSize !== null && (
        <p className="card__foot">Coorte de {cohortSize.toLocaleString('pt-BR')} processos semelhantes</p>
      )}
    </section>
  );
}

function LegendGroup({ title, items, probabilities }: { title: string; items: Outcome[]; probabilities: OutcomeProbabilities }) {
  return (
    <div className="legend-group">
      <span className="legend-group__title">{title}</span>
      {items.map((o) => (
        <span key={o.key} className="legend-group__item">
          <i className="swatch" style={{ background: `var(--viz-outcome-${o.slot})` }} />
          {o.label}
          <strong>{formatPercent(probabilities[o.key])}</strong>
        </span>
      ))}
    </div>
  );
}
