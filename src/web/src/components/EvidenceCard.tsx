import { Fragment } from 'react';
import type { CaseDocument, Contradiction, Fact, FactRelation, Gap, Source } from '../types/workspace';
import { documentTypeLabel, factTypeLabel, relationLabel } from '../pages/Workspace/format';

export type EvidenceKind = 'fato' | 'contradicao' | 'lacuna';

export type Evidence =
  | { kind: 'fato'; item: Fact }
  | { kind: 'contradicao'; item: Contradiction }
  | { kind: 'lacuna'; item: Gap };

/** Trechos de uma mesma página de um documento, agrupados em uma única citação. */
export interface Citation {
  document_id: string;
  page: number;
  excerpts: string[];
}

interface Props {
  evidence: Evidence;
  documents: Map<string, CaseDocument>;
  activeCitation: Citation | null;
  onSelectCitation: (citation: Citation) => void;
}

/** Card de explicabilidade: texto curto em destaque e documentos citados como atalhos. */
export function EvidenceCard({ evidence, documents, activeCitation, onSelectCitation }: Props) {
  const { kind, item } = evidence;

  return (
    <article className="evidence" data-kind={kind}>
      <div className="evidence__main">
        {kind === 'fato' && (
          <div className="evidence__meta">
            <RelationBadge relation={evidence.item.relation} claim={evidence.item.claim} />
            <span className="evidence__category">
              {factTypeLabel[evidence.item.fact_type] ?? 'Categoria não mapeada'}
            </span>
            <WeightBadge weight={evidence.item.weight} version={evidence.item.weights_version} />
          </div>
        )}
        <p className="evidence__text">{item.description}</p>
        {kind === 'lacuna' && <p className="evidence__impact">{evidence.item.impact}</p>}
      </div>

      <CitationChips
        kind={kind}
        citations={groupSources(item.sources)}
        documents={documents}
        activeCitation={activeCitation}
        onSelect={onSelectCitation}
      />
    </article>
  );
}

function groupSources(sources: Source[]): Citation[] {
  const groups = new Map<string, Citation>();
  for (const s of sources) {
    const key = `${s.document_id}#${s.page}`;
    const group = groups.get(key) ?? { document_id: s.document_id, page: s.page, excerpts: [] };
    group.excerpts.push(s.excerpt);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const relationClass: Record<FactRelation, string> = {
  refutes: 'relation--bank',
  supports: 'relation--plaintiff',
  neutral: 'relation--neutral',
};

function RelationBadge({ relation, claim }: { relation: FactRelation; claim?: string }) {
  return (
    <span className={`relation ${relationClass[relation]}`} title={claim ? `Alegação da parte autora: ${claim}` : undefined}>
      {relationLabel[relation]}
    </span>
  );
}

function WeightBadge({ weight, version }: { weight: number | null; version: string }) {
  if (weight === null) {
    return (
      <span className="weight weight--unmapped" title={`Tabela ${version}`}>
        Peso a definir
      </span>
    );
  }
  return (
    <span className="weight" title={`Tabela ${version}`}>
      Peso {weight}
    </span>
  );
}

function CitationChips({
  kind,
  citations,
  documents,
  activeCitation,
  onSelect,
}: {
  kind: EvidenceKind;
  citations: Citation[];
  documents: Map<string, CaseDocument>;
  activeCitation: Citation | null;
  onSelect: (citation: Citation) => void;
}) {
  if (citations.length === 0) {
    return <span className="sources__none">Indisponível no inventário</span>;
  }

  return (
    <div className="sources">
      {citations.map((c, i) => {
        const doc = documents.get(c.document_id);
        const isActive = activeCitation?.document_id === c.document_id && activeCitation.page === c.page;
        return (
          <Fragment key={`${c.document_id}-${c.page}`}>
            {kind === 'contradicao' && i > 0 && (
              <span className="sources__versus" aria-hidden="true">
                ⇄
              </span>
            )}
            <button
              type="button"
              className="source-chip"
              aria-pressed={isActive}
              title={c.excerpts.join('\n')}
              onClick={() => onSelect(c)}
            >
              <DocIcon />
              {doc ? documentTypeLabel[doc.type] : c.document_id} · p. {c.page}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1h4l2.5 2.5V11H3z M7 1v2.5h2.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function KindIcon({ kind }: { kind: EvidenceKind }) {
  if (kind === 'fato') {
    return (
      <svg className="kind-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'contradicao') {
    return (
      <svg className="kind-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 5h10m0 0L9.5 2.5M12 5L9.5 7.5M14 11H4m0 0l2.5-2.5M4 11l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="kind-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2" />
    </svg>
  );
}
