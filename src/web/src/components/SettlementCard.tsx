import type { Recommendation } from '../types/workspace';
import { formatBRL } from '../pages/Workspace/format';

/** Faixa de acordo (abertura, alvo, teto) comparada ao custo da defesa do banco. */
export function SettlementCard({ recommendation: rec }: { recommendation: Recommendation }) {
  const isAgreement = rec.action === 'ACORDO';
  const { opening, target, ceiling } = rec.settlement_range;

  const markers = [
    { key: 'opening', label: 'Abertura', value: opening },
    { key: 'target', label: 'Alvo', value: target },
    { key: 'ceiling', label: 'Teto', value: ceiling },
  ];

  return (
    <section className="card settlement" aria-labelledby="settlement-title">
      <header className="card__header">
        <h2 id="settlement-title" className="card__title">
          Faixa de acordo
        </h2>
        {!isAgreement && <span className="card__hint">se houver negociação</span>}
      </header>
      <p className="card__subtitle">O quanto o banco pode oferecer, e como isso se compara a ir a julgamento.</p>

      <div className="range__values">
        {markers.map((m) => (
          <div key={m.key} className={`range__value range__value--${m.key}`}>
            <span>{m.label}</span>
            <strong>{formatBRL(m.value)}</strong>
          </div>
        ))}
      </div>

      <ComparisonBars ceilingValue={ceiling} defenseValue={rec.expected_defense_cost} />

      {rec.expected_savings > 0 ? (
        <p className="settlement__savings">Fechando no alvo, o banco economiza {formatBRL(rec.expected_savings)} em relação a defender</p>
      ) : (
        <p className="settlement__no-savings">No teto, o acordo não fica muito abaixo do custo de defender: pouco espaço para economizar</p>
      )}

      {rec.assumptions.length > 0 && (
        <details className="assumptions">
          <summary>Premissas do cálculo ({rec.assumptions.length})</summary>
          <ul>
            {rec.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * Compara o teto do acordo (o máximo que ainda compensa oferecer) com o custo
 * esperado de defender. Quanto menor a barra do teto em relação à da defesa,
 * maior a folga para negociar — é essa folga que explica a recomendação.
 */
function ComparisonBars({ ceilingValue, defenseValue }: { ceilingValue: number; defenseValue: number }) {
  const max = Math.max(ceilingValue, defenseValue) * 1.08;

  return (
    <div className="compare-bars">
      <div className="compare-bar">
        <span className="compare-bar__label">Teto do acordo</span>
        <div className="compare-bar__track">
          <div className="compare-bar__fill compare-bar__fill--agreement" style={{ width: `${(ceilingValue / max) * 100}%` }} />
        </div>
        <strong className="compare-bar__value">{formatBRL(ceilingValue)}</strong>
      </div>
      <div className="compare-bar">
        <span className="compare-bar__label">Defesa</span>
        <div className="compare-bar__track">
          <div className="compare-bar__fill compare-bar__fill--defense" style={{ width: `${(defenseValue / max) * 100}%` }} />
        </div>
        <strong className="compare-bar__value">{formatBRL(defenseValue)}</strong>
      </div>
    </div>
  );
}
