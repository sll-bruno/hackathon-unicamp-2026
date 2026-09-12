import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDeadlineSoon, useCases, useCasesSummary } from '../../api/cases';
import { RecommendationTag, StatusBadge } from '../../components/Badges/Badges';
import { ButtonLink } from '../../components/Button/Button';
import { CaseCard } from '../../components/CaseCard/CaseCard';
import { Deadline } from '../../components/Deadline/Deadline';
import { GroupHeader } from '../../components/GroupHeader/GroupHeader';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { StatCard } from '../../components/StatCard/StatCard';
import { formatBRL } from '../../lib/format';
import { DEFAULT_EXPANDED, groupByUrgency, type UrgencyKey } from '../../lib/urgency';
import type { CaseListItem, CaseStatus } from '../../types/case';
import { STATUS_LABEL, THESIS_LABEL } from '../../types/labels';
import styles from './CasesList.module.css';

type RecFilter = 'TODAS' | 'ACORDO' | 'DEFESA' | 'SEM';
type ViewMode = 'tabela' | 'cartoes';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const byDeadline = (a: CaseListItem, b: CaseListItem) => {
  if (a.deadline_at === b.deadline_at) return 0;
  if (a.deadline_at === null) return 1;
  if (b.deadline_at === null) return -1;
  return a.deadline_at.localeCompare(b.deadline_at);
};

function CaseRow({ item }: { item: CaseListItem }) {
  const navigate = useNavigate();
  const go = () => navigate(`/processos/${item.id}`);
  return (
    <tr className={styles.row} tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}>
      <td>
        <span className={styles.plaintiff}>{item.plaintiff_name}</span>
        <span className={styles.cnj}>{item.cnj}</span>
      </td>
      <td>{item.uf}</td>
      <td>{THESIS_LABEL[item.thesis]}</td>
      <td className={styles.num}>{formatBRL(item.claim_value)}</td>
      <td>
        <StatusBadge status={item.status} />
      </td>
      <td>
        <RecommendationTag recommendation={item.recommendation} />
      </td>
      <td>
        <Deadline item={item} />
      </td>
    </tr>
  );
}

export default function CasesList() {
  const cases = useCases();
  const summary = useCasesSummary();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CaseStatus | 'TODOS'>('TODOS');
  const [rec, setRec] = useState<RecFilter>('TODAS');
  const [onlySoon, setOnlySoon] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [view, setView] = useState<ViewMode>('tabela');
  const [expanded, setExpanded] = useState(DEFAULT_EXPANDED);

  // Estado dos cards de resumo, que também funcionam como atalho de filtro.
  const isAberto = status === 'TODOS' && !onlySoon && !showClosed;
  const isDecisao = status === 'AGUARDANDO_DECISAO' && !onlySoon;
  const isAnalise = status === 'EM_ANALISE' && !onlySoon;

  const resetToAberto = () => {
    setStatus('TODOS');
    setOnlySoon(false);
    setShowClosed(false);
  };
  const toggleQuickStatus = (target: CaseStatus, active: boolean) => {
    if (active) return resetToAberto();
    setStatus(target);
    setOnlySoon(false);
    setShowClosed(false);
  };
  const toggleSoon = () => {
    if (onlySoon) return resetToAberto();
    setOnlySoon(true);
    setStatus('TODOS');
    setShowClosed(false);
  };
  const toggleGroup = (key: UrgencyKey) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const rows = useMemo(() => {
    const digits = query.replace(/\D/g, '');
    const text = normalize(query.trim());
    return (cases.data ?? [])
      .filter((c) => showClosed || status === 'ENCERRADO' || c.status !== 'ENCERRADO')
      .filter((c) => {
        if (!text) return true;
        if (digits && c.cnj.replace(/\D/g, '').includes(digits)) return true;
        return normalize(c.plaintiff_name).includes(text);
      })
      .filter((c) => status === 'TODOS' || c.status === status)
      .filter((c) => {
        if (rec === 'TODAS') return true;
        if (rec === 'SEM') return c.recommendation === null;
        return c.recommendation?.action === rec;
      })
      .filter((c) => !onlySoon || isDeadlineSoon(c))
      .sort(byDeadline);
  }, [cases.data, query, status, rec, onlySoon, showClosed]);

  const groups = useMemo(() => groupByUrgency(rows), [rows]);

  const s = summary.data;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Meus processos"
        description="Casos de não reconhecimento de contratação de empréstimo."
        actions={<ButtonLink to="/processos/novo">Novo processo</ButtonLink>}
      />

      <section className={styles.stats} aria-label="Resumo e filtros rápidos">
        <StatCard label="Em aberto" value={s?.open} active={isAberto} onClick={resetToAberto} />
        <StatCard
          label="Aguardando decisão"
          value={s?.awaiting_decision}
          accent
          active={isDecisao}
          onClick={() => toggleQuickStatus('AGUARDANDO_DECISAO', isDecisao)}
        />
        <StatCard label="Em análise" value={s?.in_analysis} active={isAnalise} onClick={() => toggleQuickStatus('EM_ANALISE', isAnalise)} />
        <StatCard label="Prazo ≤ 5 dias" value={s?.deadline_soon} active={onlySoon} onClick={toggleSoon} />
      </section>

      <section className={styles.filters} aria-label="Filtros">
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por autor ou número CNJ"
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
        <label className={`${styles.toggle} ${showClosed ? styles.toggleOn : ''}`}>
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Mostrar encerrados
        </label>
        <div className={styles.viewSwitch} role="group" aria-label="Formato de visualização">
          <button type="button" className={view === 'tabela' ? styles.viewOn : ''} onClick={() => setView('tabela')}>
            Tabela
          </button>
          <button type="button" className={view === 'cartoes' ? styles.viewOn : ''} onClick={() => setView('cartoes')}>
            Cartões
          </button>
        </div>
      </section>

      {cases.isPending && <p className={styles.message}>Carregando processos…</p>}
      {cases.isError && (
        <p className={styles.message}>Não foi possível carregar os processos. {cases.error.message}</p>
      )}
      {cases.isSuccess && rows.length === 0 && <p className={styles.message}>Nenhum processo com esses filtros.</p>}

      {cases.isSuccess && rows.length > 0 && view === 'tabela' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Processo</th>
                <th>UF</th>
                <th>Tese</th>
                <th className={styles.num}>Valor da causa</th>
                <th>Status</th>
                <th>Recomendação</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <tr className={styles.groupRow}>
                    <td colSpan={7}>
                      <GroupHeader label={g.label} count={g.items.length} expanded={expanded[g.key]} onToggle={() => toggleGroup(g.key)} />
                    </td>
                  </tr>
                  {expanded[g.key] && g.items.map((c) => <CaseRow key={c.id} item={c} />)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cases.isSuccess && rows.length > 0 && view === 'cartoes' && (
        <div className={styles.groups}>
          {groups.map((g) => (
            <section key={g.key}>
              <GroupHeader label={g.label} count={g.items.length} expanded={expanded[g.key]} onToggle={() => toggleGroup(g.key)} />
              {expanded[g.key] && (
                <div className={styles.grid}>
                  {g.items.map((c) => (
                    <CaseCard key={c.id} item={c} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {cases.isSuccess && (
        <p className={styles.count}>
          {rows.length} de {cases.data.length} processos
        </p>
      )}
    </div>
  );
}
