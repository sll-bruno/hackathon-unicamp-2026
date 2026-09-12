import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDeadlineSoon, useCases, useCasesSummary } from '../../api/cases';
import { RecommendationTag, StatusBadge } from '../../components/Badges/Badges';
import { ButtonLink } from '../../components/Button/Button';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { StatCard } from '../../components/StatCard/StatCard';
import { daysUntil, formatBRL, formatDate } from '../../lib/format';
import type { CaseListItem, CaseStatus } from '../../types/case';
import { STATUS_LABEL, THESIS_LABEL } from '../../types/labels';
import styles from './CasesList.module.css';

type RecFilter = 'TODAS' | 'ACORDO' | 'DEFESA' | 'SEM';

const byDeadline = (a: CaseListItem, b: CaseListItem) => {
  if (a.deadline_at === b.deadline_at) return 0;
  if (a.deadline_at === null) return 1;
  if (b.deadline_at === null) return -1;
  return a.deadline_at.localeCompare(b.deadline_at);
};

function Deadline({ item }: { item: CaseListItem }) {
  if (!item.deadline_at) return <span className={styles.muted}>—</span>;
  const days = daysUntil(item.deadline_at);
  const open = item.status !== 'ENCERRADO';
  const tone = open && days < 0 ? styles.overdue : isDeadlineSoon(item) ? styles.soon : '';
  const relative = days < 0 ? `vencido há ${-days} d` : days === 0 ? 'hoje' : `em ${days} d`;
  return (
    <span className={`${styles.deadline} ${tone}`}>
      {formatDate(item.deadline_at)}
      {open && <small>{relative}</small>}
    </span>
  );
}

export default function CasesList() {
  const navigate = useNavigate();
  const cases = useCases();
  const summary = useCasesSummary();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CaseStatus | 'TODOS'>('TODOS');
  const [rec, setRec] = useState<RecFilter>('TODAS');
  const [onlySoon, setOnlySoon] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const rows = useMemo(() => {
    const digits = query.replace(/\D/g, '');
    return (cases.data ?? [])
      .filter((c) => showClosed || status === 'ENCERRADO' || c.status !== 'ENCERRADO')
      .filter((c) => !digits || c.cnj.replace(/\D/g, '').includes(digits))
      .filter((c) => status === 'TODOS' || c.status === status)
      .filter((c) => {
        if (rec === 'TODAS') return true;
        if (rec === 'SEM') return c.recommendation === null;
        return c.recommendation?.action === rec;
      })
      .filter((c) => !onlySoon || isDeadlineSoon(c))
      .sort(byDeadline);
  }, [cases.data, query, status, rec, onlySoon, showClosed]);

  const s = summary.data;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Meus processos"
        description="Casos de não reconhecimento de contratação de empréstimo."
        actions={<ButtonLink to="/processos/novo">Novo processo</ButtonLink>}
      />

      <section className={styles.stats} aria-label="Resumo">
        <StatCard label="Em aberto" value={s?.open} />
        <StatCard label="Aguardando decisão" value={s?.awaiting_decision} accent />
        <StatCard label="Em análise" value={s?.in_analysis} />
        <StatCard label="Prazo ≤ 5 dias" value={s?.deadline_soon} />
      </section>

      <section className={styles.filters} aria-label="Filtros">
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por número CNJ"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as CaseStatus | 'TODOS')} aria-label="Status">
          <option value="TODOS">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        <select className={styles.select} value={rec} onChange={(e) => setRec(e.target.value as RecFilter)} aria-label="Recomendação">
          <option value="TODAS">Todas as recomendações</option>
          <option value="ACORDO">Acordo</option>
          <option value="DEFESA">Defesa</option>
          <option value="SEM">Sem recomendação</option>
        </select>
        <label className={`${styles.toggle} ${onlySoon ? styles.toggleOn : ''}`}>
          <input type="checkbox" checked={onlySoon} onChange={(e) => setOnlySoon(e.target.checked)} />
          Prazo ≤ 5 dias
        </label>
        <label className={`${styles.toggle} ${showClosed ? styles.toggleOn : ''}`}>
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Mostrar encerrados
        </label>
      </section>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Processo (CNJ)</th>
              <th>UF</th>
              <th>Tese</th>
              <th className={styles.num}>Valor da causa</th>
              <th>Status</th>
              <th>Recomendação</th>
              <th>Prazo</th>
              <th>Escritório</th>
            </tr>
          </thead>
          <tbody>
            {cases.isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  <td colSpan={8}>
                    <span className={styles.skeleton} />
                  </td>
                </tr>
              ))}
            {cases.isError && (
              <tr>
                <td colSpan={8} className={styles.message}>
                  Não foi possível carregar os processos. {cases.error.message}
                </td>
              </tr>
            )}
            {cases.isSuccess && rows.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.message}>
                  Nenhum processo com esses filtros.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr
                key={c.id}
                className={styles.row}
                tabIndex={0}
                onClick={() => navigate(`/processos/${c.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/processos/${c.id}`)}
              >
                <td className={styles.cnj}>{c.cnj}</td>
                <td>{c.uf}</td>
                <td>{THESIS_LABEL[c.thesis]}</td>
                <td className={styles.num}>{formatBRL(c.claim_value)}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>
                  <RecommendationTag recommendation={c.recommendation} />
                </td>
                <td>
                  <Deadline item={c} />
                </td>
                <td className={styles.muted}>{c.office}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cases.isSuccess && (
        <p className={styles.count}>
          {rows.length} de {cases.data.length} processos
        </p>
      )}
    </div>
  );
}
