import type { ExtractedCaseData } from '../types/case';
import type { DocumentType } from '../types/workspace';
import { USE_MOCKS, apiFetch, apiGet, simulateLatency } from './client';
import { type DraftDocument, getDraft, saveDraft } from './mocks/draftStore';
import { mockCases } from './mocks/cases';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Classificação determinística pelo nome do arquivo — sem depender de conteúdo/OCR.
// No pipeline real (docs/architecture_engine.md) isso é `detected_type`, calculado a
// partir do conteúdo do PDF; aqui usamos palavras-chave que já aparecem nos nomes
// padronizados dos documentos (ex.: "02_Contrato_...", "03_Extrato_Bancario...").
const TYPE_KEYWORDS: [DocumentType, string[]][] = [
  ['autos', ['auto']],
  ['contrato', ['contrato']],
  ['extrato', ['extrato']],
  ['comprovante_credito', ['comprovante', 'credito']],
  ['dossie', ['dossie']],
  ['demonstrativo_divida', ['demonstrativo', 'divida', 'evolucao']],
  ['laudo_referenciado', ['laudo']],
];

// Retorna o tipo do documento a partir do nome do arquivo, ou null se não reconhecer
// nenhuma palavra-chave — nesse caso o advogado escolhe o tipo manualmente.
export function classifyDocument(filename: string): DocumentType | null {
  const name = normalize(filename);
  for (const [type, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((k) => name.includes(k))) return type;
  }
  return null;
}

// Dados de exemplo das duas amostras em data/ (mesmos valores de
// pages/Workspace/fixtures/caso01.ts e caso02.ts), casados pelo CNJ no nome do arquivo do auto.
const KNOWN_AUTOS: { cnjDigits: string; data: ExtractedCaseData }[] = [
  {
    cnjDigits: '0801234-56-2024-8-10-0001',
    data: {
      cnj: '0801234-56.2024.8.10.0001',
      uf: 'MA',
      thesis: 'GOLPE',
      claim_value: 20000,
      plaintiff_name: 'Maria das Graças Silva Pereira',
      court: '3ª Vara Cível · São Luís/MA',
      contract_number: '502348719',
    },
  },
  {
    cnjDigits: '0654321-09-2024-8-04-0001',
    data: {
      cnj: '0654321-09.2024.8.04.0001',
      uf: 'AM',
      thesis: 'GOLPE',
      claim_value: 25000,
      plaintiff_name: 'José Raimundo Oliveira Costa',
      court: '5ª Vara Cível · Manaus/AM',
      contract_number: '603827451',
    },
  },
];

// Fallback para qualquer PDF que não seja uma das duas amostras conhecidas.
const FALLBACK_DATA: ExtractedCaseData = {
  cnj: '0000000-00.2024.8.00.0000',
  uf: 'SP',
  thesis: 'GENERICO',
  claim_value: 10000,
  plaintiff_name: '',
  court: '',
  contract_number: '',
};

// Simula o OCR do auto (docs/architecture_engine.md): roda dentro do pipeline de análise
// no contrato real, mas aqui é mockado a partir do nome do arquivo pra fins de demo.
export async function extractFromAuto(file: File): Promise<ExtractedCaseData> {
  const match = KNOWN_AUTOS.find((k) => file.name.includes(k.cnjDigits));
  return simulateLatency(match ? match.data : FALLBACK_DATA, 1000);
}

// POST/PATCH /api/cases — persiste o caso e envia os PDFs na integração real.
// O localStorage fica restrito ao modo mock.
export async function saveCaseDraft(
  id: string | null,
  data: ExtractedCaseData,
  documents: (DraftDocument & { file?: File })[],
): Promise<{ id: string }> {
  if (USE_MOCKS) {
    const draftId = id ?? crypto.randomUUID();
    saveDraft(draftId, data, documents.map(({ type, filename }) => ({ type, filename })));
    return simulateLatency({ id: draftId }, 400);
  }

  const persistedId = id && !getDraft(id) ? id : null;
  const subsidyTypes = TYPE_KEYWORDS.map(([type]) => type).filter((type) => type !== 'autos');
  const payload = {
    cnj: data.cnj,
    uf: data.uf,
    assunto: 'Empréstimo consignado não reconhecido',
    subassunto: data.thesis === 'GOLPE' ? 'Golpe' : 'Genérico',
    valor_causa: data.claim_value,
    plaintiff_name: data.plaintiff_name,
    court: data.court,
    contract_number: data.contract_number,
    subsidy_flags: Object.fromEntries(
      subsidyTypes.map((type) => [type, documents.some((document) => document.type === type)]),
    ),
  };
  const response = await apiFetch(persistedId ? `/api/cases/${encodeURIComponent(persistedId)}` : '/api/cases', {
    method: persistedId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`${persistedId ? 'PATCH' : 'POST'} caso → ${response.status}`);
  const saved = await response.json() as { id: string };

  for (const document of documents) {
    if (!document.file) continue;
    const form = new FormData();
    form.append('type', document.type.toUpperCase());
    form.append('file', document.file);
    const upload = await apiFetch(`/api/cases/${encodeURIComponent(saved.id)}/documents`, {
      method: 'POST',
      body: form,
    });
    if (!upload.ok) throw new Error(`POST documento ${document.filename} → ${upload.status}`);
  }
  return { id: saved.id };
}

// Recupera os dados de um rascunho pra retomar o cadastro em CaseNew: primeiro tenta um
// DraftRecord persistido; senão cai pros dados básicos do CaseListItem (ex. o rascunho de
// exemplo que nunca passou pelo formulário), preenchendo o resto vazio.
export async function resolveDraftFormData(
  id: string,
): Promise<{ data: ExtractedCaseData; documents: DraftDocument[] } | null> {
  const draft = getDraft(id);
  if (draft) return { data: draft.data, documents: draft.documents };

  if (!USE_MOCKS) {
    try {
      const workspace = await apiGet<{
        case: {
          cnj: string;
          uf: string;
          thesis: string;
          claim_value: number;
          plaintiff?: string | null;
          court?: string | null;
          contract_number?: string | null;
        };
        documents: { type: string; filename: string }[];
      }>(`/cases/${encodeURIComponent(id)}/workspace`);
      return {
        data: {
          cnj: workspace.case.cnj,
          uf: workspace.case.uf,
          thesis: /golpe/i.test(workspace.case.thesis) ? 'GOLPE' : 'GENERICO',
          claim_value: workspace.case.claim_value,
          plaintiff_name: workspace.case.plaintiff ?? '',
          court: workspace.case.court ?? '',
          contract_number: workspace.case.contract_number ?? '',
        },
        documents: workspace.documents.map((document) => ({
          type: document.type.toLowerCase() as DocumentType,
          filename: document.filename,
        })),
      };
    } catch {
      return null;
    }
  }

  const item = mockCases.find((c) => c.id === id);
  if (!item) return null;
  return {
    data: {
      cnj: item.cnj,
      uf: item.uf,
      thesis: item.thesis,
      claim_value: item.claim_value,
      plaintiff_name: item.plaintiff_name,
      court: '',
      contract_number: '',
    },
    documents: [],
  };
}

// POST /api/cases/{id}/analyze — dispara a análise real ou simula no modo mock.
export async function analyzeCase(id: string): Promise<{ id: string }> {
  if (USE_MOCKS) return simulateLatency({ id }, 600);
  const response = await apiFetch(`/api/cases/${encodeURIComponent(id)}/analyze`, { method: 'POST' });
  if (!response.ok) throw new Error(`POST análise → ${response.status}`);
  return { id };
}
