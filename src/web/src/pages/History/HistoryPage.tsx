import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistoricalCases } from '../../api/history';
import { MacroResultBadge, OutcomeBadge, RecommendationTag } from '../../components/Badges/Badges';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { formatBRLWithCents, formatDate } from '../../lib/format';
import type { HistoricalCase, HistoricalMacroResult, HistoricalOutcome } from '../../types/history';
import styles from './HistoryPage.module.css';

type MacroFilter = HistoricalMacroResult | 'TODOS';
type OutcomeFilter = HistoricalOutcome | 'TODOS';

const PAGE_SIZE = 8;

const OUTCOME_OPTIONS: { value: HistoricalOutcome; label: string }[] = [
  { value: 'IMPROCEDENCIA', label: 'Improcedência' },
  { value: 'EXTINCAO', label: 'Extinção' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'PROCEDENCIA', label: 'Procedência' },
  { value: 'ACORDO', label: 'Acordo' },
];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function matchesQuery(item: HistoricalCase, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const digits = trimmed.replace(/\D/g, '');
  if (digits && item.cnj.replace(/\D/g, '').includes(digits)) return true;

  const text = normalize(trimmed);
  return [item.plaintiff_name, item.subject, item.subtopic, item.uf]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalize(value).includes(text));
}

function HistoryRow({ item }: { item: HistoricalCase }) {
  return (
    <tr className={styles.row}>
      <td className={styles.processCell}>
        {item.operational_case_id ? (
          <Link
            className={styles.processLink}
            to={`/processos/${item.operational_case_id}`}
            aria-label={`Abrir processo de ${item.plaintiff_name ?? item.cnj}`}
          >
            <span className={styles.plaintiff}>{item.plaintiff_name ?? 'Parte não informada'}</span>
            <span className={styles.cnj}>{item.cnj}</span>
          </Link>
        ) : (
          <div title="Registro disponível somente na base histórica">
            <span className={styles.plaintiff}>{item.plaintiff_name ?? 'Parte não informada'}</span>
            <span className={styles.cnj}>{item.cnj}</span>
          </div>
        )}
      </td>
      <td>{item.uf}</td>
      <td>{item.subject}</td>
      <td>{item.subtopic}</td>
      <td>
        <MacroResultBadge result={item.macro_result} />
      </td>
      <td>
        <OutcomeBadge outcome={item.outcome} />
      </td>
      <td className={styles.num}>{formatBRLWithCents(item.claim_value)}</td>
      <td className={styles.num}>{formatBRLWithCents(item.award_value)}</td>
      <td>
        <RecommendationTag recommendation={item.recommendation} />
      </td>
      <td className={styles.date}>{item.closed_at ? formatDate(item.closed_at) : '—'}</td>
    </tr>
  );
}

export default function HistoryPage() {
  const history = useHistoricalCases();
  const [query, setQuery] = useState('');
  const [macro, setMacro] = useState<MacroFilter>('TODOS');
  const [outcome, setOutcome] = useState<OutcomeFilter>('TODOS');
  const [uf, setUf] = useState('TODAS');
  const [page, setPage] = useState(1);

  const items = history.data?.items ?? [];
  const ufs = useMemo(() => [...new Set(items.map((item) => item.uf))].sort(), [items]);
  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesQuery(item, query) &&
          (macro === 'TODOS' || item.macro_result === macro) &&
          (outcome === 'TODOS' || item.outcome === outcome) &&
          (uf === 'TODAS' || item.uf === uf),
      ),
    [items, macro, outcome, query, uf],
  );

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);

  const setFirstPage = () => setPage(1);
  const resetFilters = () => {
    setQuery('');
    setMacro('TODOS');
    setOutcome('TODOS');
    setUf('TODAS');
    setFirstPage();
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Histórico de processos"
        description={
          history.data
            ? `${history.data.total} processos encerrados carregados para consulta.`
            : 'Consulte processos encerrados e seus resultados.'
        }
      />

      <section className={styles.filters} aria-label="Filtros do histórico">
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por CNJ, parte, assunto ou UF"
          aria-label="Buscar no histórico"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setFirstPage();
          }}
        />

        <div className={styles.segmented} role="group" aria-label="Resultado macro">
          {([
            ['TODOS', 'Todos'],
            ['EXITO', 'Êxito'],
            ['NAO_EXITO', 'Não êxito'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.segment} ${macro === value ? styles.segmentActive : ''}`}
              aria-pressed={macro === value}
              onClick={() => {
                setMacro(value);
                setFirstPage();
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          className={styles.select}
          value={outcome}
          aria-label="Resultado micro ou desfecho"
          onChange={(event) => {
            setOutcome(event.target.value as OutcomeFilter);
            setFirstPage();
          }}
        >
          <option value="TODOS">Todos os desfechos</option>
          {OUTCOME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={uf}
          aria-label="Unidade federativa"
          onChange={(event) => {
            setUf(event.target.value);
            setFirstPage();
          }}
        >
          <option value="TODAS">Todas as UFs</option>
          {ufs.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </section>

      {history.isPending && (
        <div className={styles.message} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden />
          Carregando histórico…
        </div>
      )}

      {history.isError && (
        <div className={styles.message} role="alert">
          <p>Não foi possível carregar o histórico.</p>
          <button type="button" className={styles.secondaryButton} onClick={() => history.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {history.isSuccess && items.length === 0 && (
        <div className={styles.message}>
          <p>Nenhum processo encerrado disponível no histórico.</p>
        </div>
      )}

      {history.isSuccess && items.length > 0 && filteredItems.length === 0 && (
        <div className={styles.message}>
          <p>Nenhum processo corresponde aos filtros selecionados.</p>
          <button type="button" className={styles.secondaryButton} onClick={resetFilters}>
            Limpar filtros
          </button>
        </div>
      )}

      {history.isSuccess && pageItems.length > 0 && (
        <>
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabela de processos históricos">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Processo</th>
                  <th scope="col">UF</th>
                  <th scope="col">Assunto</th>
                  <th scope="col">Tese / subassunto</th>
                  <th scope="col">Resultado macro</th>
                  <th scope="col">Desfecho</th>
                  <th scope="col" className={styles.num}>Valor da causa</th>
                  <th scope="col" className={styles.num}>Condenação / indenização</th>
                  <th scope="col">Recomendação</th>
                  <th scope="col">Encerramento</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <HistoryRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          <footer className={styles.tableFooter}>
            <p className={styles.count} aria-live="polite">
              Exibindo {pageStart + 1}–{pageStart + pageItems.length} de {filteredItems.length}
              {filteredItems.length !== items.length ? ` resultados (${items.length} carregados)` : ' registros carregados'}
            </p>
            {pageCount > 1 && (
              <nav className={styles.pagination} aria-label="Paginação do histórico">
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Anterior
                </button>
                <span>
                  Página {currentPage} de {pageCount}
                </span>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={currentPage === pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  Próxima
                </button>
              </nav>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
