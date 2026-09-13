import { lazy, Suspense, useMemo, useState } from 'react';
import {
  sampleCaseIds,
  startAnalysis,
  submitClosure,
  submitNegotiation,
  useWorkspace,
} from '../../api/workspace';
import { ChatPanel } from '../../components/ChatPanel';
import { EvidenceCard, KindIcon, type Citation, type Evidence, type EvidenceKind } from '../../components/EvidenceCard';
import { RecommendationCard } from '../../components/RecommendationCard';
import { RiskCard } from '../../components/RiskCard';
import { SettlementCard } from '../../components/SettlementCard';
import { SourcePanel } from '../../components/SourcePanel';
import { WhatChangesCard } from '../../components/WhatChangesCard';
import { buildCitationIndex } from '../../components/documentViewer';
import type { Workspace } from '../../types/workspace';
import { formatBRL, formatDateTime } from './format';
import './workspace.css';

const DocumentViewerPanel = lazy(() => import('../../components/DocumentViewerPanel'));

interface Props {
  caseId: string;
  onSelectSampleCase?: (caseId: string) => void;
  chatOpen?: boolean;
  onOpenChat?: () => void;
  onCloseChat?: () => void;
}

/** Tela 3 · Área de trabalho de um processo. */
export function WorkspacePage({ caseId, onSelectSampleCase, chatOpen = false, onOpenChat, onCloseChat }: Props) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const state = useWorkspace(caseId, refreshVersion);

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
      onAnalysisStarted={() => setRefreshVersion((version) => version + 1)}
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
  onAnalysisStarted,
}: {
  data: Workspace;
  isSample: boolean;
  onSelectSampleCase?: (caseId: string) => void;
  chatOpen: boolean;
  onOpenChat?: () => void;
  onCloseChat?: () => void;
  onAnalysisStarted: () => void;
}) {
  const [tab, setTab] = useState<EvidenceKind>('fato');
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const documents = useMemo(() => new Map(data.documents.map((d) => [d.document_id, d])), [data.documents]);
  const citationsByDocument = useMemo(
    () => buildCitationIndex(
      [...data.facts, ...data.contradictions, ...data.gaps].flatMap((item) => item.sources),
    ),
    [data.contradictions, data.facts, data.gaps],
  );

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
    return <WorkspacePending data={data} isSample={isSample} onAnalysisStarted={onAnalysisStarted} />;
  }

  const { case: c, recommendation: rec } = data;
  const activeDocument = activeCitation ? documents.get(activeCitation.document_id) ?? null : null;
  const sidePanelOpen = chatOpen || Boolean(activeCitation);

  return (
    <div className={`ws-shell${sidePanelOpen ? ' ws-shell--split' : ''}`}>
    <main className={`ws${sidePanelOpen ? ' ws--split' : ''}`}>
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

      <RecommendationCard
        recommendation={rec}
        caseInfo={c}
        decision={data.decision}
        onChanged={onAnalysisStarted}
      />

      <WorkflowActionPanel data={data} onChanged={onAnalysisStarted} />

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
            <button
              type="button"
              className="chatbot-cta"
              onClick={() => {
                setActiveCitation(null);
                onOpenChat();
              }}
            >
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
                    isSample={isSample}
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
            citationsByDocument={citationsByDocument}
            isSample={isSample}
            onSelectCitation={setActiveCitation}
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
    {activeCitation ? (
      <Suspense fallback={<aside className="side-panel side-panel--loading">Carregando visualizador…</aside>}>
        <DocumentViewerPanel
          document={activeDocument}
          citation={activeCitation}
          citations={citationsByDocument.get(activeCitation.document_id) ?? [activeCitation]}
          isSample={isSample}
          returnToChat={chatOpen}
          onClose={() => setActiveCitation(null)}
        />
      </Suspense>
    ) : chatOpen && onCloseChat ? (
      <ChatPanel
        data={data}
        isSample={isSample}
        onSelectCitation={setActiveCitation}
        onClose={onCloseChat}
      />
    ) : null}
    </div>
  );
}

const analysisSteps = [
  { stage: 'INGESTAO', label: 'Organizando documentos e metadados' },
  { stage: 'EXTRACAO', label: 'Extraindo fatos, pedidos e evidências' },
  { stage: 'RISCO', label: 'Calculando o risco judicial' },
  { stage: 'FINANCEIRO', label: 'Comparando acordo e defesa' },
  { stage: 'DECISAO', label: 'Gerando a recomendação jurídica' },
  { stage: 'PERSISTING_RESULT', label: 'Preparando a área de trabalho' },
] as const;

