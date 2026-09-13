import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCases, useCasesSummary } from '../../api/cases';
import { RecommendationTag, StatusBadge } from '../../components/Badges/Badges';
import { ButtonLink } from '../../components/Button/Button';
import { HotTopics, type HotTopicItem } from '../../components/HotTopics/HotTopics';
import { KpiRow } from '../../components/KpiRow/KpiRow';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { WelcomeBanner } from '../../components/WelcomeBanner/WelcomeBanner';
import { formatBRL } from '../../lib/format';
import { pendencyRank } from '../../lib/pendencies';
import { toDisplayStatus, type DisplayStatus } from '../../lib/status';
import type { CaseListItem } from '../../types/case';
import { STATUS_LABEL, THESIS_LABEL } from '../../types/labels';
import styles from './CasesList.module.css';

type RecFilter = 'TODAS' | 'ACORDO' | 'DEFESA' | 'SEM';
// Status que fazem sentido filtrar aqui — Encerrado já tem tela própria (Histórico).
const FILTERABLE_STATUS: Exclude<DisplayStatus, 'ENCERRADO'>[] = [
  'RASCUNHO',
  'DOCUMENTOS_ENVIADOS',
  'EM_ANALISE',
  'AGUARDANDO_DECISAO',
  'AGUARDANDO_ENCERRAMENTO',
];

const VISIBLE_ROWS = 5;

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// O que precisa de ação do advogado sobe para o topo da fila.
const byUrgency = (a: CaseListItem, b: CaseListItem) => pendencyRank(a) - pendencyRank(b);

function CaseRow({ item }: { item: CaseListItem }) {
  const navigate = useNavigate();
  const go = () => navigate(`/processos/${item.id}`);
  return (
    <tr className={styles.row} tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}>
      <td>
        <span className={styles.plaintiff}>
          {item.plaintiff_name}
          {item.alert && (
            <span className={styles.alertMark} title={item.alert.message} aria-label="Documento com erro de leitura">
              !
            </span>
          )}
        </span>
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
    </tr>
  );
}

export default function CasesList() {
  const cases = useCases();
  const summary = useCasesSummary();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DisplayStatus | 'TODOS'>('TODOS');
  const [rec, setRec] = useState<RecFilter>('TODAS');
  const [onlyAlert, setOnlyAlert] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Estado dos hot-topics, que também funcionam como atalho de filtro.
  const isDecisao = status === 'AGUARDANDO_DECISAO' && !onlyAlert;
  const isEncerramento = status === 'AGUARDANDO_ENCERRAMENTO' && !onlyAlert;

  const resetFiltros = () => {
    setStatus('TODOS');
    setOnlyAlert(false);
    setExpanded(false);
  };
  const toggleQuickStatus = (target: DisplayStatus, active: boolean) => {
    if (active) return resetFiltros();
    setStatus(target);
    setOnlyAlert(false);
    setExpanded(false);
  };
  const toggleAlert = () => {
    if (onlyAlert) return resetFiltros();
    setOnlyAlert(true);
    setStatus('TODOS');
    setExpanded(false);
  };

  const rows = useMemo(() => {
    const digits = query.replace(/\D/g, '');
    const text = normalize(query.trim());
    return (cases.data ?? [])
      .filter((c) => c.status !== 'ENCERRADO') // encerrados ficam só no Histórico
      .filter((c) => {
        if (!text) return true;
        if (digits && c.cnj.replace(/\D/g, '').includes(digits)) return true;
        return normalize(c.plaintiff_name).includes(text);
      })
      .filter((c) => status === 'TODOS' || toDisplayStatus(c.status) === status)
      .filter((c) => {
        if (rec === 'TODAS') return true;
        if (rec === 'SEM') return c.recommendation === null;
        return c.recommendation?.action === rec;
      })
      .filter((c) => !onlyAlert || c.alert !== null)
      .sort(byUrgency);
  }, [cases.data, query, status, rec, onlyAlert]);

  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  const hiddenCount = rows.length - visibleRows.length;

  const s = summary.data;

  const hotTopics: HotTopicItem[] = [
    {
      key: 'alert',
      label: 'Erro de leitura',
      value: s?.document_errors,
      tone: 'negative',
      icon: '!',
      active: onlyAlert,
      onClick: toggleAlert,
    },
    {
      key: 'decisao',
      label: 'Revisar recomendação',
      value: s?.awaiting_decision,
      tone: 'accent',
      icon: '?',
      active: isDecisao,
      onClick: () => toggleQuickStatus('AGUARDANDO_DECISAO', isDecisao),
    },
    {
      key: 'desfecho',
      label: 'Falta desfecho',
      value: s?.pending_outcome,
      tone: 'muted',
      icon: '⚑',
      active: isEncerramento,
      onClick: () => toggleQuickStatus('AGUARDANDO_ENCERRAMENTO', isEncerramento),
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <WelcomeBanner />
        <div className={styles.heroRow}>
          <KpiRow
            openValueSum={s?.open_value_sum}
            newThisMonth={s?.new_this_month}
            adherencePercent={s?.adherence_percent}
            effectivenessPercent={s?.effectiveness_percent}
          />
          <div className={styles.divider} aria-hidden />
          <HotTopics items={hotTopics} />
        </div>
      </section>

      <PageHeader
        title="Meus processos"
        description={
          s
            ? `${s.open} processos em aberto · ${s.in_analysis} em análise no momento.`
            : 'Casos de não reconhecimento de contratação de empréstimo.'
        }
        actions={<ButtonLink to="/processos/novo">Novo processo</ButtonLink>}
      />

      <section className={styles.filters} aria-label="Filtros">
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por autor ou número CNJ"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpanded(false);
          }}
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as DisplayStatus | 'TODOS');
            setExpanded(false);
          }}
          aria-label="Status"
        >
          <option value="TODOS">Todos os status</option>
          {FILTERABLE_STATUS.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={rec}
          onChange={(e) => {
            setRec(e.target.value as RecFilter);
            setExpanded(false);
          }}
          aria-label="Recomendação"
        >
          <option value="TODAS">Todas as recomendações</option>
          <option value="ACORDO">Acordo</option>
          <option value="DEFESA">Defesa</option>
          <option value="SEM">Sem recomendação</option>
        </select>
      </section>

      {cases.isPending && <p className={styles.message}>Carregando processos…</p>}
      {cases.isError && <p className={styles.message}>Não foi possível carregar os processos. {cases.error.message}</p>}
      {cases.isSuccess && rows.length === 0 && <p className={styles.message}>Nenhum processo com esses filtros.</p>}

      {cases.isSuccess && rows.length > 0 && (
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
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((c) => (
                <CaseRow key={c.id} item={c} />
              ))}
            </tbody>
          </table>
          {hiddenCount > 0 && (
            <button type="button" className={styles.expandRow} onClick={() => setExpanded(true)}>
              Mostrar mais {hiddenCount} processo{hiddenCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}

      {cases.isSuccess && (
        <p className={styles.count}>
          {rows.length} de {cases.data.filter((c) => c.status !== 'ENCERRADO').length} processos em aberto
        </p>
      )}
    </div>
  );
}
