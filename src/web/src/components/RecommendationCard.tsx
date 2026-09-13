import { useEffect, useRef, useState } from 'react';
import type { CaseStatus, Recommendation, Workspace } from '../types/workspace';
import { formatBRL, reasonCodeLabel } from '../pages/Workspace/format';

interface Props {
  recommendation: Recommendation;
  caseInfo: Workspace['case'];
}

/** Cartão de decisão da Tela 3: ação recomendada, confiança e a decisão do advogado. */
export function RecommendationCard({ recommendation: rec, caseInfo: c }: Props) {
  return (
    <section className="card rec-card" aria-labelledby="rec-title">
      <header className="card__header">
        <span className="eyebrow">Recomendação da política</span>
        <DecisionControl status={c.status} />
      </header>

      <div className="rec-card__body">
        <div className="rec-card__action">
          <h2 id="rec-title" className="rec-card__action-title">
            {rec.action === 'ACORDO' ? 'Acordo' : 'Defesa'}
          </h2>
          <p className="rec-card__reason">{rec.reason}</p>
          {rec.reason_codes.length > 0 && (
            <ul className="chip-list" aria-label="Alertas da recomendação">
              {rec.reason_codes.map((code) => (
                <li key={code} className="chip chip--warning">
                  <span aria-hidden="true">!</span> {reasonCodeLabel[code] ?? code}
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
        <span className="rec-card__meta-name">{c.plaintiff}</span>
        <span>{c.cnj}</span>
        <span>{c.court}</span>
        <span>{c.thesis}</span>
        <span>Contrato {c.contract_number}</span>
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

type Decision = 'pending' | 'accepted' | 'rejected';

function decisionFromStatus(status: CaseStatus): Decision {
  if (status === 'PROPOSTA_ACEITA') return 'accepted';
  if (status === 'DIVERGIU') return 'rejected';
  return 'pending';
}

const decisionLabel: Record<Decision, string> = {
  pending: 'Avaliar recomendação',
  accepted: 'Proposta aceita',
  rejected: 'Recomendação recusada',
};

/**
 * Substitui a antiga etiqueta de status por um controle: o advogado abre e
 * escolhe aceitar ou recusar a recomendação. Só muda o estado local — o
 * registro de verdade (`POST /cases/{id}/decision`) fica com o backend.
 */
function DecisionControl({ status }: { status: CaseStatus }) {
  const [decision, setDecision] = useState<Decision>(() => decisionFromStatus(status));
  const [open, setOpen] = useState(false);
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

  const choose = (next: Decision) => {
    setDecision(next);
    setOpen(false);
  };

  return (
    <div className="decision-control" ref={ref}>
      <button
        type="button"
        className="decision-control__button"
        data-decision={decision}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {decisionLabel[decision]}
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
              aria-selected={decision === 'accepted'}
              className="decision-control__option decision-control__option--accept"
              onClick={() => choose('accepted')}
            >
              Aceitar recomendação
            </button>
          </li>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={decision === 'rejected'}
              className="decision-control__option decision-control__option--reject"
              onClick={() => choose('rejected')}
            >
              Recusar recomendação
            </button>
          </li>
          {decision !== 'pending' && (
            <li className="decision-control__menu-divider">
              <button type="button" className="decision-control__option decision-control__option--undo" onClick={() => choose('pending')}>
                Desfazer decisão
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
