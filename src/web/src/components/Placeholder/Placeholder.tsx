import { PageHeader } from '../PageHeader/PageHeader';

// Tela ainda não implementada.
export function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <PageHeader title={title} description={description} />
      <div
        style={{
          padding: 'var(--space-12)',
          border: '1px dashed var(--stroke-primary)',
          borderRadius: 'var(--radius-12)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        Em construção
      </div>
    </div>
  );
}
