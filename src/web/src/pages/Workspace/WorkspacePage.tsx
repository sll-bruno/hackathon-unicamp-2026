import { useMemo, useState } from 'react';
import { sampleCaseIds, startAnalysis, useWorkspace } from '../../api/workspace';
import { ChatPanel } from '../../components/ChatPanel';
import { EvidenceCard, KindIcon, type Citation, type Evidence, type EvidenceKind } from '../../components/EvidenceCard';
import { RecommendationCard } from '../../components/RecommendationCard';
import { RiskCard } from '../../components/RiskCard';
import { SettlementCard } from '../../components/SettlementCard';
import { SourcePanel } from '../../components/SourcePanel';
import { WhatChangesCard } from '../../components/WhatChangesCard';
import type { Workspace } from '../../types/workspace';
import { formatDateTime } from './format';
import './workspace.css';

interface Props {
  caseId: string;
  onSelectSampleCase?: (caseId: string) => void;
  chatOpen?: boolean;
  onOpenChat?: () => void;
  onCloseChat?: () => void;
}

/** Tela 3 · Área de trabalho de um processo. */
export function WorkspacePage({ caseId, onSelectSampleCase, chatOpen = false, onOpenChat, onCloseChat }: Props) {
  const state = useWorkspace(caseId);

  if (state.status === 'loading') {
    return (
      <main className="ws ws--state" aria-busy="true">
        <p>Carregando a área de trabalho…</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="ws ws--state">
        <h1>Não foi possível abrir o processo</h1>
        <p>{state.message}</p>
      </main>
    );
  }

  return (
    <WorkspaceView
      key={caseId}
      data={state.data}
      isSample={state.isSample}
      onSelectSampleCase={onSelectSampleCase}
      chatOpen={chatOpen}
      onOpenChat={onOpenChat}
      onCloseChat={onCloseChat}
    />
  );
}

const tabs: { kind: EvidenceKind; title: string; hint: string }[] = [
  { kind: 'fato', title: 'Fatos', hint: 'Do maior para o menor peso' },
  { kind: 'contradicao', title: 'Contradições', hint: 'Trechos em conflito' },
  { kind: 'lacuna', title: 'Lacunas', hint: 'Informação ausente' },
];

