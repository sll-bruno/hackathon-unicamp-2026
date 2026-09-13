import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkspacePage } from './WorkspacePage';

/**
 * Liga a área de trabalho às rotas: o processo vem da URL e o painel de chat
 * continua abrindo por ?view=chat, como na tela original.
 */
export function WorkspaceRoute({ caseId }: { caseId: string }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const setChatOpen = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('view', 'chat');
    else next.delete('view');
    setParams(next, { replace: true });
  };

  return (
    <WorkspacePage
      key={caseId}
      caseId={caseId}
      chatOpen={params.get('view') === 'chat'}
      onOpenChat={() => setChatOpen(true)}
      onCloseChat={() => setChatOpen(false)}
      onSelectSampleCase={(next) => navigate(`/processos/${next}`)}
    />
  );
}
