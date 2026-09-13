// Persistência mock dos rascunhos criados em CaseNew — não há backend real, então
// usamos localStorage pra sobreviver a navegações/reloads durante a demo.
import type { ExtractedCaseData } from '../../types/case';
import type { DocumentType } from '../../types/workspace';

const STORAGE_KEY = 'enter.drafts.v1';

export interface DraftDocument {
  type: DocumentType;
  filename: string;
}

export interface DraftRecord {
  id: string;
  data: ExtractedCaseData;
  documents: DraftDocument[];
  created_at: string;
  updated_at: string;
}

function readAll(): DraftRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: DraftRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage indisponível (ex. modo privado) — segue sem persistir.
  }
}

export function listDrafts(): DraftRecord[] {
  return readAll();
}

export function getDraft(id: string): DraftRecord | undefined {
  return readAll().find((d) => d.id === id);
}

export function saveDraft(id: string, data: ExtractedCaseData, documents: DraftDocument[]): DraftRecord {
  const records = readAll();
  const existing = records.find((d) => d.id === id);
  const now = new Date().toISOString();
  const record: DraftRecord = {
    id,
    data,
    documents,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  writeAll([...records.filter((d) => d.id !== id), record]);
  return record;
}
