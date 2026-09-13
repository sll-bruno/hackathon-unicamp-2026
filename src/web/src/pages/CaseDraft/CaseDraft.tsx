import { useNavigate } from 'react-router-dom';
import { getDraft } from '../../api/mocks/draftStore';
import { StatusBadge } from '../../components/Badges/Badges';
import { Button } from '../../components/Button/Button';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { formatBRL, formatDate } from '../../lib/format';
import type { CaseListItem } from '../../types/case';
import { DOCUMENT_LABEL, THESIS_LABEL } from '../../types/labels';
import styles from './CaseDraft.module.css';

export default function CaseDraft({ item }: { item: CaseListItem }) {
  const navigate = useNavigate();
  const draft = getDraft(item.id);

  return (
    <div className={styles.page}>
      <PageHeader title={item.cnj} description="Processo em rascunho" />
      <StatusBadge status={item.status} />

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Dados do processo</h2>
        <p className={styles.hint}>Este processo ainda não foi submetido para análise da IA.</p>
        <dl className={styles.grid}>
          <div className={styles.field}>
            <dt>UF</dt>
            <dd>{item.uf}</dd>
          </div>
          <div className={styles.field}>
            <dt>Tese</dt>
            <dd>{THESIS_LABEL[item.thesis]}</dd>
          </div>
          <div className={styles.field}>
            <dt>Valor da causa</dt>
            <dd>{formatBRL(item.claim_value)}</dd>
          </div>
          <div className={styles.field}>
            <dt>Autor</dt>
            <dd>{item.plaintiff_name || '—'}</dd>
          </div>
          <div className={styles.field}>
            <dt>Criado em</dt>
            <dd>{formatDate(item.created_at)}</dd>
          </div>
          <div className={styles.field}>
            <dt>Atualizado em</dt>
            <dd>{formatDate(item.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Documentos enviados</h2>
        {draft && draft.documents.length > 0 ? (
          <ul className={styles.docList}>
            {draft.documents.map((doc) => (
              <li key={doc.type} className={styles.docItem}>
                <span className={styles.docType}>{DOCUMENT_LABEL[doc.type]}</span>
                <span className={styles.filename}>{doc.filename}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Nenhum documento enviado ainda.</p>
        )}
      </section>

      <div className={styles.actions}>
        <Button onClick={() => navigate(`/processos/novo?id=${item.id}`)}>Continuar cadastro</Button>
      </div>
    </div>
  );
}
