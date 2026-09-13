import type { CaseDocument, SubsidyType } from '../types/workspace';
import type { Citation } from './EvidenceCard';
import { documentFileUrl } from '../api/workspace';
import { documentTypeLabel } from '../pages/Workspace/format';

interface Props {
  documents: CaseDocument[];
  flags: Record<SubsidyType, boolean>;
  activeCitation: Citation | null;
  isSample: boolean;
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
export function SourcePanel({ documents, flags, activeCitation, isSample, onClear }: Props) {
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
                Abrir PDF novamente
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
          {subsidyOrder.map((type) => (
            <li key={type} className="inventory__item" data-available={flags[type]}>
              <span className="inventory__mark" aria-hidden="true" />
              <span className="inventory__label">{documentTypeLabel[type]}</span>
              <span className="inventory__state">{flags[type] ? 'Disponível' : 'Indisponível'}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
