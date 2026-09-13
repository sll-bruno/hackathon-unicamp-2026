import { useEffect, useRef, useState } from 'react';
import { submitDecision } from '../api/workspace';
import type { CaseStatus, Recommendation, Workspace } from '../types/workspace';
import { formatBRL, reasonCodeLabel } from '../pages/Workspace/format';

interface Props {
  recommendation: Recommendation;
  caseInfo: Workspace['case'];
  decision: Workspace['decision'];
  onChanged: () => void;
}

/** Cartão de decisão da Tela 3: ação recomendada, confiança e a decisão do advogado. */
export function RecommendationCard({ recommendation: rec, caseInfo: c, decision, onChanged }: Props) {
  return (
    <section className="card rec-card" aria-labelledby="rec-title">
      <header className="card__header">
        <span className="eyebrow">Recomendação da política</span>
        <DecisionControl
          caseId={c.case_id}
          status={c.status}
          recommendationAction={rec.action}
          decision={decision}
          onChanged={onChanged}
        />
      </header>

      <div className="rec-card__body">
        <div className="rec-card__action">
          <h2 id="rec-title" className="rec-card__action-title">
            {rec.action === 'ACORDO' ? 'Acordo' : 'Defesa'}
          </h2>
          <p className="rec-card__reason">{rec.reason}</p>
          {rec.reason_codes.length > 0 && (
            <ul className="chip-list" aria-label="Marcadores da recomendação">
              {rec.reason_codes.map((code) => (
                <li key={code} className="chip chip--warning">
                  <span aria-hidden="true">!</span>
                  {reasonCodeLabel[code] ?? code}
                </li>
              ))}
            </ul>
          )}
        </div>

        <ConfidenceMeter
          value={rec.confidence_percent}
          method={rec.confidence_method_version}
          nullReason={rec.confidence_null_reason}
        />
      </div>

      <footer className="rec-card__meta">
        {c.plaintiff && <span className="rec-card__meta-name">{c.plaintiff}</span>}
        <span>{c.cnj}</span>
        {c.court && <span>{c.court}</span>}
        <span>{c.thesis}</span>
        {c.contract_number && <span>Contrato {c.contract_number}</span>}
        <span>{formatBRL(c.claim_value)}</span>
      </footer>
    </section>
  );
}

function ConfidenceMeter({ value, method, nullReason }: { value: number | null; method: string | null; nullReason?: string }) {
  if (value === null) {
    return (
      <div className="confidence">
        <span className="eyebrow">Confiança</span>
        <p className="confidence__value confidence__value--empty">Não calculável</p>
        <p className="confidence__meta">{nullReason ?? 'O método de confiança ainda não retornou um valor.'}</p>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="confidence">
      <span className="eyebrow" id="confidence-label">Confiança</span>
      <p className="confidence__value">
        {Math.round(clamped)}
        <span>%</span>
      </p>
      <div
        className="meter"
        role="meter"
        aria-labelledby="confidence-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <div className="meter__fill" style={{ width: `${clamped}%` }} />
      </div>
      {method && <p className="confidence__meta">Método {method}</p>}
    </div>
  );
}

function DecisionControl({
  caseId,
  status,
  recommendationAction,
  decision,
  onChanged,
}: {
  caseId: string;
  status: CaseStatus;
  recommendationAction: 'ACORDO' | 'DEFESA';
  decision: Workspace['decision'];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [diverging, setDiverging] = useState(false);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const save = async (action: 'ACORDO' | 'DEFESA', divergenceDetails?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await submitDecision(caseId, action, divergenceDetails);
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  if (status !== 'AGUARDANDO_DECISAO') {
    const label = decision
      ? decision.adhered ? 'Recomendação seguida' : 'Divergência registrada'
      : status === 'ENCERRADO' ? 'Processo encerrado' : 'Decisão registrada';
    return <span className="decision-control__resolved">{label}</span>;
  }

  const oppositeAction = recommendationAction === 'ACORDO' ? 'DEFESA' : 'ACORDO';

  return (
    <div className="decision-control" ref={ref}>
      <button
        type="button"
        className="decision-control__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Avaliar recomendação
        <svg viewBox="0 0 10 6" aria-hidden="true" className="decision-control__chevron">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="decision-control__menu" role="listbox">
          <li>
            <button
              type="button"
              role="option"
              aria-selected="false"
              className="decision-control__option decision-control__option--accept"
              disabled={submitting}
              onClick={() => void save(recommendationAction)}
            >
              Seguir recomendação ({recommendationAction === 'ACORDO' ? 'Acordo' : 'Defesa'})
            </button>
          </li>
          <li>
            <button
              type="button"
              role="option"
              aria-selected="false"
              className="decision-control__option decision-control__option--reject"
              disabled={submitting}
              onClick={() => setDiverging(true)}
            >
              Divergir para {oppositeAction === 'ACORDO' ? 'Acordo' : 'Defesa'}
            </button>
          </li>
          {diverging && (
            <li className="decision-control__menu-divider">
              <form
                className="decision-control__divergence"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (details.trim()) void save(oppositeAction, details.trim());
                }}
              >
                <label htmlFor="divergence-details">Motivo da divergência</label>
                <textarea
                  id="divergence-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Explique o fato novo ou ajuste necessário"
                  required
                />
                <button type="submit" disabled={submitting || !details.trim()}>
                  {submitting ? 'Registrando…' : 'Confirmar divergência'}
                </button>
              </form>
            </li>
          )}
          {error && <li className="decision-control__error" role="alert">{error}</li>}
        </ul>
      )}
    </div>
  );
}
