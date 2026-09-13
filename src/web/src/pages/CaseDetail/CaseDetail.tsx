import { useParams } from 'react-router-dom';
import { useCase } from '../../api/cases';
import { sampleCaseIds } from '../../api/workspace';
import { Placeholder } from '../../components/Placeholder/Placeholder';
import CaseDraft from '../CaseDraft/CaseDraft';
import { WorkspaceRoute } from '../Workspace/WorkspaceRoute';

// Área do processo (Tela 3). Rascunho tem tela própria; o resto abre a área de
// trabalho. Os casos de exemplo passam direto para o workspace para evitar uma
// consulta redundante antes de carregar os dados completos.
export default function CaseDetail() {
  const { id = '' } = useParams();
  const { data: item, isLoading } = useCase(id);

  if (sampleCaseIds.includes(id)) return <WorkspaceRoute caseId={id} />;
  if (isLoading) return <Placeholder title="Carregando…" description="Buscando dados do processo." />;
  if (!item) return <Placeholder title="Processo não encontrado" description={`Nenhum processo com id ${id}.`} />;
  if (item.status === 'RASCUNHO') return <CaseDraft item={item} />;
  return <WorkspaceRoute caseId={id} />;
}
