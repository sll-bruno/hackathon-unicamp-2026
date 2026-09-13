const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlWithCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatBRL = (value: number) => brl.format(value);
export const formatBRLWithCents = (value: number) => brlWithCents.format(value);
export const formatDate = (iso: string) => {
  // Datas civis sem horário não devem recuar um dia em fusos a oeste de UTC.
  const safeIso = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return date.format(new Date(safeIso));
};

// null quando não há dado suficiente para calcular (ver lib/metrics.ts).
export const formatPercent = (value: number | null) => (value === null ? '–' : `${Math.round(value)}%`);
