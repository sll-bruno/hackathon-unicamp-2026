import type { Source } from '../types/workspace';
import type { Citation } from './EvidenceCard';

export function buildCitationIndex(sources: Source[]): Map<string, Citation[]> {
  const byDocument = new Map<string, Map<number, Set<string>>>();

  for (const source of sources) {
    const pages = byDocument.get(source.document_id) ?? new Map<number, Set<string>>();
    const excerpts = pages.get(source.page) ?? new Set<string>();
    if (source.excerpt.trim()) excerpts.add(source.excerpt.trim());
    pages.set(source.page, excerpts);
    byDocument.set(source.document_id, pages);
  }

  return new Map(
    [...byDocument.entries()].map(([documentId, pages]) => [
      documentId,
      [...pages.entries()]
        .sort(([pageA], [pageB]) => pageA - pageB)
        .map(([page, excerpts]) => ({ document_id: documentId, page, excerpts: [...excerpts] })),
    ]),
  );
}

export function renderPdfTextItem(text: string, highlighted: boolean): string {
  const escaped = escapeHtml(text);
  return highlighted ? `<mark class="pdf-text-highlight">${escaped}</mark>` : escaped;
}

export function findHighlightedTextItems(
  items: unknown[],
  excerpts: string[],
): Set<number> {
  const segments: Array<{ index: number; start: number; end: number }> = [];
  const normalizedItems: string[] = [];
  let cursor = 0;

  items.forEach((item, index) => {
    const rawText = typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string'
      ? item.str
      : '';
    const value = normalize(rawText);
    if (!value) return;
    const start = cursor;
    normalizedItems.push(value);
    cursor += value.length;
    segments.push({ index, start, end: cursor });
    cursor += 1;
  });

  const pageText = normalizedItems.join(' ');
  const highlighted = new Set<number>();
  for (const excerpt of excerpts) {
    const normalizedExcerpt = normalize(excerpt);
    const match = findBestMatch(pageText, normalizedExcerpt);
    if (!match) continue;
    for (const segment of segments) {
      if (segment.end > match.start && segment.start < match.end) highlighted.add(segment.index);
    }
  }
  return highlighted;
}

function findBestMatch(pageText: string, excerpt: string): { start: number; end: number } | null {
  if (!excerpt) return null;
  const exactStart = pageText.indexOf(excerpt);
  if (exactStart >= 0) return { start: exactStart, end: exactStart + excerpt.length };

  const tokens = excerpt.split(' ');
  for (let size = Math.min(tokens.length, 12); size >= 5; size -= 1) {
    for (let start = 0; start <= tokens.length - size; start += 1) {
      const phrase = tokens.slice(start, start + size).join(' ');
      const phraseStart = pageText.indexOf(phrase);
      if (phraseStart >= 0) return { start: phraseStart, end: phraseStart + phrase.length };
    }
  }
  return null;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
