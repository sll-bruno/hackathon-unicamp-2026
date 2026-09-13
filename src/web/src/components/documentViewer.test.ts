import { describe, expect, it } from 'vitest';
import { buildCitationIndex, findHighlightedTextItems, renderPdfTextItem } from './documentViewer';

describe('document viewer citations', () => {
  it('groups and deduplicates excerpts by document and page', () => {
    const index = buildCitationIndex([
      { document_id: 'doc-1', page: 2, excerpt: 'Trecho B' },
      { document_id: 'doc-1', page: 1, excerpt: 'Trecho A' },
      { document_id: 'doc-1', page: 1, excerpt: 'Trecho A' },
      { document_id: 'doc-2', page: 3, excerpt: 'Trecho C' },
    ]);

    expect(index.get('doc-1')).toEqual([
      { document_id: 'doc-1', page: 1, excerpts: ['Trecho A'] },
      { document_id: 'doc-1', page: 2, excerpts: ['Trecho B'] },
    ]);
    expect(index.get('doc-2')?.[0]?.page).toBe(3);
  });

  it('locates the exact citation without marking repeated words elsewhere', () => {
    const items = [
      { str: 'BANCO UFMG S.A.' },
      { str: 'O valor líquido liberado será creditado em conta de titularidade do TOMADOR,' },
      { str: 'junto ao Banco UFMG S.A., agência 0001, na data prevista de 12/05/2022.' },
    ];
    const highlighted = findHighlightedTextItems(items, [
      'O valor líquido liberado será creditado em conta de titularidade do TOMADOR, junto ao Banco UFMG S.A., agência 0001, na data prevista de 12/05/2022.',
    ]);

    expect([...highlighted]).toEqual([1, 2]);
  });

  it('escapes unsafe PDF text before wrapping a highlighted item', () => {
    const rendered = renderPdfTextItem('<script>alert(1)</script>', true);
    expect(rendered).toContain('<mark class="pdf-text-highlight">');
    expect(rendered).not.toContain('<script>');
  });
});
