import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { documentFileUrl } from '../api/workspace';
import { documentTypeLabel } from '../pages/Workspace/format';
import type { CaseDocument } from '../types/workspace';
import type { Citation } from './EvidenceCard';
import { findHighlightedTextItems, renderPdfTextItem } from './documentViewer';
import './document-viewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  document: CaseDocument | null;
  citation: Citation;
  citations: Citation[];
  isSample: boolean;
  returnToChat: boolean;
  onClose: () => void;
}

export default function DocumentViewerPanel({
  document,
  citation,
  citations,
  isSample,
  returnToChat,
  onClose,
}: Props) {
  const [pageNumber, setPageNumber] = useState(citation.page);
  const [numPages, setNumPages] = useState(document?.pages ?? 1);
  const [pageWidth, setPageWidth] = useState(520);
  const [highlightedTextItems, setHighlightedTextItems] = useState<Set<number>>(() => new Set());
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageNumber(citation.page);
  }, [citation.document_id, citation.page]);

  useEffect(() => {
    setHighlightedTextItems(new Set());
  }, [citation.document_id, pageNumber]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateWidth = () => setPageWidth(Math.max(280, Math.min(760, stage.clientWidth - 32)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const citedPages = useMemo(
    () => [...new Set(citations.map((item) => item.page))].sort((a, b) => a - b),
    [citations],
  );
  const pageExcerpts = useMemo(
    () => citations.filter((item) => item.page === pageNumber).flatMap((item) => item.excerpts),
    [citations, pageNumber],
  );
  const renderText = useCallback(
    ({ str, itemIndex }: { str: string; itemIndex: number }) => renderPdfTextItem(str, highlightedTextItems.has(itemIndex)),
    [highlightedTextItems],
  );
  const captureTextItems = useCallback(
    ({ items }: { items: unknown[] }) => {
      const next = findHighlightedTextItems(items, pageExcerpts);
      setHighlightedTextItems((current) => {
        const currentKey = [...current].join(',');
        const nextKey = [...next].join(',');
        return currentKey === nextKey ? current : next;
      });
    },
    [pageExcerpts],
  );
  const fileUrl = document && !isSample ? documentFileUrl(document.document_id) : null;

  return (
    <aside className="document-viewer side-panel" aria-label="Visualizador do documento">
      <header className="document-viewer__header">
        <div className="document-viewer__heading">
          <span className="eyebrow">Documento da evidência</span>
          <h2 className="document-viewer__title">
            {document ? documentTypeLabel[document.type] : citation.document_id}
          </h2>
          {document?.filename && <span className="document-viewer__filename">{document.filename}</span>}
        </div>
        <button type="button" className="document-viewer__close" onClick={onClose} aria-label={returnToChat ? 'Voltar ao chatbot' : 'Fechar documento'}>
          <CloseIcon />
        </button>
      </header>

      <div className="document-viewer__toolbar">
        <div className="document-viewer__pagination" aria-label="Navegação de páginas">
          <button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber <= 1} aria-label="Página anterior">
            <ChevronIcon direction="left" />
          </button>
          <span>Página {pageNumber} de {numPages}</span>
          <button type="button" onClick={() => setPageNumber((page) => Math.min(numPages, page + 1))} disabled={pageNumber >= numPages} aria-label="Próxima página">
            <ChevronIcon direction="right" />
          </button>
        </div>
        {fileUrl && (
          <a href={`${fileUrl}#page=${pageNumber}`} target="_blank" rel="noreferrer" className="document-viewer__external">
            Abrir em nova aba
          </a>
        )}
      </div>

      {citedPages.length > 0 && (
        <nav className="document-viewer__references" aria-label="Páginas citadas pelo argumentador">
          <span>Trechos citados</span>
          <div>
            {citedPages.map((page) => (
              <button key={page} type="button" aria-pressed={page === pageNumber} onClick={() => setPageNumber(page)}>
                p. {page}
              </button>
            ))}
          </div>
        </nav>
      )}

      <div className="document-viewer__stage" ref={stageRef}>
        {fileUrl ? (
          <Document
            file={fileUrl}
            loading={<ViewerStatus>Carregando documento…</ViewerStatus>}
            error={<ViewerStatus>Não foi possível carregar o PDF. Use “Abrir em nova aba”.</ViewerStatus>}
            onLoadSuccess={({ numPages: loadedPages }) => {
              setNumPages(loadedPages);
              setPageNumber((page) => Math.min(page, loadedPages));
            }}
          >
            <Page
              key={`${citation.document_id}-${pageNumber}`}
              pageNumber={pageNumber}
              width={pageWidth}
              renderAnnotationLayer={false}
              renderTextLayer
              customTextRenderer={renderText}
              onGetTextSuccess={captureTextItems}
              loading={<ViewerStatus>Renderizando página…</ViewerStatus>}
            />
          </Document>
        ) : (
          <ViewerStatus>O arquivo real fica disponível nos processos carregados pela API.</ViewerStatus>
        )}
      </div>

      <footer className="document-viewer__evidence" aria-live="polite">
        <span className="document-viewer__marker" aria-hidden="true" />
        <div>
          <strong>
            {pageExcerpts.length > 0
              ? `${pageExcerpts.length} trecho${pageExcerpts.length === 1 ? '' : 's'} citado${pageExcerpts.length === 1 ? '' : 's'}${highlightedTextItems.size > 0 ? ' · destaque localizado' : ''}`
              : 'Página sem trecho citado'}
          </strong>
          {pageExcerpts.map((excerpt) => <blockquote key={excerpt}>{excerpt}</blockquote>)}
        </div>
      </footer>
    </aside>
  );
}

function ViewerStatus({ children }: { children: string }) {
  return <p className="document-viewer__status">{children}</p>;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d={direction === 'left' ? 'M7.5 2.5 4 6l3.5 3.5' : 'M4.5 2.5 8 6 4.5 9.5'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