const stageCopy: Record<string, string> = {
  QUEUED: 'Análise recebida. Preparando o processamento',
  RUNNING_ENGINE: 'Preparando modelos e regras da política',
  INGESTAO: analysisSteps[0].label,
  EXTRACAO: analysisSteps[1].label,
  RISCO: analysisSteps[2].label,
  FINANCEIRO: analysisSteps[3].label,
  DECISAO: analysisSteps[4].label,
  CONCLUIDO: analysisSteps[5].label,
  PERSISTING_RESULT: analysisSteps[5].label,
};

function WorkspacePending({
  data,
  isSample,
  onAnalysisStarted,
}: {
  data: Workspace;
  isSample: boolean;
  onAnalysisStarted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [startedJob, setStartedJob] = useState<NonNullable<Workspace['analysis_job']> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = data.analysis_job ?? startedJob;
  const running = job?.status === 'QUEUED' || job?.status === 'RUNNING';

  const analyze = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const newJob = await startAnalysis(data.case.case_id);
      setStartedJob(newJob);
      onAnalysisStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  if (running || submitting) {
    const stage = job?.stage ?? 'QUEUED';
    const progress = job?.progress_percent ?? 0;
    const currentStep = analysisSteps.findIndex((step) => step.stage === stage);
    const activeStep = currentStep >= 0 ? currentStep : stage === 'RUNNING_ENGINE' || stage === 'QUEUED' ? 0 : 5;
    const visibleDocumentCount = progress < 10
      ? 0
      : Math.min(data.documents.length, Math.max(1, Math.ceil(((progress - 10) / 48) * data.documents.length)));

    return (
      <main className="ws ws--analysis" aria-busy="true">
        <section className="analysis-loading" aria-labelledby="analysis-title">
          <div className="analysis-loading__visual" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <circle className="analysis-loading__track" cx="60" cy="60" r="52" pathLength="100" />
              <circle
                className="analysis-loading__progress"
                cx="60"
                cy="60"
                r="52"
                pathLength="100"
                style={{ strokeDashoffset: 100 - progress }}
              />
            </svg>
            <strong>{progress}%</strong>
          </div>

          <div className="analysis-loading__content">
            <span className="analysis-loading__eyebrow">
              <span className="analysis-loading__pulse" /> Análise em andamento
            </span>
            <h1 id="analysis-title">Construindo a estratégia do processo</h1>
            <p className="analysis-loading__stage" aria-live="polite">
              {stageCopy[stage] ?? 'Processando o caso'}
            </p>
            <p className="analysis-loading__context">
              O OCR já foi concluído. Agora a engine cruza os documentos com o histórico e a política econômica.
            </p>

            <div className="analysis-documents" aria-live="polite">
              <div className="analysis-documents__header">
                <span>Documentos processados</span>
                <strong>{visibleDocumentCount}/{data.documents.length}</strong>
              </div>
              <ul>
                {data.documents.slice(0, visibleDocumentCount).map((document) => (
                  <li key={document.document_id}>
                    <span aria-hidden="true">✓</span>
                    <span>{document.filename}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="analysis-loading__bar"
              role="progressbar"
              aria-label="Progresso da análise"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>

            <ol className="analysis-steps" aria-label="Etapas da análise">
              {analysisSteps.map((step, index) => {
                const status = index < activeStep ? 'done' : index === activeStep ? 'active' : 'waiting';
                return (
                  <li key={step.stage} data-status={status}>
                    <span className="analysis-steps__marker">{status === 'done' ? '✓' : index + 1}</span>
                    <span>{step.label}</span>
                    {status === 'active' && <span className="analysis-steps__status">em andamento</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ws ws--state ws--pending">
      <span className="analysis-ready__eyebrow">Documentos preparados</span>
      <h1>Processo pronto para análise</h1>
      <p className="analysis-ready__copy">
        {job?.status === 'FAILED'
          ? job.safe_error ?? 'A análise anterior falhou. Você pode tentar novamente.'
          : 'O OCR e a leitura inicial já foram concluídos. Gere agora uma recomendação rastreável de acordo ou defesa.'}
      </p>
      {!isSample && (
        <button type="button" className="button button--primary" disabled={submitting} onClick={analyze}>
          {job?.status === 'FAILED' ? 'Tentar novamente' : 'Analisar processo'}
        </button>
      )}
      {error && <p className="analysis-ready__error" role="alert">{error}</p>}
    </main>
  );
}

function WorkflowActionPanel({ data, onChanged }: { data: Workspace; onChanged: () => void }) {
  const [finalValue, setFinalValue] = useState(
    data.recommendation?.settlement_range.target.toFixed(2) ?? '',
  );
  const [outcome, setOutcome] = useState<'IMPROCEDENCIA' | 'EXTINCAO' | 'PARCIAL' | 'PROCEDENCIA'>('IMPROCEDENCIA');
  const [defenseCost, setDefenseCost] = useState('');
  const [courtAward, setCourtAward] = useState('');
  const [legalCosts, setLegalCosts] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  if (data.case.status === 'EM_NEGOCIACAO') {
    const value = Number(finalValue.replace(',', '.'));
    return (
      <section className="workflow-action card" aria-labelledby="negotiation-title">
        <div>
          <span className="eyebrow">Etapa humana · negociação</span>
          <h2 id="negotiation-title">Registrar resposta da parte autora</h2>
          <p>A recomendação já foi decidida. Informe agora o resultado real da negociação.</p>
        </div>
        <div className="workflow-action__controls">
          <label>
            Valor final do acordo
            <input
              type="number"
              min="0"
              step="0.01"
              value={finalValue}
              onChange={(event) => setFinalValue(event.target.value)}
            />
          </label>
          <div className="workflow-action__buttons">
            <button
              type="button"
              className="button button--primary"
              disabled={submitting || !Number.isFinite(value)}
              onClick={() => void run(() => submitNegotiation(data.case.case_id, true, value))}
            >
              Acordo aceito
            </button>
            <button
              type="button"
              className="button"
              disabled={submitting}
              onClick={() => void run(() => submitNegotiation(data.case.case_id, false))}
            >
              Acordo recusado
            </button>
          </div>
          {error && <p className="workflow-action__error" role="alert">{error}</p>}
        </div>
      </section>
    );
  }

  if (data.case.status === 'AGUARDANDO_ENCERRAMENTO') {
    const optionalNumber = (value: string) => value ? Number(value.replace(',', '.')) : undefined;
    return (
      <section className="workflow-action card" aria-labelledby="closure-title">
        <div>
          <span className="eyebrow">Etapa humana · encerramento</span>
          <h2 id="closure-title">Registrar desfecho observado</h2>
          <p>Esses valores são eventos posteriores; nunca entram como dados de entrada da recomendação.</p>
        </div>
        <form
          className="workflow-action__form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => submitClosure(data.case.case_id, {
              outcome,
              defense_cost: optionalNumber(defenseCost),
              court_award: optionalNumber(courtAward),
              legal_costs: optionalNumber(legalCosts),
            }));
          }}
        >
          <label>
            Desfecho
            <select value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
              <option value="IMPROCEDENCIA">Improcedência</option>
              <option value="EXTINCAO">Extinção</option>
              <option value="PARCIAL">Parcial procedência</option>
              <option value="PROCEDENCIA">Procedência</option>
            </select>
          </label>
          <label>Custo da defesa<input type="number" min="0" step="0.01" value={defenseCost} onChange={(event) => setDefenseCost(event.target.value)} /></label>
          <label>Condenação<input type="number" min="0" step="0.01" value={courtAward} onChange={(event) => setCourtAward(event.target.value)} /></label>
          <label>Custas jurídicas<input type="number" min="0" step="0.01" value={legalCosts} onChange={(event) => setLegalCosts(event.target.value)} /></label>
          <button type="submit" className="button button--primary" disabled={submitting}>
            {submitting ? 'Registrando…' : 'Encerrar processo'}
          </button>
          {error && <p className="workflow-action__error" role="alert">{error}</p>}
        </form>
      </section>
    );
  }

  if (data.case.status === 'ENCERRADO' && data.outcome) {
    const observedValue = data.outcome.final_value ?? data.outcome.court_award;
    return (
      <section className="workflow-result" aria-label="Desfecho observado">
        <span>Desfecho observado</span>
        <strong>{data.outcome.outcome.replaceAll('_', ' ')}</strong>
        {observedValue != null && <strong>{formatBRL(observedValue)}</strong>}
      </section>
    );
  }

  return null;
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
