/** Condições que mudariam a ação recomendada. Prioridade visual menor que a decisão. */
export function WhatChangesCard({ items }: { items: string[] }) {
  return (
    <section className="card card--secondary" aria-labelledby="changes-title">
      <h2 id="changes-title" className="eyebrow">
        O que mudaria a decisão
      </h2>
      <ol className="change-list change-list--compact">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
