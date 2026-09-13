import type { ExtractedCaseData } from '../types/case';
import type { DocumentType } from '../types/workspace';
import { simulateLatency } from './client';
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

// POST /api/cases — cria ou atualiza o rascunho (persistido em localStorage, ver
// api/mocks/draftStore.ts) e devolve o id.
export async function saveCaseDraft(
  id: string | null,
  data: ExtractedCaseData,
  documents: DraftDocument[],
): Promise<{ id: string }> {
  const draftId = id ?? crypto.randomUUID();
  saveDraft(draftId, data, documents);
  return simulateLatency({ id: draftId }, 400);
}

// Recupera os dados de um rascunho pra retomar o cadastro em CaseNew: primeiro tenta um
// DraftRecord persistido; senão cai pros dados básicos do CaseListItem (ex. o rascunho de
// exemplo que nunca passou pelo formulário), preenchendo o resto vazio.
export function resolveDraftFormData(id: string): { data: ExtractedCaseData; documents: DraftDocument[] } | null {
  const draft = getDraft(id);
  if (draft) return { data: draft.data, documents: draft.documents };

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

// POST /api/cases/{id}/analyze — dispara a análise (assíncrona no contrato real; aqui
// só simula o tempo de fila antes de levar o advogado pra Área de trabalho).
export async function analyzeCase(id: string): Promise<{ id: string }> {
  return simulateLatency({ id }, 600);
}