function WorkspaceView({
  data,
  isSample,
  onSelectSampleCase,
  chatOpen,
  onOpenChat,
  onCloseChat,
}: {
  data: Workspace;
  isSample: boolean;
  onSelectSampleCase?: (caseId: string) => void;
  chatOpen: boolean;
  onOpenChat?: () => void;
  onCloseChat?: () => void;
}) {
  const [tab, setTab] = useState<EvidenceKind>('fato');
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const documents = useMemo(() => new Map(data.documents.map((d) => [d.document_id, d])), [data.documents]);

  const evidences = useMemo<Record<EvidenceKind, Evidence[]>>(
    () => ({
      fato: [...data.facts]
        .sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1))
        .map((item) => ({ kind: 'fato', item })),
      contradicao: data.contradictions.map((item) => ({ kind: 'contradicao', item })),
      lacuna: data.gaps.map((item) => ({ kind: 'lacuna', item })),
    }),
    [data],
  );

  if (!data.recommendation || !data.risk) {
    return <WorkspacePending data={data} isSample={isSample} />;
  }

  const { case: c, recommendation: rec } = data;

  return (
    <div className="ws-shell">
    <main className={`ws${chatOpen ? ' ws--split' : ''}`}>
      {isSample && (
        <div className="sample-banner" role="note">
          <span className="sample-banner__label">Dados de exemplo</span>
          <span className="sample-banner__text">Trechos reais dos PDFs; valores e confiança ilustrativos.</span>
          {onSelectSampleCase && (
            <div className="segmented" aria-label="Caso de exemplo">
              {sampleCaseIds.map((id) => (
                <button key={id} type="button" aria-pressed={id === c.case_id} onClick={() => onSelectSampleCase(id)}>
                  {id === 'caso-01' ? 'Caso 01' : id === 'caso-02' ? 'Caso 02' : id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="breadcrumb" aria-label="Navegação">
        <span>Meus processos</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Área de trabalho</span>
      </nav>

      <RecommendationCard recommendation={rec} caseInfo={c} />

      <section className="explain" aria-labelledby="explain-title">
        <header className="section-header">
          <h2 id="explain-title" className="section-title">
            Motivos da decisão
          </h2>
          {/* <p className="section-subtitle">Clique em um documento para ler o trecho citado.</p> */}
        </header>

        <div className="evidence-toolbar">
          <div className="evidence-tabs" aria-label="Tipo de evidência">
            {tabs.map((t) => (
              <button
                key={t.kind}
                type="button"
                className="evidence-tab"
                data-kind={t.kind}
                aria-pressed={tab === t.kind}
                onClick={() => setTab(t.kind)}
              >
                <span className="evidence-tab__count">{evidences[t.kind].length}</span>
                <span className="evidence-tab__label">
                  <KindIcon kind={t.kind} />
                  {t.title}
                </span>
                <span className="evidence-tab__hint">{t.hint}</span>
              </button>
            ))}
          </div>

          {onOpenChat && (
            <button type="button" className="chatbot-cta" onClick={onOpenChat}>
              <ChatIcon />
              Perguntar ao chatbot
            </button>
          )}
        </div>

        <div className="ws-body">
          <div className="evidence-column">
            {evidences[tab].length === 0 ? (
              <p className="evidence-empty">Nenhum item nesta categoria.</p>
            ) : (
              <div className="evidence-list">
                {evidences[tab].map((ev) => (
                  <EvidenceCard
                    key={ev.item.id}
                    evidence={ev}
                    documents={documents}
                    activeCitation={activeCitation}
                    onSelectCitation={setActiveCitation}
                  />
                ))}
              </div>
            )}
          </div>

          <SourcePanel
            documents={data.documents}
            flags={data.subsidy_flags}
            activeCitation={activeCitation}
            isSample={isSample}
            onClear={() => setActiveCitation(null)}
          />
        </div>
      </section>

      <section className="financials" aria-labelledby="financials-title">
        <header className="section-header">
          <h2 id="financials-title" className="section-title">
            Entenda Melhor
          </h2>
          <p className="section-subtitle">Faixa de acordo, risco de condenação e o que mudaria a recomendação.</p>
        </header>

        <div className="decision-row">
          <SettlementCard recommendation={rec} />
          <RiskCard probabilities={data.risk.probabilities} cohortSize={data.risk.cohort_size} />
        </div>

        <div className="changes-row">
          <WhatChangesCard items={rec.what_changes} />
        </div>
      </section>

      <footer className="ws-footer">
        {data.analyzed_at ? `Análise em ${formatDateTime(data.analyzed_at)} · ` : ''}
        {Object.entries(data.versions).map(([k, v]) => `${k} ${v}`).join(' · ')}
      </footer>
    </main>
    {chatOpen && onCloseChat && <ChatPanel data={data} isSample={isSample} onClose={onCloseChat} />}
    </div>
  );
}

function WorkspacePending({ data, isSample }: { data: Workspace; isSample: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = data.analysis_job;
  const running = job?.status === 'QUEUED' || job?.status === 'RUNNING';

  const analyze = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await startAnalysis(data.case.case_id);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <main className="ws ws--state">
      <h1>{running ? 'Analisando o processo…' : 'Processo pronto para análise'}</h1>
      <p>
        {running
          ? `${job?.stage ?? 'PROCESSANDO'} · ${job?.progress_percent ?? 0}%`
          : job?.status === 'FAILED'
            ? job.safe_error ?? 'A análise anterior falhou. Você pode tentar novamente.'
            : 'Os documentos foram recebidos. Inicie a engine para gerar a recomendação rastreável.'}
      </p>
      {!running && !isSample && (
        <button type="button" className="button button--primary" disabled={submitting} onClick={analyze}>
          {submitting ? 'Iniciando…' : job?.status === 'FAILED' ? 'Tentar novamente' : 'Analisar processo'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 3.5h12v7H6.2L3 13.2V10.5H2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
