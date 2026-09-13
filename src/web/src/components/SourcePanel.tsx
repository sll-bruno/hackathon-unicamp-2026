import type { CaseDocument, SubsidyType } from '../types/workspace';
import type { Citation } from './EvidenceCard';
import { documentFileUrl } from '../api/workspace';
import { documentTypeLabel } from '../pages/Workspace/format';

interface Props {
  documents: CaseDocument[];
  flags: Record<SubsidyType, boolean>;
  activeCitation: Citation | null;
  citationsByDocument: Map<string, Citation[]>;
  isSample: boolean;
  onSelectCitation: (citation: Citation) => void;
  onClear: () => void;
}

const subsidyOrder: SubsidyType[] = [
  'contrato',
  'extrato',
  'comprovante_credito',
  'dossie',
  'demonstrativo_divida',
  'laudo_referenciado',
];

/** Coluna lateral: trecho citado selecionado e inventário dos subsídios. */
export function SourcePanel({
  documents,
  flags,
  activeCitation,
  citationsByDocument,
  isSample,
  onSelectCitation,
  onClear,
}: Props) {
  const activeDoc = activeCitation && documents.find((d) => d.document_id === activeCitation.document_id);
  const activeDocumentUrl =
    activeCitation && !isSample
      ? documentFileUrl(activeCitation.document_id, activeCitation.page)
      : null;

  return (
    <aside className="source-panel" aria-label="Fontes e documentos">
      <section className="card" aria-live="polite">
        <header className="card__header">
          <h2 className="card__title">Trecho citado</h2>
          {activeCitation && (
            <button type="button" className="link-button" onClick={onClear}>
              Limpar
            </button>
          )}
        </header>

        {activeCitation ? (
          <div className="source-view">
            <p className="source-view__doc">
              {activeDoc ? documentTypeLabel[activeDoc.type] : activeCitation.document_id}
              <span>
                Página {activeCitation.page}
                {activeDoc?.pages ? ` de ${activeDoc.pages}` : ''}
              </span>
            </p>
            {activeCitation.excerpts.map((excerpt) => (
              <blockquote key={excerpt} className="source-view__quote">
                {excerpt}
              </blockquote>
            ))}
            {activeDocumentUrl ? (
              <a
                className="button button--secondary"
                href={activeDocumentUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir em nova aba
              </a>
            ) : (
              <p className="source-view__hint">O PDF abre aqui quando a API de documentos estiver conectada.</p>
            )}
          </div>
        ) : (
          <p className="card__empty">Clique em um documento citado para ler o trecho.</p>
        )}
      </section>

      <section className="card">
        <header className="card__header">
          <h2 className="card__title">Subsídios do banco</h2>
          <span className="card__hint">
            {subsidyOrder.filter((s) => flags[s]).length} de {subsidyOrder.length}
          </span>
        </header>
        <ul className="inventory">
          {subsidyOrder.map((type) => {
            const document = documents.find((item) => item.type === type);
            const citations = document ? citationsByDocument.get(document.document_id) ?? [] : [];
            const available = flags[type] && Boolean(document);
            const selected = document?.document_id === activeCitation?.document_id;
            const initialCitation = citations[0] ?? (document
              ? { document_id: document.document_id, page: 1, excerpts: [] }
              : null);

            return (
              <li key={type} className="inventory__item" data-available={available}>
                <button
                  type="button"
                  className="inventory__button"
                  disabled={!available || !initialCitation}
                  aria-pressed={selected}
                  onClick={() => initialCitation && onSelectCitation(initialCitation)}
                >
                  <span className="inventory__mark" aria-hidden="true" />
                  <span className="inventory__label">{documentTypeLabel[type]}</span>
                  <span className="inventory__state">
                    {available
                      ? citations.length > 0
                        ? `${citations.reduce((total, item) => total + item.excerpts.length, 0)} citações`
                        : 'Abrir arquivo'
                      : flags[type]
                        ? 'Arquivo ausente'
                        : 'Indisponível'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
