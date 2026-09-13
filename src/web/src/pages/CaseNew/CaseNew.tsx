import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { analyzeCase, classifyDocument, extractFromAuto, resolveDraftFormData, saveCaseDraft } from '../../api/caseNew';
import { Button } from '../../components/Button/Button';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { ExtractedCaseData, Thesis } from '../../types/case';
import { DOCUMENT_LABEL, THESIS_LABEL, UF_LIST } from '../../types/labels';
import type { DocumentType } from '../../types/workspace';
import styles from './CaseNew.module.css';

const ALL_TYPES = Object.keys(DOCUMENT_LABEL) as DocumentType[];

const EMPTY_FORM: ExtractedCaseData = {
  cnj: '',
  uf: '',
  thesis: 'GOLPE',
  claim_value: 0,
  plaintiff_name: '',
  court: '',
  contract_number: '',
};

type Saving = 'idle' | 'draft' | 'analyze';

interface UploadedDoc {
  id: string;
  file: File;
  type: DocumentType | null;
}

export default function CaseNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('id');

  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  // Documentos de um rascunho retomado — só temos o nome (não o File original), então
  // aparecem no checklist como já enviados, sem poder ser reabertos/reprocessados.
  const [resumedFilenames, setResumedFilenames] = useState<Partial<Record<DocumentType, string>>>({});
  const [extracting, setExtracting] = useState(false);
  const [form, setForm] = useState<ExtractedCaseData>(EMPTY_FORM);
  const [saving, setSaving] = useState<Saving>('idle');

  useEffect(() => {
    if (!draftId) return;
    const resolved = resolveDraftFormData(draftId);
    if (!resolved) return;
    setForm(resolved.data);
    setResumedFilenames(Object.fromEntries(resolved.documents.map((d) => [d.type, d.filename])));
  }, [draftId]);

  const set = <K extends keyof ExtractedCaseData>(key: K, value: ExtractedCaseData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const runExtraction = async (file: File) => {
    setExtracting(true);
    try {
      setForm(await extractFromAuto(file));
    } finally {
      setExtracting(false);
    }
  };

  // Cada arquivo é classificado pelo nome (docs/architecture_engine.md descreve o
  // equivalente real como `detected_type`, calculado a partir do conteúdo do PDF).
  // Um novo documento substitui qualquer outro já enviado do mesmo tipo.
  const handleFilesAdded = (files: FileList | null) => {
    if (!files) return;
    const added = Array.from(files).map((file) => ({ id: crypto.randomUUID(), file, type: classifyDocument(file.name) }));
    setDocuments((prev) => {
      let next = prev;
      for (const doc of added) {
        if (doc.type) next = next.filter((d) => d.type !== doc.type);
        next = [...next, doc];
      }
      return next;
    });
    const autoDoc = added.find((d) => d.type === 'autos');
    if (autoDoc) void runExtraction(autoDoc.file);
  };

  // Correção manual de um documento não reconhecido (ou classificado errado).
  const setDocType = (id: string, type: DocumentType) => {
    setDocuments((prev) => {
      const withoutSameType = prev.filter((d) => d.type !== type || d.id === id);
      return withoutSameType.map((d) => (d.id === id ? { ...d, type } : d));
    });
    if (type === 'autos') {
      const doc = documents.find((d) => d.id === id);
      if (doc) void runExtraction(doc.file);
    }
  };

  const docByType = (type: DocumentType) => documents.find((d) => d.type === type);
  const unclassified = documents.filter((d) => d.type === null);

  const canAnalyze = Boolean(form.cnj && form.uf && form.claim_value > 0);

  const submit = async (mode: Saving) => {
    setSaving(mode);
    try {
      const docList = ALL_TYPES.flatMap((type) => {
        const uploaded = docByType(type);
        if (uploaded) return [{ type, filename: uploaded.file.name }];
        const resumed = resumedFilenames[type];
        return resumed ? [{ type, filename: resumed }] : [];
      });
      const { id } = await saveCaseDraft(draftId, form, docList);
      if (mode === 'analyze') await analyzeCase(id);
      navigate(`/processos/${id}`);
    } finally {
      setSaving('idle');
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Novo processo" description="Cadastro, envio de documentos e análise." />

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>1. Documentos</h2>
        <p className={styles.hint}>
          Envie os documentos do caso. O tipo de cada arquivo é reconhecido automaticamente.
        </p>
        <label className={styles.fileInput}>
          <input type="file" accept="application/pdf" multiple onChange={(e) => handleFilesAdded(e.target.files)} />
          Selecionar arquivos PDF
        </label>

        <ul className={styles.checklist}>
          {ALL_TYPES.map((type) => {
            const doc = docByType(type);
            const filename = doc?.file.name ?? resumedFilenames[type];
            return (
              <li key={type} className={styles.checklistItem}>
                <span className={filename ? styles.checkOk : styles.checkPending}>{filename ? '✓' : '–'}</span>
                <span className={styles.checklistLabel}>{DOCUMENT_LABEL[type]}</span>
                {filename && <span className={styles.filename}>{filename}</span>}
              </li>
            );
          })}
        </ul>

        {unclassified.length > 0 && (
          <div className={styles.unclassified}>
            <p className={styles.hint}>Não identificamos o tipo destes arquivos — selecione manualmente:</p>
            <ul className={styles.checklist}>
              {unclassified.map((doc) => (
                <li key={doc.id} className={styles.checklistItem}>
                  <span className={styles.checkPending}>?</span>
                  <span className={styles.filename}>{doc.file.name}</span>
                  <select
                    className={styles.typeSelect}
                    defaultValue=""
                    onChange={(e) => setDocType(doc.id, e.target.value as DocumentType)}
                  >
                    <option value="" disabled>
                      Tipo do documento
                    </option>
                    {ALL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DOCUMENT_LABEL[type]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>2. Dados do processo</h2>
        {extracting && <p className={styles.hint}>Extraindo dados do auto…</p>}
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>CNJ</span>
            <input value={form.cnj} onChange={(e) => set('cnj', e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
          </label>
          <label className={styles.field}>
            <span>UF</span>
            <select value={form.uf} onChange={(e) => set('uf', e.target.value)}>
              <option value="" disabled>
                Selecione
              </option>
              {UF_LIST.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Tese</span>
            <select value={form.thesis} onChange={(e) => set('thesis', e.target.value as Thesis)}>
              {(Object.keys(THESIS_LABEL) as Thesis[]).map((t) => (
                <option key={t} value={t}>
                  {THESIS_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Valor da causa</span>
            <input
              type="number"
              min={0}
              value={form.claim_value || ''}
              onChange={(e) => set('claim_value', Number(e.target.value))}
            />
          </label>
          <label className={styles.field}>
            <span>Autor</span>
            <input value={form.plaintiff_name} onChange={(e) => set('plaintiff_name', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Vara / comarca</span>
            <input value={form.court} onChange={(e) => set('court', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Número do contrato</span>
            <input value={form.contract_number} onChange={(e) => set('contract_number', e.target.value)} />
          </label>
        </div>
      </section>

      <div className={styles.actions}>
        <Button variant="secondary" disabled={saving !== 'idle'} onClick={() => submit('draft')}>
          {saving === 'draft' ? 'Salvando…' : 'Salvar rascunho'}
        </Button>
        <Button disabled={!canAnalyze || saving !== 'idle'} onClick={() => submit('analyze')}>
          {saving === 'analyze' ? 'Enviando…' : 'Avaliar'}
        </Button>
      </div>
    </div>
  );
}
