import { useNavigate } from 'react-router-dom';
import type { PendencyItem, PendencyKind } from '../../lib/pendencies';
import styles from './PendencyFeed.module.css';

const KIND_LABEL: Record<PendencyKind, string> = {
  ALERTA: 'Documento com erro',
  DECISAO: 'Revisar recomendação',
  PRAZO: 'Prazo apertado',
  DESFECHO: 'Falta registrar desfecho',
};

// Cores reaproveitadas dos tokens de status do produto (não vêm da Enter).
const KIND_COLOR: Record<PendencyKind, { color: string; bg: string }> = {
  ALERTA: { color: 'var(--status-negative)', bg: 'var(--status-negative-bg)' },
  PRAZO: { color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  DECISAO: { color: 'var(--accent)', bg: 'var(--accent-soft)' },
  DESFECHO: { color: 'var(--status-positive)', bg: 'var(--status-positive-bg)' },
};

export function PendencyFeed({ items }: { items: PendencyItem[] }) {
  const navigate = useNavigate();

  return (
    <section className={styles.panel} aria-label="Pendências">
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>O que precisa da sua atenção</h2>
          <p className={styles.subtitle}>Casos ordenados pelo que é mais urgente resolver agora.</p>
        </div>
      </div>
      {items.length === 0 && <p className={styles.empty}>Nenhuma pendência no momento — tudo em dia.</p>}
      {items.length > 0 && (
        <div className={styles.list}>
          {items.map(({ key, kind, item, badge }) => {
            const colors = KIND_COLOR[kind];
            return (
              <button
                key={key}
                type="button"
                className={styles.row}
                style={{ '--kind-color': colors.color, '--kind-color-bg': colors.bg } as React.CSSProperties}
                onClick={() => navigate(`/processos/${item.id}`)}
              >
                <span className={styles.bar} aria-hidden />
                <span className={styles.body}>
                  <span className={styles.kindLabel}>{KIND_LABEL[kind]}</span>
                  <span className={styles.plaintiff}>{item.plaintiff_name}</span>
                  <span className={styles.cnj}>{item.cnj}</span>
                </span>
                <span className={styles.badge}>{badge}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
