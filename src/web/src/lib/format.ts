const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatBRL = (value: number) => brl.format(value);
export const formatDate = (iso: string) => date.format(new Date(iso));

const DAY_MS = 86_400_000;

// Dias corridos até o prazo, a partir de hoje (negativo = vencido).
export function daysUntil(iso: string, now = new Date()): number {
  const target = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / DAY_MS);
}
