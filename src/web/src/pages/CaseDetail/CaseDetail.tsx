import { useParams } from 'react-router-dom';
import { useCase } from '../../api/cases';
import { Placeholder } from '../../components/Placeholder/Placeholder';
import CaseDraft from '../CaseDraft/CaseDraft';

// Área do processo (Tela 3, casos já analisados) é da Pessoa E; mantemos o placeholder
// pra esse caminho e só assumimos a tela dedicada para RASCUNHO.
export default function CaseDetail() {
  const { id = '' } = useParams();
  const { data: item, isLoading } = useCase(id);

  if (isLoading) return <Placeholder title="Carregando…" description="Buscando dados do processo." />;
  if (!item) return <Placeholder title="Processo não encontrado" description={`Nenhum processo com id ${id}.`} />;
  if (item.status === 'RASCUNHO') return <CaseDraft item={item} />;
  return <Placeholder title="Área do processo" description={`Processo ${id} — responsabilidade da Pessoa E.`} />;
}
